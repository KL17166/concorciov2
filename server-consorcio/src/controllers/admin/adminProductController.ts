import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { paginate, paginationMeta, buildPageUrl } from '../../utils/pagination';
import { safeParseImageUrls, safeParseSpecs } from '../../mappers/productMapper';
import { validateMagicBytes } from '../../security/magicBytes';

// Calcula parcela mensal estimada (mesma regra da API pública)
const estimateMonthly = (price: number, adminFeeRate: number, fundRate = 2.0, months: number) => {
    if (!months || months <= 0) return price;
    const total = price * (1 + (Number(adminFeeRate) + Number(fundRate)) / 100);
    return Number((total / months).toFixed(2));
};

const parseDisplayOrder = (raw: any, fallback: number): number => {
    const n = parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};

// GET /admin/products
export const listProducts = async (req: Request, res: Response) => {
    try {
        const typeFilter = req.query.type as string | undefined;
        const q = ((req.query.q as string) || '').trim();
        const where: any = typeFilter ? { type: typeFilter.toUpperCase() } : {};
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { brand: { contains: q, mode: 'insensitive' } },
                { model: { contains: q, mode: 'insensitive' } }
            ];
        }
        const { page, limit, skip } = paginate(req);

        const [products, total, maxOrderRow, groups] = await Promise.all([
            prisma.product.findMany({
                where,
                include: { plans: true },
                orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
                skip,
                take: limit
            }),
            prisma.product.count({ where }),
            prisma.product.aggregate({ _max: { displayOrder: true } }),
            // Totais GLOBAIS p/ os cards (a página mostra só `limit`; contar `products.length` mente)
            prisma.product.groupBy({ by: ['active', 'type'], _count: { _all: true } })
        ]);
        let totalActive = 0, totalMotos = 0;
        for (const g of groups as any[]) {
            if (g.active) totalActive += g._count._all;
            if (g.type === 'MOTO') totalMotos += g._count._all;
        }
        const grandTotal = await prisma.product.count();

        const parsedProducts = products.map(p => {
            const price = p.price.toNumber();
            const maxDuration = (p as any).maxDuration || 60;
            const adminFeeRate = Number((p as any).adminFeeRate ?? 15);
            // Revisão de fotos (extração por IA): quantas da galeria já foram conferidas
            let gallery: string[] = [];
            let verified: string[] = [];
            try {
                const raw = safeParseImageUrls((p as any).imageUrls);
                gallery = Array.isArray(raw) ? raw : [];
            } catch { gallery = []; }
            try {
                const v = (p as any).verifiedImageUrls ? JSON.parse((p as any).verifiedImageUrls) : [];
                verified = Array.isArray(v) ? v : [];
            } catch { verified = []; }
            const photosVerified = gallery.filter(u => verified.includes(u)).length;
            return {
                ...p,
                price,
                photosTotal: gallery.length,
                photosVerified,
                photosAllVerified: gallery.length > 0 && photosVerified === gallery.length,
                specs: safeParseSpecs((p as any).specs),
                imageList: safeParseImageUrls((p as any).imageUrls),
                displayOrder: (p as any).displayOrder ?? 0,
                estimatedMonthly: estimateMonthly(price, adminFeeRate, 2.0, maxDuration)
            };
        });

        const pagination = paginationMeta(total, page, limit);

        res.render('pages/products/index', {
            path: '/products',
            products: parsedProducts,
            typeFilter: typeFilter || '',
            pagination,
            totals: { total: grandTotal, active: totalActive, inactive: grandTotal - totalActive, motos: totalMotos, filtered: total },
            q,
            nextDisplayOrder: ((maxOrderRow._max.displayOrder ?? 0) + 10),
            buildPageUrl: (p: number) => buildPageUrl('/admin/products', req.query as Record<string, any>, p)
        });
    } catch (error) {
        logger.error('Load products error:', error);
        res.status(500).send('Erro ao carregar produtos');
    }
};

