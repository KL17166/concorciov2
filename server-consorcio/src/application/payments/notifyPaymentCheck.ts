import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { maskCpf } from '../../services/kycStorageService';

export interface NotifyPaymentCheckInput {
    subscriptionId: string;
    requesterUserId: string;
    /** Parcela exata que o cliente afirma ter pago (o app sempre sabe — adesão, atual ou antecipada). */
    installmentId?: string;
    /** Lote: N parcelas verificadas de uma vez (1 PIX combinado). */
    installmentIds?: string[];
    /** Lote do PIX combinado — usa valores/total do lote (com desconto de antecipação). */
    batchId?: string;
}

// Anti-spam: não cria outro alerta para a mesma assinatura dentro da janela
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Registra que o cliente clicou em "Verificar Pagamento".
 * Gera um SystemAlert (visível no dashboard admin) para o dev saber
 * que o cliente afirma ter pago e conferir a baixa manual.
 */
export async function notifyPaymentCheck(input: NotifyPaymentCheckInput): Promise<{ notified: boolean }> {
    const { subscriptionId, requesterUserId, installmentIds } = input;
    const installmentId = input.installmentId || (installmentIds && installmentIds[0]);
    const multiIds = [...new Set([...(installmentIds || []), ...(installmentId ? [installmentId] : [])])];

    const subscription: any = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
            user: { select: { id: true, name: true, cpf: true, email: true } },
            plan: { include: { product: { select: { id: true, name: true } } } },
            installments: {
                where: { status: { in: ['PENDING', 'OVERDUE'] } },
                orderBy: { number: 'asc' },
                take: 3,
                select: { id: true, number: true, amount: true, status: true, dueDate: true, paymentMethod: true }
            }
        }
    });

    if (!subscription) {
        throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    if (subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const user = subscription.user || {};
    const open = (subscription.installments || []) as any[];
    // Parcelas exatas quando o app informa (1 ou N — cobre antecipação);
    // senão, a primeira em aberto (caso da adesão).
    let currents: any[] = open[0] ? [open[0]] : [];
    let exact = false;
    let batchTotal: number | null = null;
    let batchProvider: string | null = null;
    if (input.batchId) {
        const batch = await (prisma as any).paymentBatch.findUnique({ where: { id: input.batchId } });
        if (!batch || batch.subscriptionId !== subscriptionId) {
            throw Object.assign(new Error('Cobrança não pertence a este contrato'), { statusCode: 403 });
        }
        const ids: string[] = JSON.parse(batch.installmentIds || '[]');
        const claimed = await prisma.installment.findMany({ where: { id: { in: ids } } });
        currents = claimed.sort((a: any, b: any) => a.number - b.number);
        exact = true;
        batchTotal = Number(batch.totalAmount);
        batchProvider = batch.provider;
    } else if (multiIds.length > 0) {
        const claimed = await prisma.installment.findMany({ where: { id: { in: multiIds } } });
        if (claimed.length !== multiIds.length || claimed.some((c: any) => c.subscriptionId !== subscriptionId)) {
            throw Object.assign(new Error('Parcela não pertence a este contrato'), { statusCode: 403 });
        }
        currents = claimed.sort((a: any, b: any) => a.number - b.number);
        exact = true;
    } else if (installmentId) {
        const claimed = await prisma.installment.findUnique({ where: { id: installmentId } });
        if (!claimed || claimed.subscriptionId !== subscriptionId) {
            throw Object.assign(new Error('Parcela não pertence a este contrato'), { statusCode: 403 });
        }
        currents = [claimed];
        exact = true;
    }
    // Anti-spam POR CONJUNTO: mesmo conjunto em 5min suprime; conjunto diferente gera novo pedido.
    const dedupeKey = currents.length > 0 ? currents.map((c: any) => c.id).sort().join('+') : subscriptionId;
    const recent = await (prisma as any).systemAlert.findFirst({
        where: {
            type: 'PAYMENT_CHECK',
            createdAt: { gte: since },
            details: { contains: dedupeKey }
        },
        select: { id: true }
    });

    if (recent) {
        return { notified: false };
    }

    const current = currents[0] || null;
    const hasAdesao = currents.some((c: any) => c.number === 1);
    const firstOpenNumber = open[0]?.number;
    const anticipated = currents.filter((c: any) => firstOpenNumber != null && c.number > firstOpenNumber);
    const hasAntecipacao = anticipated.length > 0;
    const kindLabel = currents.length === 0 ? 'Contrato'
        : currents.length === 1
            ? (currents[0].number === 1 ? 'Adesão' : `Parcela ${currents[0].number}`)
            : describeMulti(currents);
    const totalAmount = batchTotal ?? currents.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const amountLabel = currents.length > 0 ? `R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null;
    const title = `Cliente verificou pagamento — ${kindLabel}${hasAntecipacao ? ' (com antecipação)' : ''}`;
    // PII minimizada no título/mensagem (CPF mascarado — LGPD); completo só em details.
    const message = `${user.name || 'Cliente'} (${maskCpf(user.cpf || '')}) clicou em "Verificar Pagamento" — ${kindLabel}${hasAntecipacao ? ' (com antecipação)' : ''}${amountLabel ? ` de ${amountLabel}` : ''} no contrato ${subscriptionId} (grupo ${subscription.groupNumber || '—'}/cota ${subscription.quotaNumber || '—'}). Confira o recebimento e dê a baixa manual.`;

    logger.warn(`[PaymentCheck] ${message}`);

    // Última tentativa de pagamento (gateway/método que gerou o PIX da 1ª parcela do pedido)
    let attempt: any = null;
    try {
        attempt = current ? await prisma.paymentAttempt.findFirst({
            where: { installmentId: current.id },
            orderBy: { createdAt: 'desc' },
            select: { provider: true, status: true, amount: true }
        }) : null;
    } catch { /* tabela pode não existir em ambientes antigos */ }

    const items = currents.map((c: any) => ({
        installmentId: c.id,
        number: c.number,
        amount: Number(c.amount),
        status: c.status,
        dueDate: c.dueDate || null,
        anticipated: firstOpenNumber != null && c.number > firstOpenNumber
    }));

    await (prisma as any).systemAlert.create({
        data: {
            type: 'PAYMENT_CHECK',
            severity: currents.some((c: any) => c.status === 'OVERDUE') ? 'WARNING' : 'INFO',
            title,
            message,
            status: 'OPEN',
            entityKind: 'subscription',
            entityId: subscriptionId,
            details: JSON.stringify({
                subscriptionId,
                customerId: user.id || requesterUserId,
                customerName: user.name || null,
                customerCpf: user.cpf || null,
                customerEmail: user.email || null,
                groupNumber: subscription.groupNumber || null,
                quotaNumber: subscription.quotaNumber || null,
                status: subscription.status || null,
                productName: subscription.plan?.product?.name || null,
                planName: subscription.plan?.name || null,
                kind: currents.length === 0 ? 'CONTRATO' : (hasAdesao && currents.length === 1 ? 'ADESAO' : 'PARCELA'),
                kindLabel,
                isAntecipacao: hasAntecipacao,
                parcelaInformadaPeloApp: exact,
                installmentIds: currents.map((c: any) => c.id),
                items,
                count: currents.length,
                installmentId: current?.id || null,
                installmentNumber: current?.number ?? null,
                installmentStatus: current?.status || null,
                dueDate: current?.dueDate || null,
                amount: totalAmount > 0 ? Math.round(totalAmount * 100) / 100 : null,
                paymentMethod: current?.paymentMethod || null,
                provider: batchProvider || attempt?.provider || null,
                batchId: input.batchId || null
            })
        }
    });

    return { notified: true };
}

/** "Adesão + Parcelas 2 e 3" | "Parcelas 2, 3 e 5" | "Parcela 2" */
function describeMulti(currents: any[]): string {
    const parts = currents.map((c: any) => (c.number === 1 ? 'Adesão' : `Parcela ${c.number}`));
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} + ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}
