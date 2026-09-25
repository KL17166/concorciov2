import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path, method: req.method });

    // Prevent "Cannot set headers after they are sent" crashes
    if (res.headersSent) {
        return next(err);
    }

    // Fotos/documentos grandes demais (body-parser entity.too.large).
    // A tela de contrato envia 3 fotos em base64 no JSON — sem isso caía no 500 genérico.
    const errStatus = (err as any)?.status || (err as any)?.statusCode;
    const errType = (err as any)?.type;
    if (errStatus === 413 || errType === 'entity.too.large') {
        return res.status(413).json({
            error: 'PAYLOAD_TOO_LARGE',
            message: 'As fotos enviadas são muito grandes. Use fotos com menor resolução e tente novamente.',
        });
    }

    if (err instanceof ZodError) {
        return res.status(400).json({
            error: 'Validacao falhou',
            message: 'Os dados enviados nao sao validos. Verifique os campos e tente novamente.',
            ...(process.env.NODE_ENV === 'development' ? { details: err.issues } : {}),
        });
    }

    // Erros com status conhecido (ex: 403 do CORS) não são 500: respeita o
    // status sem vazar detalhes internos. Antes, "Bloqueado por CORS" caía no
    // 500 genérico e assustava como erro interno.
    if (errStatus === 403) {
        if (req.path.startsWith('/admin') && req.accepts('html')) {
            return res.status(403).render('pages/error/index', {
                message: 'Acesso bloqueado (CORS)',
                error: process.env.NODE_ENV === 'development' ? err : {}
            });
        }
        return res.status(403).json({
            error: 'FORBIDDEN',
            message: err.message || 'Acesso bloqueado.'
        });
    }

    // Handle specific known errors here (e.g., AppError class if created)

    // Handle Admin UI errors
    if (req.path.startsWith('/admin') && req.accepts('html')) {
        return res.status(500).render('pages/error/index', {
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }

    res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro inesperado. Tente novamente mais tarde ou entre em contato com o suporte.',
    });
};
