import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const FUND_RATE = 2.0;

function slugify(v: string): string {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function planDurations(min: number, max: number): number[] {
  const s = new Set<number>([min, max]);
  for (let d = min; d <= max; d += 12) s.add(d);
  return [...s].sort((a, b) => a - b);
}

async function main() {
  const fileContent = fs.readFileSync('/mnt/win/Users/kl/Documents/concorciov2/catalogo_agentes/produtos/MOTO.json', 'utf-8');
  const full = JSON.parse(fileContent);
  const all: any[] = full.produtos || [];
  console.log(`Novos a inserir: ${all.length}`);

  // 1. WIPE (tudo fake, autorizado): subscriptions -> plans -> products
  const delSubs = await prisma.subscription.deleteMany({});
  console.log(`Subscriptions apagadas: ${delSubs.count} (installments/bids em cascade)`);
  const delPlans = await prisma.consortiumPlan.deleteMany({});
  console.log(`Plans apagados: ${delPlans.count}`);
  const delProds = await prisma.product.deleteMany({});
  console.log(`Products apagados: ${delProds.count}`);

  // 2. SEED
  let plansTotal = 0;
  for (const p of all) {
    const id = `catalog-novo-${slugify(p.name)}`;
    await prisma.product.create({
      data: {
        id,
        name: p.name,
        description: p.description,
        type: "MOTO",
        category: p.category || "esportiva",
        imageUrl: p.imageUrl,
        imageUrls: JSON.stringify(p.imageUrls || []),
        price: new Prisma.Decimal(p.price || 0),
        active: p.active !== undefined ? p.active : true,
        isFeatured: !!p.isFeatured,
        isPopular: !!p.isPopular,
        brand: p.brand ?? null,
        model: p.model ?? null,
        year: p.year ?? null,
        specs: p.specs ? JSON.stringify(p.specs) : null,
        minDuration: p.minDuration || 12,
        maxDuration: p.maxDuration || 60,
        adminFeeRate: new Prisma.Decimal(p.adminFeeRate || 15.0),
      },
    });
    const durs = planDurations(p.minDuration || 12, p.maxDuration || 60);
    await prisma.consortiumPlan.createMany({
      data: durs.map((d) => ({
        id: `${id}-plan-${d}`,
        name: `${d} Meses`,
        durationMonths: d,
        adminFeeRate: new Prisma.Decimal(p.adminFeeRate || 15.0),
        fundRate: new Prisma.Decimal(FUND_RATE),
        productId: id,
        active: true,
      })),
    });
    plansTotal += durs.length;
    console.log(`OK MOTO ${p.name} + ${durs.length} planos`);
  }
  console.log(`SEED OK: ${all.length} produtos, ${plansTotal} planos`);
}

main().catch((e) => { console.error('FAIL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
