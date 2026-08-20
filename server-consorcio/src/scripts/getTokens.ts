import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { guardDevEnvironment } from './guard';

const prisma = new PrismaClient();

async function main() {
    guardDevEnvironment('getTokens');
    const users = await prisma.user.findMany({
        where: { cpf: { in: ['11111111111', '22222222222'] } }
    });

    const tokens: Record<string, string> = {};

    users.forEach(u => {
        const token = jwt.sign(
            { userId: u.id, role: u.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );
        tokens[u.cpf] = token;
        const maskedCpf = u.cpf.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2');
        console.log(`[Token Generated] User CPF: ${maskedCpf} | Token: ${token.substring(0, 10)}...[MASKED]`);
    });

    console.log('\n✅ Tokens gerados com sucesso no ambiente de desenvolvimento.');
    await prisma.$disconnect();
}

main();
