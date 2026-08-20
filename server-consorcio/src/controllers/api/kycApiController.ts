import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { submitKyc } from '../../application/kyc/submitKyc';
import { SubmitKycSchema } from '../../schemas/kycSchema';
import { logger } from '../../config/logger';

export const submitClientKyc = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = SubmitKycSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                error: 'Documentos incompletos. Envie: foto frente do documento, foto verso, e selfie.'
            });
            return;
        }

        const data = validation.data;
        const result = await submitKyc({
            userId: user.userId,
            documentFrontUrl: data.documentFrontUrl,
            documentBackUrl: data.documentBackUrl,
            selfieUrl: data.selfieUrl
        });

        res.json(result);
    } catch (error: any) {
        logger.error('KYC submit error:', error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao enviar documentos' });
    }
};

export const getClientKycStatus = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const userData = await prisma.user.findUnique({
            where: { id: user.userId },
            select: {
                kycStatus: true,
                kycRejectReason: true,
                documentFrontUrl: true,
                documentBackUrl: true,
                selfieUrl: true
            }
        });

        if (!userData) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        res.json({
            kycStatus: userData.kycStatus,
            rejectReason: userData.kycRejectReason,
            documentsUploaded: !!(userData.documentFrontUrl && userData.documentBackUrl && userData.selfieUrl)
        });
    } catch (error: any) {
        logger.error('KYC status error:', error);
        res.status(500).json({ error: 'Erro ao consultar status do KYC' });
    }
};
