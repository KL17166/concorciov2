import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

type FrontMatter = Record<string, unknown>;

type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  imageUrl: string;
  imageUrls: string[];
  price: number;
  active: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  brand: string | null;
  model: string | null;
  year: number | null;
  specs: Record<string, unknown>;
  minDuration: number;
  maxDuration: number;
  adminFeeRate: number;
  sourceFile: string;
};

const PLAN_DURATIONS = [36, 48, 60, 70, 80, 90];
const DEFAULT_FUND_RATE = 2.0;

function resolveCatalogFichasDir(): string {
  const candidates = [
    process.env.CATALOG_REAL_FICHAS_DIR,
    path.resolve(process.cwd(), 'catalogo_real', 'fichas'),
    path.resolve(process.cwd(), '..', 'catalogo_real', 'fichas'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) {
    throw new Error(
      `Pasta de fichas do catálogo real não encontrada. Procuradas: ${candidates.join(', ')}`,
    );
  }

  return existing;
}

function listMarkdownFiles(directory: string): string[] {
  const result: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      result.push(entryPath);
    }
  }

  return result.sort((a, b) => a.localeCompare(b));
}

function parseScalar(rawValue: string): unknown {
  const value = rawValue.trim();

  if (value === '') return '';
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseFrontMatter(markdown: string, sourceFile: string): FrontMatter {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    throw new Error(`A ficha ${sourceFile} não começa com front matter YAML.`);
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) {
    throw new Error(`A ficha ${sourceFile} não possui fechamento do front matter.`);
  }

  const data: FrontMatter = {};
  let currentKey: string | null = null;

  for (const line of lines.slice(1, closingIndex)) {
    const topLevel = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (topLevel) {
      const [, key, rawValue] = topLevel;
      currentKey = key;

      if (rawValue === '>- ' || rawValue === '>-') {
        data[key] = '';
      } else if (rawValue === '') {
        data[key] = key === 'specs' ? {} : key === 'imageUrls' ? [] : '';
      } else {
        data[key] = parseScalar(rawValue);
      }
      continue;
    }

    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey === 'imageUrls') {
      const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
      imageUrls.push(parseScalar(listItem[1]));
      data.imageUrls = imageUrls;
      continue;
    }

    const nestedSpec = line.match(/^\s{2,}([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (nestedSpec && currentKey === 'specs') {
      const specs = data.specs && typeof data.specs === 'object' && !Array.isArray(data.specs)
        ? data.specs as Record<string, unknown>
        : {};
      specs[nestedSpec[1]] = parseScalar(nestedSpec[2]);
      data.specs = specs;
      continue;
    }

    if (currentKey === 'description' && line.trim() !== '') {
      data.description = `${String(data.description ?? '').trim()} ${line.trim()}`.trim();
    }
  }

  return data;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCatalogProduct(filePath: string, fichasDir: string): CatalogProduct {
  const markdown = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const raw = parseFrontMatter(markdown, filePath);
  const name = asString(raw.name);
  if (!name) throw new Error(`A ficha ${filePath} não possui name.`);

  const imageUrls = Array.isArray(raw.imageUrls)
    ? raw.imageUrls.map((url) => asString(url)).filter((url) => /^https?:\/\//i.test(url))
    : [];
  const imageUrl = imageUrls[0] || `https://placehold.co/1200x800/1f2937/ffffff?text=${encodeURIComponent(name)}`;
  const specs = raw.specs && typeof raw.specs === 'object' && !Array.isArray(raw.specs)
    ? raw.specs as Record<string, unknown>
    : {};
  const relativeFile = path.relative(fichasDir, filePath).replace(/\\/g, '/');

  return {
    id: `catalog-real-${slugify(name)}`,
    name,
    description: asString(raw.description, `Produto de catálogo: ${name}.`),
    type: asString(raw.type, 'ELETRONICO'),
    category: asString(raw.category, 'outros'),
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : [imageUrl],
    price: asNumber(raw.price, 0),
    active: asBoolean(raw.active, false),
    isFeatured: asBoolean(raw.isFeatured, false),
    isPopular: asBoolean(raw.isPopular, false),
    brand: raw.brand == null || raw.brand === '' ? null : asString(raw.brand),
    model: raw.model == null || raw.model === '' ? null : asString(raw.model),
    year: asNullableNumber(raw.year),
    specs,
    minDuration: Math.max(1, Math.trunc(asNumber(raw.minDuration, 12))),
    maxDuration: Math.max(1, Math.trunc(asNumber(raw.maxDuration, 60))),
    adminFeeRate: asNumber(raw.adminFeeRate, 15.0),
    sourceFile: relativeFile,
  };
}

export function loadCatalogProducts(): CatalogProduct[] {
  const fichasDir = resolveCatalogFichasDir();
  const files = listMarkdownFiles(fichasDir);
  if (files.length === 0) throw new Error(`Nenhuma ficha Markdown encontrada em ${fichasDir}.`);
  return files.map((filePath) => parseCatalogProduct(filePath, fichasDir));
}

async function main(): Promise<void> {
  const products = loadCatalogProducts();
  const dryRun = process.argv.includes('--dry-run') || process.env.SEED_DRY_RUN === '1';

  console.log(`📚 Fichas carregadas: ${products.length}`);
  console.log(`🧪 Modo: ${dryRun ? 'dry-run (sem banco)' : 'gravação idempotente'}`);

  for (const product of products) {
    console.log(`  ${product.active ? 'ATIVO' : 'INATIVO'} | ${product.type} | ${product.name} | R$ ${product.price.toFixed(2)} | ${product.sourceFile}`);
  }

  if (dryRun) return;

  const prisma = new PrismaClient();
  try {
    for (const product of products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          name: product.name,
          description: product.description,
          type: product.type,
          category: product.category,
          imageUrl: product.imageUrl,
          imageUrls: JSON.stringify(product.imageUrls),
          price: new Prisma.Decimal(product.price),
          active: product.active,
          isFeatured: product.isFeatured,
          isPopular: product.isPopular,
          brand: product.brand,
          model: product.model,
          year: product.year,
          specs: JSON.stringify(product.specs),
          minDuration: product.minDuration,
          maxDuration: product.maxDuration,
          adminFeeRate: new Prisma.Decimal(product.adminFeeRate),
        },
        create: {
          id: product.id,
          name: product.name,
          description: product.description,
          type: product.type,
          category: product.category,
          imageUrl: product.imageUrl,
          imageUrls: JSON.stringify(product.imageUrls),
          price: new Prisma.Decimal(product.price),
          active: product.active,
          isFeatured: product.isFeatured,
          isPopular: product.isPopular,
          brand: product.brand,
          model: product.model,
          year: product.year,
          specs: JSON.stringify(product.specs),
          minDuration: product.minDuration,
          maxDuration: product.maxDuration,
          adminFeeRate: new Prisma.Decimal(product.adminFeeRate),
        },
      });

      for (const durationMonths of PLAN_DURATIONS) {
        const planId = `${product.id}-plan-${durationMonths}`;
        await prisma.consortiumPlan.upsert({
          where: { id: planId },
          update: {
            name: `${product.name} — ${durationMonths} meses`,
            durationMonths,
            adminFeeRate: new Prisma.Decimal(product.adminFeeRate),
            fundRate: new Prisma.Decimal(DEFAULT_FUND_RATE),
            productId: product.id,
            active: product.active,
          },
          create: {
            id: planId,
            name: `${product.name} — ${durationMonths} meses`,
            durationMonths,
            adminFeeRate: new Prisma.Decimal(product.adminFeeRate),
            fundRate: new Prisma.Decimal(DEFAULT_FUND_RATE),
            productId: product.id,
            active: product.active,
          },
        });
      }

      console.log(`✅ ${product.name}: produto + ${PLAN_DURATIONS.length} planos sincronizados`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('✅ Seed do catálogo real concluído sem apagar registros existentes.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Falha no seed do catálogo real:', error);
    process.exitCode = 1;
  });
}
