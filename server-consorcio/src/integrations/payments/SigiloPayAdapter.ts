import { PaymentGateway, PaymentMethod, PaymentRequest, PaymentResult } from './PaymentGateway';
import { SigiloPayService } from '../../services/gateways/sigiloPayService';

export class SigiloPayAdapter implements PaymentGateway {
    readonly name = 'sigilopay';

    supports(method: PaymentMethod): boolean {
        return method === 'PIX' || method === 'BOLETO';
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResult> {
        if (request.method === 'PIX') {
            const payer: any = {
                name: request.customer.name,
                document: request.customer.document
            };
            if (request.customer.email) payer.email = request.customer.email;
            if (request.customer.phone) payer.phone = request.customer.phone;

            const result = await SigiloPayService.createPixDeposit({
                amount: request.amount,
                external_id: request.installmentId,
                description: `Pgto Parc. ${request.installmentNumber}`,
                payer
            });

            return {
                provider: 'sigilopay',
                paymentId: result.transactionId || result.id || '',
                qrCode: result.pix?.base64 || null,
                copyPaste: result.pix?.code || '',
                amount: request.amount,
                expirationDate: null
            };
        }

        if (request.method === 'BOLETO') {
            if (!request.customer.address) {
                throw new Error('Endereço completo é obrigatório para gerar boleto.');
            }

            const payer: any = {
                name: request.customer.name,
                document: request.customer.document,
                address: request.customer.address
            };
            if (request.customer.email) payer.email = request.customer.email;
            if (request.customer.phone) payer.phone = request.customer.phone;

            const result = await SigiloPayService.createBoletoDeposit({
                amount: request.amount,
                external_id: request.installmentId,
                description: `Boleto Parc. ${request.installmentNumber}`,
                payer
            });

            return {
                provider: 'sigilopay',
                paymentId: result.id || result.transactionId || '',
                qrCode: null,
                copyPaste: result.boleto?.digitableLine || result.pix?.code || '',
                amount: request.amount,
                expirationDate: result.boleto?.dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            };
        }

        throw new Error(`Método de pagamento não suportado: ${request.method}`);
    }
}
