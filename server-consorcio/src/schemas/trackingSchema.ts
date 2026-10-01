import { z } from 'zod';

// Pixel próprio — allowlists fechadas: nada fora do enum é persistido.
// metadata é JSON pequeno (≤2KB) para contexto (ex: {screen, reused}).
export const TRACK_EVENTS = [
    'SCREEN_VIEW',
    'VIEW_ITEM_LIST',
    'VIEW_ITEM',
    'SEARCH',
    'FILTER_CATEGORY',
    'ADD_TO_CART',
    'BEGIN_CHECKOUT',
    'CHECKOUT_STEP',
    'CHECKOUT_COMPLETE',
    'GENERATE_QR_CLICK',
    'QR_SHOWN',
    'COPY_PIX_CLICK',
    'VERIFY_PAYMENT_CLICK',
    'PAYMENT_CONFIRMED_VIEW',
    'BID_CREATED',
    'BID_VIEWED',
    'LOGIN',
    'LOGOUT',
    'REGISTER',
    'KYC_STARTED',
    'KYC_SUBMITTED',
    'KYC_APPROVED',
    'KYC_REJECTED',
    'ONBOARDING_STARTED',
    'ONBOARDING_COMPLETE',
    'SHARE',
    'NOTIFICATION_CLICK'
] as const;

export const TRACK_SCREENS = [
    'home',
    'welcome',
    'catalogo',
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
    'product_detail',
    'profile'
] as const;

export const TRACK_ENTITY_TYPES = ['bid', 'installment', 'subscription', 'product', 'user'] as const;

export const TrackEventSchema = z.object({
    event: z.enum(TRACK_EVENTS),
    screen: z.enum(TRACK_SCREENS).optional().nullable(),
    entityType: z.enum(TRACK_ENTITY_TYPES).optional().nullable(),
    entityId: z.string().uuid().or(z.string().regex(/^[a-z0-9][a-z0-9-_]{0,119}$/i)).optional().nullable(),
    guestId: z.string().uuid().optional().nullable(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .nullable()
        .refine(
            (v) => !v || JSON.stringify(v).length <= 2048,
            { message: 'metadata deve ter no máximo 2KB' }
        )
}).strict();

export type TrackEventInput = z.infer<typeof TrackEventSchema>;
