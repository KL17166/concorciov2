import { Response } from 'express';
import { logger } from '../config/logger';

export interface AppErrorOptions {
    statusCode?: number;
    code?: string;
    details?: any;
    isPublic?: boolean;
}

export class AppError extends Error {
    public statusCode: number;
    public code: string;
    public details?: any;
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
 * Handles error response securely without leaking stack traces or internal secrets.
 */
export function handleApiError(res: Response, error: any, customDefaultMessage = 'Ocorreu um erro ao processar a solicitação'): void {
    const statusCode = error?.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    logger.error(`[API Error] Code: ${error?.code || 'UNKNOWN'}, Status: ${statusCode}`, {
        message: error?.message,
        stack: isProduction ? undefined : error?.stack
    });

    if (error?.code === 'GATEWAY_UNAVAILABLE') {
        res.status(503).json({
            success: false,
            error: 'GATEWAY_UNAVAILABLE',
            message: 'Serviço de pagamentos temporariamente indisponível. Tente novamente em instantes.',
            retryable: true
        });
        return;
    }

    const publicMessage = (statusCode < 500 || error?.isPublic)
        ? (error?.message || customDefaultMessage)
        : (isProduction ? customDefaultMessage : (error?.message || customDefaultMessage));

    res.status(statusCode).json({
        success: false,
        error: error?.code || (statusCode === 400 ? 'BAD_REQUEST' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'),
        message: publicMessage
    });
}
