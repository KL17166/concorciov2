import express from 'express';
import compression from 'compression';
import hpp from 'hpp';
import path from 'path';
import ejs from 'ejs';
import flash from 'connect-flash';

import { env } from './config/env';
import { prisma } from './config/database';
import { redisClient } from './config/redis';
import { logger } from './config/logger';

// Modular Configurations
import { helmetMiddleware, permissionsPolicyMiddleware } from './config/securityHeaders';
import { corsMiddleware } from './config/cors';
import { sessionMiddleware } from './config/session';
import {
    generalLimiter,
    apiAuthLimiter,
    apiRegisterLimiter,
    paymentGenerationLimiter,
    bidLimiter,
    subscriptionRouteRateLimiter,
    kycSubmitLimiter,
    adminGeneralLimiter,
    adminAuthLimiter,
    sessionLimiter
} from './config/rateLimits';

// Middlewares
import { errorHandler } from './middlewares/errorHandler';
import { securityMiddleware, honeypotHandler, HONEYPOT_ROUTES } from './middlewares/securityMiddleware';

// Routers
import routes from './routes';
import adminRoutes from './routes/adminRoutes';
import webhookRoutes from './routes/webhookRoutes';

export { redisClient };

const app = express();

// ========================================
// SECURITY & HEADERS
// ========================================
app.use(helmetMiddleware);
app.use(permissionsPolicyMiddleware);
app.disable('x-powered-by');

// Block access to hidden files (.env, .git, etc.)
app.use((req, res, next) => {
    if (req.path.includes('/.') || req.path.includes('\\.')) {
        logger.warn(`Blocked attempt to access hidden file: ${req.path} from ${req.ip}`);
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use(hpp());

// Compression (60-80% response size reduction)
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

app.set('trust proxy', 1);

// ========================================
// CORS & BODY PARSERS
// ========================================
app.use(corsMiddleware);

app.use(express.json({
    limit: '1mb',
    reviver: (key, value) => {
        // Prototype pollution protection during JSON parsing
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            return undefined;
        }
        return value;
    },
    verify: (req: any, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ========================================
// RATE LIMITING
// ========================================
app.use('/api', generalLimiter);
app.use('/api/auth/login', apiAuthLimiter);
app.use('/api/auth/register', apiRegisterLimiter);
app.use('/api/payments', paymentGenerationLimiter);
app.use('/api/bids', bidLimiter);
app.use('/api/subscriptions', subscriptionRouteRateLimiter);
app.use('/api/kyc/submit', kycSubmitLimiter);
app.use('/admin', adminGeneralLimiter);
app.use('/admin/login', adminAuthLimiter);

// ========================================
// VIEW ENGINE & SESSIONS
// ========================================
const viewsPath = path.join(__dirname, 'views');
app.set('views', viewsPath);
app.set('view engine', 'ejs');

app.engine('ejs', (filePath: string, options: any, callback: any) => {
    ejs.renderFile(filePath, options, {
        views: [viewsPath, path.join(viewsPath, 'pages')],
        async: false
    }, callback);
});

app.use(sessionMiddleware);
app.use(sessionLimiter);
app.use(flash());

// Flash messages & user context for views
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = (req as any).session?.user || null;
    next();
});

// Request Logger
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// ========================================
// HONEYPOT & WEBHOOKS
// ========================================
const apiHoneypots = HONEYPOT_ROUTES.filter(p => p.startsWith('/api'));
apiHoneypots.forEach(p => {
    app.all(p, honeypotHandler);
});

// Webhook routes BEFORE security middleware
app.use('/api/webhooks', webhookRoutes);

// Security Middleware (IP threat protection)
app.use('/api', securityMiddleware);
app.use('/admin', securityMiddleware);

// ========================================
// ROUTING
// ========================================
app.use('/api', routes);
app.use('/admin', adminRoutes);
app.get('/admin', (_req, res) => res.redirect('/admin/login'));

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Health Check
app.get('/health', async (_req, res) => {
    const memUsage = process.memoryUsage();
    let dbStatus = 'ok';
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = 'error';
    }
    res.status(dbStatus === 'ok' ? 200 : 503).json({
        status: dbStatus === 'ok' ? 'OK' : 'DEGRADED',
        uptime: Math.floor(process.uptime()) + 's',
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
            heap: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        },
        database: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;
