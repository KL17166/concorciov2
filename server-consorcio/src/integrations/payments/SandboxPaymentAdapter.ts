import { PaymentGateway, PaymentMethod, PaymentRequest, PaymentResult } from './PaymentGateway';
import { prisma } from '../../config/database';

export class SandboxPaymentAdapter implements PaymentGateway {
    readonly name = 'sandbox';

    supports(_method: PaymentMethod): boolean {
        return true;
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResult> {
        // Referências `bid-<uuid>` (PIX de lance) NÃO tocam installments —
        // o vínculo vive em `bid_payments` (B5). Antes este update estourava
        // sem try/catch e o PIX de lance falhava sempre no modo sandbox.
        if (!request.installmentId.startsWith('bid-') && !request.installmentId.startsWith('batch-')) {
            // Update installment to waiting approval
            await prisma.installment.update({
                where: { id: request.installmentId },
                data: {
                    paymentMethod: 'SANDBOX_WAITING_APPROVAL'
                }
            });
        }

        if (request.method === 'PIX') {
            return {
                provider: 'sandbox',
                paymentId: `sandbox-${Date.now()}`,
                qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                copyPaste: '00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913Cicrano de Tal6008BRASILIA62070503***63041D3D',
                amount: request.amount,
                expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                message: 'Ambiente de Testes: Pagamento enviado para aprovação manual do administrador.',
                isManualApproval: true
            };
        }

        return {
            provider: 'sandbox',
            paymentId: `sandbox-boleto-${Date.now()}`,
            qrCode: null,
            copyPaste: '34191.09008 61713.957308 71444.640008 2 92900000000000',
            amount: request.amount,
            expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            message: 'Ambiente de Testes: Boleto enviado para aprovação manual.',
            isManualApproval: true
        };
    }
}
