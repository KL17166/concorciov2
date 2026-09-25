import { prisma } from '../../config/database';
import { verifyPaymentToken } from '../../security/paymentToken';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';
import { parseAddress } from '../../mappers/addressMapper';
import { PaymentFailoverService } from '../../services/paymentFailoverService';
import { PaymentMethod } from '../../integrations/payments/PaymentGateway';
import { logger } from '../../config/logger';

export interface BatchItemInput {
    number: number;
    idTokenPay: string;
}

export interface GenerateBatchPaymentInput {
    subscriptionId: string;
    items: BatchItemInput[];
    requesterUserId: string;
    method?: PaymentMethod;
}

const BATCH_REF_PREFIX = 'batch-';
const BATCH_TTL_MS = 30 * 60 * 1000;
const MAX_BATCH_ITEMS = 12;

export function batchExternalId(batchId: string): string {
    return `${BATCH_REF_PREFIX}${batchId}`;
}

export function parseBatchExternalId(externalId: string): string | null {
    if (!externalId.startsWith(BATCH_REF_PREFIX)) return null;
    const id = externalId.slice(BATCH_REF_PREFIX.length);
    return id.length > 0 ? id : null;
}

/**
 * Gera 1 PIX combinado somando N parcelas (adesão, do mês, antecipações).
 * Cada parcela entra com seu valor calculado; a baixa rateia em 1 transação.
 */
