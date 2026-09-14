import { prisma } from '../config/database';

async function main() {
    const bids = await prisma.bid.findMany({
        where: { subscription: { user: { email: 'mariana.dev@katari.com.br' } } },
        include: { subscription: true }
    });

    console.log('Mariana Bids in DB:', JSON.stringify(bids, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
