import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface CreateTicketInput {
    userId: string;
    subscriptionId?: string;
    type?: string;
    subject: string;
    message: string;
}

/**
 * Abre um ticket de suporte (ex: pedido de cancelamento de contrato ativo).
 * Dedupe: não abre outro ticket OPEN para a mesma assinatura em 24h.
 */
export async function createTicket(input: CreateTicketInput) {
    const { userId, subscriptionId, type, subject, message } = input;

    if (!subject?.trim() || !message?.trim()) {
        throw Object.assign(new Error('Assunto e mensagem são obrigatórios'), { statusCode: 400 });
    }

    let subscription: any = null;
    if (subscriptionId) {
        subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { user: { select: { id: true, name: true, cpf: true } } }
        });
        if (!subscription) {
            throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
        }
        if (subscription.userId !== userId) {
            throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dupe = await (prisma as any).supportTicket.findFirst({
            where: { subscriptionId, status: { in: ['OPEN', 'IN_PROGRESS'] }, createdAt: { gte: since } },
            select: { id: true }
        });
        if (dupe) {
            throw Object.assign(new Error('Você já tem um atendimento aberto para este contrato. Aguarde o retorno.'), { statusCode: 400 });
        }
    }

    const ticket = await (prisma as any).supportTicket.create({
        data: {
            userId,
            subscriptionId: subscriptionId || null,
            type: type || 'CANCELLATION',
            subject: subject.trim().slice(0, 120),
            message: message.trim().slice(0, 2000),
            status: 'OPEN'
        }
    });

    logger.warn(`[Ticket] Novo ticket ${ticket.id} (${ticket.type}) de ${userId} contrato=${subscriptionId || '-'}`);

    return ticket;
}

export async function listUserTickets(userId: string) {
    return (prisma as any).supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}
