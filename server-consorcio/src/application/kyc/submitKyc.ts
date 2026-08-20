import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface SubmitKycInput {
    userId: string;
    documentFrontUrl: string;
    documentBackUrl: string;
    selfieUrl: string;
}

export async function submitKyc(input: SubmitKycInput) {
    const { userId, documentFrontUrl, documentBackUrl, selfieUrl } = input;

    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true }
    });

    if (!currentUser) {
        throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    if (currentUser.kycStatus === 'APPROVED') {
        throw Object.assign(new Error('Seu KYC já foi aprovado e não pode ser resubmetido.'), { statusCode: 409 });
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            documentFrontUrl,
            documentBackUrl,
            selfieUrl,
            kycStatus: 'SUBMITTED',
            kycRejectReason: null
        }
    });

    logger.info(`KYC submitted: user ${userId}`);

    return {
        success: true,
        message: 'Documentos enviados com sucesso! Aguarde a verificação do administrador.',
        kycStatus: 'SUBMITTED'
    };
}
