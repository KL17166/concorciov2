import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { createBid } from '../../application/bids/createBid';
import { listUserBids } from '../../application/bids/listUserBids';
import { CreateBidSchema } from '../../schemas/bidSchema';
import { logger } from '../../config/logger';

export const createClientBid = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = CreateBidSchema.safeParse(req.body);
        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message || 'Dados incompletos';
            res.status(400).json({ error: firstError });
            return;
        }

        const data = validation.data;

        const bid = await createBid({
            subscriptionId: data.subscriptionId,
            requesterUserId: user.userId,
            type: data.type,
            percentage: data.percentage,
            amount: data.amount
        });

        res.status(201).json({
            success: true,
            message: 'Lance registrado com sucesso!',
            bid
        });
    } catch (error: any) {
        logger.error('Error creating bid:', error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao registrar lance' });
    }
};

export const listClientBids = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId as string;
        const bids = await listUserBids(userId);
        res.json(bids);
    } catch (error: any) {
        logger.error('Error fetching bids:', error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao buscar lances' });
    }
};
