import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { TrackEventInput } from '../schemas/trackingSchema';

// Taxa de aprendizado (EMA): cada evento move o peso 20% em direção ao sinal.
const ALPHA = 0.2;
// Exploração epsilon-greedy: 15% das ordenações embaralham o top para descobrir.
export const EXPLORE_RATE = 0.15;

async function bumpCounter(scope: string, key: string, by = 1) {
    try {
        await prisma.learningWeight.upsert({
            where: { scope_key: { scope, key } },
            create: { scope, key, value: by, samples: 1 },
            update: { value: { increment: by }, samples: { increment: 1 } }
        });
    } catch (err) {
        logger.warn('[Learning] bumpCounter failed:', err);
    }
}

async function emaUpdate(scope: string, key: string, signal: 0 | 1) {
    try {
        const current = await prisma.learningWeight.findUnique({
            where: { scope_key: { scope, key } }
        });
        const next = current ? current.value + ALPHA * (signal - current.value) : signal;
        await prisma.learningWeight.upsert({
            where: { scope_key: { scope, key } },
            create: { scope, key, value: next, samples: 1 },
            update: { value: next, samples: { increment: 1 } }
        });
    } catch (err) {
        logger.warn('[Learning] emaUpdate failed:', err);
    }
}

function productIdOf(input: TrackEventInput): string | null {
    const meta = input.metadata as Record<string, unknown> | null | undefined;
    const pid = meta?.productId;
    return typeof pid === 'string' && pid.length >= 8 && pid.length <= 64 ? pid : null;
}

/**
 * Coração do loop: chamado a cada evento do pixel (best-effort, nunca quebra).
 * Aprende afinidade produto-usuário, popularidade global e propensão a pagar —
 * é isso que o ranking e o dashboard consomem. Quanto mais uso, melhor fica.
 */
export async function learnFromEvent(
    userId: string | null,
    input: TrackEventInput
): Promise<void> {
    try {
        const pid = productIdOf(input);

        switch (input.event) {
            case 'GENERATE_QR_CLICK':
            case 'QR_SHOWN':
                if (pid) {
                    if (userId) await bumpCounter(userId, `aff:PROD:${pid}`, 1);
                    await bumpCounter('global', `pop:PROD:${pid}`, 1);
                }
                break;
            case 'BID_CREATED':
                if (pid) {
                    // Lance criado = sinal forte (3x): intenção real de compra.
                    if (userId) await bumpCounter(userId, `aff:PROD:${pid}`, 3);
                    await bumpCounter('global', `pop:PROD:${pid}`, 3);
                }
                break;
            case 'VERIFY_PAYMENT_CLICK':
                if (userId) await emaUpdate(userId, 'prop:verify', 1);
                await emaUpdate('global', 'conv:qr_verify', 1);
                break;
            case 'PAYMENT_CONFIRMED_VIEW':
                if (userId) await emaUpdate(userId, 'prop:pay', 1);
                await emaUpdate('global', 'conv:verify_paid', 1);
                break;
            case 'COPY_PIX_CLICK':
                if (pid && userId) await bumpCounter(userId, `aff:PROD:${pid}`, 1);
                break;
            default:
                break;
        }
    } catch (err) {
        logger.warn('[Learning] learnFromEvent failed:', err);
    }
}

export interface RankedProduct {
    productId: string;
    score: number;
    reason: string;
    explore: boolean;
}

/**
 * Ranking personalizado: afinidade do usuário + popularidade global + propensão.
 * Sem histórico, cai para popularidade global; sem nada, mantém ordem do admin.
 */
export async function getRecommendations(userId: string | null, productIds: string[]): Promise<RankedProduct[]> {
    if (productIds.length === 0) return [];

    let weights: Array<{ scope: string; key: string; value: number }> = [];
    try {
        weights = await prisma.learningWeight.findMany({
            where: {
                OR: [
                    { scope: 'global' },
                    ...(userId ? [{ scope: userId }] : [])
                ]
            },
            select: { scope: true, key: true, value: true }
        });
    } catch (err) {
        logger.warn('[Learning] getRecommendations fallback (no weights):', err);
    }

    const get = (scope: string, key: string): number =>
        weights.find((w) => w.scope === scope && w.key === key)?.value ?? 0;

    const propPay = userId ? get(userId, 'prop:pay') : 0;

    const ranked = productIds.map((productId, index) => {
        const aff = userId ? get(userId, `aff:PROD:${productId}`) : 0;
        const pop = get('global', `pop:PROD:${productId}`);
        const score = 2.0 * aff + 1.0 * Math.log1p(pop) + 0.5 * propPay - index * 0.001;
        const reason = aff > 0 ? 'baseado no seu interesse' : pop > 0 ? 'em alta' : 'sugestão';
        return { productId, score, reason, explore: false };
    });

    ranked.sort((a, b) => b.score - a.score);

    // Exploração: embaralha o top-8 para o algoritmo descobrir gostos novos.
    if (Math.random() < EXPLORE_RATE && ranked.length > 1) {
        const top = ranked.slice(0, 8);
        for (let i = top.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [top[i], top[j]] = [top[j]!, top[i]!];
        }
        return [...top.map((r) => ({ ...r, explore: true })), ...ranked.slice(8)];
    }

    return ranked;
}
