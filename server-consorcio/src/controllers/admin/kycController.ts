import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { AdminRoles } from '../../config/roles';
import { runFacialCheck, runBiographicalCheck } from '../../services/datavalidService';
import { pushToKycStorage, maskCpf } from '../../services/kycStorageService';

/**
 * KYC Controller — Admin verification of client identity
 * Flow: Client submits docs → Admin reviews → Approve or Reject
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Express 5 types params as string | string[] — always take the scalar value */
function param(v: string | string[]): string {
    return Array.isArray(v) ? v[0] : v;
}

function readSidecar(userId: string, filename: string): Record<string, unknown> | null {
    try {
        const primary = path.join(process.cwd(), 'storage', 'kyc', userId, filename);
        if (fs.existsSync(primary)) {
            return JSON.parse(fs.readFileSync(primary, 'utf-8')) as Record<string, unknown>;
        }
        const legacy = path.join(process.cwd(), 'public', 'uploads', 'documents', userId, filename);
        if (fs.existsSync(legacy)) {
            return JSON.parse(fs.readFileSync(legacy, 'utf-8')) as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}

function adminRole(req: Request): string {
    return (req as any).session?.user?.role ?? '';
}

function canViewFullData(role: string): boolean {
    return role === AdminRoles.MASTER || role === AdminRoles.MANAGER;
}

export const getAdminKycDocument = async (req: Request, res: Response) => {
    const userId = param(req.params.userId);
    const rawFileName = param(req.params.fileName);
    const safeFileName = path.basename(rawFileName);

    if (safeFileName !== rawFileName || safeFileName.includes('..')) {
        return res.status(400).send('Nome de arquivo inválido.');
    }

    // userId nunca entra cru no path (traversal via `..`): ids são uuid/slug.
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
        return res.status(400).send('Usuário inválido.');
    }

    const primaryPath = path.join(process.cwd(), 'storage', 'kyc', userId, safeFileName);
    const legacyPath = path.join(process.cwd(), 'public', 'uploads', 'documents', userId, safeFileName);

    let filePathToServe: string | null = null;
    if (fs.existsSync(primaryPath)) {
        filePathToServe = primaryPath;
    } else if (fs.existsSync(legacyPath)) {
        filePathToServe = legacyPath;
    }

    if (!filePathToServe) {
        return res.status(404).send('Documento não encontrado.');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.sendFile(path.resolve(filePathToServe));
};

// ── GET /admin/kyc — Queue ─────────────────────────────────────────────────────

export const getKycQueue = async (req: Request, res: Response) => {
    try {
        const rawFilter = (req.query.filter as string) || 'pending';
        const filter = ['pending', 'approved', 'rejected'].includes(rawFilter) ? rawFilter : 'pending';
        const statusMap: Record<string, string> = { pending: 'SUBMITTED', approved: 'APPROVED', rejected: 'REJECTED' };

        const pendingUsers = await prisma.user.findMany({
            where: {
                role: 'CLIENT',
                kycStatus: statusMap[filter],
            },
            include: {
                subscriptions: {
                    where: filter === 'pending' ? { status: 'PENDING_KYC' } : {},
                    include: {
                        plan: { include: { product: true } },
                        installments: { where: { number: 1 }, take: 1 },
                    },
                },
            },
            orderBy: filter === 'pending' ? { updatedAt: 'desc' } : { kycReviewedAt: 'desc' },
            take: 100,
        });

        const counts = await prisma.user.groupBy({
            by: ['kycStatus'],
            where: { role: 'CLIENT' },
            _count: { kycStatus: true },
        });
        const countOf = (s: string) => counts.find(c => c.kycStatus === s)?._count.kycStatus || 0;

        const recentlyReviewed = filter === 'pending' ? await prisma.user.findMany({
            where: {
                role: 'CLIENT',
                kycStatus: { in: ['APPROVED', 'REJECTED'] },
                kycReviewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            orderBy: { kycReviewedAt: 'desc' },
            take: 20,
        }) : [];

        res.render('pages/kyc/index', {
            path: '/kyc',
            filter,
            pendingUsers,
            recentlyReviewed,
            counts: {
                pending: countOf('SUBMITTED'),
                approved: countOf('APPROVED'),
                rejected: countOf('REJECTED'),
            },
        });
    } catch (error) {
        logger.error('KYC queue error:', error);
        res.status(500).send('Erro ao carregar fila de KYC');
    }
};

// ── GET /admin/kyc/:userId — Detail (role-gated) ───────────────────────────────
/**
 * Access rules:
 *   MASTER / MANAGER — full unmasked CPF, image URLs, full raw Datavalid JSON
 *   SUPPORT          — masked CPF, kycStatus only, no images, no Datavalid result
 */
export const getKycDetail = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const role = adminRole(req);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                cpf: true,
                kycStatus: true,
                kycReviewedAt: true,
                kycReviewedBy: true,
                kycRejectReason: true,
                selfieUrl: true,
                documentFrontUrl: true,
                documentBackUrl: true,
                createdAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const full = canViewFullData(role);

        // Datavalid sidecar results — only exposed to MASTER/MANAGER
        const facialResult   = full ? readSidecar(userId, 'kyc-facial-result.json')       : null;
        const bioResult      = full ? readSidecar(userId, 'kyc-biographical-result.json') : null;

        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            cpf: full ? user.cpf : maskCpf(user.cpf),
            kycStatus: user.kycStatus,
            kycReviewedAt: user.kycReviewedAt,
            kycReviewedBy: user.kycReviewedBy,
            kycRejectReason: user.kycRejectReason,
            createdAt: user.createdAt,
            // Images — only MASTER/MANAGER
            selfieUrl:         full ? user.selfieUrl         : undefined,
            documentFrontUrl:  full ? user.documentFrontUrl  : undefined,
            documentBackUrl:   full ? user.documentBackUrl   : undefined,
            // Datavalid raw results — only MASTER/MANAGER
            datavalid: full ? { facial: facialResult, biographical: bioResult } : undefined,
            // Caller's role so the frontend can adapt its UI
            viewerRole: role,
        };

        res.json(payload);
    } catch (error) {
        logger.error('KYC detail error:', error);
        res.status(500).json({ error: 'Erro ao carregar detalhes do KYC' });
    }
};