// GET /admin/products/new
export const newProductForm = async (req: Request, res: Response) => {
    const maxOrder = await prisma.product.aggregate({ _max: { displayOrder: true } });
    res.render('pages/products/form', {
        path: '/products',
        editing: false,
        nextDisplayOrder: ((maxOrder._max.displayOrder ?? 0) + 10),
        product: { active: true, type: 'MOTO', displayOrder: ((maxOrder._max.displayOrder ?? 0) + 10), stockQuantity: null }
    });
};

// POST /admin/products/new
export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, price, type, category, imageUrls, description, brand, model, year, specs, active, minDuration, maxDuration, adminFeeRate, isFeatured, isPopular } = req.body;

        const min = parseInt(minDuration) || 12;
        const max = parseInt(maxDuration) || 60;
        const fee = parseFloat(adminFeeRate) || 15.0;

        // Parse JSON lists/objects injected by our JS frontend
        let parsedImageUrls: string[] = [];
        try { if (imageUrls) parsedImageUrls = JSON.parse(imageUrls); } catch (e) {}

        // Se a lista estiver vazia mas houver pelo menos uma URL enviada (caso raro de falha no JS do form), tenta salvar
        if (parsedImageUrls.length === 0 && req.body.imageUrl) {
            parsedImageUrls.push(req.body.imageUrl);
        }

        // Parse JSON specs injected by our JS frontend
        let parsedSpecs: any = {};
        try { if (specs) parsedSpecs = JSON.parse(specs); } catch(e) {}

        const maxOrder = await prisma.product.aggregate({ _max: { displayOrder: true } });
        const displayOrder = parseDisplayOrder(req.body.displayOrder, (maxOrder._max.displayOrder ?? 0) + 10);

        const product = await prisma.product.create({
            data: {
                name,
                price: parseFloat(price),
                type: type || 'MOTO',
                category: category || 'geral',
                imageUrl: parsedImageUrls.length > 0 ? parsedImageUrls[0] : '',
                imageUrls: JSON.stringify(parsedImageUrls),
                description,
                brand: brand || null,
                model: model || null,
                year: year ? parseInt(year) : null,
                specs: Object.keys(parsedSpecs).length > 0 ? JSON.stringify(parsedSpecs) : null,
                active: active === 'on',
                isFeatured: isFeatured === 'on',
                isPopular: isPopular === 'on',
                minDuration: min,
                maxDuration: max,
                adminFeeRate: fee,
                displayOrder
            } as any
        });

        // Auto-generate plans (e.g., every 12 months or just min/max/mid)
        const durations = new Set<number>();
        durations.add(min);
        durations.add(max);
        for (let d = min; d <= max; d += 12) {
            durations.add(d);
        }

        const plansToCreate = Array.from(durations).sort((a, b) => a - b).map(duration => ({
            name: `${duration} Meses`,
            durationMonths: duration,
            adminFeeRate: fee,
            fundRate: 2.0, // Default fund rate
            productId: product.id,
            active: true
        }));

        await prisma.consortiumPlan.createMany({ data: plansToCreate });

        req.flash('success_msg', 'Produto e planos criados com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        logger.error('Create product error:', error);
        req.flash('error_msg', 'Erro ao criar produto.');
        res.redirect('/admin/products/new');
    }
};

// GET /admin/products/:id/edit
export const editProductForm = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return res.redirect('/admin/products');

        const maxOrder = await prisma.product.aggregate({ _max: { displayOrder: true } });
        res.render('pages/products/form', {
            path: '/products',
            editing: true,
            nextDisplayOrder: ((maxOrder._max.displayOrder ?? 0) + 10),
            isDev: process.env.NODE_ENV !== 'production',
            product
        });
    } catch (e) {
        res.redirect('/admin/products');
    }
};

