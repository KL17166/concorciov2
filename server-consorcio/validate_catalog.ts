import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CATS: Record<string, string[]> = {
  MOTO: ['urbana','esportiva','trail','custom','street','adventure','scooter','naked','touring'],
  CARRO: ['suv','hatch','sedan','pickup','esportivo','outros'],
  CARTA_CREDITO: ['geral','veiculo','imovel','premium'],
  ELETRONICO: ['gaming','notebook','smartphone','tablet','outros'],
  IMOVEL: ['residencial','comercial','terreno','rural'],
  SERVICO: ['educacao','viagem','saude','consultoria','outros'],
};
async function main() {
  const products = await prisma.product.findMany({ include: { plans: true }, orderBy: { name: 'asc' } });
  const byType: Record<string, number> = {};
  let errs = 0;
  for (const p of products) {
    byType[p.type] = (byType[p.type] || 0) + 1;
    const issues: string[] = [];
    if (!CATS[p.type]?.includes(p.category)) { issues.push(`categoria invalida: ${p.category}`); }
    if (!p.imageUrl) issues.push('imageUrl vazio');
    try {
      const urls = JSON.parse(p.imageUrls);
      if (!Array.isArray(urls) || urls.length < 3) issues.push(`imageUrls=${Array.isArray(urls) ? urls.length : '?'}`);
      if (urls[0] !== p.imageUrl) issues.push('imageUrl != imageUrls[0]');
    } catch { issues.push('imageUrls JSON invalido'); }
    try { JSON.parse(p.specs || '{}'); } catch { issues.push('specs JSON invalido'); }
    if (Number(p.price) <= 0) issues.push('price<=0');
    if (p.plans.length === 0) issues.push('sem planos');
    if (issues.length) { errs++; console.log(`X ${p.name}: ${issues.join('; ')}`); }
  }
  const subs = await prisma.subscription.count();
  console.log('POR TIPO:', JSON.stringify(byType));
  console.log(`TOTAL: ${products.length} produtos | erros: ${errs} | subscriptions restantes: ${subs}`);
}
main().finally(() => prisma.$disconnect());