// ── POST /admin/kyc/:userId/approve ───────────────────────────────────────────

export const approveKyc = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const adminId = (req as any).session?.user?.id || 'unknown';

        // B7: ativação atômica — antes eram N updates fora de transação
        // (queda no meio deixava usuário aprovado com contratos pendentes).
        const activated = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    kycStatus: 'APPROVED',
                    kycReviewedAt: new Date(),
                    kycReviewedBy: adminId,
                    kycRejectReason: null,
                },
            });

            const pendingSubscriptions = await tx.subscription.findMany({
                where: { userId, status: 'PENDING_KYC' },
                select: { id: true },
            });

            for (const sub of pendingSubscriptions) {
                await tx.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'ACTIVE' },
                });
            }
            return pendingSubscriptions.length;
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        logger.info(`KYC APPROVED: user ${userId} by admin ${adminId}. Activated ${activated} subscriptions.`);

        try {
            await prisma.auditLog.create({
                data: { userId: adminId, action: 'KYC_APPROVED', resource: 'user', details: JSON.stringify({ targetUserId: userId, activated, adminName: (req as any).session?.user?.name || null }), ipAddress: req.ip || 'unknown' }
            });
            await (prisma as any).systemAlert.updateMany({
                where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] }, details: { contains: userId } },
                data: { status: 'RESOLVED', read: true, readAt: new Date(), readBy: adminId, resolvedAt: new Date() }
            });
        } catch { /* audit best-effort */ }

        (req as any).flash?.('success', `KYC aprovado! ${activated} contrato(s) ativado(s).`);
        res.redirect('/admin/kyc');
    } catch (error) {
        logger.error('KYC approve error:', error);
        (req as any).flash?.('error', 'Erro ao aprovar KYC');
        res.redirect('/admin/kyc');
    }
};

// ── POST /admin/kyc/:userId/reject ────────────────────────────────────────────

export const rejectKyc = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const adminId = (req as any).session?.user?.id || 'unknown';
        const { reason } = req.body;
        const rejectReason = reason || 'Documentos inválidos ou ilegíveis';

        // Reprovar NÃO emite reembolso nem cancela nada (reembolso é manual e
        // aqui não há o que devolver: o contrato continua PENDING_KYC e o
        // cliente reenvia os documentos). O que precisa acontecer é a
        // notificação chegar no app pedindo o reenvio — via `notifications`.
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    kycStatus: 'REJECTED',
                    kycReviewedAt: new Date(),
                    kycReviewedBy: adminId,
                    kycRejectReason: rejectReason,
                },
            });

            await tx.notification.create({
                data: {
                    userId,
                    type: 'KYC_REJECTED',
                    title: 'Documentos recusados',
                    message: `${rejectReason} Reenvie novas fotos nítidas em Validação de Documentos para liberar sua conta.`
                }
            });
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        logger.info(`KYC REJECTED: user ${userId} by admin ${adminId}. Reason: ${rejectReason}. Contracts kept PENDING_KYC; client notified to resubmit.`);

        try {
            await prisma.auditLog.create({
                data: { userId: adminId, action: 'KYC_REJECTED', resource: 'user', details: JSON.stringify({ targetUserId: userId, reason: rejectReason, adminName: (req as any).session?.user?.name || null }), ipAddress: req.ip || 'unknown' }
            });
        } catch { /* audit best-effort */ }

        (req as any).flash?.('success', 'KYC rejeitado. O cliente foi avisado no app para reenviar os documentos.');
        res.redirect('/admin/kyc');
    } catch (error) {
        logger.error('KYC reject error:', error);
        (req as any).flash?.('error', 'Erro ao rejeitar KYC');
        res.redirect('/admin/kyc');
    }
};

