export type PaymentMethod = 'PIX' | 'BOLETO';

export interface PaymentCustomer {
    name: string;
    email: string;
    document: string; // CPF
    phone?: string;
    address?: any;
}

export interface PaymentRequest {
    installmentId: string;
    installmentNumber: number;
    amount: number;
    customer: PaymentCustomer;
    method: PaymentMethod;
}

export interface PaymentResult {
    provider: string;
    paymentId: string;
    qrCode: string | null;      // base64 image or null
    copyPaste: string;          // digitable line or pix code
    amount: number;
    expirationDate: string | null;
    message?: string;
    isManualApproval?: boolean;
}

export interface PaymentGateway {
    readonly name: string;
    supports(method: PaymentMethod): boolean;
    createPayment(request: PaymentRequest): Promise<PaymentResult>;
}

import QRCode from 'qrcode';

/**
 * Normaliza o resultado de pagamento do Pix para qualquer gateway.
 * Detecta se o método é PIX e se o gateway forneceu apenas o Copia e Cola (EMV),
 * montando automaticamente o QR Code em formato Data URL caso a imagem não exista.
 */
export async function ensurePixQrCode(result: PaymentResult, method: PaymentMethod): Promise<PaymentResult> {
    if (method === 'PIX') {
        const emv = result.copyPaste || (result as any).qrCodeText || (result as any).pixCopiaECola || '';
        const currentQr = result.qrCode;

        // Se já for uma data URL completa ou URL http/https, mantém
        if (currentQr && (currentQr.startsWith('data:image') || currentQr.startsWith('http://') || currentQr.startsWith('https://'))) {
            return result;
        }

        // Se for uma string base64 pura (sem data:image/png;base64,), formata
        if (currentQr && currentQr.length > 80 && !currentQr.includes(' ')) {
            result.qrCode = `data:image/png;base64,${currentQr}`;
            return result;
        }

        // Se a gateway não forneceu imagem mas retornou o código Pix (EMV), o servidor monta o QR Code automaticamente
        if (emv) {
            try {
                result.qrCode = await QRCode.toDataURL(emv, {
                    width: 320,
                    margin: 2,
                    color: {
                        dark: '#1E293B',
                        light: '#FFFFFF'
                    },
                    errorCorrectionLevel: 'M'
                });
            } catch (err) {
                console.error('[PaymentGateway] Erro ao montar QR Code Pix no backend:', err);
            }
        }
    }

    return result;
}