// POST /admin/products/:id/edit
export const updateProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const { name, price, type, category, imageUrls, description, brand, model, year, specs, active, minDuration, maxDuration, adminFeeRate, isFeatured, isPopular } = req.body;

        const min = parseInt(minDuration) || 12;
        const max = parseInt(maxDuration) || 60;
        const fee = parseFloat(adminFeeRate) || 15.0;

        // Parse JSON lists/objects injected by our JS frontend
        let parsedImageUrls: string[] = [];
        try { if (imageUrls) parsedImageUrls = JSON.parse(imageUrls); } catch (e) {}

        // Se a lista estiver vazia mas houver pelo menos uma URL enviada
        if (parsedImageUrls.length === 0 && req.body.imageUrl) {
            parsedImageUrls.push(req.body.imageUrl);
        }

        // Parse JSON specs injected by our JS frontend
        let parsedSpecs: any = {};
        try { if (specs) parsedSpecs = JSON.parse(specs); } catch(e) {}

        const current = await prisma.product.findUnique({ where: { id } });
        const displayOrder = req.body.displayOrder !== undefined && String(req.body.displayOrder).trim() !== ''
            ? parseDisplayOrder(req.body.displayOrder, (current as any)?.displayOrder ?? 0)
            : ((current as any)?.displayOrder ?? 0);

        await prisma.product.update({
            where: { id },
            data: {
                name,
                price: parseFloat(price),
                type: type || 'MOTO',
                category: category || 'geral',
                imageUrl: parsedImageUrls.length > 0 ? parsedImageUrls[0] : '',
                imageUrls: JSON.stringify(parsedImageUrls),
                description,
                brand: brand || null,
                model: model || null,
                year: year ? parseInt(year) : null,
                specs: Object.keys(parsedSpecs).length > 0 ? JSON.stringify(parsedSpecs) : null,
                active: active === 'on',
                isFeatured: isFeatured === 'on',
                isPopular: isPopular === 'on',
                minDuration: min,
                maxDuration: max,
                adminFeeRate: fee,
                displayOrder
            } as any
        });

        // Auto-generate missing plans
        const durations = new Set<number>();
        durations.add(min);
        durations.add(max);
        for (let d = min; d <= max; d += 12) {
            durations.add(d);
        }

        const existingPlans = await prisma.consortiumPlan.findMany({
             where: { productId: id }
        });
        const existingDurations = new Set(existingPlans.map(p => p.durationMonths));

        const plansToCreate = Array.from(durations)
            .filter(d => !existingDurations.has(d))
            .map(duration => ({
                name: `${duration} Meses`,
                durationMonths: duration,
                adminFeeRate: fee,
                fundRate: 2.0,
                productId: id,
                active: true
            }));

        if (plansToCreate.length > 0) {
            await prisma.consortiumPlan.createMany({ data: plansToCreate });
        }

        req.flash('success_msg', 'Produto atualizado e planos ajustados!');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao atualizar produto.');
        res.redirect(`/admin/products/${id}/edit`);
    }
};

// POST /admin/products/:id/delete
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        // Check if there are active subscriptions linked to this product's plans
        const activeSubscriptions = await prisma.subscription.count({
            where: {
                plan: { productId: id },
                status: { in: ['ACTIVE', 'PENDING', 'CONTEMPLATED'] }
            }
        });

        if (activeSubscriptions > 0) {
            req.flash('error_msg', `Não é possível excluir: existem ${activeSubscriptions} contrato(s) ativo(s) para este produto.`);
            return res.redirect('/admin/products');
        }

        // Delete plans first, then product
        await prisma.consortiumPlan.deleteMany({ where: { productId: id } });
        await prisma.product.delete({ where: { id } });

        req.flash('success_msg', 'Produto e planos removidos com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        logger.error('Delete product error:', error);
        req.flash('error_msg', 'Erro ao excluir produto.');
        res.redirect('/admin/products');
    }
};

