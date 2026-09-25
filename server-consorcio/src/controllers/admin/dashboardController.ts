import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// GET /admin/dashboard
export const getDashboard = async (req: Request, res: Response) => {
    try {
        // === BATCH 1: All count/stat queries in parallel ===
        const [
            totalUsers,
            totalContracts,
            activeContracts,
            contemplatedContracts,
            pendingAdesoes,
            openTickets,
            kycPending,
            recentContracts,
            recentTickets,
            statusGroups
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'CLIENT' } }),
            prisma.subscription.count(),
            prisma.subscription.count({ where: { status: 'ACTIVE' } }),
            prisma.subscription.count({ where: { contemplated: true } }),
            prisma.installment.count({ where: { number: 1, status: { in: ['PENDING', 'OVERDUE'] } } }),
            (prisma as any).supportTicket.count({ where: { status: 'OPEN' } }),
            prisma.user.count({ where: { kycStatus: 'SUBMITTED' } }),
            prisma.subscription.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: true,
                    plan: { include: { product: true } }
                }
            }),
            (prisma as any).supportTicket.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { name: true } } }
            }),
            prisma.subscription.groupBy({ by: ['status'], _count: { status: true } })
        ]);

        // === Contratos criados por mês (últimos 6) p/ o gráfico ===
        const contractsByMonth: Array<{ label: string; total: number }> = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
            const count = await prisma.subscription.count({
                where: { createdAt: { gte: startOfMonth, lte: endOfMonth } }
            });
            contractsByMonth.push({
                label: date.toLocaleDateString('pt-BR', { month: 'short' }),
                total: count
            });
        }

        const contractsByStatus = {
            pending: 0, active: 0, contemplated: 0, cancelled: 0, completed: 0
        };
        for (const g of statusGroups as any[]) {
            const key = String(g.status).toLowerCase();
            if (key in contractsByStatus) (contractsByStatus as any)[key] = g._count.status;
        }

        // Fetch system alerts & gateway failover notifications
        let systemAlerts: any[] = [];
        let unreadAlertsCount = 0;
        try {
            const [alerts, unread] = await Promise.all([
                (prisma as any).systemAlert.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }),
                (prisma as any).systemAlert.count({
                    where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } }
                })
            ]);
            systemAlerts = alerts;
            unreadAlertsCount = unread;
        } catch (alertErr) {
            logger.warn('Failed to query system alerts:', alertErr);
        }

        // === Aprendizado do algoritmo (pixel + pesos online) ===
        let learning: any = null;
        try {
            const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const [funnelGroups, weights, recentEvents] = await Promise.all([
                prisma.trackingEvent.groupBy({
                    by: ['event'],
                    where: { createdAt: { gte: since7d } },
                    _count: { event: true }
                }),
                prisma.learningWeight.findMany({
                    select: { scope: true, key: true, value: true, samples: true }
                }),
                prisma.trackingEvent.findMany({
                    where: { createdAt: { gte: since30d }, metadata: { not: null } },
                    select: { event: true, metadata: true },
                    orderBy: { createdAt: 'desc' },
                    take: 2000
                })
            ]);

            const funnelOrder = ['SCREEN_VIEW', 'GENERATE_QR_CLICK', 'QR_SHOWN', 'COPY_PIX_CLICK', 'VERIFY_PAYMENT_CLICK', 'PAYMENT_CONFIRMED_VIEW'];
            const countOf = (e: string) => funnelGroups.find((g) => g.event === e)?._count.event || 0;
            const funnel = funnelOrder.map((e) => ({ event: e, count: countOf(e) }));
            const views = countOf('SCREEN_VIEW');
            const verifies = countOf('VERIFY_PAYMENT_CLICK');

            // Top produtos por interesse (productId no metadata dos eventos de funil)
            const productHits: Record<string, number> = {};
            for (const ev of recentEvents) {
                try {
                    const meta = JSON.parse(ev.metadata || '{}');
                    const pid = typeof meta.productId === 'string' && meta.productId ? meta.productId : null;
                    if (pid && ['GENERATE_QR_CLICK', 'QR_SHOWN', 'BID_CREATED', 'COPY_PIX_CLICK'].includes(ev.event)) {
                        productHits[pid] = (productHits[pid] || 0) + 1;
                    }
                } catch { /* metadata inválido ignora */ }
            }
            const topProductIds = Object.entries(productHits)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            const topProducts = topProductIds.length > 0
                ? await prisma.product.findMany({
                    where: { id: { in: topProductIds.map(([id]) => id) } },
                    select: { id: true, name: true }
                })
                : [];
            const topProductsNamed = topProductIds.map(([id, hits]) => ({
                id,
                name: topProducts.find((p) => p.id === id)?.name || id.slice(0, 8),
                hits
            }));

            const w = (scope: string, key: string) =>
                weights.find((x) => x.scope === scope && x.key === key);
            const convQrVerify = w('global', 'conv:qr_verify');
            const convVerifyPaid = w('global', 'conv:verify_paid');

            learning = {
                funnel,
                totalEvents7d: funnelGroups.reduce((s, g) => s + g._count.event, 0),
                conversion: views > 0 ? ((verifies / views) * 100).toFixed(1) : '0.0',
                convQrVerify: convQrVerify ? (convQrVerify.value * 100).toFixed(1) : '—',
                convVerifyPaid: convVerifyPaid ? (convVerifyPaid.value * 100).toFixed(1) : '—',
                weightCount: weights.length,
                topProducts: topProductsNamed
            };
        } catch (learnErr) {
            logger.warn('Failed to query learning data:', learnErr);
        }

        res.render('pages/dashboard/index', {
            path: '/dashboard',
            stats: {
                totalUsers,
                totalContracts,
                activeContracts,
                contemplatedContracts,
                pendingAdesoes,
                openTickets,
                kycPending
            },
            recentContracts,
            recentTickets,
            contractsByMonth,
            contractsByStatus,
            systemAlerts,
            unreadAlertsCount,
            learning
        });
    } catch (error) {
        logger.error('Dashboard error:', error);
        res.status(500).send('Erro ao carregar dashboard');
    }
};

// POST /admin/alerts/:id/read
export const markAlertAsRead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminUser = (req as any).user;

        await (prisma as any).systemAlert.update({
            where: { id },
            data: {
                read: true,
                readAt: new Date(),
                readBy: adminUser?.id || null,
                status: 'RESOLVED',
                resolvedAt: new Date()
            }
        });

        res.json({ success: true, message: 'Alerta marcado como lido' });
    } catch (error) {
        logger.error('Error marking alert as read:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar alerta' });
    }
};

// POST /admin/alerts/read-all
export const markAllAlertsAsRead = async (req: Request, res: Response) => {
    try {
        const adminUser = (req as any).user;

        // Fase 1: "marcar todas" dispensa só as minhas + as sem dono (nunca apaga dos outros)
        await (prisma as any).systemAlert.updateMany({
            where: {
                status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] },
                OR: [{ assignedTo: null }, { assignedTo: adminUser?.id || '__none__' }]
            },
            data: {
                read: true,
                readAt: new Date(),
                readBy: adminUser?.id || null,
                status: 'RESOLVED',
                resolvedAt: new Date()
            }
        });

        res.json({ success: true, message: 'Todos os alertas foram marcados como lidos' });
    } catch (error) {
        logger.error('Error marking all alerts as read:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar alertas' });
    }
};
