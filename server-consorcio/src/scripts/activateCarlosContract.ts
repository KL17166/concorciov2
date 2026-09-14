import { prisma } from '../config/database';

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'carlos.dev@katari.com.br' }
    });

    if (!user) {
        console.log('Carlos not found');
        return;
    }

    // Find the latest subscription
    const sub = await prisma.subscription.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { installments: { orderBy: { number: 'asc' } } }
    });

    if (!sub) {
        console.log('No subscription found for Carlos');
        return;
    }

    // Set subscription to ACTIVE
    await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' }
    });

    // Mark installment 1 as PAID if not already
    if (sub.installments[0]) {
        await prisma.installment.update({
            where: { id: sub.installments[0].id },
            data: {
                status: 'PAID',
                paymentDate: new Date(),
                paymentMethod: 'ADMIN_MANUAL'
            }
        });
    }

    console.log(`Contract ${sub.id} is now ACTIVE and installment #1 is PAID!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
