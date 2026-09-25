import { z } from 'zod';

export const GeneratePaymentSchema = z.object({
    idTokenPay: z.string().min(1, 'Token de pagamento é obrigatório'),
    anticipate: z.boolean().optional().default(false)
});

export const GenerateBatchPaymentSchema = z.object({
    subscriptionId: z.string().min(1, 'Contrato é obrigatório'),
    items: z.array(z.object({
        number: z.number().int().min(1),
        idTokenPay: z.string().min(1, 'Token da parcela é obrigatório')
    })).min(1).max(12)
});

export type GeneratePaymentDTO = z.infer<typeof GeneratePaymentSchema>;

export const MarkPaidAdminSchema = z.object({
    paymentMethod: z.string().optional(),
    paymentDate: z.string().or(z.date()).optional()
});

export type MarkPaidAdminDTO = z.infer<typeof MarkPaidAdminSchema>;
