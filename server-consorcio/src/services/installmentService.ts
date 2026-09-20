import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface MarkPaidOptions {
    paymentMethod?: string;
    paymentDate?: Date;
}

export interface MarkPaidResult {
    success: boolean;
    message: string;
    activated?: boolean;
    completed?: boolean;
    pendingKyc?: boolean;
}

/**
 * Unified logic for marking an installment as paid.
 * Uses Prisma interactive transaction to prevent race conditions
 * when multiple payments are processed simultaneously.
 *
 * All operations (installment update, subscription balance,
 * activation, completion check) happen atomically.
 */
export async function markInstallmentAsPaid(
    installmentId: string,
    options: MarkPaidOptions = {}
): Promise<MarkPaidResult> {
    // Pre-validation outside transaction (fast fail)
    const installment = await prisma.installment.findUnique({
        where: { id: installmentId },
        include: { subscription: true }
    });

    if (!installment) {
        return { success: false, message: 'Parcela não encontrada.' };
    }

    if (installment.status === 'PAID') {
        return { success: false, message: 'Esta parcela já está paga.' };
    }

    // Fix 1: Block payments on CANCELLED subscriptions (pre-check fast fail)
    if (installment.subscription.status === 'CANCELLED') {
        return { success: false, message: 'Esta parcela pertence a um contrato cancelado.' };
    }

    // === ATOMIC TRANSACTION ===
    // Uses serializable isolation to prevent concurrent payment race conditions.
    // Inside the transaction:
    //   1. Re-verify installment status (double-check after lock)
    //   2. Mark installment as PAID
    //   3. Update subscription balance (atomic increment/decrement)
    //   4. Activate subscription if adesão (installment #1)
    //   5. Check completion and mark as COMPLETED if all paid
    const result = await prisma.$transaction(async (tx) => {
        // Re-read inside transaction to prevent TOCTOU race
        const inst = await tx.installment.findUnique({
            where: { id: installmentId },
            include: { subscription: { include: { user: true } } }
        });

        if (!inst || inst.status === 'PAID') {
            return {
                success: false,
                message: inst ? 'Esta parcela já está paga.' : 'Parcela não encontrada.',
                activated: false,
                completed: false
            };
        }

        // Fix 1 (inside transaction): Block payments on CANCELLED subscriptions
        if (inst.subscription.status === 'CANCELLED') {
            return {
                success: false,
                message: 'Esta parcela pertence a um contrato cancelado.',
                activated: false,
                completed: false
            };
        }

        // Fix 3: Ordem — a adesão (#1) precisa estar paga antes das demais.
        // (Antecipação explícita pode furar a sequência, mas nunca a adesão.)
        if (inst.number > 1) {
            const adhesion = await tx.installment.findFirst({
                where: {
                    subscriptionId: inst.subscriptionId,
                    number: 1,
                    status: { notIn: ['PAID', 'CANCELLED'] }
                },
                select: { id: true }
            });
            if (adhesion) {
                return {
                    success: false,
                    message: `Pague a adesão antes das demais parcelas.`,
                    activated: false,
                    completed: false
                };
            }
        }

        // 1. Update installment to PAID
        await tx.installment.update({
            where: { id: installmentId },
            data: {
                status: 'PAID',
                paymentDate: options.paymentDate || new Date(),
                paymentMethod: options.paymentMethod || 'ADMIN_MANUAL'
            }
        });

        // 1b. Marca a tentativa de PIX como paga (as anteriores já expiram ao regerar)
        try {
            await (tx as any).paymentAttempt.updateMany({
                where: { installmentId, status: 'ACTIVE' },
                data: { status: 'PAID' }
            });
        } catch (_) {
            // Tabela pode não existir em bancos antigos — não quebra a baixa
        }

        // 2. Update subscription: atomic increment/decrement
        // These generate SQL: SET "paidInstallments" = "paidInstallments" + 1
        // which is inherently safe against concurrent writes.
        const updateData: any = {
            paidInstallments: { increment: 1 },
            balanceDue: { decrement: Number(inst.amount) }
        };

        // 3. If this is adesão (#1) and subscription is PENDING → activate or set PENDING_KYC
        let activated = false;
        let pendingKyc = false;
        if (inst.number === 1 && (inst.subscription.status === 'PENDING' || inst.subscription.status === 'PENDING_KYC')) {
            const userKyc = (inst.subscription as any).user?.kycStatus;
            if (userKyc && userKyc !== 'APPROVED') {
                updateData.status = 'PENDING_KYC';
                pendingKyc = true;
            } else {
                updateData.status = 'ACTIVE';
                activated = true;
            }
        }

        await tx.subscription.update({
            where: { id: inst.subscriptionId },
            data: updateData
        });

        // 4. Check if ALL non-cancelled installments are now paid → COMPLETED
        // CANCELLED installments are excluded: they were removed from the plan and
        // should not prevent completion. REFUNDED installments remain blocking.
        let completed = false;
        const unpaidCount = await tx.installment.count({
            where: {
                subscriptionId: inst.subscriptionId,
                status: { notIn: ['PAID', 'CANCELLED'] }
            }
        });

        if (unpaidCount === 0) {
            await tx.subscription.update({
                where: { id: inst.subscriptionId },
                data: { status: 'COMPLETED' }
            });
            completed = true;
        }

        let message: string;
        if (inst.number === 1 && pendingKyc) {
            message = 'Adesão paga! Aguardando aprovação do KYC pelo administrador.';
        } else if (inst.number === 1) {
            message = 'Adesão marcada como paga!';
        } else {
            message = `Parcela #${inst.number} marcada como paga!`;
        }

        return { success: true, message, activated, completed, pendingKyc };
    }, {
        // Transaction options
        timeout: 10000,          // 10s max
        isolationLevel: 'Serializable'  // Strongest isolation
    });

    if (result.success) {
        logger.info(`Payment processed: installment ${installmentId}`);
    }

    return result;
}
