import { InstallmentRepository } from '../../repositories/installmentRepository';
import { verifyPaymentToken } from '../../security/paymentToken';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';
import { parseAddress } from '../../mappers/addressMapper';
import { PaymentFailoverService } from '../../services/paymentFailoverService';
import { PaymentMethod, PaymentResult } from '../../integrations/payments/PaymentGateway';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface GeneratePaymentInput {
    installmentId: string;
    idTokenPay: string;
    requesterUserId: string;
    method: PaymentMethod;
    /** Antecipação explícita: permite pagar fora de ordem (exige adesão paga). */
    anticipate?: boolean;
}

export async function generatePayment(input: GeneratePaymentInput): Promise<PaymentResult> {
    const { installmentId, idTokenPay, requesterUserId, method, anticipate } = input;

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

    // Regra de ordem: parcelas vencem em sequência.
    // - Adesão (1): sempre liberada.
    // - N > 1 normal: só a parcela atual (todas as anteriores pagas).
    // - N > 1 antecipação explícita: exige ao menos a adesão paga.
    const paidNumbers = new Set(
        (installment.subscription.installments || [])
            .filter((i: any) => i.status === 'PAID')
            .map((i: any) => i.number)
    );

    if (installment.number > 1) {
        if (!anticipate) {
            let firstUnpaid = 1;
            while (paidNumbers.has(firstUnpaid)) firstUnpaid++;
            if (installment.number !== firstUnpaid) {
                throw Object.assign(
                    new Error(`Pague a parcela atual primeiro (parcela ${firstUnpaid}).`),
                    { statusCode: 400 }
                );
            }
        } else if (!paidNumbers.has(1)) {
            throw Object.assign(
                new Error('Pague a adesão antes de antecipar parcelas.'),
                { statusCode: 400 }
            );
        }
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

    const paymentResult = await PaymentFailoverService.executePaymentWithFailover({
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

    // Valor original da parcela (a gateway pode cobrar um pouco menos — exibir como desconto)
    paymentResult.requestedAmount = valueToPay;

    // Expira tentativas anteriores e registra a nova (só vale o último PIX gerado)
    try {
        await prisma.paymentAttempt.updateMany({
            where: { installmentId: installment.id, status: 'ACTIVE' },
            data: { status: 'EXPIRED' }
        });
        await prisma.paymentAttempt.create({
            data: {
                installmentId: installment.id,
                provider: paymentResult.provider,
                externalId: paymentResult.paymentId || null,
                amount: paymentResult.amount,
                status: 'ACTIVE',
                expiresAt: paymentResult.expirationDate ? new Date(paymentResult.expirationDate) : null
            }
        });
    } catch (attemptErr) {
        logger.error('[generatePayment] Erro ao registrar tentativa de pagamento:', attemptErr);
    }

    return paymentResult;
}
