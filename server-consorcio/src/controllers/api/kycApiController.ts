import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { submitKyc } from '../../application/kyc/submitKyc';
import { SubmitKycSchema } from '../../schemas/kycSchema';
import { handleApiError } from '../../utils/errors';
import { KYC_STORAGE_DIR } from '../../middlewares/uploadMiddleware';

export const submitClientKyc = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = SubmitKycSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'Documentos incompletos. Envie: foto frente do documento, foto verso, e selfie.'
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
        handleApiError(res, error, 'Erro ao enviar documentos', req);
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
            res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Usuário não encontrado'
            });
            return;
        }

        res.json({
            kycStatus: userData.kycStatus,
            rejectReason: userData.kycRejectReason,
            documentsUploaded: !!(userData.documentFrontUrl && userData.documentBackUrl && userData.selfieUrl)
        });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao consultar status do KYC', req);
    }
};

/**
 * GET /api/kyc/documents/:userId/:fileName
 * Secure endpoint to view/download KYC documents with strict authorization check.
 */
export const getKycDocument = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    const requestedUserId = req.params.userId as string;
    const rawFileName = req.params.fileName as string;

    // Strict authorization: Clients can only access their own documents; Admins can access any
    const isAdmin = user && ['MASTER', 'MANAGER', 'SUPPORT'].includes(user.role);
    if (!isAdmin && user.userId !== requestedUserId) {
        res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Acesso negado aos documentos deste usuário.'
        });
        return;
    }

    // Path traversal defense
    const safeFileName = path.basename(rawFileName);
    if (safeFileName !== rawFileName || safeFileName.includes('..')) {
        res.status(400).json({
            success: false,
            error: 'BAD_REQUEST',
            message: 'Nome de arquivo inválido.'
        });
        return;
    }

    // Check primary private storage
    const primaryPath = path.join(KYC_STORAGE_DIR, requestedUserId, safeFileName);
    const legacyPath = path.join(process.cwd(), 'public', 'uploads', 'documents', requestedUserId, safeFileName);

    let filePathToServe: string | null = null;
    if (fs.existsSync(primaryPath)) {
        filePathToServe = primaryPath;
    } else if (fs.existsSync(legacyPath)) {
        filePathToServe = legacyPath;
    }

    if (!filePathToServe) {
        res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Documento não encontrado.'
        });
        return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.sendFile(path.resolve(filePathToServe));
};
