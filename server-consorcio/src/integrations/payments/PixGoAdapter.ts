import { PaymentGateway, PaymentMethod, PaymentRequest, PaymentResult } from './PaymentGateway';
import { PixGoService } from '../../services/gateways/pixGoService';

export class PixGoAdapter implements PaymentGateway {
    readonly name = 'pixgo';

    supports(method: PaymentMethod): boolean {
        return method === 'PIX';
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResult> {
        if (request.method !== 'PIX') {
            throw new Error('PixGo suporta apenas pagamentos via PIX');
        }

        const webhookUrl = process.env.PIXGO_WEBHOOK_URL
            ? `${process.env.PIXGO_WEBHOOK_URL}/webhooks/pixgo`
            : undefined;

        const result = await PixGoService.createPayment({
            amount: request.amount,
            external_id: request.installmentId,
            description: `Pagamento Consórcio - Parcela ${request.installmentNumber}`,
            customer_name: request.customer.name,
            customer_email: request.customer.email,
            customer_cpf: request.customer.document,
            webhook_url: webhookUrl
        });

        return {
            provider: 'pixgo',
            paymentId: result.id,
            qrCode: result.qr_code_base64,
            copyPaste: result.qr_code,
            amount: request.amount,
            expirationDate: result.expiration_date || new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };
    }
}
