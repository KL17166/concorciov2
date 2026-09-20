import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { createTicket, listUserTickets } from '../../application/support/tickets';
import { handleApiError } from '../../utils/errors';

export const openTicket = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const { subscriptionId, type, subject, message } = req.body || {};
        const ticket = await createTicket({
            userId: user.userId,
            subscriptionId,
            type,
            subject,
            message
        });

        res.status(201).json({ success: true, ticket });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao abrir atendimento', req);
    }
};

export const listTickets = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const tickets = await listUserTickets(user.userId);
        res.json(tickets);
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao buscar atendimentos', req);
    }
};
