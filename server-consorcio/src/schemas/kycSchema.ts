import { z } from 'zod';

export const SubmitKycSchema = z.object({
    documentFrontUrl: z.string().min(1, 'Foto da frente do documento é obrigatória'),
    documentBackUrl: z.string().min(1, 'Foto do verso do documento é obrigatória'),
    selfieUrl: z.string().min(1, 'Selfie com documento é obrigatória')
});

export type SubmitKycDTO = z.infer<typeof SubmitKycSchema>;

export const ReviewKycSchema = z.object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().optional().nullable()
});

export type ReviewKycDTO = z.infer<typeof ReviewKycSchema>;
