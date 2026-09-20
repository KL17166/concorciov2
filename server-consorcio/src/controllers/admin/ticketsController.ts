import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// GET /admin/tickets
export const listTickets = async (req: Request, res: Response) => {
    try {
        const status = (req.query.status as string) || 'OPEN';
        const valid = ['OPEN', 'IN_PROGRESS', 'CLOSED', 'ALL'];
        const filter = valid.includes(status) ? status : 'OPEN';

        const tickets = await (prisma as any).supportTicket.findMany({
            where: filter === 'ALL' ? {} : { status: filter },
            include: {
                user: { select: { id: true, name: true, email: true, cpf: true } },
                subscription: { select: { id: true, groupNumber: true, quotaNumber: true, status: true, paidInstallments: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        const openCount = await (prisma as any).supportTicket.count({ where: { status: 'OPEN' } });

        res.render('pages/tickets/index', {
            path: '/tickets',
            tickets,
            filter,
            openCount,
            csrfToken: res.locals.csrfToken || (req.session as any)?.csrfToken || ''
        });
    } catch (error) {
        logger.error('Tickets page error:', error);
        res.status(500).send('Erro ao carregar atendimentos');
    }
};

// POST /admin/tickets/:id/reply
export const replyTicket = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { adminReply, close } = req.body;

        if (!adminReply?.trim()) {
            req.flash('error_msg', 'Escreva uma resposta antes de enviar.');
            return res.redirect('/admin/tickets');
        }

        const status = close === 'true' ? 'CLOSED' : 'IN_PROGRESS';

        await (prisma as any).supportTicket.update({
            where: { id },
            data: {
                adminReply: adminReply.trim().slice(0, 2000),
                repliedBy: ((req as any).session?.user?.email) || 'admin',
                status,
                ...(status === 'CLOSED' ? { closedAt: new Date() } : {})
            }
        });

        req.flash('success_msg', status === 'CLOSED' ? 'Atendimento respondido e encerrado!' : 'Resposta enviada ao cliente!');
        res.redirect('/admin/tickets');
    } catch (error) {
        logger.error('Reply ticket error:', error);
        req.flash('error_msg', 'Erro ao responder atendimento.');
        res.redirect('/admin/tickets');
    }
};

// POST /admin/tickets/:id/close
export const closeTicket = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await (prisma as any).supportTicket.update({
            where: { id },
            data: { status: 'CLOSED', closedAt: new Date() }
        });

        req.flash('success_msg', 'Atendimento encerrado.');
        res.redirect('/admin/tickets');
    } catch (error) {
        logger.error('Close ticket error:', error);
        req.flash('error_msg', 'Erro ao encerrar atendimento.');
        res.redirect('/admin/tickets');
    }
};
