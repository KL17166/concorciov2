import { InstallmentRepository } from '../../repositories/installmentRepository';
import { verifyPaymentToken } from '../../security/paymentToken';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';
import { parseAddress } from '../../mappers/addressMapper';
import { PaymentGatewayFactory } from '../../integrations/payments/PaymentGatewayFactory';
import { PaymentMethod, PaymentResult } from '../../integrations/payments/PaymentGateway';
import { logger } from '../../config/logger';

export interface GeneratePaymentInput {
    installmentId: string;
    idTokenPay: string;
    requesterUserId: string;
    method: PaymentMethod;
}

export async function generatePayment(input: GeneratePaymentInput): Promise<PaymentResult> {
    const { installmentId, idTokenPay, requesterUserId, method } = input;

    const installment = await InstallmentRepository.findById(installmentId);

    if (!installment) {
        throw Object.assign(new Error('Parcela não encontrada'), { statusCode: 404 });
    }

    if (installment.subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
    }

    // Verify HMAC payment token signature
    const tokenValid = verifyPaymentToken(
        idTokenPay,
        installment.subscriptionId,
        installment.number,
        requesterUserId
    );

    if (!tokenValid) {
        logger.warn(`Invalid payment token attempt: user ${requesterUserId}, installment ${installmentId}`);
        throw Object.assign(new Error('Token de pagamento inválido'), { statusCode: 403 });
    }

    if (installment.status === 'PAID') {
        throw Object.assign(new Error('Parcela já está paga'), { statusCode: 400 });
    }

    // Next installment index
    const paidIndices = new Set(
        installment.subscription.installments
            .filter((i: any) => i.status === 'PAID')
            .map((i: any) => i.number)
    );

    let nextIndex = installment.subscription.totalInstallments + 1;
    for (let i = 1; i <= installment.subscription.totalInstallments; i++) {
        if (!paidIndices.has(i)) {
            nextIndex = i;
            break;
        }
    }

    const valueToPay = calculateInstallmentValue(Number(installment.amount), installment.number, nextIndex);

    let parsedAddress = null;
    if (installment.subscription.user.address) {
        parsedAddress = parseAddress(installment.subscription.user.address);
    }

    if (method === 'BOLETO') {
        if (!parsedAddress || !parsedAddress.cep || !parsedAddress.street || !parsedAddress.number || !parsedAddress.neighborhood || !parsedAddress.city || !parsedAddress.state) {
            throw Object.assign(new Error('Endereço completo é obrigatório para gerar boleto. Por favor, atualize seu cadastro.'), { statusCode: 400 });
        }
    }

    const gateway = await PaymentGatewayFactory.getGateway(method);

    const paymentResult = await gateway.createPayment({
        installmentId: installment.id,
        installmentNumber: installment.number,
        amount: valueToPay,
        method,
        customer: {
            name: installment.subscription.user.name,
            email: installment.subscription.user.email,
            document: installment.subscription.user.cpf,
            phone: installment.subscription.user.phone || undefined,
            address: parsedAddress
        }
    });

    return paymentResult;
}
