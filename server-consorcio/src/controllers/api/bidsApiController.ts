import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { createBid } from '../../application/bids/createBid';
import { listUserBids } from '../../application/bids/listUserBids';
import { cancelBid } from '../../application/bids/cancelBid';
import { generateBidPix } from '../../application/bids/generateBidPix';
import { CreateBidSchema } from '../../schemas/bidSchema';
import { handleApiError } from '../../utils/errors';

export const createClientBid = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = CreateBidSchema.safeParse(req.body);
        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message || 'Dados incompletos';
            res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: firstError
            });
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
        handleApiError(res, error, 'Erro ao registrar lance', req);
    }
};

export const listClientBids = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId as string;
        const bids = await listUserBids(userId);
        res.json(bids);
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao buscar lances', req);
    }
};

export const cancelClientBid = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    const bidId = req.params.id as string;
    try {
        const result = await cancelBid({
            bidId,
            requesterUserId: user.userId,
            isAdmin: false
        });
        res.json({
            success: true,
            message: result.message,
            bid: result
        });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao cancelar lance', req);
    }
};

export const generateClientBidPix = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    const bidId = req.params.id as string;
    try {
        const result = await generateBidPix({
            bidId,
            requesterUserId: user.userId
        });
        res.json({
            success: true,
            message: 'PIX do lance gerado com sucesso',
            ...result
        });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao gerar PIX do lance', req);
    }
};