// POST /admin/products/reorder — salva a ordem do catálogo em lote
// Aceita JSON { orders: [{ id, displayOrder }] } ou form order[id]=displayOrder
export const reorderProducts = async (req: Request, res: Response) => {
    try {
        let orders: Array<{ id: string; displayOrder: number }> = [];
        if (Array.isArray((req.body as any)?.orders)) {
            orders = (req.body as any).orders
                .filter((o: any) => o && o.id)
                .map((o: any) => ({ id: String(o.id), displayOrder: parseDisplayOrder(o.displayOrder, 0) }));
        } else if ((req.body as any)?.order && typeof (req.body as any).order === 'object') {
            orders = Object.entries((req.body as any).order).map(([id, v]) => ({ id, displayOrder: parseDisplayOrder(v, 0) }));
        }
        if (orders.length === 0) {
            if (req.accepts('json')) return res.status(400).json({ ok: false, message: 'Nenhuma ordem enviada.' });
            req.flash('error_msg', 'Nenhuma ordem enviada.');
            return res.redirect('/admin/products');
        }
        await prisma.$transaction(
            orders.map(o => prisma.product.update({ where: { id: o.id }, data: { displayOrder: o.displayOrder } as any }))
        );
        if (req.accepts('json') && !req.accepts('html')) return res.json({ ok: true, updated: orders.length });
        // fetch() com Accept: */* cai aqui — responde JSON se for XHR
        if (req.xhr || (req.headers['content-type'] || '').includes('application/json')) {
            return res.json({ ok: true, updated: orders.length });
        }
        req.flash('success_msg', `Ordem do catálogo salva (${orders.length} produtos)!`);
        return res.redirect('/admin/products');
    } catch (error) {
        logger.error('Reorder products error:', error);
        if (req.xhr || (req.headers['content-type'] || '').includes('application/json')) {
            return res.status(500).json({ ok: false, message: 'Erro ao salvar ordem.' });
        }
        req.flash('error_msg', 'Erro ao salvar ordem.');
        return res.redirect('/admin/products');
    }
};

// POST /admin/products/:id/move — sobe/desce um produto na ordem (troca com vizinho)
export const moveProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const direction = String(req.body?.direction || req.query.direction || '').toLowerCase(); // up | down
        const typeFilter = (req.body?.typeFilter || req.query.type || '') as string;
        const where = typeFilter ? { type: typeFilter.toUpperCase() } : {};
        const ordered = await prisma.product.findMany({
            where,
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, displayOrder: true }
        });
        const idx = ordered.findIndex(p => p.id === id);
        if (idx < 0) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= ordered.length) return res.json({ ok: true, moved: false });
        const a = ordered[idx] as any;
        const b = ordered[swapIdx] as any;
        await prisma.$transaction([
            prisma.product.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } as any }),
            prisma.product.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } as any })
        ]);
        // Normaliza para múltiplos de 10 se houver empate
        if (a.displayOrder === b.displayOrder) {
            const all = await prisma.product.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
            await prisma.$transaction(all.map((p, i) => prisma.product.update({ where: { id: p.id }, data: { displayOrder: (i + 1) * 10 } as any })));
        }
        return res.json({ ok: true, moved: true });
    } catch (error) {
        logger.error('Move product error:', error);
        return res.status(500).json({ ok: false, message: 'Erro ao mover produto.' });
    }
};

// POST /admin/products/:id/toggle — liga/desliga active | isFeatured | isPopular via AJAX
export const toggleProductFlag = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const field = String(req.body?.field || req.query.field || '');
        if (!['active', 'isFeatured', 'isPopular'].includes(field)) {
            return res.status(400).json({ ok: false, message: 'Campo inválido.' });
        }
        const current = await prisma.product.findUnique({ where: { id }, select: { id: true, active: true, isFeatured: true, isPopular: true } });
        if (!current) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
        const updated = await prisma.product.update({
            where: { id },
            data: { [field]: !(current as any)[field] } as any,
            select: { id: true, active: true, isFeatured: true, isPopular: true }
        });
        return res.json({ ok: true, product: updated });
    } catch (error) {
        logger.error('Toggle product flag error:', error);
        return res.status(500).json({ ok: false, message: 'Erro ao alternar status.' });
    }
};

