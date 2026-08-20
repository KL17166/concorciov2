import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface ContemplateSubscriptionInput {
    subscriptionId: string;
    contemplationType?: string;
}

export async function contemplateSubscription(input: ContemplateSubscriptionInput) {
    const { subscriptionId, contemplationType = 'DIRECT' } = input;

    const contract = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
    });

    if (!contract || contract.status !== 'ACTIVE') {
        throw Object.assign(new Error('Contrato deve estar ativo para ser contemplado'), { statusCode: 400 });
    }

    if (contract.contemplated) {
        throw Object.assign(new Error('Este contrato já foi contemplado anteriormente e não pode ser contemplado novamente'), { statusCode: 400 });
    }

    const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            contemplated: true,
            contemplationDate: new Date(),
            contemplationType,
            status: 'CONTEMPLATED'
        }
    });

    logger.info(`Subscription ${subscriptionId} contemplated (type: ${contemplationType})`);

    return updated;
}
