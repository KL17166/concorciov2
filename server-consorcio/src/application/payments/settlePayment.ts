import { markInstallmentAsPaid, MarkPaidOptions, MarkPaidResult } from '../../services/installmentService';
import { logger } from '../../config/logger';

export interface SettlePaymentInput {
    installmentId: string;
    paymentMethod?: string;
    paymentDate?: Date;
    channel?: 'WEBHOOK' | 'ADMIN';
}

export async function settlePayment(input: SettlePaymentInput): Promise<MarkPaidResult> {
    const { installmentId, paymentMethod, paymentDate, channel = 'ADMIN' } = input;

    logger.info(`Settling payment for installment ${installmentId} via ${channel}`);

    const options: MarkPaidOptions = {
        paymentMethod: paymentMethod || (channel === 'WEBHOOK' ? 'WEBHOOK_AUTOMATIC' : 'ADMIN_MANUAL'),
        paymentDate: paymentDate || new Date()
    };

    const result = await markInstallmentAsPaid(installmentId, options);

    if (!result.success) {
        logger.warn(`Payment settlement failed for installment ${installmentId}: ${result.message}`);
    } else {
        logger.info(`Payment settlement succeeded for installment ${installmentId}`);
    }

    return result;
}
