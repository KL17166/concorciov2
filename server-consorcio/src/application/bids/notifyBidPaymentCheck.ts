import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { maskCpf } from '../../services/kycStorageService';

export interface NotifyBidPaymentCheckInput {
    bidId: string;
    requesterUserId: string;
}

// Anti-spam: não cria outro alerta para o mesmo lance dentro da janela
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Registra que o cliente clicou em "Já paguei" no PIX do lance.
 * Espelho do notifyPaymentCheck (adesão): gera SystemAlert p/ o admin
 * conferir o recebimento (Eldorado = baixa manual) + rastro em tracking.
 */
export async function notifyBidPaymentCheck(input: NotifyBidPaymentCheckInput): Promise<{ notified: boolean }> {
    const { bidId, requesterUserId } = input;

    const bid: any = await prisma.bid.findUnique({
        where: { id: bidId },
        include: {
            subscription: {
                select: {
                    id: true, userId: true, groupNumber: true, quotaNumber: true,
                    user: { select: { id: true, name: true, cpf: true, email: true } }
                }
            }
        }
    });

    if (!bid) {
        throw Object.assign(new Error('Lance não encontrado'), { statusCode: 404 });
    }

    if (bid.subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await (prisma as any).systemAlert.findFirst({
        where: {
            type: 'BID_PAYMENT_CHECK',
            createdAt: { gte: since },
            details: { contains: bidId }
        },
        select: { id: true }
    });

    if (recent) {
        return { notified: false };
    }

    const payment = await prisma.bidPayment.findFirst({
        where: { bidId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
    });

    const user = bid.subscription.user || {};
    const bidTypeLabel = (bid as any).type === 'FIXED' ? 'Lance Fixo' : (bid as any).type === 'EMBEDDED' ? 'Lance Embutido' : 'Lance Livre';
    // PII minimizada no título/mensagem (CPF mascarado — LGPD); completo só em details.
    const title = `Cliente verificou pagamento de lance — ${bidTypeLabel}`;
    const message = `${user.name || 'Cliente'} (${maskCpf(user.cpf || '')}) clicou em "Já paguei" — ${bidTypeLabel} de R$ ${Number(bid.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no lance ${bidId} (contrato ${bid.subscription.id}, grupo ${bid.subscription.groupNumber || '—'}/cota ${bid.subscription.quotaNumber || '—'}). Confira o recebimento e confirme em Lances → Pagamentos.`;

    logger.warn(`[BidPaymentCheck] ${message}`);

    await (prisma as any).systemAlert.create({
        data: {
            type: 'BID_PAYMENT_CHECK',
            severity: 'INFO',
            title,
            message,
            status: 'OPEN',
            entityKind: 'bidPayment',
            entityId: payment?.id || null,
            details: JSON.stringify({
                bidId,
                bidPaymentId: payment?.id || null,
                provider: payment?.provider || null,
                amount: payment ? Number(payment.amount) : Number(bid.amount),
                bidType: (bid as any).type || null,
                bidTypeLabel,
                bidStatus: (bid as any).status || null,
                kind: 'LANCE',
                kindLabel: bidTypeLabel,
                subscriptionId: bid.subscription.id,
                customerId: user.id || requesterUserId,
                customerName: user.name || null,
                customerCpf: user.cpf || null,
                customerEmail: user.email || null
            })
        }
    });

    return { notified: true };
}
