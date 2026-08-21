import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import ejs from 'ejs';
import flash from 'connect-flash';
import { prisma } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { sessionMiddleware } from './config/session';
import { redisClient } from './config/redis';
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
import { securityMiddleware, honeypotHandler, HONEYPOT_ROUTES } from './middlewares/securityMiddleware';
import { errorHandler } from './middlewares/errorHandler';

// Route imports
import routes from './routes';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhookRoutes';

const app = express();

export { redisClient };

// Trust proxy for rate limiting behind reverse proxy / Cloudflare
app.set('trust proxy', 1);

// ========================================
// SECURITY & HEADERS
// ========================================
app.use(helmet({
    contentSecurityPolicy: false, // Customized per view if needed
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

if (env.CLOUDFLARE_TUNNEL_URL) {
    allowedOrigins.push(env.CLOUDFLARE_TUNNEL_URL);
}

app.use(cors({
    origin: (origin, callback) => {
        // No origin or "null" (same-origin form submissions, privacy redirects, mobile webviews)
        if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`[CORS] Blocked origin: "${origin}" | Allowed: ${allowedOrigins.join(', ')}`);
            callback(new Error('Bloqueado por CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-pixgo-signature', 'x-pixgo-timestamp', 'x-client-device-id']
}));

// ========================================
// BODY PARSERS
// ========================================
app.use(express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
        // Save raw body for webhook HMAC signature verification
        if (req.originalUrl.includes('/webhooks/')) {
            req.rawBody = buf;
        }
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

// Request Logger with URL Query Redaction
app.use((req, res, next) => {
    const sanitizedUrl = req.url.replace(/(token|secret|password|cpf|key|apiKey)=([^&]+)/gi, '$1=[REDACTED]');
    logger.info(`${req.method} ${sanitizedUrl}`);
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

// Block direct static access to sensitive KYC documents
app.use(['/public/uploads/documents', '/uploads/documents'], (_req, res) => {
    res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Acesso direto a documentos desativado. Utilize a rota autenticada /api/kyc/documents/.'
    });
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// ========================================
// HEALTH CHECKS & OBSERVABILITY
// ========================================
// Liveness probe (Lightweight ping)
app.get('/livez', (_req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Readiness probe (Checks database connection)
app.get('/readyz', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'READY', database: 'connected' });
    } catch (err) {
        logger.error('Readiness probe failed:', err);
        res.status(503).json({ status: 'NOT_READY', database: 'disconnected' });
    }
});

// Public health check endpoint
app.get('/health', async (_req, res) => {
    let dbStatus = 'ok';
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = 'error';
    }

    const isProduction = env.NODE_ENV === 'production';
    const memUsage = process.memoryUsage();

    res.status(dbStatus === 'ok' ? 200 : 503).json({
        status: dbStatus === 'ok' ? 'OK' : 'DEGRADED',
        uptime: Math.floor(process.uptime()) + 's',
        database: dbStatus,
        timestamp: new Date().toISOString(),
        ...(!isProduction && {
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
                heap: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            }
        })
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;
