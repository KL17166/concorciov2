import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { TrackEventSchema } from '../../schemas/trackingSchema';
import { recordTrackingEvent } from '../../application/tracking/recordEvent';
import { handleApiError } from '../../utils/errors';

// POST /api/track — pixel próprio (telas/cliques). Sempre 200 (best-effort);
// o userId vem do JWT — nunca do body (anti-spoof de atribuição).
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
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        res.status(200).json({ success: true, recorded: result.recorded });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao registrar evento', req);
    }
};
