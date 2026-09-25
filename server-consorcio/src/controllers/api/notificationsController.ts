import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { handleApiError } from '../../utils/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/notifications - lista as notificações do próprio usuário (dono via JWT)
export const listNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as AuthPayload;
        const [items, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId: user.userId },
                select: { id: true, type: true, title: true, message: true, read: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 20
            }),
            prisma.notification.count({ where: { userId: user.userId, read: false } })
        ]);
        res.json({ success: true, unreadCount, notifications: items });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao buscar notificações', req);
    }
};

// PATCH /api/notifications/:id/read - marca UMA notificação como lida (só do dono)
export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as AuthPayload;
        const id = req.params.id as string;
        if (!UUID_RE.test(id)) {
            res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'ID inválido' });
            return;
        }
        const updated = await prisma.notification.updateMany({
            where: { id, userId: user.userId, read: false },
            data: { read: true, readAt: new Date() }
        });
        res.json({ success: true, marked: updated.count });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao marcar notificação', req);
    }
};
