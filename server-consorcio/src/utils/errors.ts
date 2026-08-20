import { Response, Request } from 'express';
import crypto from 'crypto';
import { logger } from '../config/logger';

export interface AppErrorOptions {
    statusCode?: number;
    code?: string;
    details?: unknown;
    isPublic?: boolean;
}

export class AppError extends Error {
    public statusCode: number;
    public code: string;
    public details?: unknown;
    public isPublic: boolean;

    constructor(message: string, options: AppErrorOptions = {}) {
        super(message);
        this.name = 'AppError';
        this.statusCode = options.statusCode || 500;
        this.code = options.code || 'INTERNAL_ERROR';
        this.details = options.details;
        this.isPublic = options.isPublic ?? (this.statusCode < 500);
    }
}

/**
 * Handles API error responses securely without leaking stack traces or internal secrets in production.
 * Attaches a traceable requestId to correlate logs with client reports.
 */
export function handleApiError(
    res: Response,
    error: any,
    customDefaultMessage = 'Ocorreu um erro ao processar a solicitação',
    req?: Request
): void {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Correlate with incoming request header or generate fresh UUID
    const requestId = (req?.headers?.['x-request-id'] as string) || crypto.randomUUID();

    const errorCode = error?.code || (
        statusCode === 400 ? 'BAD_REQUEST' :
        statusCode === 401 ? 'UNAUTHORIZED' :
        statusCode === 403 ? (error?.message === 'KYC_REJECTED' ? 'KYC_REJECTED' : 'FORBIDDEN') :
        statusCode === 404 ? 'NOT_FOUND' :
        statusCode === 429 ? 'TOO_MANY_REQUESTS' :
        statusCode === 503 ? 'GATEWAY_UNAVAILABLE' :
        'INTERNAL_SERVER_ERROR'
    );

    logger.error(`[API Error] RequestId: ${requestId} | Code: ${errorCode} | Status: ${statusCode}`, {
        requestId,
        code: errorCode,
        message: error?.message,
        path: req?.originalUrl || req?.url,
        stack: isProduction ? undefined : error?.stack
    });

    if (errorCode === 'GATEWAY_UNAVAILABLE') {
        res.status(503).json({
            success: false,
            error: 'GATEWAY_UNAVAILABLE',
            message: 'Serviço de pagamentos temporariamente indisponível. Tente novamente em instantes.',
            requestId,
            retryable: true
        });
        return;
    }

    if (error?.message === 'KYC_REJECTED' || errorCode === 'KYC_REJECTED') {
        res.status(403).json({
            success: false,
            error: 'KYC_REJECTED',
            message: 'Seu cadastro foi reprovado. Entre em contato com o suporte para regularizar sua situação.',
            requestId
        });
        return;
    }

    const publicMessage = (statusCode < 500 || error?.isPublic)
        ? (error?.message || customDefaultMessage)
        : (isProduction ? customDefaultMessage : (error?.message || customDefaultMessage));

    res.status(statusCode).json({
        success: false,
        error: errorCode,
        message: publicMessage,
        requestId
    });
}
