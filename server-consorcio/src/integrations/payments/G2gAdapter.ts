import { PaymentGateway, PaymentMethod, PaymentRequest, PaymentResult } from './PaymentGateway';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { checkLimits, recordSuccess, withSlot, loadLimitConfig } from './ExternalGatewayLimits';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8766';
const REQUEST_TIMEOUT_MS = 300_000; // fluxo completo (pedido + PIX) pode levar minutos

/**
 * G2G (fluxo PIX via Pipwave/Tazapay, serviço local g2g).
 * Gera um PIX copia-e-cola no valor da parcela e marca a parcela como
 * aguardando aprovação manual — a baixa é feita pelo admin após
 * conferir o recebimento, como no Sandbox.
 */
export class G2gAdapter implements PaymentGateway {
    readonly name = 'g2g';
    private baseUrl: string;
    private token: string;

    constructor(config?: { baseUrl?: string | null; apiKey?: string | null }) {
        const base = (config?.baseUrl || process.env.G2G_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.baseUrl = base;
        this.token = config?.apiKey || process.env.G2G_API_TOKEN || '';
    }

    supports(method: PaymentMethod): boolean {
        return method === 'PIX';
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResult> {
        if (request.method !== 'PIX') {
            throw new Error('G2G suporta apenas pagamentos via PIX');
        }

        const characterName = process.env.G2G_CHARACTER_NAME || '';
        if (!characterName) {
            throw Object.assign(
                new Error('G2G sem CHARACTER_NAME configurado (env G2G_CHARACTER_NAME). Avise o administrador.'),
                { statusCode: 503, code: 'GATEWAY_UNAVAILABLE' }
            );
        }

        const limits = loadLimitConfig('G2G');
        checkLimits(this.name, request.amount, limits);

        const cpf = (request.customer.document || '').replace(/\D/g, '');
        if (cpf.length !== 11) {
            throw Object.assign(new Error('CPF do cliente inválido para gerar PIX na G2G.'), { statusCode: 400 });
        }

        return withSlot(this.name, limits, async () => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

            let res: Response;
            try {
                res = await fetch(`${this.baseUrl}/api/pay/pix-direct`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.token ? { 'X-Gateway-Token': this.token } : {})
                    },
                    body: JSON.stringify({
                        amount: Number(request.amount.toFixed(2)),
                        cpf,
                        characterName
                    }),
                    signal: ctrl.signal
                });
            } catch (err: any) {
                if (err?.name === 'AbortError') {
                    throw Object.assign(new Error('G2G demorou demais a responder (timeout).'), { statusCode: 504, code: 'GATEWAY_TIMEOUT' });
                }
                throw Object.assign(new Error(`G2G fora do ar (${this.baseUrl}): ${err?.message || err}`), { statusCode: 502, code: 'GATEWAY_UNAVAILABLE' });
            } finally {
                clearTimeout(timer);
            }

            let data: any = null;
            try {
                data = await res.json();
            } catch {
                throw Object.assign(new Error(`G2G respondeu de forma inválida (HTTP ${res.status}).`), { statusCode: 502, code: 'GATEWAY_BAD_RESPONSE' });
            }

            if (res.status === 401) {
                throw Object.assign(new Error('G2G: token inválido ou sessão expirada. Avise o administrador.'), { statusCode: 502, code: 'GATEWAY_AUTH' });
            }
            if (res.status === 429) {
                throw Object.assign(new Error('G2G em limite de uso. Tentando próxima gateway...'), { statusCode: 429, code: 'GATEWAY_RATE_LIMITED' });
            }
            if (!res.ok || !data?.success || !data?.brCode) {
                const detail = data?.error || `HTTP ${res.status}`;
                throw Object.assign(new Error(`G2G não gerou o PIX: ${detail}`), { statusCode: 502, code: 'GATEWAY_ERROR' });
            }

            const brCode: string = data.brCode;
            if (!brCode.startsWith('000201')) {
                throw Object.assign(new Error('G2G devolveu um código PIX inválido.'), { statusCode: 502, code: 'GATEWAY_BAD_RESPONSE' });
            }

            // Parcela aguarda baixa manual do admin (o valor cai na conta da operação)
            try {
                await prisma.installment.update({
                    where: { id: request.installmentId },
                    data: { paymentMethod: 'G2G_WAITING_APPROVAL' }
                });
            } catch (err) {
                logger.error('[G2G] Erro ao marcar parcela como aguardando aprovação:', err);
            }

            recordSuccess(this.name, request.amount);

            logger.info(`[G2G] PIX gerado parcela ${request.installmentId} R$ ${request.amount} order=${data.orderId || '?'}`);

            return {
                provider: 'g2g',
                paymentId: data.orderId || data.paymentAttemptId || `g2g-${Date.now()}`,
                qrCode: null, // o failover monta o QR a partir do copia-e-cola
                copyPaste: brCode,
                amount: typeof data.total === 'number' ? data.total : request.amount,
                expirationDate: data.pixExpiryDate || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                message: 'PIX gerado via G2G. Após pagar, o admin confirma a baixa em até alguns minutos.',
                isManualApproval: true
            } as PaymentResult;
        });
    }
}
