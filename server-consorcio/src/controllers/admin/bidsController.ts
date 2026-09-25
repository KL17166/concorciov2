import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { paginate, paginationMeta, buildPageUrl } from '../../utils/pagination';

import { getBidNotificationFrequency, setBidNotificationFrequency, NotificationFrequency } from '../../config/notificationSettings';

// GET /admin/bids
export const getBids = async (req: Request, res: Response) => {
    try {
        const status = (req.query.status as string) || '';
        const type   = (req.query.type   as string) || '';
        const search = (req.query.search as string) || '';
        const { page, limit, skip } = paginate(req);

        const where: any = {};
        if (status) where.status = status;
        if (type)   where.type   = type;
        if (search) {
            where.subscription = {
                user: {
                    OR: [
                        { name:  { contains: search } },
                        { email: { contains: search } },
                        { cpf:   { contains: search } }
                    ]
                }
            };
        }

        const [bids, total] = await Promise.all([
            prisma.bid.findMany({
                where,
                include: {
                    subscription: {
                        include: {
                            user: true,
                            plan: { include: { product: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.bid.count({ where })
        ]);

        // Global summary (ignores filters)
        const allBids = await prisma.bid.findMany({ select: { status: true, amount: true } });
        const totalPending      = allBids.filter(b => b.status === 'PENDING').length;
        const totalApproved     = allBids.filter(b => b.status === 'APPROVED').length;
        const totalContemplated = allBids.filter(b => b.status === 'CONTEMPLATED').length;
        const totalRejected     = allBids.filter(b => b.status === 'REJECTED').length;
        const totalAmount       = allBids.reduce((s, b) => s + Number(b.amount), 0);

        const pagination = paginationMeta(total, page, limit);
        const notificationFrequency = getBidNotificationFrequency();

        res.render('pages/bids/index', {
            path: '/bids',
            bids,
            summary: {
                totalPending,
                totalApproved,
                totalContemplated,
                totalRejected,
                totalAmount,
                total: allBids.length
            },
            status,
            type,
            search,
            pagination,
            notificationFrequency,
            buildPageUrl: (p: number) => buildPageUrl('/admin/bids', req.query as Record<string, any>, p)
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar lances');
    }
};

// GET /admin/bids/pending
export const getPendingBids = async (req: Request, res: Response) => {
    try {
        const pendingBids = await prisma.bid.findMany({
            where: { status: 'PENDING' },
            include: {
                subscription: {
                    include: {
                        user: true,
                        plan: { include: { product: true } }
                    }
                }
            },
            orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }]
        });

        const totalAmount = pendingBids.reduce((s, b) => s + Number(b.amount), 0);

        res.render('pages/bids/pending', {
            path: '/bids',
            bids: pendingBids,
            totalAmount
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar lances pendentes');
    }
};

// GET /admin/bids/:id
export const getBidDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const bid = await prisma.bid.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        user: true,
                        plan: { include: { product: true } },
                        installments: { orderBy: { number: 'asc' } }
                    }
                }
            }
        });

        if (!bid) {
            req.flash('error_msg', 'Lance não encontrado');
            return res.redirect('/admin/bids');
        }

        const installments       = bid.subscription.installments;
        const monthlyInstallment = installments[0]?.amount || 0;
        const installmentsFromBid = Number(monthlyInstallment) > 0
            ? Math.round(Number(bid.amount) / Number(monthlyInstallment))
            : 0;

        const creditValue    = Number(bid.subscription.creditValue);
        const bidPercentage  = creditValue > 0
            ? ((Number(bid.amount) / creditValue) * 100).toFixed(2)
            : '0.00';

        const paidInstallments    = installments.filter(i => i.status === 'PAID').length;
        const totalInstallments   = installments.length;
        const totalPaid           = installments
            .filter(i => i.status === 'PAID')
            .reduce((s, i) => s + Number(i.amount), 0);

        res.render('pages/bids/details', {
            path: '/bids',
            bid,
            installmentsFromBid,
            bidPercentage,
            paidInstallments,
            totalInstallments,
            totalPaid
        });
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao carregar detalhes do lance');
        res.redirect('/admin/bids');
    }
};

// POST /admin/bids/:id/approve
export const approveBid = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const bid = await prisma.bid.findUnique({ where: { id } });
        if (!bid || bid.status !== 'PENDING') {
            req.flash('error_msg', 'Lance não encontrado ou já processado');
            return res.redirect('/admin/bids');
        }
        await prisma.bid.update({ where: { id }, data: { status: 'APPROVED' } });
        req.flash('success_msg', 'Lance aprovado com sucesso!');
        res.redirect(`/admin/bids/${id}`);
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao aprovar lance');
        res.redirect(`/admin/bids/${id}`);
    }
};

