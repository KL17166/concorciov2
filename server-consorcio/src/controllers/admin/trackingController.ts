import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const FUNNEL_ORDER = [
    'SCREEN_VIEW', 'VIEW_ITEM', 'ADD_TO_CART', 'BEGIN_CHECKOUT',
    'CHECKOUT_STEP', 'CHECKOUT_COMPLETE', 'QR_SHOWN',
    'COPY_PIX_CLICK', 'VERIFY_PAYMENT_CLICK', 'PAYMENT_CONFIRMED_VIEW',
    'BID_CREATED', 'LOGIN', 'REGISTER', 'KYC_SUBMITTED',
    'ONBOARDING_STARTED', 'ONBOARDING_COMPLETE'
];

const KNOWN_SCREENS = [
    'home', 'welcome', 'auth', 'bids', 'payment', 'checkout', 'contract',
    'adhesion', 'contracts', 'payments', 'statement', 'kyc',
    'products', 'product_detail', 'profile'
];

// GET /admin/tracking
export const getTracking = async (req: Request, res: Response) => {
    try {
        const days = Math.min(Math.max(parseInt((req.query.days as string) || '7', 10) || 7, 1), 90);
        const event = (req.query.event as string) || '';
        const screen = (req.query.screen as string) || '';
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const where: any = { createdAt: { gte: since } };
        if (event && FUNNEL_ORDER.includes(event)) where.event = event;
        if (screen && KNOWN_SCREENS.includes(screen)) where.screen = screen;

        const grouped = await prisma.trackingEvent.groupBy({
            by: ['event'],
            where: { createdAt: { gte: since } },
            _count: { event: true }
        });
        const countOf = (e: string) => grouped.find((g) => g.event === e)?._count.event || 0;
        const funnel = FUNNEL_ORDER.map((e) => ({ event: e, count: countOf(e) }));

        // KPIs principais
        const views = countOf('SCREEN_VIEW');
        const verifies = countOf('VERIFY_PAYMENT_CLICK');
        const totalCheckouts = countOf('BEGIN_CHECKOUT');
        const totalPurchases = countOf('PAYMENT_CONFIRMED_VIEW');
        const conversion = views > 0 ? ((verifies / views) * 100).toFixed(1) : '0.0';
        const checkoutConversion = totalCheckouts > 0 ? ((totalPurchases / totalCheckouts) * 100).toFixed(1) : '0.0';

        // Por tela
        const [viewsByScreen, qrByScreen, verifyByScreen] = await Promise.all([
            prisma.trackingEvent.groupBy({ by: ['screen'], where: { createdAt: { gte: since }, event: 'SCREEN_VIEW' }, _count: { screen: true } }),
            prisma.trackingEvent.groupBy({ by: ['screen'], where: { createdAt: { gte: since }, event: { in: ['GENERATE_QR_CLICK', 'QR_SHOWN'] } }, _count: { screen: true } }),
            prisma.trackingEvent.groupBy({ by: ['screen'], where: { createdAt: { gte: since }, event: 'VERIFY_PAYMENT_CLICK' }, _count: { screen: true } })
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
            return { screen: s, views: v, qr: q, verifies: f, viewToVerify: v > 0 ? ((f / v) * 100).toFixed(1) : '0.0' };
        }).sort((a, b) => b.views - a.views);

        // Série diária
        const recentForSeries = await prisma.trackingEvent.findMany({
            where: { createdAt: { gte: since } },
            select: { event: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
            take: 10000
        });
        const dayMap: Record<string, { total: number; verifies: number; checkouts: number; purchases: number }> = {};
        const dayKey = (d: Date) => d.toISOString().slice(0, 10);
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            dayMap[dayKey(d)] = { total: 0, verifies: 0, checkouts: 0, purchases: 0 };
        }
        for (const ev of recentForSeries) {
            const k = dayKey(new Date(ev.createdAt));
            const slot = dayMap[k];
            if (!slot) continue;
            slot.total++;
            if (ev.event === 'VERIFY_PAYMENT_CLICK') slot.verifies++;
            if (ev.event === 'BEGIN_CHECKOUT') slot.checkouts++;
            if (ev.event === 'PAYMENT_CONFIRMED_VIEW') slot.purchases++;
        }
        const dailySeries = Object.entries(dayMap)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([day, s]) => ({ day: day.slice(5), total: s.total, verifies: s.verifies, checkouts: s.checkouts, purchases: s.purchases }));

        // Heatmap por hora do dia
        const hourCounts = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
        for (const ev of recentForSeries) {
            const h = new Date(ev.createdAt).getHours();
            hourCounts[h]!.count++;
        }

        // Top entidades
        const entityEvents = await prisma.trackingEvent.findMany({
            where: {
                createdAt: { gte: since },
                event: { in: ['QR_SHOWN', 'VERIFY_PAYMENT_CLICK', 'BID_CREATED', 'PAYMENT_CONFIRMED_VIEW', 'VIEW_ITEM', 'ADD_TO_CART'] },
                entityId: { not: null }
            },
            select: { event: true, entityType: true, entityId: true },
            orderBy: { createdAt: 'desc' },
            take: 2000
        });
        const entityHits: Record<string, { type: string; id: string; qr: number; verifies: number; purchases: number }> = {};
        for (const ev of entityEvents) {
            const k = `${ev.entityType}:${ev.entityId}`;
            if (!entityHits[k]) entityHits[k] = { type: ev.entityType || '?', id: ev.entityId || '', qr: 0, verifies: 0, purchases: 0 };
            if (ev.event === 'VERIFY_PAYMENT_CLICK') entityHits[k]!.verifies++;
            else if (ev.event === 'PAYMENT_CONFIRMED_VIEW') entityHits[k]!.purchases++;
            else entityHits[k]!.qr++;
        }
        const topEntities = Object.values(entityHits)
            .sort((a, b) => (b.purchases * 3 + b.verifies * 2 + b.qr) - (a.purchases * 3 + a.verifies * 2 + a.qr))
            .slice(0, 10);

        const recent = await prisma.trackingEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
        // Únicos = userId distintos + guests (sem login) distintos.
        const [usersWithId, guestOnly] = await Promise.all([
            prisma.trackingEvent.groupBy({ by: ['userId'], where: { createdAt: { gte: since }, userId: { not: null } } }),
            prisma.trackingEvent.groupBy({ by: ['guestId'], where: { createdAt: { gte: since }, userId: null, guestId: { not: null } } })
        ]);
        const uniqueUsers = usersWithId.length + guestOnly.length;

        // Por campanha (atribuição first-touch gravada no metadata pelo front).
        // metadata é string JSON — agrupa em memória como a série diária.
        const attribEvents = await prisma.trackingEvent.findMany({
            where: { createdAt: { gte: since } },
            select: { event: true, metadata: true },
            orderBy: { createdAt: 'desc' },
            take: 10000
        });
        const campMap: Record<string, { campaign: string; source: string; total: number; checkouts: number; purchases: number }> = {};
        for (const ev of attribEvents) {
            let campaign = '(direto)';
            let source = '';
            try {
                const m = ev.metadata ? JSON.parse(ev.metadata) : null;
                if (m && typeof m.utm_campaign === 'string' && m.utm_campaign) campaign = m.utm_campaign.slice(0, 60);
                if (m && typeof m.utm_source === 'string' && m.utm_source) source = m.utm_source.slice(0, 40);
            } catch { /* metadata legado inválido — conta como direto */ }
            const k = `${campaign}|||${source}`;
            if (!campMap[k]) campMap[k] = { campaign, source, total: 0, checkouts: 0, purchases: 0 };
            campMap[k]!.total++;
            if (ev.event === 'BEGIN_CHECKOUT') campMap[k]!.checkouts++;
            if (ev.event === 'PAYMENT_CONFIRMED_VIEW') campMap[k]!.purchases++;
        }
        const campaignStats = Object.values(campMap)
            .map((c) => ({ ...c, conversion: c.checkouts > 0 ? ((c.purchases / c.checkouts) * 100).toFixed(1) : '0.0' }))
            .sort((a, b) => (b.purchases - a.purchases) || (b.total - a.total))
            .slice(0, 20);

        // Pixels de marketing (config exclusiva do MASTER — seção oculta p/ demais).
        const role = (req.session as any)?.user?.role as string | undefined;
        const isMaster = role === 'MASTER';
        const PIXEL_PROVIDERS = [
            { provider: 'ga4', label: 'Google (GA4)', hint: 'ID de medição, ex: G-XXXXXXXXXX' },
            { provider: 'meta', label: 'Meta (Facebook)', hint: 'ID do pixel, só números' },
            { provider: 'tiktok', label: 'TikTok', hint: 'ID do pixel (começa com C)' }
        ] as const;
        for (const p of PIXEL_PROVIDERS) {
            await prisma.pixelConfig.upsert({
                where: { provider: p.provider },
                update: {},
                create: { provider: p.provider, pixelId: '', enabled: false }
            });
        }
        const pixelRows = await prisma.pixelConfig.findMany();
        const pixelConfigs = PIXEL_PROVIDERS.map((p) => {
            const row = pixelRows.find((r) => r.provider === p.provider);
            return { ...p, pixelId: row?.pixelId ?? '', enabled: row?.enabled ?? false };
        });
        // Fluxo real 7d (prova de que está capturando).
        const PIXEL_KEY_EVENTS = ['SCREEN_VIEW', 'VIEW_ITEM', 'ADD_TO_CART', 'BEGIN_CHECKOUT', 'PAYMENT_CONFIRMED_VIEW', 'REGISTER'];
        const keyGrouped = await prisma.trackingEvent.groupBy({
            by: ['event'],
            where: { createdAt: { gte: since }, event: { in: PIXEL_KEY_EVENTS } },
            _count: { event: true }
        });
        const pixelStats = PIXEL_KEY_EVENTS.map((e) => ({
            event: e,
            count: keyGrouped.find((g) => g.event === e)?._count.event || 0
        }));

        res.render('pages/tracking/index', {
            path: '/tracking', funnel, conversion, checkoutConversion,
            totalEvents: grouped.reduce((s, g) => s + g._count.event, 0),
            uniqueUsers, totalCheckouts, totalPurchases,
            recent, days, eventFilter: event, screenFilter: screen,
            funnelOrder: FUNNEL_ORDER, knownScreens: KNOWN_SCREENS,
            screenStats, dailySeries, topEntities, hourCounts, campaignStats,
            isMaster, pixelConfigs, pixelStats
        });
    } catch (error) {
        logger.error('Tracking page error:', error);
        res.status(500).send('Erro ao carregar tracking');
    }
};

