import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { hashPassword } from '../security/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Semeando usuários e dados de desenvolvimento no PostgreSQL...');

  const defaultPassword = await hashPassword('123456');

  // 1. Carlos Alberto (Cliente Completo - KYC Aprovado)
  const carlosCpf = '11144477735';
  const carlos = await prisma.user.upsert({
    where: { cpf: carlosCpf },
    update: {
      name: 'Carlos Alberto Silva',
      email: 'carlos.dev@katari.com.br',
      passwordHash: defaultPassword,
      role: 'CLIENT',
      kycStatus: 'APPROVED',
      phone: '(11) 98765-4321',
      birthDate: new Date('1990-05-15'),
      address: JSON.stringify({
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP'
      })
    },
    create: {
      name: 'Carlos Alberto Silva',
      email: 'carlos.dev@katari.com.br',
      cpf: carlosCpf,
      passwordHash: defaultPassword,
      role: 'CLIENT',
      kycStatus: 'APPROVED',
      phone: '(11) 98765-4321',
      birthDate: new Date('1990-05-15'),
      address: JSON.stringify({
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP'
      })
    }
  });
  console.log(`✅ Carlos Alberto pronto: CPF ${carlos.cpf} (Senha: 123456)`);

  // 2. Mariana Oliveira (Cliente Novo - KYC Pendente)
  const marianaCpf = '22233344405';
  const mariana = await prisma.user.upsert({
    where: { cpf: marianaCpf },
    update: {
      name: 'Mariana Oliveira',
      email: 'mariana.dev@katari.com.br',
      passwordHash: defaultPassword,
      role: 'CLIENT',
      kycStatus: 'PENDING',
      phone: '(11) 97777-8888',
      birthDate: new Date('1994-08-20'),
      address: JSON.stringify({
        cep: '04571-010',
        street: 'Avenida Engenheiro Luís Carlos Berrini',
        number: '500',
        neighborhood: 'Brooklin',
        city: 'São Paulo',
        state: 'SP'
      })
    },
    create: {
      name: 'Mariana Oliveira',
      email: 'mariana.dev@katari.com.br',
      cpf: marianaCpf,
      passwordHash: defaultPassword,
      role: 'CLIENT',
      kycStatus: 'PENDING',
      phone: '(11) 97777-8888',
      birthDate: new Date('1994-08-20'),
      address: JSON.stringify({
        cep: '04571-010',
        street: 'Avenida Engenheiro Luís Carlos Berrini',
        number: '500',
        neighborhood: 'Brooklin',
        city: 'São Paulo',
        state: 'SP'
      })
    }
  });
  console.log(`✅ Mariana Oliveira pronta: CPF ${mariana.cpf} (Senha: 123456)`);

  // 3. Admin Master
  const adminCpf = '52998224725';
  const admin = await prisma.user.upsert({
    where: { cpf: adminCpf },
    update: {
      name: 'Admin Master Katari',
      email: 'admin.master@katari.com.br',
      passwordHash: defaultPassword,
      role: 'MASTER',
      kycStatus: 'APPROVED'
    },
    create: {
      name: 'Admin Master Katari',
      email: 'admin.master@katari.com.br',
      cpf: adminCpf,
      passwordHash: defaultPassword,
      role: 'MASTER',
      kycStatus: 'APPROVED',
      birthDate: new Date('1985-01-01')
    }
  });
  console.log(`✅ Admin Master pronto: CPF ${admin.cpf} (Senha: 123456)`);

  // 4. Ensure at least 1 Product and Plan exists in database
  let product = await prisma.product.findFirst({
    include: { plans: true }
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Honda CG 160 Titan 2025',
        description: 'A motocicleta mais vendida e confiável do Brasil.',
        type: 'MOTO',
        category: 'urbana',
        imageUrl: 'https://placehold.co/600x400/png?text=Honda+CG+160',
        imageUrls: JSON.stringify(['https://placehold.co/600x400/png?text=Honda+CG+160']),
        price: 18500,
        active: true,
        brand: 'Honda',
        model: 'CG 160 Titan',
        year: 2025,
        plans: {
          create: [
            { name: '36 Meses', durationMonths: 36, adminFeeRate: 6.0, fundRate: 2.0, active: true },
            { name: '60 Meses', durationMonths: 60, adminFeeRate: 8.0, fundRate: 2.0, active: true },
            { name: '80 Meses', durationMonths: 80, adminFeeRate: 10.0, fundRate: 2.0, active: true }
          ]
        }
      },
      include: { plans: true }
    });
    console.log(`🏍️ Produto de teste criado: ${product.name}`);
  }

  // 5. Create a sample Active Subscription for Carlos if none exists
  const existingCarlosSub = await prisma.subscription.findFirst({
    where: { userId: carlos.id }
  });

  if (!existingCarlosSub && product && product.plans.length > 0) {
    const plan = product.plans[0];
    const sub = await prisma.subscription.create({
      data: {
        userId: carlos.id,
        planId: plan.id,
        groupNumber: '104',
        quotaNumber: '042',
        creditValue: product.price,
        status: 'ACTIVE',
        balanceDue: 15000,
        paidInstallments: 12,
        totalInstallments: plan.durationMonths,
        termsAccepted: true,
        termsAcceptedAt: new Date()
      }
    });

    // Create 12 paid installments and remaining pending installments
    const installmentAmount = (Number(product.price) * 1.1) / plan.durationMonths;
    for (let i = 1; i <= plan.durationMonths; i++) {
      const isPaid = i <= 12;
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + (i - 12));

      await prisma.installment.create({
        data: {
          subscriptionId: sub.id,
          number: i,
          amount: installmentAmount,
          dueDate,
          status: isPaid ? 'PAID' : 'PENDING',
          paymentDate: isPaid ? new Date() : null,
          paymentMethod: isPaid ? 'PIX' : null
        }
      });
    }

    console.log(`📋 Contrato ativo semeado para Carlos Alberto: Sub ${sub.id}`);
  }

  console.log('🎉 Semente de dados de dev concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