export async function generateBatchPayment(input: GenerateBatchPaymentInput) {
    const { subscriptionId, requesterUserId, method = 'PIX' } = input;
    const numbers = [...new Set((input.items || []).map(i => i.number))].sort((a, b) => a - b);
    if (numbers.length === 0) throw Object.assign(new Error('Escolha ao menos 1 parcela'), { statusCode: 400 });
    if (numbers.length > MAX_BATCH_ITEMS) throw Object.assign(new Error(`Máximo de ${MAX_BATCH_ITEMS} parcelas por cobrança`), { statusCode: 400 });
    const tokenByNumber = new Map((input.items || []).map(i => [i.number, i.idTokenPay]));

    const subscription: any = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
            user: true,
            installments: { orderBy: { number: 'asc' } }
        }
    });
    if (!subscription) throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    if (subscription.userId !== requesterUserId) throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    if (subscription.status === 'CANCELLED') throw Object.assign(new Error('Contrato cancelado'), { statusCode: 400 });

    const byNumber = new Map(subscription.installments.map((i: any) => [i.number, i]));
    const paidSet = new Set(subscription.installments.filter((i: any) => i.status === 'PAID').map((i: any) => i.number));

    // Adesão (#1) precisa estar paga ou dentro do lote — nunca fura.
    const adhesionPaid = paidSet.has(1);
    if (!adhesionPaid && !numbers.includes(1)) {
        throw Object.assign(new Error('Inclua a adesão (parcela 1) no pagamento.'), { statusCode: 400 });
    }

    // Valida cada parcela + token; calcula valor simulando a ordem de baixa.
    const items: Array<{ installment: any; amount: number; anticipated: boolean }> = [];
    const simulatedPaid = new Set(paidSet);
    for (const n of numbers) {
        const inst: any = byNumber.get(n);
        if (!inst) throw Object.assign(new Error(`Parcela ${n} não encontrada`), { statusCode: 404 });
        if (inst.status === 'PAID') throw Object.assign(new Error(`Parcela ${n} já está paga`), { statusCode: 400 });
        if (inst.status === 'CANCELLED') throw Object.assign(new Error(`Parcela ${n} foi cancelada`), { statusCode: 400 });
        const token = tokenByNumber.get(n);
        if (!token || !verifyPaymentToken(token, subscriptionId, n, requesterUserId)) {
            throw Object.assign(new Error(`Token inválido para a parcela ${n}`), { statusCode: 403 });
        }
        let nextUnpaid = 1;
        while (simulatedPaid.has(nextUnpaid)) nextUnpaid++;
        const anticipated = n > nextUnpaid;
        items.push({ installment: inst, amount: calculateInstallmentValue(Number(inst.amount), n, nextUnpaid), anticipated });
        simulatedPaid.add(n);
    }
    const total = items.reduce((s, i) => s + i.amount, 0);
    const idsKey = JSON.stringify(items.map(i => i.installment.id).sort());

    // Idempotência: lote ACTIVE com as mesmas parcelas → reexibe.
    const now = new Date();
    const existing = await (prisma as any).paymentBatch.findFirst({
        where: { subscriptionId, status: 'ACTIVE', expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' }
    });
    if (existing && existing.installmentIds === idsKey) {
        logger.info(`Batch PIX reused for subscription ${subscriptionId} (batch ${existing.id})`);
        let reusedManual = false;
        try {
            const cfg = await prisma.gatewayConfig.findUnique({ where: { name: existing.provider } });
            reusedManual = !!cfg?.requiresManualReview || ['eldorado', 'g2g', 'sandbox'].includes(existing.provider);
        } catch { /* fallback: sem flag */ }
        return toResponse(existing, items, true, { isManualApproval: reusedManual } as any);
    }

    const batch = await prisma.$transaction(async (tx: any) => {
        await tx.paymentBatch.updateMany({ where: { subscriptionId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
        return tx.paymentBatch.create({
            data: { subscriptionId, installmentIds: idsKey, totalAmount: total, status: 'RESERVED' }
        });
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    let parsedAddress = null;
    try {
        if (subscription.user.address) parsedAddress = parseAddress(subscription.user.address);
    } catch { /* endereço opcional p/ PIX */ }

    let paymentResult;
    try {
        paymentResult = await PaymentFailoverService.executePaymentWithFailover({
            installmentId: batchExternalId(batch.id),
            installmentNumber: 0,
            amount: total,
            method,
            customer: {
                name: subscription.user.name,
                email: subscription.user.email,
                document: subscription.user.cpf,
                phone: subscription.user.phone || undefined,
                address: parsedAddress
            }
        });
    } catch (err) {
        await (prisma as any).paymentBatch.update({ where: { id: batch.id }, data: { status: 'EXPIRED' } }).catch(() => {});
        throw err;
    }

    const active = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.paymentBatch.update({
            where: { id: batch.id },
            data: {
                provider: paymentResult.provider,
                externalId: paymentResult.paymentId || null,
                copyPaste: paymentResult.copyPaste || null,
                status: 'ACTIVE',
                expiresAt: paymentResult.expirationDate ? new Date(paymentResult.expirationDate) : new Date(Date.now() + BATCH_TTL_MS)
            }
        });
        for (const it of items) {
            await tx.paymentAttempt.updateMany({ where: { installmentId: it.installment.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
            await tx.paymentAttempt.create({
                data: {
                    installmentId: it.installment.id,
                    batchId: batch.id,
                    provider: paymentResult.provider,
                    externalId: paymentResult.paymentId || null,
                    amount: it.amount,
                    status: 'ACTIVE',
                    expiresAt: updated.expiresAt
                }
            });
        }
        return updated;
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    logger.info(`Batch PIX generated for subscription ${subscriptionId}: ${items.length} parcelas, R$ ${total} (batch ${batch.id}, ${active.provider})`);
    return toResponse(active, items, false, paymentResult);
}

function toResponse(batch: any, items: Array<{ installment: any; amount: number; anticipated: boolean }>, reused: boolean, paymentResult?: any) {
    return {
        batchId: batch.id,
        subscriptionId: batch.subscriptionId,
        items: items.map(i => ({
            installmentId: i.installment.id,
            number: i.installment.number,
            amount: i.amount,
            anticipated: i.anticipated,
            dueDate: i.installment.dueDate || null,
            status: i.installment.status
        })),
        totalAmount: Number(batch.totalAmount),
        provider: batch.provider,
        isManualApproval: !!paymentResult?.isManualApproval,
        copyPaste: batch.copyPaste || paymentResult?.copyPaste || null,
        qrCode: paymentResult?.qrCode || null,
        expiresAt: batch.expiresAt ? new Date(batch.expiresAt).toISOString() : null,
        reused
    };
}
