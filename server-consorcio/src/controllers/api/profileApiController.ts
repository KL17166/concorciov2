import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { handleApiError } from '../../utils/errors';

const UpdateProfileSchema = z.object({
    email: z.string().email('E-mail inválido').optional(),
    phone: z.string().optional().transform(v => {
        const digits = (v || '').replace(/\D/g, '');
        return digits === '' ? undefined : digits;
    }).refine(v => v === undefined || (v.length >= 10 && v.length <= 11), 'Telefone inválido')
}).refine(d => d.email !== undefined || d.phone !== undefined, 'Nada para atualizar');

/**
 * PATCH /api/profile — cliente atualiza o próprio e-mail e/ou telefone.
 * Nome e CPF não são editáveis (vínculo com KYC/contratos).
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = UpdateProfileSchema.safeParse(req.body);
        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message || 'Dados inválidos';
            res.status(400).json({ success: false, error: 'BAD_REQUEST', message: firstError });
            return;
        }

        const { email, phone } = validation.data;

        if (email) {
            const taken = await prisma.user.findFirst({
                where: { email, id: { not: user.userId } },
                select: { id: true }
            });
            if (taken) {
                res.status(409).json({ success: false, error: 'CONFLICT', message: 'Este e-mail já está em uso.' });
                return;
            }
        }

        const updated = await prisma.user.update({
            where: { id: user.userId },
            data: {
                ...(email !== undefined ? { email } : {}),
                ...(phone !== undefined ? { phone } : {})
            },
            select: { id: true, name: true, email: true, cpf: true, phone: true, role: true, kycStatus: true }
        });

        res.json({ success: true, user: updated });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao atualizar perfil', req);
    }
};
