import { PaymentGateway, PaymentMethod, PaymentRequest, PaymentResult } from './PaymentGateway';
import { SigiloPayService } from '../../services/gateways/sigiloPayService';
import QRCode from 'qrcode';

export class SigiloPayAdapter implements PaymentGateway {
    readonly name = 'sigilopay';

    supports(method: PaymentMethod): boolean {
        return method === 'PIX';
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

            const copyPaste = result.pix?.code || (result as any).qrCode || '';
            let qrCode = result.pix?.base64 || (result as any).qrCodeBase64 || null;

            if (!qrCode && copyPaste) {
                try {
                    qrCode = await QRCode.toDataURL(copyPaste, { width: 300, margin: 2 });
                } catch (e) {
                    // Fallback
                }
            }

            return {
                provider: 'sigilopay',
                paymentId: result.transactionId || result.id || '',
                qrCode,
                copyPaste,
                amount: request.amount,
                expirationDate: null
            };
        }

        throw new Error(`Método de pagamento não suportado para SigiloPay: ${request.method}`);
    }
}
