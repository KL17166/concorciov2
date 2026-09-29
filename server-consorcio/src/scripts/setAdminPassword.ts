import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { hashPassword, verifyPassword } from '../security/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_TARGET_EMAIL || 'admin.master@katari.com.br';
  const plain = process.env.ADMIN_NEW_PASSWORD;
  if (!plain || plain.length < 8) {
    console.error('❌ Defina ADMIN_NEW_PASSWORD (mín. 8 chars) como variável de ambiente.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ Usuário ${email} não encontrado.`);
    process.exit(1);
  }

  const newHash = await hashPassword(plain);
  await prisma.user.update({ where: { email }, data: { passwordHash: newHash } });

  const check = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(plain, check!.passwordHash);
  console.log(ok ? `✅ Senha de ${email} atualizada e verificada.` : '❌ Falha na verificação.');
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
