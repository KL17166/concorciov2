import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const FUNNEL_ORDER = [
    'SCREEN_VIEW',
    'GENERATE_QR_CLICK',
    'QR_SHOWN',
    'COPY_PIX_CLICK',
    'VERIFY_PAYMENT_CLICK',
    'PAYMENT_CONFIRMED_VIEW',
    'BID_CREATED'
];

const KNOWN_SCREENS = [
    'home', 'welcome', 'auth', 'bids', 'payment', 'checkout', 'contract',
    'adhesion', 'contracts', 'payments', 'statement', 'kyc', 'products', 'profile'
];

// GET /admin/tracking - Funil do pixel próprio (produto + ads)
export const getTracking = async (req: Request, res: Response) => {
    try {
        const days = Math.min(Math.max(parseInt((req.query.days as string) || '7', 10) || 7, 1), 90);
        const event = (req.query.event as string) || '';
        const screen = (req.query.screen as string) || '';
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const where: any = { createdAt: { gte: since } };
        if (event && [...FUNNEL_ORDER].includes(event)) where.event = event;
        if (screen && KNOWN_SCREENS.includes(screen)) where.screen = screen;

        const grouped = await prisma.trackingEvent.groupBy({
            by: ['event'],
            where: { createdAt: { gte: since } },
            _count: { event: true }
        });
        const countOf = (e: string) => grouped.find((g) => g.event === e)?._count.event || 0;
        const funnel = FUNNEL_ORDER.map((e) => ({ event: e, count: countOf(e) }));

        // Conversão ponta a ponta do funil de pagamento
        const views = countOf('SCREEN_VIEW');
        const verifies = countOf('VERIFY_PAYMENT_CLICK');
        const conversion = views > 0 ? ((verifies / views) * 100).toFixed(1) : '0.0';

        // Por tela: views + QR + verificações + conversão (base p/ saber onde dói)
        const [viewsByScreen, qrByScreen, verifyByScreen] = await Promise.all([
            prisma.trackingEvent.groupBy({
                by: ['screen'],
                where: { createdAt: { gte: since }, event: 'SCREEN_VIEW' },
                _count: { screen: true }
            }),
            prisma.trackingEvent.groupBy({
                by: ['screen'],
                where: { createdAt: { gte: since }, event: { in: ['GENERATE_QR_CLICK', 'QR_SHOWN'] } },
                _count: { screen: true }
            }),
            prisma.trackingEvent.groupBy({
                by: ['screen'],
                where: { createdAt: { gte: since }, event: 'VERIFY_PAYMENT_CLICK' },
                _count: { screen: true }
            })
        ]);
        const screens = [...new Set([
            ...viewsByScreen.map((g) => g.screen),
            ...qrByScreen.map((g) => g.screen),
            ...verifyByScreen.map((g) => g.screen)
        ])].filter(Boolean).sort() as string[];
        const screenStats = screens.map((s) => {
            const v = viewsByScreen.find((g) => g.screen === s)?._count.screen || 0;
            const q = qrByScreen.find((g) => g.screen === s)?._count.screen || 0;
            const f = verifyByScreen.find((g) => g.screen === s)?._count.screen || 0;
            return {
                screen: s,
                views: v,
                qr: q,
                verifies: f,
                viewToVerify: v > 0 ? ((f / v) * 100).toFixed(1) : '0.0'
            };
        }).sort((a, b) => b.views - a.views);

        // Série diária (curva de aprendizado/uso): total + verificações por dia
        const recentForSeries = await prisma.trackingEvent.findMany({
            where: { createdAt: { gte: since } },
            select: { event: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
            take: 5000
        });
        const dayMap: Record<string, { total: number; verifies: number }> = {};
        const dayKey = (d: Date) => d.toISOString().slice(0, 10);
        for (let i = 0; i < days; i++) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            dayMap[dayKey(d)] = { total: 0, verifies: 0 };
        }
        for (const ev of recentForSeries) {
            const k = dayKey(new Date(ev.createdAt));
            const slot = dayMap[k];
            if (!slot) continue;
            slot.total++;
            if (ev.event === 'VERIFY_PAYMENT_CLICK') slot.verifies++;
        }
        const dailySeries = Object.entries(dayMap)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([day, s]) => ({ day: day.slice(5), total: s.total, verifies: s.verifies }));

        // Top entidades: onde o dinheiro está se mexendo (lances/parcelas/contratos)
        const entityEvents = await prisma.trackingEvent.findMany({
            where: {
                createdAt: { gte: since },
                event: { in: ['GENERATE_QR_CLICK', 'QR_SHOWN', 'VERIFY_PAYMENT_CLICK', 'BID_CREATED'] },
                entityId: { not: null }
            },
            select: { event: true, entityType: true, entityId: true },
            orderBy: { createdAt: 'desc' },
            take: 2000
        });
        const entityHits: Record<string, { type: string; id: string; qr: number; verifies: number }> = {};
        for (const ev of entityEvents) {
            const k = `${ev.entityType}:${ev.entityId}`;
            if (!entityHits[k]) entityHits[k] = { type: ev.entityType || '?', id: ev.entityId || '', qr: 0, verifies: 0 };
            if (ev.event === 'VERIFY_PAYMENT_CLICK') entityHits[k]!.verifies++;
            else entityHits[k]!.qr++;
        }
        const topEntities = Object.values(entityHits)
            .sort((a, b) => (b.qr + b.verifies) - (a.qr + a.verifies))
            .slice(0, 10);

        const recent = await prisma.trackingEvent.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        const uniqueUsers = await prisma.trackingEvent.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: since } }
        });

        res.render('pages/tracking/index', {
            path: '/tracking',
            funnel,
            conversion,
            totalEvents: grouped.reduce((s, g) => s + g._count.event, 0),
            uniqueUsers: uniqueUsers.length,
            recent,
            days,
            eventFilter: event,
            screenFilter: screen,
            funnelOrder: FUNNEL_ORDER,
            knownScreens: KNOWN_SCREENS,
            screenStats,
            dailySeries,
            topEntities
        });
    } catch (error) {
        logger.error('Tracking page error:', error);
        res.status(500).send('Erro ao carregar tracking');
    }
};