// ── POST /admin/kyc/:userId/reopen ─────────────────────────────────────────────
// Devolve um KYC rejeitado para a fila (o cliente pode ter reenviado docs).
export const reopenKyc = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const adminId = (req as any).session?.user?.id || 'unknown';

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { kycStatus: true } });
        if (!user) {
            (req as any).flash?.('error', 'Usuário não encontrado');
            return res.redirect('/admin/kyc?filter=rejected');
        }
        if (user.kycStatus !== 'REJECTED') {
            (req as any).flash?.('error', 'Só é possível reabrir KYC rejeitado');
            return res.redirect('/admin/kyc');
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: 'SUBMITTED',
                kycReviewedAt: null,
                kycReviewedBy: adminId,
                kycRejectReason: null,
            },
        });

        logger.info(`KYC REOPENED: user ${userId} by admin ${adminId}`);
        (req as any).flash?.('success', 'KYC devolvido para a fila de análise.');
        res.redirect('/admin/kyc');
    } catch (error) {
        logger.error('KYC reopen error:', error);
        (req as any).flash?.('error', 'Erro ao reabrir KYC');
        res.redirect('/admin/kyc?filter=rejected');
    }
};

// ── POST /admin/kyc/:userId/propose — Atendente (SUPPORT) propõe aprovação p/ gerente ──
export const proposeKyc = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const admin = (req as any).session?.user;
        const note = ((req.body?.note as string) || '').trim();
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, kycStatus: true } });
        if (!user) {
            (req as any).flash?.('error', 'Usuário não encontrado');
            return res.redirect('/admin/kyc');
        }
        if (user.kycStatus !== 'SUBMITTED') {
            (req as any).flash?.('error', 'Só é possível propor aprovação de KYC enviado (SUBMITTED).');
            return res.redirect('/admin/kyc');
        }
        const since = new Date(Date.now() - 30 * 60 * 1000);
        const dup = await (prisma as any).systemAlert.findFirst({
            where: { type: 'KYC_PROPOSAL', entityId: userId, createdAt: { gte: since }, status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } },
            select: { id: true }
        });
        if (dup) {
            (req as any).flash?.('error', 'Já existe proposta aberta para este cliente na Central.');
            return res.redirect('/admin/kyc');
        }
        await (prisma as any).systemAlert.create({
            data: {
                type: 'KYC_PROPOSAL',
                severity: 'INFO',
                title: 'Atendente propôs aprovação de KYC',
                message: `${admin?.name || 'Atendente'} propôs aprovar o KYC de ${user.name}.${note ? ` Nota: ${note}` : ''} Aguardando gerente.`,
                status: 'OPEN',
                assignedTo: admin?.id || null,
                assignedAt: new Date(),
                entityKind: 'user',
                entityId: userId,
                details: JSON.stringify({ userId, proposedBy: admin?.id, note: note || null })
            }
        });
        await prisma.auditLog.create({
            data: { userId: admin?.id || null, action: 'KYC_PROPOSED', resource: 'user', details: JSON.stringify({ targetUserId: userId, note: note || null, adminName: admin?.name }), ipAddress: req.ip || 'unknown' }
        });
        (req as any).flash?.('success', 'Proposta enviada ao gerente na Central de Notificações.');
        res.redirect('/admin/kyc');
    } catch (error) {
        logger.error('KYC propose error:', error);
        (req as any).flash?.('error', 'Erro ao propor aprovação');
        res.redirect('/admin/kyc');
    }
};

// ── POST /admin/kyc/:userId/override — Manual override (MASTER/MANAGER only) ──
/**
 * Manually approve or reject KYC regardless of the Datavalid result.
 * Body: { action: 'approve' | 'reject', reason?: string }
 *
 * A failed Datavalid check never permanently blocks a user — MASTER/MANAGER
 * can always call this endpoint to override it.
 */
