import { PaymentGateway, PaymentMethod, PaymentRequest, PaymentResult } from './PaymentGateway';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { checkLimits, recordSuccess, withSlot, loadLimitConfig } from './ExternalGatewayLimits';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8765';
const REQUEST_TIMEOUT_MS = 150_000;

/**
 * Eldorado.gg (fluxo PIX automatizado, serviço local eldoradov2).
 * Gera um PIX copia-e-cola no valor aproximado da parcela (modo budget)
 * e marca a parcela como aguardando aprovação manual — a baixa é feita
 * pelo admin após conferir o recebimento, como no Sandbox.
 */
export class EldoradoAdapter implements PaymentGateway {
    readonly name = 'eldorado';
    private baseUrl: string;
    private token: string;

    constructor(config?: { baseUrl?: string | null; apiKey?: string | null }) {
        const base = (config?.baseUrl || process.env.ELDORADO_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.baseUrl = base;
        this.token = config?.apiKey || process.env.ELDORADO_API_TOKEN || '';
    }

    supports(method: PaymentMethod): boolean {
        return method === 'PIX';
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResult> {
        if (request.method !== 'PIX') {
            throw new Error('Eldorado suporta apenas pagamentos via PIX');
        }

        const limits = loadLimitConfig('ELDORADO');
        checkLimits(this.name, request.amount, limits);

        const cpf = (request.customer.document || '').replace(/\D/g, '');
        if (cpf.length !== 11) {
            throw Object.assign(new Error('CPF do cliente inválido para gerar PIX na Eldorado.'), { statusCode: 400 });
        }

        return withSlot(this.name, limits, async () => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

            let res: Response;
            try {
                res = await fetch(`${this.baseUrl}/pix`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.token ? { 'X-Gateway-Token': this.token } : {})
                    },
                    body: JSON.stringify({
                        cpf,
                        budget: Number(request.amount.toFixed(2)),
                        auto_seller: true,
                        max_delivery_min: 20,
                        min_rating: 90
                    }),
                    signal: ctrl.signal
                });
            } catch (err: any) {
                if (err?.name === 'AbortError') {
                    throw Object.assign(new Error('Eldorado demorou demais a responder (timeout).'), { statusCode: 504, code: 'GATEWAY_TIMEOUT' });
                }
                throw Object.assign(new Error(`Eldorado fora do ar (${this.baseUrl}): ${err?.message || err}`), { statusCode: 502, code: 'GATEWAY_UNAVAILABLE' });
            } finally {
                clearTimeout(timer);
            }

            let data: any = null;
            try {
                data = await res.json();
            } catch {
                throw Object.assign(new Error(`Eldorado respondeu de forma inválida (HTTP ${res.status}).`), { statusCode: 502, code: 'GATEWAY_BAD_RESPONSE' });
            }

            if (res.status === 401) {
                throw Object.assign(new Error('Eldorado: token inválido ou sessão expirada. Avise o administrador.'), { statusCode: 502, code: 'GATEWAY_AUTH' });
            }
            if (res.status === 429) {
                throw Object.assign(new Error('Eldorado em limite de uso. Tentando próxima gateway...'), { statusCode: 429, code: 'GATEWAY_RATE_LIMITED' });
            }
            if (!res.ok || !data?.ok || !data?.pix_code) {
                const detail = data?.error || data?.detail || `HTTP ${res.status}`;
                const stage = data?.stage ? ` (etapa: ${data.stage})` : '';
                throw Object.assign(new Error(`Eldorado não gerou o PIX: ${detail}${stage}`), { statusCode: 502, code: 'GATEWAY_ERROR' });
            }

            const pixCode: string = data.pix_code;
            if (!pixCode.startsWith('000201')) {
                throw Object.assign(new Error('Eldorado devolveu um código PIX inválido.'), { statusCode: 502, code: 'GATEWAY_BAD_RESPONSE' });
            }

            // Parcela aguarda baixa manual do admin (o valor cai na conta da operação)
            try {
                await prisma.installment.update({
                    where: { id: request.installmentId },
                    data: { paymentMethod: 'ELDORADO_WAITING_APPROVAL' }
                });
            } catch (err) {
                logger.error('[Eldorado] Erro ao marcar parcela como aguardando aprovação:', err);
            }

            recordSuccess(this.name, request.amount);

            const parsedExpiry = data.expires_at ? Date.parse(data.expires_at) : NaN;
            const expirationDate = !isNaN(parsedExpiry)
                ? new Date(parsedExpiry).toISOString()
                : new Date(Date.now() + 10 * 60 * 1000).toISOString(); // voucher Eldorado expira em ~10min

            logger.info(`[Eldorado] PIX gerado parcela ${request.installmentId} R$ ${request.amount} payment=${data.payment_id || '?'}`);

            return {
                provider: 'eldorado',
                paymentId: data.payment_id || data.voucher_id || `eldorado-${Date.now()}`,
                qrCode: null, // o failover monta o QR a partir do copia-e-cola
                copyPaste: pixCode,
                amount: typeof data.total === 'number' ? data.total : request.amount,
                expirationDate,
                message: 'PIX gerado via Eldorado. Após pagar, o admin confirma a baixa em até alguns minutos.',
                isManualApproval: true
            } as PaymentResult;
        });
    }
}
