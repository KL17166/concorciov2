import { z } from 'zod';

// Pixel próprio — allowlists fechadas: nada fora do enum é persistido.
// metadata é JSON pequeno (≤2KB) para contexto (ex: {screen, reused}).
export const TRACK_EVENTS = [
    'SCREEN_VIEW',
    'GENERATE_QR_CLICK',
    'QR_SHOWN',
    'COPY_PIX_CLICK',
    'VERIFY_PAYMENT_CLICK',
    'PAYMENT_CONFIRMED_VIEW',
    'BID_CREATED'
] as const;

export const TRACK_SCREENS = [
    'home',
    'welcome',
    'auth',
    'bids',
    'payment',
    'checkout',
    'contract',
    'adhesion',
    'contracts',
    'payments',
    'statement',
    'kyc',
    'products',
    'profile'
] as const;

export const TRACK_ENTITY_TYPES = ['bid', 'installment', 'subscription'] as const;

export const TrackEventSchema = z.object({
    event: z.enum(TRACK_EVENTS),
    screen: z.enum(TRACK_SCREENS).optional().nullable(),
    entityType: z.enum(TRACK_ENTITY_TYPES).optional().nullable(),
    entityId: z.string().uuid().optional().nullable(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .nullable()
        .refine(
            (v) => !v || JSON.stringify(v).length <= 2048,
            { message: 'metadata deve ter no máximo 2KB' }
        )
}).strict();

export type TrackEventInput = z.infer<typeof TrackEventSchema>;