// POST /admin/tracking/pixels — salva IDs dos pixels (MASTER exclusivo).
export const updatePixels = async (req: Request, res: Response) => {
    const sessionUser = (req.session as any)?.user;
    if (sessionUser?.role !== 'MASTER') {
        req.flash('error_msg', 'Apenas o usuário mestre pode alterar os pixels.');
        return res.redirect('/admin/tracking');
    }
    try {
        const ids = (req.body?.pixelId ?? {}) as Record<string, unknown>;
        const enabled = (req.body?.enabled ?? {}) as Record<string, unknown>;
        const changes: string[] = [];
        for (const provider of ['ga4', 'meta', 'tiktok']) {
            const raw = String(ids[provider] ?? '').trim().slice(0, 64);
            if (raw && !/^[A-Za-z0-9_-]+$/.test(raw)) {
                req.flash('error_msg', `ID inválido para ${provider} (use letras, números, - ou _).`);
                return res.redirect('/admin/tracking');
            }
            const isEnabled = !!enabled[provider] && raw.length > 0;
            await prisma.pixelConfig.upsert({
                where: { provider },
                update: { pixelId: raw, enabled: isEnabled },
                create: { provider, pixelId: raw, enabled: isEnabled }
            });
            changes.push(`${provider}=${raw || '(vazio)'}:${isEnabled ? 'on' : 'off'}`);
        }
        await prisma.auditLog.create({
            data: {
                userId: sessionUser?.id ?? null,
                action: 'UPDATE_PIXELS',
                resource: 'pixel_configs',
                details: JSON.stringify({ changes }),
                ipAddress: req.ip || req.socket.remoteAddress
            }
        });
        req.flash('success_msg', 'Pixels atualizados com sucesso!');
        return res.redirect('/admin/tracking');
    } catch (error) {
        logger.error('Update pixels error:', error);
        req.flash('error_msg', 'Erro ao salvar pixels.');
        return res.redirect('/admin/tracking');
    }
};