// POST /admin/bids/:id/reject
export const rejectBid = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const bid = await prisma.bid.findUnique({ where: { id } });
        if (!bid || bid.status !== 'PENDING') {
            req.flash('error_msg', 'Lance não encontrado ou já processado');
            return res.redirect('/admin/bids');
        }
        await prisma.bid.update({ where: { id }, data: { status: 'REJECTED' } });
        req.flash('success_msg', 'Lance rejeitado');
        res.redirect('/admin/bids');
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao rejeitar lance');
        res.redirect(`/admin/bids/${id}`);
    }
};

// GET /admin/bids/payments - Vouchers PIX de lance aguardando confirmação manual
// (Eldorado/G2G não têm webhook automático — a baixa é conferida aqui).
export const getBidPayments = async (req: Request, res: Response) => {
    try {
        const status = (req.query.status as string) || 'ACTIVE';
        const allowed = ['ACTIVE', 'PAID', 'EXPIRED', 'CANCELLED', 'RESERVED'];
        const search = ((req.query.search as string) || '').trim();
        const gateway = ((req.query.gateway as string) || '').trim();
        const onlyClaimed = (req.query.onlyClaimed as string) === '1';
        const focusPaymentId = (req.query.paymentId as string) || '';
        const focusAlertId = (req.query.alertId as string) || '';
        const { page, limit, skip } = paginate(req);
        const where: any = allowed.includes(status) ? { status } : {};
        if (gateway) where.provider = gateway;
        if (search) {
            where.bid = {
                subscription: {
                    user: {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } },
                            { cpf: { contains: search } }
                        ]
                    }
                }
            };
            if (/^[0-9a-f-]{6,}$/i.test(search)) {
                where.OR = [{ id: search }, ...(where.bid ? [{ bid: where.bid }] : [])];
            }
        }

        let [payments, total] = await Promise.all([
            prisma.bidPayment.findMany({
                where,
                include: {
                    bid: {
                        include: {
                            subscription: {
                                include: {
                                    user: { select: { id: true, name: true, email: true, cpf: true } },
                                    plan: { include: { product: { select: { id: true, name: true } } } }
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: onlyClaimed ? 0 : skip,
                take: onlyClaimed ? 200 : limit
            }),
            prisma.bidPayment.count({ where })
        ]);

        // Join "Já paguei": alertas BID_PAYMENT_CHECK por voucher (últimos 30d)
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const checks = await (prisma as any).systemAlert.findMany({
            where: { type: 'BID_PAYMENT_CHECK', createdAt: { gte: since }, status: { in: ['OPEN', 'ACK', 'IN_PROGRESS', 'RESOLVED'] } },
            select: { details: true, createdAt: true, status: true }
        });
        const checkByPayment = new Map<string, { at: Date; count: number; status: string }>();
        const checkByBid = new Map<string, { at: Date; count: number }>();
        for (const c of checks) {
            try {
                const d = JSON.parse(c.details || '{}');
                if (d.bidPaymentId) {
                    const cur = checkByPayment.get(d.bidPaymentId) || { at: c.createdAt, count: 0, status: c.status };
                    cur.count += 1;
                    if (new Date(c.createdAt) > new Date(cur.at)) { cur.at = c.createdAt; cur.status = c.status; }
                    checkByPayment.set(d.bidPaymentId, cur);
                } else if (d.bidId) {
                    const cur = checkByBid.get(d.bidId) || { at: c.createdAt, count: 0 };
                    cur.count += 1;
                    if (new Date(c.createdAt) > new Date(cur.at)) cur.at = c.createdAt;
                    checkByBid.set(d.bidId, cur);
                }
            } catch { /* ignora details quebrado */ }
        }

        let enriched = payments.map((p: any) => ({
            ...p,
            paidClick: checkByPayment.get(p.id) || (checkByBid.get(p.bidId) ? { ...checkByBid.get(p.bidId), status: 'OPEN' } : null)
        }));
        if (onlyClaimed) {
            enriched = enriched.filter((p: any) => p.paidClick);
            total = enriched.length;
            enriched = enriched.slice(skip, skip + limit);
        }

        const pendingCount = await prisma.bidPayment.count({ where: { status: 'ACTIVE' } });
        const pagination = paginationMeta(total, page, limit);

        res.render('pages/bids/payments', {
            path: '/bids',
            payments: enriched,
            total,
            pendingCount,
            status: allowed.includes(status) ? status : '',
            search, gateway, onlyClaimed: onlyClaimed ? '1' : '',
            focusPaymentId, focusAlertId,
            pagination,
            buildPageUrl: (p: number) => buildPageUrl('/admin/bids/payments', req.query as Record<string, any>, p)
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar pagamentos de lances');
    }
};

// POST /admin/bids/payments/:paymentId/confirm - Baixa manual: confere o
// recebimento na conta da operação e marca o voucher como PAID.
export const confirmBidPayment = async (req: Request, res: Response) => {
    const paymentId = req.params.paymentId as string;
    const adminUser = (req as any).session?.user;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.bidPayment.findUnique({
                where: { id: paymentId },
                include: { bid: { select: { id: true, status: true, subscriptionId: true } } }
            });
            if (!payment) {
                throw Object.assign(new Error('Pagamento não encontrado'), { isBusinessRule: true });
            }
            if (payment.status !== 'ACTIVE') {
                throw Object.assign(
                    new Error(`Voucher já está ${payment.status} — só ACTIVE pode ser confirmado.`),
                    { isBusinessRule: true }
                );
            }
            if (payment.bid.status === 'CANCELLED') {
                throw Object.assign(
                    new Error('Lance cancelado — trate como estorno, não como baixa.'),
                    { isBusinessRule: true }
                );
            }
            if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
                await tx.bidPayment.update({ where: { id: paymentId }, data: { status: 'EXPIRED' } });
                throw Object.assign(new Error('Voucher expirado — peça ao cliente gerar um novo PIX.'), { isBusinessRule: true });
            }

            const updated = await tx.bidPayment.update({
                where: { id: paymentId },
                data: { status: 'PAID', paidAt: new Date() }
            });
            await tx.bidPayment.updateMany({
                where: { bidId: payment.bidId, status: 'ACTIVE', id: { not: paymentId } },
                data: { status: 'EXPIRED' }
            });
            await tx.auditLog.create({
                data: {
                    userId: adminUser?.id || null,
                    action: 'BID_PAYMENT_CONFIRMED_MANUAL',
                    resource: 'bid_payment',
                    details: JSON.stringify({
                        bidPaymentId: paymentId,
                        bidId: payment.bidId,
                        provider: payment.provider,
                        amount: Number(payment.amount),
                        adminName: adminUser?.name || 'Unknown'
                    }),
                    ipAddress: req.ip || req.socket.remoteAddress || 'unknown'
                }
            });
            return updated;
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        req.flash('success_msg', `Baixa confirmada: lance ${String(result.bidId).slice(0, 8)} liquidado (R$ ${Number(result.amount).toFixed(2)}).`);
        res.redirect('/admin/bids/payments');
    } catch (error: any) {
        if (error?.isBusinessRule) {
            req.flash('error_msg', error.message);
            return res.redirect('/admin/bids/payments');
        }
        logger.error(error);
        req.flash('error_msg', 'Erro ao confirmar pagamento do lance');
        res.redirect('/admin/bids/payments');
    }
};

// POST /admin/bids/payments/:paymentId/refuse - Recusa com motivo (volta p/ EXPIRED + avisa fila)
export const refuseBidPayment = async (req: Request, res: Response) => {
    const paymentId = req.params.paymentId as string;
    const adminUser = (req as any).session?.user;
    const reason = ((req.body?.reason as string) || '').trim();
    try {
        if (reason.length < 8) {
            req.flash('error_msg', 'Motivo obrigatório (mín. 8 caracteres) para recusar.');
            return res.redirect('/admin/bids/payments');
        }
        await prisma.$transaction(async (tx) => {
            const payment = await tx.bidPayment.findUnique({ where: { id: paymentId } });
            if (!payment) throw Object.assign(new Error('Pagamento não encontrado'), { isBusinessRule: true });
            if (payment.status !== 'ACTIVE') throw Object.assign(new Error(`Voucher já está ${payment.status} — só ACTIVE pode ser recusado.`), { isBusinessRule: true });
            await tx.bidPayment.update({ where: { id: paymentId }, data: { status: 'EXPIRED' } });
            await tx.auditLog.create({
                data: {
                    userId: adminUser?.id || null,
                    action: 'BID_PAYMENT_REFUSED',
                    resource: 'bid_payment',
                    details: JSON.stringify({ bidPaymentId: paymentId, bidId: payment.bidId, amount: Number(payment.amount), adminName: adminUser?.name || 'Unknown', reason }),
                    ipAddress: req.ip || 'unknown'
                }
            });
            // Encerra alertas da fila ligados a este voucher com o motivo
            await tx.systemAlert.updateMany({
                where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] }, details: { contains: paymentId } },
                data: { status: 'RESOLVED', read: true, readAt: new Date(), readBy: adminUser?.id || null, resolvedAt: new Date() }
            });
        }, { isolationLevel: 'Serializable', timeout: 10000 });
        req.flash('success_msg', 'Voucher recusado. Cliente pode gerar um novo PIX.');
        res.redirect('/admin/bids/payments');
    } catch (error: any) {
        if (error?.isBusinessRule) { req.flash('error_msg', error.message); return res.redirect('/admin/bids/payments'); }
        logger.error(error);
        req.flash('error_msg', 'Erro ao recusar pagamento do lance');
        res.redirect('/admin/bids/payments');
    }
};

