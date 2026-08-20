import { SubscriptionRepository } from '../../repositories/subscriptionRepository';
import { InstallmentRepository } from '../../repositories/installmentRepository';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';

export interface ListSubscriptionPaymentsInput {
    subscriptionId: string;
    requesterUserId?: string;
    isAdmin?: boolean;
}

export interface InstallmentPaymentDTO {
    id: string;
    idTokenPay: string;
    number: number;
    amount: number;
    valueToPay: number;
    dueDate: Date;
    status: string;
    paymentDate: Date | null;
    paymentMethod: string | null;
}

export async function listSubscriptionPayments(
    input: ListSubscriptionPaymentsInput
): Promise<InstallmentPaymentDTO[]> {
    const { subscriptionId, requesterUserId, isAdmin } = input;

    const subscription = await SubscriptionRepository.findById(subscriptionId);

    if (!subscription) {
        throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    if (!isAdmin && requesterUserId && subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    const installments = await InstallmentRepository.findSubscriptionInstallments(subscriptionId);

    const paidIndices = new Set(
        installments.filter((i) => i.status === 'PAID').map((i) => i.number)
    );

    let nextIndex = subscription.totalInstallments + 1;
    for (let i = 1; i <= subscription.totalInstallments; i++) {
        if (!paidIndices.has(i)) {
            nextIndex = i;
            break;
        }
    }

    return installments.map((inst) => ({
        id: inst.id,
        idTokenPay: inst.idTokenPay,
        number: inst.number,
        amount: Number(inst.amount),
        valueToPay: calculateInstallmentValue(Number(inst.amount), inst.number, nextIndex),
        dueDate: inst.dueDate,
        status: inst.status,
        paymentDate: inst.paymentDate,
        paymentMethod: inst.paymentMethod
    }));
}
