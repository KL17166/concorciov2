import session from 'express-session';
const { RedisStore } = require('connect-redis');
import { env } from './env';
import { redisClient } from './redis';

export const sessionStore = redisClient
    ? new RedisStore({ client: redisClient, prefix: 'consorcio:sess:', ttl: 86400 })
    : undefined;

export const sessionMiddleware = session({
    store: sessionStore, // Redis store (undefined = in-memory fallback)
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: env.NODE_ENV === 'production' ? '__Host-sessionId' : 'sessionId',
    cookie: {
        secure: env.NODE_ENV === 'production', // Force HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict',
        path: '/'
    }
});
