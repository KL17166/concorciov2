import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('🔍 Buscando cliente Carlos Alberto Silva (CPF 11144477735)...');
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { cpf: '11144477735' },
                    { cpf: '111.444.777-35' },
                    { email: 'carlos.dev@katari.com.br' },
                    { name: { contains: 'Carlos Alberto', mode: 'insensitive' } }
                ]
            },
            include: {
                subscriptions: {
                    include: {
                        plan: {
                            include: {
                                product: true
                            }
                        },
                        bids: true
                    }
                }
            }
        });

        if (!user) {
            console.error('❌ Cliente Carlos Alberto Silva não encontrado no banco.');
            return;
        }

        console.log(`✅ Cliente encontrado: ${user.name} (ID: ${user.id}, CPF: ${user.cpf}, Status KYC: ${user.kycStatus})`);

        let subscription = user.subscriptions.find(s => s.status === 'ACTIVE');

        if (!subscription && user.subscriptions.length > 0) {
            // Se tem assinatura mas está PENDING, vamos ativá-la para o teste
            const firstSub = user.subscriptions[0];
            console.log(`ℹ️ Ativando contrato ${firstSub.id} para permitir lances...`);
            subscription = await prisma.subscription.update({
                where: { id: firstSub.id },
                data: { status: 'ACTIVE' },
                include: { plan: { include: { product: true } }, bids: true }
            });
        } else if (!subscription) {
            // Se não tem nenhuma assinatura, buscar um plano e criar uma
            const plan = await prisma.consortiumPlan.findFirst({ include: { product: true } });
            if (!plan) {
                console.error('❌ Nenhum plano encontrado.');
                return;
            }
            console.log(`ℹ️ Criando novo contrato ACTIVE para ${user.name}...`);
            subscription = await prisma.subscription.create({
                data: {
                    userId: user.id,
                    planId: plan.id,
                    creditValue: plan.product.price,
                    totalInstallments: plan.durationMonths,
                    paidInstallments: 1,
                    balanceDue: Number(plan.product.price) * 0.95,
                    groupNumber: 'G01',
                    quotaNumber: '101',
                    status: 'ACTIVE',
                    termsAccepted: true,
                    termsAcceptedAt: new Date()
                },
                include: { plan: { include: { product: true } }, bids: true }
            });
        }

        console.log(`📋 Contrato Selecionado: ${subscription.id} | Produto: ${subscription.plan.product.name} | Crédito: R$ ${Number(subscription.creditValue).toFixed(2)}`);

        // Remover lances pendentes anteriores deste contrato se houver para evitar bloqueio de duplicidade
        await prisma.bid.deleteMany({
            where: {
                subscriptionId: subscription.id,
                status: 'PENDING'
            }
        });

        // Gerar Token JWT do Carlos Alberto Silva
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            env.JWT_SECRET || 'jwt_secret_key_change_in_production_min_32_chars',
            { expiresIn: '1h' }
        );

        const bidPercentage = 25; // 25% de lance
        const bidAmount = Number(subscription.creditValue) * (bidPercentage / 100);

        console.log(`\n🚀 Enviando Request POST /api/bids como ${user.name}...`);
        console.log(`   Percentual: ${bidPercentage}%`);
        console.log(`   Valor: R$ ${bidAmount.toFixed(2)}`);
        console.log(`   Tipo: FREE (Lance Livre)`);

        const response = await fetch('http://localhost:3000/api/bids', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                subscriptionId: subscription.id,
                type: 'FREE',
                percentage: bidPercentage,
                amount: bidAmount
            })
        });

        const json = await response.json();
        console.log('\n📥 Resposta da API:');
        console.log(JSON.stringify(json, null, 2));

        if (response.ok && json.success) {
            console.log('\n🎉 SUCESSO! Lance registrado com êxito na API.');
            console.log(`👉 Acesse no Painel Admin: http://localhost:3000/admin/bids`);
            console.log(`👉 E nos Detalhes do Contrato: http://localhost:3000/admin/contracts/${subscription.id}`);
        } else {
            console.error('\n⚠️ Falha ao registrar lance:', json);
        }
    } catch (err) {
        console.error('❌ Erro no script:', err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
