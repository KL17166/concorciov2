import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface NotifyPaymentCheckInput {
    subscriptionId: string;
    requesterUserId: string;
}

// Anti-spam: não cria outro alerta para a mesma assinatura dentro da janela
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Registra que o cliente clicou em "Verificar Pagamento".
 * Gera um SystemAlert (visível no dashboard admin) para o dev saber
 * que o cliente afirma ter pago e conferir a baixa manual.
 */
export async function notifyPaymentCheck(input: NotifyPaymentCheckInput): Promise<{ notified: boolean }> {
    const { subscriptionId, requesterUserId } = input;

    const subscription: any = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: { select: { id: true, name: true, cpf: true, email: true } } }
    });

    if (!subscription) {
        throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    if (subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await (prisma as any).systemAlert.findFirst({
        where: {
            type: 'PAYMENT_CHECK',
            createdAt: { gte: since },
            details: { contains: subscriptionId }
        },
        select: { id: true }
    });

    if (recent) {
        return { notified: false };
    }

    const user = subscription.user || {};
    const title = 'Cliente verificou pagamento';
    const message = `${user.name || 'Cliente'} (CPF: ${user.cpf || '—'}) clicou em "Verificar Pagamento" no contrato ${subscriptionId} (grupo ${subscription.groupNumber || '—'}/cota ${subscription.quotaNumber || '—'}). Confira o recebimento e dê a baixa manual.`;

    logger.warn(`[PaymentCheck] ${message}`);

    await (prisma as any).systemAlert.create({
        data: {
            type: 'PAYMENT_CHECK',
            severity: 'INFO',
            title,
            message,
            details: JSON.stringify({
                subscriptionId,
                customerId: user.id || requesterUserId,
                customerName: user.name || null,
                customerCpf: user.cpf || null,
                customerEmail: user.email || null,
                groupNumber: subscription.groupNumber || null,
                quotaNumber: subscription.quotaNumber || null,
                status: subscription.status || null
            })
        }
    });

    return { notified: true };
}
