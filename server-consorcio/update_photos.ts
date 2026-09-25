import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
function slugify(v: string): string {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
async function main() {
  const full = JSON.parse(fs.readFileSync('C:\\Users\\kl\\catalogo-consorcio\\catalogo-completo.json', 'utf-8'));
  const all: any[] = Object.values(full).flat();
  let n = 0;
  for (const p of all) {
    const id = `catalog-novo-${slugify(p.name)}`;
    await prisma.product.update({
      where: { id },
      data: { imageUrl: p.imageUrl, imageUrls: JSON.stringify(p.imageUrls) },
    });
    n++;
  }
  console.log(`FOTOS ATUALIZADAS: ${n} produtos`);
}
main().catch((e) => { console.error('FAIL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
