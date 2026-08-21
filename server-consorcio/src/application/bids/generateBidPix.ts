import { prisma } from '../../config/database';
import { parseAddress } from '../../mappers/addressMapper';
import { PaymentGatewayFactory } from '../../integrations/payments/PaymentGatewayFactory';
import { logger } from '../../config/logger';

export interface GenerateBidPixInput {
    bidId: string;
    requesterUserId: string;
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

    let parsedAddress = null;
    if (bid.subscription.user.address) {
        parsedAddress = parseAddress(bid.subscription.user.address);
    }

    const gateway = await PaymentGatewayFactory.getGateway('PIX');
    const amount = Number(bid.amount);

    const paymentResult = await gateway.createPayment({
        installmentId: `bid-${bid.id}`,
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

    logger.info(`Bid PIX generated for bid ${bidId} by user ${requesterUserId} - Amount: R$ ${amount}`);

    return {
        bidId: bid.id,
        amount,
        percentage: Number(bid.percentage),
        productName: bid.subscription.plan.product.name,
        qrCode: paymentResult.qrCode,
        qrCodeText: paymentResult.qrCodeText,
        pixCopiaECola: paymentResult.pixCopiaECola || paymentResult.qrCodeText,
        expiresAt: paymentResult.expiresAt
    };
}
