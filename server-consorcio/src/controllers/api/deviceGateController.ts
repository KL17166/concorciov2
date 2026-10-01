import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { GateEventSchema } from '../../schemas/deviceGateSchema';
import { handleApiError } from '../../utils/errors';

// POST /api/device-gate/event — telemetria do porteiro mobile-first.
// Sempre 200 (best-effort, não vaza se a validação falhar).
// Sem auth (roda pré-login): o IP + UA vêm da conexão, nunca do body.
export const recordGateEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const validation = GateEventSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(200).json({ success: true, recorded: false });
            return;
        }
        const { type, signals } = validation.data;
        logger.warn('device-gate', {
            gateEvent: type,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            signals
        });
        res.status(200).json({ success: true, recorded: true });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao registrar evento do porteiro', req);
    }
};
