import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { TrackEventInput } from '../../schemas/trackingSchema';
import { learnFromEvent } from '../../services/learningService';
import { dispatchServerConversions } from '../../services/conversionsService';

// Eventos que valem dinheiro/cadastro: espelha server-side (Meta CAPI + GA4 MP).
const SERVER_MIRROR_EVENTS = new Set([
    'PAYMENT_CONFIRMED_VIEW',
    'REGISTER',
    'BEGIN_CHECKOUT',
    'ADD_TO_CART',
    'VIEW_ITEM'
]);

export interface RecordEventInput extends TrackEventInput {
    userId: string | null;
    guestId?: string | null;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Pixel próprio — registra um evento de funil (tela/clique).
 * Best-effort: nunca quebra o fluxo do cliente; valida allowlists no schema.
 */
export async function recordTrackingEvent(input: RecordEventInput): Promise<{ recorded: boolean }> {
    const { userId, guestId, event, screen, entityType, entityId, metadata, ipAddress, userAgent } = input;

    try {
        await prisma.trackingEvent.create({
            data: {
                userId,
                guestId: guestId ?? null,
                event,
                screen: screen ?? null,
                entityType: entityType ?? null,
                entityId: entityId ?? null,
                metadata: metadata ? JSON.stringify(metadata).substring(0, 2048) : null,
                ipAddress: ipAddress ? ipAddress.substring(0, 64) : null,
                userAgent: userAgent ? userAgent.substring(0, 512) : null
            }
        });
        // Loop de aprendizado: cada evento treina o ranking em tempo real.
        await learnFromEvent(userId, { event, screen, entityType, entityId, metadata });
        // Espelho server-side (fire-and-forget): recupera o que o browser perde.
        if (SERVER_MIRROR_EVENTS.has(event)) {
            const metaObj =
                metadata && typeof metadata === 'object' && !Array.isArray(metadata)
                    ? (metadata as Record<string, string | number | boolean>)
                    : null;
            dispatchServerConversions({ event, entityId, userId, metadata: metaObj, ipAddress, userAgent });
        }
        return { recorded: true };
    } catch (err) {
        logger.warn('[Tracking] Failed to record event:', err);
        return { recorded: false };
    }
}