// POST /admin/bids/payments/:paymentId/refund-request + /refund-confirm (dupla aprovação p/ PAID de bid CANCELLED)
export const requestBidRefund = async (req: Request, res: Response) => {
    const paymentId = req.params.paymentId as string;
    const adminUser = (req as any).session?.user;
    const reason = ((req.body?.reason as string) || '').trim();
    try {
        if (reason.length < 8) {
            req.flash('error_msg', 'Motivo obrigatório (mín. 8 caracteres) para pedir estorno.');
            return res.redirect('/admin/bids/payments?status=PAID');
        }
        const payment = await prisma.bidPayment.findUnique({ where: { id: paymentId }, include: { bid: { select: { status: true } } } });
        if (!payment || payment.status !== 'PAID') {
            req.flash('error_msg', 'Só voucher PAID pode ter estorno.');
            return res.redirect('/admin/bids/payments?status=PAID');
        }
        await (prisma as any).systemAlert.create({
            data: {
                type: 'REFUND_REQUEST',
                severity: 'CRITICAL',
                title: 'Estorno solicitado (lance)',
                message: `${adminUser?.name || 'Admin'} pediu estorno do voucher ${paymentId} (R$ ${Number(payment.amount).toFixed(2)}). Motivo: ${reason}. Exige confirmação de outro gerente/master.`,
                status: 'OPEN',
                entityKind: 'bidPayment',
                entityId: paymentId,
                details: JSON.stringify({ bidPaymentId: paymentId, bidId: payment.bidId, amount: Number(payment.amount), requestedBy: adminUser?.id, reason })
            }
        });
        await prisma.auditLog.create({
            data: { userId: adminUser?.id || null, action: 'BID_REFUND_REQUESTED', resource: 'bid_payment', details: JSON.stringify({ bidPaymentId: paymentId, reason, adminName: adminUser?.name }), ipAddress: req.ip || 'unknown' }
        });
        req.flash('success_msg', 'Estorno solicitado. Outro gerente precisa confirmar na Central.');
        res.redirect('/admin/bids/payments?status=PAID');
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao solicitar estorno');
        res.redirect('/admin/bids/payments?status=PAID');
    }
};

