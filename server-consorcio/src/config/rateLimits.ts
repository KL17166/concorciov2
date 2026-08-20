import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

/**
 * Hybrid key generator: Combines verified user identifier with client IP.
 * If token signature is invalid, safely falls back to pure IP to prevent spoofing.
 */
export const secureKeyGenerator = (req: any): string => {
    const ip = ipKeyGenerator(req);
    const auth = req.headers.authorization?.split(' ')[1];
    
    if (auth && process.env.JWT_SECRET) {
        try {
            const payload = jwt.verify(auth, process.env.JWT_SECRET, {
                algorithms: ['HS256']
            }) as any;
            if (payload?.userId) {
                return `${ip}:u:${payload.userId}`;
            }
        } catch {
            // Token is invalid/expired - limit strictly by IP
        }
    }
    return ip;
};

// =============================================
// RATE LIMIT PROFILES (Production vs Development)
// =============================================

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 300 : 1500,
    message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const adminAuthLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isProduction ? 5 : 50,
    message: { error: 'Muitas tentativas de login admin. Bloqueado por 10 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

export const apiAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 10 : 100,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiRegisterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 50,
    message: { error: 'Muitos registros. Tente novamente em 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const adminGeneralLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 300 : 1500,
    message: 'Muitas requisições ao painel admin. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const paymentGenerationLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: isProduction ? 5 : 50,
    keyGenerator: secureKeyGenerator,
    message: { error: 'Muitas solicitações de pagamento. Aguarde 5 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const bidLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isProduction ? 5 : 50,
    keyGenerator: secureKeyGenerator,
    message: { error: 'Muitos lances registrados. Aguarde 10 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const subscriptionReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 120 : 1000,
    keyGenerator: secureKeyGenerator,
    message: { error: 'Muitas consultas de contratos. Aguarde alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const subscriptionCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 50,
    keyGenerator: secureKeyGenerator,
    message: { error: 'Muitos contratos criados. Aguarde 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const kycSubmitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 5 : 50,
    keyGenerator: secureKeyGenerator,
    message: { error: 'Muitas submissões de KYC. Aguarde 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const sessionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isProduction ? 120 : 1000,
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