// GET /admin/products/:id/preview — dados do produto como o app cliente vê (para o modal de pré-visualização)
export const previewProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const product = await prisma.product.findUnique({
            where: { id },
            include: { plans: { where: { active: true }, orderBy: { durationMonths: 'asc' } } }
        });
        if (!product) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
        const price = product.price.toNumber();
        const imageUrls = safeParseImageUrls((product as any).imageUrls);
        const specs = safeParseSpecs((product as any).specs);
        const plans = ((product as any).plans || []).map((plan: any) => {
            const totalRate = Number(plan.adminFeeRate) + Number(plan.fundRate);
            const totalCost = price * (1 + totalRate / 100);
            return { ...plan, monthlyInstallment: Number((totalCost / plan.durationMonths).toFixed(2)) };
        });
        const minMonthly = plans.length ? Math.min(...plans.map((p: any) => p.monthlyInstallment)) : price;
        return res.json({
            ok: true,
            product: {
                ...product,
                price,
                imageUrls,
                specs,
                plans,
                minMonthly,
                displayOrder: (product as any).displayOrder ?? 0
            }
        });
    } catch (error) {
        logger.error('Preview product error:', error);
        return res.status(500).json({ ok: false, message: 'Erro ao carregar pré-visualização.' });
    }
};

// POST /admin/products/upload - Enviar foto da galeria p/ o catálogo do app
// Salva em zuvio-web/public/img/catalogo/<tipo>/ (servido em /img/...) e devolve o path.
const CATALOG_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const CATALOG_IMG_DIRS: Record<string, string> = {
    MOTO: 'moto', CARRO: 'carro', CARTA_CREDITO: 'carta', ELETRONICO: 'eletronicos',
    IMOVEL: 'imovel', SERVICO: 'servicos'
};

export const uploadCatalogImage = async (req: Request, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) {
            return res.status(400).json({ ok: false, message: 'Nenhum arquivo enviado (campo "photo").' });
        }
        const dir = CATALOG_IMG_DIRS[String(req.body?.tipo || 'MOTO').toUpperCase()] || 'moto';
        const catalogDir = path.join(process.cwd(), '..', 'zuvio-web', 'public', 'img', 'catalogo', dir);
        if (!fs.existsSync(catalogDir)) fs.mkdirSync(catalogDir, { recursive: true });

        const slug = String(req.body?.slug || 'produto').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'produto';
        const dest = path.join(catalogDir, `${slug}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.filename).toLowerCase()}`);
        fs.renameSync(file.path, dest);

        if (!validateMagicBytes(dest)) {
            fs.unlinkSync(dest);
            return res.status(400).json({ ok: false, message: 'Arquivo não é uma imagem válida (JPG/PNG/WebP).' });
        }
        const publicPath = `/img/catalogo/${dir}/${path.basename(dest)}`;
        logger.info(`[Catalog] upload ${publicPath} por ${(req as any).session?.user?.email || 'admin'}`);
        return res.json({ ok: true, path: publicPath });
    } catch (error) {
        logger.error('Upload catalog image error:', error);
        return res.status(500).json({ ok: false, message: 'Erro ao enviar imagem.' });
    }
};

// POST /admin/products/:id/verify-image — (DEV) marcar foto como conferida por humano
export const verifyProductImage = async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ ok: false, message: 'Indisponível em produção.' });
    }
    try {
        const id = req.params.id as string;
        const imagePath = String(req.body?.path || '').trim().slice(0, 500);
        if (!imagePath) return res.status(400).json({ ok: false, message: 'Informe o path da foto.' });
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
        let verified: string[] = [];
        try {
            const raw = (product as any).verifiedImageUrls;
            verified = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(verified)) verified = [];
        } catch { verified = []; }
        if (!verified.includes(imagePath)) verified.push(imagePath);
        await prisma.product.update({ where: { id }, data: { verifiedImageUrls: JSON.stringify(verified) } as any });
        logger.info(`[Catalog] foto verificada ${imagePath} em ${id} por ${(req as any).session?.user?.email || 'admin'}`);
        return res.json({ ok: true, verified });
    } catch (error) {
        logger.error('Verify product image error:', error);
        return res.status(500).json({ ok: false, message: 'Erro ao marcar foto.' });
    }
};
