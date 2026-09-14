import { prisma } from '../config/database';

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'carlos.dev@katari.com.br' }
    });

    if (!user) {
        console.log('User Carlos not found!');
        return;
    }

    const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.id },
        include: {
            installments: {
                orderBy: { number: 'asc' },
                take: 3
            },
            plan: {
                include: { product: true }
            }
        }
    });

    console.log('User Carlos:', user.id, 'KYC:', user.kycStatus);
    console.log('Subscriptions count:', subscriptions.length);
    for (const s of subscriptions) {
        console.log({
            id: s.id,
            status: s.status,
            product: s.plan.product.name,
            inst1: s.installments[0] ? { number: s.installments[0].number, status: s.installments[0].status, amount: s.installments[0].amount } : null
        });
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
