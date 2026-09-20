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
                    where: { read: false }
                })
            ]);
            systemAlerts = alerts;
            unreadAlertsCount = unread;
        } catch (alertErr) {
            logger.warn('Failed to query system alerts:', alertErr);
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
            unreadAlertsCount
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
                readBy: adminUser?.id || null
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

        await (prisma as any).systemAlert.updateMany({
            where: { read: false },
            data: {
                read: true,
                readAt: new Date(),
                readBy: adminUser?.id || null
            }
        });

        res.json({ success: true, message: 'Todos os alertas foram marcados como lidos' });
    } catch (error) {
        logger.error('Error marking all alerts as read:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar alertas' });
    }
};
