import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000').transform(Number),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    PASSWORD_PEPPER: z.string().min(16, "PASSWORD_PEPPER deve ter no mínimo 16 caracteres")
        .default(process.env.PASSWORD_PEPPER || (isProd ? '' : 'dev-pepper-secret-minimum-16-chars!')),
    ALLOWED_ORIGINS: z.string().optional(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    PIXGO_WEBHOOK_SECRET: z.string().min(16, "PIXGO_WEBHOOK_SECRET deve ter pelo menos 16 caracteres em producao").optional()
        .refine(
            (val) => !isProd || (val && val.length >= 16),
            { message: "PIXGO_WEBHOOK_SECRET é OBRIGATÓRIO em produção. Sem ele, qualquer pessoa pode simular webhooks." }
        ),

    // SigiloPay Credentials (fallback if not in DB)
    SIGILOPAY_API_KEY: z.string().optional(),
    SIGILOPAY_API_SECRET: z.string().optional(),

    // Admin Credentials for Seeding
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    ADMIN_CPF: z.string().length(11).optional(),

    // Serpro Datavalid KYC
    DATAVALID_CONSUMER_KEY: z.string().optional(),
    DATAVALID_CONSUMER_SECRET: z.string().optional(),
    DATAVALID_ENABLED: z.string().default('false').transform((v) => v === 'true'),

    // KYC VPS Storage — audit copy of every KYC submission
    KYC_STORAGE_URL: z.string().url().optional(),
    KYC_STORAGE_SECRET: z.string().optional(),

    // HMAC Request Signing
    REQUEST_SIGNING_SECRET: z.string().min(32, 'REQUEST_SIGNING_SECRET must be at least 32 characters')
        .refine(
            (val) => !isProd || (val && val.length >= 32),
            { message: 'REQUEST_SIGNING_SECRET é OBRIGATÓRIO em produção.' }
        )
        .optional(),

    // Payload Encryption (AES-256)
    PAYLOAD_ENCRYPTION_SECRET: z.string().min(32, 'PAYLOAD_ENCRYPTION_SECRET must be at least 32 characters')
        .default(process.env.PAYLOAD_ENCRYPTION_SECRET || (isProd ? '' : 'dev-secret-payload-encryption-32ch!')),
    ENCRYPTION_BYPASS_SECRET: z.string()
        .default(process.env.ENCRYPTION_BYPASS_SECRET || (isProd ? '' : 'dev-admin-bypass-secret-123')),

    // Bootstrap payload key for pre-auth requests (login/register).
    PAYLOAD_BOOTSTRAP_KEY: z.string().length(64, 'PAYLOAD_BOOTSTRAP_KEY must be 64 hex chars').optional(),

    // Cloudflare Tunnel URL
    CLOUDFLARE_TUNNEL_URL: z.string().url().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("❌ Invalid environment variables:", _env.error.format());
    process.exit(1);
}

export const env = _env.data;
