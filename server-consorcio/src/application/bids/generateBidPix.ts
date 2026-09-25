import { prisma } from '../../config/database';
import { parseAddress } from '../../mappers/addressMapper';
import { PaymentFailoverService } from '../../services/paymentFailoverService';
import { logger } from '../../config/logger';

export interface GenerateBidPixInput {
    bidId: string;
    requesterUserId: string;
}

const BID_REF_PREFIX = 'bid-';
/** Vouchers de lance valem 30 min (igual ao QR de parcela). */
const BID_VOUCHER_TTL_MS = 30 * 60 * 1000;

export function bidExternalId(bidId: string): string {
    return `${BID_REF_PREFIX}${bidId}`;
}

export function parseBidExternalId(externalId: string): string | null {
    if (!externalId.startsWith(BID_REF_PREFIX)) return null;
    const bidId = externalId.slice(BID_REF_PREFIX.length);
    return bidId.length > 0 ? bidId : null;
}

export async function generateBidPix(input: GenerateBidPixInput) {
    const { bidId, requesterUserId } = input;

    const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: {
            subscription: {
                include: {
                    user: true,
                    plan: {
                        include: {
                            product: true
                        }
                    }
                }
            }
        }
    });

    if (!bid) {
        throw Object.assign(new Error('Lance não encontrado'), { statusCode: 404 });
    }

    if (bid.subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado: lance não pertence ao usuário autenticado'), { statusCode: 403 });
    }

    if (bid.status !== 'APPROVED') {
        throw Object.assign(new Error('Apenas lances aprovados podem ser pagos'), { statusCode: 400 });
    }

    if (bid.subscription.status === 'CANCELLED') {
        throw Object.assign(new Error('Contrato cancelado — não é possível gerar cobrança para este lance'), { statusCode: 400 });
    }

    const now = new Date();

    // ── Idempotência: voucher ACTIVE ainda válido → reexibe, não cobra de novo ──
    // Serializable garante que dois toques simultâneos não geram duas cobranças:
    // a segunda transação enxerga o RESERVED/ACTIVE da primeira e espera/reutiliza.
    const reservation = await prisma.$transaction(async (tx) => {
        const existing = await tx.bidPayment.findFirst({
            where: {
                bidId,
                status: 'ACTIVE',
                expiresAt: { gt: now }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (existing) return { reused: true as const, payment: existing };

        const inFlight = await tx.bidPayment.findFirst({
            where: { bidId, status: 'RESERVED' },
            orderBy: { createdAt: 'desc' }
        });
        if (inFlight && now.getTime() - inFlight.createdAt.getTime() < 2 * 60 * 1000) {
            throw Object.assign(
                new Error('Cobrança do lance em processamento. Aguarde alguns segundos e tente novamente.'),
                { statusCode: 429 }
            );
        }
        if (inFlight) {
            await tx.bidPayment.update({ where: { id: inFlight.id }, data: { status: 'EXPIRED' } });
        }

        // Expira vouchers antigos (só vale o último) e reserva a nova emissão
        await tx.bidPayment.updateMany({
            where: { bidId, status: 'ACTIVE' },
            data: { status: 'EXPIRED' }
        });
        const created = await tx.bidPayment.create({
            data: {
                bidId,
                provider: 'pending',
                amount: bid.amount,
                status: 'RESERVED'
            }
        });
        return { reused: false as const, payment: created };
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    if (reservation.reused) {
        const p = reservation.payment;
        logger.info(`Bid PIX reused for bid ${bidId} (payment ${p.id})`);
        let reusedManual = false;
        try {
            const cfg = await prisma.gatewayConfig.findUnique({ where: { name: (p as any).provider } });
            reusedManual = !!cfg?.requiresManualReview || ['eldorado', 'g2g', 'sandbox', 'pending'].includes((p as any).provider);
        } catch { /* fallback abaixo */ }
        return {
            bidId: bid.id,
            bidPaymentId: p.id,
            amount: Number(p.amount),
            percentage: Number(bid.percentage),
            productName: bid.subscription.plan.product.name,
            provider: (p as any).provider,
            isManualApproval: reusedManual,
            qrCode: null,
            qrCodeText: p.copyPaste,
            pixCopiaECola: p.copyPaste,
            expiresAt: p.expiresAt?.toISOString() ?? null,
            reused: true
        };
    }

    const reservationId = reservation.payment.id;

    let parsedAddress = null;
    if (bid.subscription.user.address) {
        parsedAddress = parseAddress(bid.subscription.user.address);
    }

    const amount = Number(bid.amount);

    // O external_id carrega o prefixo `bid-` para o webhook rotear a liquidação
    // para `processBidPaymentWebhook` em vez de procurar um installment inexistente.
    let paymentResult;
    try {
        paymentResult = await PaymentFailoverService.executePaymentWithFailover({
            installmentId: bidExternalId(bid.id),
            installmentNumber: 0,
            amount,
            method: 'PIX',
            customer: {
                name: bid.subscription.user.name,
                email: bid.subscription.user.email,
                document: bid.subscription.user.cpf,
                phone: bid.subscription.user.phone || undefined,
                address: parsedAddress
            }
        });
    } catch (err) {
        await prisma.bidPayment.update({
            where: { id: reservationId },
            data: { status: 'EXPIRED' }
        }).catch(() => {});
        throw err;
    }

    const active = await prisma.bidPayment.update({
        where: { id: reservationId },
        data: {
            provider: paymentResult.provider,
            externalId: paymentResult.paymentId || null,
            amount: paymentResult.amount,
            status: 'ACTIVE',
            copyPaste: paymentResult.copyPaste || null,
            expiresAt: paymentResult.expirationDate
                ? new Date(paymentResult.expirationDate)
                : new Date(Date.now() + BID_VOUCHER_TTL_MS)
        }
    });

    logger.info(`Bid PIX generated for bid ${bidId} by user ${requesterUserId} - Amount: R$ ${amount} (payment ${active.id}, provider ${active.provider})`);

    return {
        bidId: bid.id,
        bidPaymentId: active.id,
        amount,
        percentage: Number(bid.percentage),
        productName: bid.subscription.plan.product.name,
        provider: paymentResult.provider,
        isManualApproval: !!paymentResult.isManualApproval,
        qrCode: paymentResult.qrCode,
        qrCodeText: paymentResult.copyPaste,
        pixCopiaECola: paymentResult.copyPaste,
        expiresAt: paymentResult.expirationDate,
        reused: false
    };
}
