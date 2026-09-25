import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { paginate, paginationMeta, buildPageUrl } from '../../utils/pagination';
import { claimAlert, transitionAlert, releaseAlert } from '../../application/alerts/alertQueue';
import { alertTypeLabel, queueStatusLabel, verificationKindLabel, shortId, alertTypeFromLabel } from '../../utils/adminLabels';

const ALLOWED_STATUS = ['OPEN', 'ACK', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'];

function parseDetails(details: string | null): any {
    if (!details) return {};
    try { return JSON.parse(details); } catch { return {}; }
}

function alertTarget(a: any): string {
    const d = parseDetails(a.details);
    if (a.entityKind && a.entityId) {
        if (a.entityKind === 'bidPayment') return `/admin/bids/payments?paymentId=${a.entityId}`;
        if (a.entityKind === 'subscription') return `/admin/contracts/${a.entityId}`;
        if (a.entityKind === 'bid') return `/admin/bids/${a.entityId}`;
        if (a.entityKind === 'user') return `/admin/kyc?search=${a.entityId}`;
    }
    if (d.bidPaymentId) return `/admin/bids/payments?paymentId=${d.bidPaymentId}`;
    if (d.bidId) return `/admin/bids/${d.bidId}`;
    if (d.subscriptionId) return `/admin/contracts/${d.subscriptionId}`;
    return '/admin/notifications';
}

// GET /admin/notifications — Central
export const getNotifications = async (req: Request, res: Response) => {
    try {
        const status = (req.query.status as string) || 'OPEN';
        const type = (req.query.type as string) || '';
        const q = (req.query.q as string) || '';
        const mine = (req.query.mine as string) === '1';
        const unassigned = (req.query.unassigned as string) === '1';
        const highlight = (req.query.alertId as string) || (req.query.paymentId ? '' : '');
        const { page, limit, skip } = paginate(req);
        const adminId = (req as any).session?.user?.id;

        const where: any = {};
        if (ALLOWED_STATUS.includes(status)) where.status = status;
        else if (status === 'ALL' || status === '') delete where.status;
        if (type) where.type = alertTypeFromLabel(type);
        if (mine && adminId) where.assignedTo = adminId;
        if (unassigned) where.assignedTo = null;
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { message: { contains: q, mode: 'insensitive' } },
                { type: { contains: q, mode: 'insensitive' } },
                { details: { contains: q } }
            ];
        }

        const [alerts, total, openCount, mineCount, unassignedCount] = await Promise.all([
            (prisma as any).systemAlert.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
            (prisma as any).systemAlert.count({ where }),
            (prisma as any).systemAlert.count({ where: { status: 'OPEN' } }),
            adminId ? (prisma as any).systemAlert.count({ where: { assignedTo: adminId, status: { in: ['ACK', 'IN_PROGRESS'] } } }) : 0,
            (prisma as any).systemAlert.count({ where: { assignedTo: null, status: { in: ['OPEN', 'ACK'] } } })
        ]);

        const pagination = paginationMeta(total, page, limit);
        res.render('pages/notifications/index', {
            path: '/notifications',
            alerts: alerts.map((a: any) => {
                const parsed = parseDetails(a.details);
                return {
                    ...a,
                    target: alertTarget(a),
                    parsed,
                    typeLabel: alertTypeLabel(a.type),
                    statusLabel: queueStatusLabel(a.status),
                    kindLabel: verificationKindLabel(parsed),
                    shortId: shortId(a.entityId || parsed.bidPaymentId || parsed.installmentId || parsed.subscriptionId || a.id)
                };
            }),
            total, openCount, mineCount, unassignedCount,
            status: ALLOWED_STATUS.includes(status) ? status : status,
            type, q, mine: mine ? '1' : '', unassigned: unassigned ? '1' : '',
            highlight: (req.query.alertId as string) || '',
            focusPaymentId: (req.query.paymentId as string) || highlight,
            pagination,
            buildPageUrl: (p: number) => buildPageUrl('/admin/notifications', req.query as Record<string, any>, p)
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar central de notificações');
    }
};

// POST /admin/notifications/:id/claim
export const claim = async (req: Request, res: Response) => {
    try {
        const admin = (req as any).session?.user;
        await claimAlert(req.params.id as string, admin.id, admin.name, req.ip);
        req.flash('success_msg', 'Atendimento assumido por você.');
        res.redirect(req.get('Referer') || '/admin/notifications');
    } catch (e: any) {
        req.flash('error_msg', e.message || 'Erro ao assumir atendimento');
        res.redirect(req.get('Referer') || '/admin/notifications');
    }
};

// POST /admin/notifications/:id/release
export const release = async (req: Request, res: Response) => {
    try {
        const admin = (req as any).session?.user;
        await releaseAlert(req.params.id as string, admin.id, admin.name, req.ip);
        req.flash('success_msg', 'Atendimento liberado para a fila.');
        res.redirect(req.get('Referer') || '/admin/notifications');
    } catch (e: any) {
        req.flash('error_msg', e.message || 'Erro ao liberar');
        res.redirect(req.get('Referer') || '/admin/notifications');
    }
};

// POST /admin/notifications/:id/progress
export const progress = async (req: Request, res: Response) => {
    try {
        const admin = (req as any).session?.user;
        await transitionAlert(req.params.id as string, 'IN_PROGRESS', admin.id, admin.name, { ip: req.ip });
        req.flash('success_msg', 'Atendimento em andamento.');
        res.redirect(req.get('Referer') || '/admin/notifications');
    } catch (e: any) {
        req.flash('error_msg', e.message || 'Erro ao atualizar');
        res.redirect(req.get('Referer') || '/admin/notifications');
    }
};

// POST /admin/notifications/:id/resolve
export const resolve = async (req: Request, res: Response) => {
    try {
        const admin = (req as any).session?.user;
        const reason = (req.body?.reason as string) || '';
        await transitionAlert(req.params.id as string, 'RESOLVED', admin.id, admin.name, { reason, ip: req.ip });
        req.flash('success_msg', 'Atendimento concluído.');
        res.redirect(req.get('Referer') || '/admin/notifications');
    } catch (e: any) {
        req.flash('error_msg', e.message || 'Erro ao concluir');
        res.redirect(req.get('Referer') || '/admin/notifications');
    }
};

// POST /admin/notifications/:id/dismiss (motivo obrigatório)
export const dismiss = async (req: Request, res: Response) => {
    try {
        const admin = (req as any).session?.user;
        const reason = ((req.body?.reason as string) || '').trim();
        if (reason.length < 8) {
            req.flash('error_msg', 'Motivo obrigatório (mín. 8 caracteres) para dispensar/recusar.');
            return res.redirect(req.get('Referer') || '/admin/notifications');
        }
        await transitionAlert(req.params.id as string, 'DISMISSED', admin.id, admin.name, { reason, ip: req.ip });
        req.flash('success_msg', 'Alerta dispensado com motivo registrado.');
        res.redirect(req.get('Referer') || '/admin/notifications');
    } catch (e: any) {
        req.flash('error_msg', e.message || 'Erro ao dispensar');
        res.redirect(req.get('Referer') || '/admin/notifications');
    }
};

// GET /admin/notifications/stream — SSE (mesma sessão admin)
export const stream = async (req: Request, res: Response) => {
    try {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const send = async () => {
            try {
                const [open, mine] = await Promise.all([
                    (prisma as any).systemAlert.count({ where: { status: 'OPEN' } }),
                    (req as any).session?.user?.id
                        ? (prisma as any).systemAlert.count({ where: { assignedTo: (req as any).session.user.id, status: { in: ['ACK', 'IN_PROGRESS'] } } })
                        : 0
                ]);
                res.write(`data: ${JSON.stringify({ open, mine, at: new Date().toISOString() })}\n\n`);
            } catch (_) { /* mantém conexão */ }
        };
        await send();
        const timer = setInterval(send, 15000);
        req.on('close', () => clearInterval(timer));
    } catch (error) {
        logger.error(error);
        res.end();
    }
};

// GET /admin/notifications/unread-count — polling fallback do sino
export const unreadCount = async (req: Request, res: Response) => {
    try {
        const open = await (prisma as any).systemAlert.count({ where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } } });
        const latest = await (prisma as any).systemAlert.findMany({
            where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'desc' },
            take: 8
        });
        res.json({ open, alerts: latest.map((a: any) => ({ id: a.id, title: a.title, message: a.message, severity: a.severity, createdAt: a.createdAt, target: alertTarget(a) })) });
    } catch (error) {
        res.status(500).json({ open: 0, alerts: [] });
    }
};
