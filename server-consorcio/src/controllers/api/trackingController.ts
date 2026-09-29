import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { TrackEventSchema } from '../../schemas/trackingSchema';
import { recordTrackingEvent } from '../../application/tracking/recordEvent';
import { handleApiError } from '../../utils/errors';

// POST /api/track — pixel próprio (telas/cliques). Sempre 200 (best-effort);
// o userId vem do JWT (via optionalAuth) — nunca do body (anti-spoof).
// guestId (UUID do front, anônimo) costura a jornada pré-login.
export const recordClientEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as AuthPayload;
        const validation = TrackEventSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(200).json({ success: true, recorded: false });
            return;
        }
        const result = await recordTrackingEvent({
            ...validation.data,
            userId: user?.userId ?? null,
            guestId: validation.data.guestId ?? null,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        res.status(200).json({ success: true, recorded: result.recorded });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao registrar evento', req);
    }
};

// GET /api/pixel-config — IDs públicos dos pixels p/ o front (sem auth).
// Expõe SÓ os habilitados com ID preenchido. Tokens (CAPI/MP) nunca saem do env.
export const getPixelConfig = async (_req: Request, res: Response): Promise<void> => {
    try {
        const rows = await prisma.pixelConfig.findMany({ where: { enabled: true } });
        const get = (provider: string) => rows.find((r) => r.provider === provider)?.pixelId || '';
        res.json({ ga4Id: get('ga4'), metaPixelId: get('meta'), tiktokPixelId: get('tiktok') });
    } catch {
        res.json({ ga4Id: '', metaPixelId: '', tiktokPixelId: '' });
    }
};
