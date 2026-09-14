import { z } from 'zod';

export const CreateClientSubscriptionSchema = z.object({
    userId: z.string().min(1, 'ID de usuário obrigatório'),
    planId: z.string().min(1, 'ID de plano obrigatório'),
    productId: z.string().min(1, 'ID de produto obrigatório').optional(),
    token: z.string().optional().nullable(),
    termsAccepted: z.boolean().refine(val => val === true, {
        message: 'Você deve aceitar os termos e condições para criar um contrato.'
    }),
    documentFrontUrl: z.string().optional().nullable(),
    documentBackUrl: z.string().optional().nullable(),
    selfieUrl: z.string().optional().nullable()
});

export type CreateClientSubscriptionDTO = z.infer<typeof CreateClientSubscriptionSchema>;

export const CreateAdminSubscriptionSchema = z.object({
    userId: z.string().min(1, 'ID de usuário obrigatório'),
    planId: z.string().min(1, 'ID de plano obrigatório'),
    groupNumber: z.string().optional().nullable(),
    quotaNumber: z.string().optional().nullable()
});

export type CreateAdminSubscriptionDTO = z.infer<typeof CreateAdminSubscriptionSchema>;

export const ContemplateSubscriptionSchema = z.object({
    contemplationType: z.enum(['BID', 'DRAW', 'DIRECT']).default('DIRECT')
});

export type ContemplateSubscriptionDTO = z.infer<typeof ContemplateSubscriptionSchema>;
