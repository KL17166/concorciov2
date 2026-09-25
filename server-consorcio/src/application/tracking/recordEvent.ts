import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { TrackEventInput } from '../../schemas/trackingSchema';
import { learnFromEvent } from '../../services/learningService';

export interface RecordEventInput extends TrackEventInput {
    userId: string | null;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Pixel próprio — registra um evento de funil (tela/clique).
 * Best-effort: nunca quebra o fluxo do cliente; valida allowlists no schema.
 */
export async function recordTrackingEvent(input: RecordEventInput): Promise<{ recorded: boolean }> {
    const { userId, event, screen, entityType, entityId, metadata, ipAddress, userAgent } = input;

    try {
        await prisma.trackingEvent.create({
            data: {
                userId,
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
        return { recorded: true };
    } catch (err) {
        logger.warn('[Tracking] Failed to record event:', err);
        return { recorded: false };
    }
}
