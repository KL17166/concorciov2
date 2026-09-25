import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export type AlertStatus = 'OPEN' | 'ACK' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

const TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
    OPEN: ['ACK', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'],
    ACK: ['IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'OPEN'],
    IN_PROGRESS: ['RESOLVED', 'DISMISSED', 'OPEN'],
    RESOLVED: ['OPEN'],
    DISMISSED: ['OPEN']
};

export function canTransition(from: string, to: AlertStatus): boolean {
    return (TRANSITIONS[from as AlertStatus] || []).includes(to);
}

async function audit(action: string, adminId: string | null, details: any, ip?: string) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: adminId,
                action,
                resource: 'system_alert',
                details: JSON.stringify(details),
                ipAddress: ip || 'unknown'
            }
        });
    } catch (e) {
        logger.warn(`[alertQueue] audit best-effort falhou: ${action} ${(e as Error).message}`);
    }
}

function parseDetails(details: string | null): any {
    if (!details) return {};
    try { return JSON.parse(details); } catch { return {}; }
}

/** Atendente/gerente assume a fila (claim). Idempotente por dono. */
export async function claimAlert(alertId: string, adminId: string, adminName: string, ip?: string) {
    return prisma.$transaction(async (tx: any) => {
        const alert = await tx.systemAlert.findUnique({ where: { id: alertId } });
        if (!alert) throw Object.assign(new Error('Alerta não encontrado'), { statusCode: 404 });
        if (alert.status === 'RESOLVED' || alert.status === 'DISMISSED') {
            throw Object.assign(new Error(`Alerta já ${alert.status} — reabra antes de assumir.`), { statusCode: 409 });
        }
        if (alert.assignedTo && alert.assignedTo !== adminId && alert.status !== 'OPEN') {
            throw Object.assign(new Error('Alerta já assumido por outro atendente.'), { statusCode: 409 });
        }
        const updated = await tx.systemAlert.update({
            where: { id: alertId },
            data: {
                status: 'ACK',
                assignedTo: adminId,
                assignedAt: new Date(),
                read: false
            }
        });
        await tx.auditLog.create({
            data: {
                userId: adminId,
                action: 'ALERT_CLAIMED',
                resource: 'system_alert',
                details: JSON.stringify({ alertId, type: alert.type, adminName }),
                ipAddress: ip || 'unknown'
            }
        });
        return updated;
    }, { isolationLevel: 'Serializable', timeout: 10000 });
}

/** Transição de status com trava + audit. Motivo obrigatório p/ recusa/estorno. */
export async function transitionAlert(
    alertId: string,
    to: AlertStatus,
    adminId: string,
    adminName: string,
    opts: { reason?: string; ip?: string } = {}
) {
    const { reason, ip } = opts;
    if ((to === 'DISMISSED' || to === 'RESOLVED') && !reason && to === 'DISMISSED') {
        throw Object.assign(new Error('Motivo obrigatório para dispensar/recusar (mín. 8 caracteres).'), { statusCode: 400 });
    }
    if (reason && reason.trim().length < 8 && (to === 'DISMISSED' || to === 'RESOLVED')) {
        // RESOLVED por confirmação não exige motivo; DISMISSED sempre exige
        if (to === 'DISMISSED') throw Object.assign(new Error('Motivo deve ter ao menos 8 caracteres.'), { statusCode: 400 });
    }
    return prisma.$transaction(async (tx: any) => {
        const alert = await tx.systemAlert.findUnique({ where: { id: alertId } });
        if (!alert) throw Object.assign(new Error('Alerta não encontrado'), { statusCode: 404 });
        if (!canTransition(alert.status, to)) {
            throw Object.assign(new Error(`Transição inválida: ${alert.status} → ${to}.`), { statusCode: 409 });
        }
        const d = parseDetails(alert.details);
        const data: any = { status: to };
        if (to === 'RESOLVED' || to === 'DISMISSED') {
            data.read = true;
            data.readAt = new Date();
            data.readBy = adminId;
            data.resolvedAt = new Date();
        } else {
            data.read = false;
        }
        if (!alert.assignedTo) {
            data.assignedTo = adminId;
            data.assignedAt = new Date();
        }
        const updated = await tx.systemAlert.update({ where: { id: alertId }, data });
        await tx.auditLog.create({
            data: {
                userId: adminId,
                action: to === 'RESOLVED' ? 'ALERT_RESOLVED' : to === 'DISMISSED' ? 'ALERT_DISMISSED' : 'ALERT_TRANSITION',
                resource: 'system_alert',
                details: JSON.stringify({ alertId, type: alert.type, from: alert.status, to, adminName, reason: reason || null, entityKind: alert.entityKind, entityId: alert.entityId, bidId: d.bidId || null, subscriptionId: d.subscriptionId || null }),
                ipAddress: ip || 'unknown'
            }
        });
        return updated;
    }, { isolationLevel: 'Serializable', timeout: 10000 });
}

export async function releaseAlert(alertId: string, adminId: string, adminName: string, ip?: string) {
    const updated = await (prisma as any).systemAlert.update({
        where: { id: alertId },
        data: { status: 'OPEN', assignedTo: null, assignedAt: null, read: false }
    });
    await audit('ALERT_RELEASED', adminId, { alertId, adminName }, ip);
    return updated;
}