export const overrideKyc = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const adminId = (req as any).session?.user?.id || 'unknown';
        const { action, reason } = req.body as { action: string; reason?: string };

        if (action !== 'approve' && action !== 'reject') {
            return res.status(400).json({ error: 'action must be "approve" or "reject"' });
        }

        const overrideNote = `Manual override by ${adminId}${reason ? `: ${reason}` : ''}`;

        if (action === 'approve') {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    kycStatus: 'APPROVED',
                    kycReviewedAt: new Date(),
                    kycReviewedBy: adminId,
                    kycRejectReason: null,
                },
            });

            const pendingSubscriptions = await prisma.subscription.findMany({
                where: { userId, status: 'PENDING_KYC' },
            });

            for (const sub of pendingSubscriptions) {
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'ACTIVE' },
                });
            }

            logger.info(`KYC OVERRIDE APPROVED: user ${userId}. ${overrideNote}. Activated ${pendingSubscriptions.length} subscriptions.`);
            return res.json({ ok: true, kycStatus: 'APPROVED', activatedSubscriptions: pendingSubscriptions.length });
        }

        // action === 'reject' (sem cancelamento/reembolso — igual ao rejectKyc:
        // o contrato continua e o cliente reenvia; a notificação chega no app).
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    kycStatus: 'REJECTED',
                    kycReviewedAt: new Date(),
                    kycReviewedBy: adminId,
                    kycRejectReason: overrideNote,
                },
            });
            await tx.notification.create({
                data: {
                    userId,
                    type: 'KYC_REJECTED',
                    title: 'Documentos recusados',
                    message: `${overrideNote} Reenvie novas fotos nítidas em Validação de Documentos para liberar sua conta.`
                }
            });
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        logger.info(`KYC OVERRIDE REJECTED: user ${userId}. ${overrideNote}.`);
        return res.json({ ok: true, kycStatus: 'REJECTED' });
    } catch (error) {
        logger.error('KYC override error:', error);
        res.status(500).json({ error: 'Erro ao processar override de KYC' });
    }
};

// ── POST /admin/kyc/:userId/retrigger — Re-run Datavalid (MASTER/MANAGER only) ─
/**
 * Re-triggers Datavalid validation using the user's currently stored files.
 * Updates the JSON sidecar and pushes a new copy to VPS.
 * Body: { step: 'facial' | 'biographical' }
 */
export const retriggerKyc = async (req: Request, res: Response) => {
    try {
        const userId = param(req.params.userId);
        const { step } = req.body as { step: string };

        if (step !== 'facial' && step !== 'biographical') {
            return res.status(400).json({ error: 'step must be "facial" or "biographical"' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { cpf: true, name: true, selfieUrl: true, documentFrontUrl: true },
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const kycDir = path.join(process.cwd(), 'public', 'uploads', 'documents', userId);

        if (step === 'facial') {
            if (!user.selfieUrl) {
                return res.status(422).json({ error: 'No selfie on record for this user' });
            }
            const selfieDiskPath = path.join(process.cwd(), user.selfieUrl.replace(/^\//, ''));
            if (!fs.existsSync(selfieDiskPath)) {
                return res.status(422).json({ error: 'Selfie file not found on disk' });
            }

            const imageBuffer = fs.readFileSync(selfieDiskPath);
            const { error, rawResponse } = await runFacialCheck(user.cpf, imageBuffer);

            const sidecar = {
                kycStep: 'facial_check',
                timestamp: new Date().toISOString(),
                retriggeredBy: (req as any).session?.user?.id,
                passed: error === null,
                errorReason: error?.type === 'validation_failed' ? error.reason : null,
                rawResponse,
            };

            fs.writeFileSync(
                path.join(kycDir, 'kyc-facial-result.json'),
                JSON.stringify(sidecar, null, 2),
            );

            pushToKycStorage({
                userId,
                cpf: user.cpf,
                fileType: 'selfie',
                imageBuffer,
                imageFilename: path.basename(selfieDiskPath),
                datavalidResult: rawResponse,
                kycStep: 'facial_check',
            });

            logger.info(`KYC retrigger facial: user ${userId}, passed=${error === null}`);
            return res.json({ passed: error === null, errorReason: sidecar.errorReason, rawResponse });
        }

        // step === 'biographical'
        const { error, rawResponse } = await runBiographicalCheck(user.cpf, user.name ?? '');

        const sidecar = {
            kycStep: 'biographical_check',
            timestamp: new Date().toISOString(),
            retriggeredBy: (req as any).session?.user?.id,
            passed: error === null,
            errorReason: error?.type === 'validation_failed' ? error.reason : null,
            rawResponse,
        };

        fs.writeFileSync(
            path.join(kycDir, 'kyc-biographical-result.json'),
            JSON.stringify(sidecar, null, 2),
        );

        // No image file for biographical (it's a pure DB-data check) — skip VPS image push
        logger.info(`KYC retrigger biographical: user ${userId}, passed=${error === null}`);
        return res.json({ passed: error === null, errorReason: sidecar.errorReason, rawResponse });
    } catch (error) {
        logger.error('KYC retrigger error:', error);
        res.status(500).json({ error: 'Erro ao re-executar validação Datavalid' });
    }
};
