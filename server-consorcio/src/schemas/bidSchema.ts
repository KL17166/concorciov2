import { z } from 'zod';

export const CreateBidSchema = z.object({
    subscriptionId: z.string().uuid('ID de contrato inválido'),
    type: z.enum(['FREE', 'FIXED']),
    percentage: z.coerce.number().min(0, 'Porcentagem mínima é 0').max(100, 'Porcentagem máxima é 100'),
    amount: z.coerce.number().positive('Valor do lance deve ser maior que zero')
});

export type CreateBidDTO = z.infer<typeof CreateBidSchema>;
