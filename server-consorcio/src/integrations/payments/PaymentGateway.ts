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
