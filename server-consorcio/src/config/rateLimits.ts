import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

// Helper: extract userId from JWT for per-user rate limiting without full auth middleware
export const userIdFromBearer = (req: any): string => {
    const auth = req.headers.authorization?.split(' ')[1];
    if (auth) {
        try {
            const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString());
            if (payload?.userId) return `u:${payload.userId}`;
        } catch { /* fall through to IP */ }
    }
    return ipKeyGenerator(req);
};

// =============================================
// RATE LIMIT PROFILES (Production vs Development)
// =============================================

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 300 : 30000,
    message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const adminAuthLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isProduction ? 5 : 5000,
    message: { error: 'Muitas tentativas de login admin. Bloqueado por 10 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

export const apiAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 10 : 10000,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiRegisterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 5000,
    message: { error: 'Muitos registros. Tente novamente em 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const adminGeneralLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 300 : 30000,
    message: 'Muitas requisições ao painel admin. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const paymentGenerationLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: isProduction ? 5 : 3000,
    keyGenerator: userIdFromBearer,
    message: { error: 'Muitas solicitações de pagamento. Aguarde 5 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const bidLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isProduction ? 5 : 5000,
    keyGenerator: userIdFromBearer,
    message: { error: 'Muitos lances registrados. Aguarde 10 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const subscriptionReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 120 : 120000,
    keyGenerator: userIdFromBearer,
    message: { error: 'Muitas consultas de contratos. Aguarde alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const subscriptionCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 3000,
    keyGenerator: userIdFromBearer,
    message: { error: 'Muitos contratos criados. Aguarde 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const kycSubmitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 5000,
    keyGenerator: userIdFromBearer,
    message: { error: 'Muitas submissões de KYC. Aguarde 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const sessionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isProduction ? 120 : 120000,
    keyGenerator: (req) => (req.session as any)?.id || req.socket.remoteAddress || 'anon',
    message: { error: 'Muitas requisições por sessão. Aguarde um momento.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Method-aware rate limiter middleware for /api/subscriptions
 */
export const subscriptionRouteRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' && (req.path === '/' || req.path === '')) {
        return subscriptionCreateLimiter(req, res, next);
    }
    return subscriptionReadLimiter(req, res, next);
};
