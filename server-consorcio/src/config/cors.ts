import cors from 'cors';
import { env } from './env';
import { logger } from './logger';

const allowedOrigins = (env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://10.0.2.2:3000', // Android emulator
]).map(origin => origin.trim());

// Matches any localhost / 127.0.0.1 origin regardless of port (Flutter/Nuxt dev web)
const localhostOriginRe = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        // Allow Cloudflare Tunnel URLs — only the specific tunnel configured in CLOUDFLARE_TUNNEL_URL
        const tunnelUrl = env.CLOUDFLARE_TUNNEL_URL?.trim();
        if (tunnelUrl && origin === tunnelUrl) {
            return callback(null, true);
        }

        // Allow any localhost / 127.0.0.1 origin in development
        if (env.NODE_ENV === 'development' && localhostOriginRe.test(origin)) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
});
