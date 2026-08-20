import { z } from 'zod';

export const GeneratePaymentSchema = z.object({
    idTokenPay: z.string().min(1, 'Token de pagamento é obrigatório')
});

export type GeneratePaymentDTO = z.infer<typeof GeneratePaymentSchema>;

export const MarkPaidAdminSchema = z.object({
    paymentMethod: z.string().optional(),
    paymentDate: z.string().or(z.date()).optional()
});

export type MarkPaidAdminDTO = z.infer<typeof MarkPaidAdminSchema>;