export const confirmBidRefund = async (req: Request, res: Response) => {
    const paymentId = req.params.paymentId as string;
    const adminUser = (req as any).session?.user;
    const providerRefundId = ((req.body?.providerRefundId as string) || '').trim();
    try {
        if (!providerRefundId) {
            req.flash('error_msg', 'Informe o ID do estorno na gateway (providerRefundId).');
            return res.redirect('/admin/bids/payments?status=PAID');
        }
        const req_alert = await (prisma as any).systemAlert.findFirst({
            where: { type: 'REFUND_REQUEST', entityId: paymentId, status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'desc' }
        });
        if (!req_alert) {
            req.flash('error_msg', 'Sem pedido de estorno OPEN para este voucher.');
            return res.redirect('/admin/bids/payments?status=PAID');
        }
        const d = JSON.parse(req_alert.details || '{}');
        if (d.requestedBy === adminUser?.id) {
            req.flash('error_msg', 'Dupla aprovação: quem pediu não pode confirmar. Chame outro gerente/master.');
            return res.redirect('/admin/bids/payments?status=PAID');
        }
        await prisma.$transaction(async (tx) => {
            await tx.bidPayment.update({ where: { id: paymentId }, data: { status: 'CANCELLED' } });
            await tx.systemAlert.update({ where: { id: req_alert.id }, data: { status: 'RESOLVED', read: true, readAt: new Date(), readBy: adminUser?.id, resolvedAt: new Date() } });
            await tx.auditLog.create({
                data: { userId: adminUser?.id || null, action: 'BID_REFUNDED', resource: 'bid_payment', details: JSON.stringify({ bidPaymentId: paymentId, providerRefundId, confirmedBy: adminUser?.name, requestedBy: d.requestedBy }), ipAddress: req.ip || 'unknown' }
            });
        }, { isolationLevel: 'Serializable', timeout: 10000 });
        req.flash('success_msg', 'Estorno confirmado e voucher baixado como CANCELLED.');
        res.redirect('/admin/bids/payments?status=PAID');
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao confirmar estorno');
        res.redirect('/admin/bids/payments?status=PAID');
    }
};
// GET /admin/bids/draw
export const getDrawPage = async (req: Request, res: Response) => {
    try {
        const approvedBids = await prisma.bid.findMany({
            where: { status: 'APPROVED', isWinner: false },
            include: {
                subscription: {
                    include: {
                        user: true,
                        plan: { include: { product: true } }
                    }
                }
            },
            orderBy: { amount: 'desc' }
        });

        const groupedBids: Record<string, any> = {};
        approvedBids.forEach(bid => {
            const key = `${bid.subscription.plan.productId}-${bid.subscription.planId}`;
            if (!groupedBids[key]) {
                groupedBids[key] = {
                    product:     bid.subscription.plan.product,
                    plan:        bid.subscription.plan,
                    bids:        [],
                    totalAmount: 0
                };
            }
            groupedBids[key].bids.push(bid);
            groupedBids[key].totalAmount += Number(bid.amount);
        });

        res.render('pages/bids/draw', {
            path: '/bids',
            groupedBids,
            totalGroups: Object.keys(groupedBids).length,
            totalApproved: approvedBids.length
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar página de sorteio');
    }
};

// POST /admin/bids/draw
export const performDraw = async (req: Request, res: Response) => {
    try {
        const { productId, planId, numberOfWinners } = req.body;

        const eligibleBids = await prisma.bid.findMany({
            where: {
                status: 'APPROVED',
                isWinner: false,
                subscription: { planId, plan: { productId } }
            },
            include: { subscription: true },
            orderBy: { amount: 'desc' }
        });

        if (eligibleBids.length === 0) {
            req.flash('error_msg', 'Não há lances elegíveis para sorteio');
            return res.redirect('/admin/bids/draw');
        }

        const winners  = eligibleBids.slice(0, parseInt(numberOfWinners) || 1);
        const drawDate = new Date();

        const ops = winners.flatMap(winner => [
            prisma.bid.update({
                where: { id: winner.id },
                data: { status: 'CONTEMPLATED', isWinner: true, drawDate, contemplatedDate: drawDate }
            }),
            prisma.subscription.update({
                where: { id: winner.subscriptionId },
                data: { contemplated: true, contemplationDate: drawDate, contemplationType: 'BID', status: 'CONTEMPLATED' }
            })
        ]);

        await prisma.$transaction(ops);

        req.flash('success_msg', `${winners.length} lance(s) contemplado(s) com sucesso!`);
        res.redirect('/admin/bids');
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao realizar sorteio');
        res.redirect('/admin/bids/draw');
    }
};

// POST /admin/bids/notification-frequency
export const updateNotificationFrequency = async (req: Request, res: Response) => {
    const { frequency } = req.body;
    try {
        if (frequency === 'HOURLY' || frequency === 'DAILY') {
            setBidNotificationFrequency(frequency);
            req.flash('success_msg', `Frequência de lembretes atualizada para: ${frequency === 'HOURLY' ? 'De hora em hora' : 'Diariamente'}`);
        } else {
            req.flash('error_msg', 'Frequência inválida');
        }
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao atualizar frequência de notificações');
    }
    res.redirect('/admin/bids');
};

