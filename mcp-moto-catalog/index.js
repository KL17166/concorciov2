#!/usr/bin/env node
/**
 * mcp-moto-catalog — MCP server do pipeline de catalogo de motos.
 *
 * Sites de montadoras bloqueiam fetch direto (403 anti-bot). Este servidor usa
 * um navegador real (Edge do sistema via playwright-core) para extrair lineups.
 *
 * Marcas suportadas (presets testados em 09/2026):
 *   honda    → https://www.honda.com.br/motos/modelos (33 modelos, preço+foto no card)
 *   yamaha   → https://www.yamaha-motor.com.br/motos (links /product/<slug>-<id>)
 *   kawasaki → https://www.kawasakibrasil.com/pt_br/motorcycles.html (links /pt_br/motorcycles/<fam>/<mod>-<ano>.html)
 *   bmw      → https://www.bmw-motorrad.com.br/ (links /pt/models/<cat>/<mod>.html)
 *
 * Tools:
 *   - list_models            → modelos de uma marca (slug, url, preco?, foto?)
 *   - get_model              → detalhe de qualquer URL (preços, galeria, ficha, og:image, JSON-LD)
 *   - download_images        → baixa imagens via navegação (fura 403 de CDN)
 *   - sync_moto_catalog      → pipeline Honda: fotos+preços no MOTO.json (+ Postgres opcional)
 *
 * Env:
 *   MOTO_EDGE_PATH → caminho do Edge/Chrome (padrão: Edge x86 no Windows)
 *   MOTO_HEADLESS  → "false" p/ ver o navegador (padrão: true)
 */
const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { chromium } = require('playwright-core');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const EDGE = process.env.MOTO_EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const HEADLESS = process.env.MOTO_HEADLESS !== 'false';

const BRANDS = {
  honda: {
    base: 'https://www.honda.com.br',
    listing: 'https://www.honda.com.br/motos/modelos',
    linkRe: '^/(motos/(street|adventure|off-road|sport|touring)/[^/]+(?:/[^/]+)?)/?$',
    priceCard: '.single-product-price',
    imgFull: u => u.replace(/\/styles\/[^/]+\/public\//, '').split('?')[0]
  },
  yamaha: {
    base: 'https://www.yamaha-motor.com.br',
    listing: 'https://www.yamaha-motor.com.br/motos',
    linkRe: '^/(product/[^/]+)/?$',
    priceCard: null,
    imgFull: u => u.split('?')[0]
  },
  kawasaki: {
    base: 'https://www.kawasakibrasil.com',
    listing: 'https://www.kawasakibrasil.com/pt_br/motorcycles.html',
    linkRe: '^/(pt_br/motorcycles/[^/]+/[^/]+\\.html)$',
    priceCard: null,
    imgFull: u => u.split('?')[0]
  },
  bmw: {
    base: 'https://www.bmw-motorrad.com.br',
    listing: 'https://www.bmw-motorrad.com.br/',
    linkRe: '^/(pt/models/[^/]+/[^/]+\\.html)$',
    priceCard: null,
    imgFull: u => u.split('?')[0]
  }
};

const DEFAULT_MOTO_JSON = 'C:/Users/kl/Documents/concorciov2/catalogo_agentes/produtos/MOTO.json';
const DEFAULT_IMG_DIR = 'C:/Users/kl/Documents/concorciov2/zuvio-web/public/img/catalogo/honda';
const DEFAULT_SERVER_DIR = 'C:/Users/kl/Documents/concorciov2/server-consorcio';

// slug do /modelos Honda -> model no MOTO.json
const HONDA_SLUG_TO_MODEL = {
  'cg-50-anos': 'CG 160 50 Anos', 'cg-160-start': 'CG 160 Start', 'cg-160-fan': 'CG 160 Fan',
  'cg-160-titan': 'CG 160 Titan', 'cg-160-cargo': 'CG 160 Cargo', 'pop110i-es': 'Pop 110i ES',
  'biz-kuromi': 'Biz Kuromi', 'biz125': 'Biz 125', 'elite-125': 'Elite 125', 'pcx': 'PCX 160',
  'honda-adv': 'ADV 160', 'x-adv': 'X-ADV', 'cb300f-twister': 'CB 300F Twister',
  'cb500-hornet': 'CB 500 Hornet', 'cb650r': 'CB650R E-Clutch', 'hornet-750': 'CB750 Hornet',
  'cb1000-hornet': 'CB1000 Hornet', 'xr-300l-tornado': 'XR 300L Tornado',
  'xr300l-tornado-special-edition': 'XR300L Tornado Special Edition',
  'xl750-transalp': 'XL 750 Transalp', 'nxr-160-bros': 'NXR 160 Bros',
  'sahara-300': 'Sahara 300', 'xre-190': 'XRE 190', 'nx500': 'NX 500',
  'nc-750x': 'NC750X MT', 'crf1100l-africa-twin': 'CRF1100L Africa Twin',
  'crf-300f': 'CRF300F', 'crf-250r': 'CRF250R', 'crf-450r': 'CRF450R',
  'trx-420-fourtrax': 'TRX 420FM FourTrax', 'cbr1000rr-r-fireblade-sp': 'CBR1000RR-R Fireblade SP',
  'gl-1800-gold-wing-tour': 'GL1800 Gold Wing Tour', 'goldwing-50-anos': 'Gold Wing 50 Anos'
};

let browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      executablePath: EDGE, headless: HEADLESS,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
  }
  return browser;
}
async function newPage(b) {
  return b.newPage({ userAgent: UA, viewport: { width: 1366, height: 900 } });
}
async function fullScroll(page) {
  await page.evaluate(async () => {
    await new Promise(res => {
      let y = 0;
      const t = setInterval(() => {
        y += 900; window.scrollTo(0, y);
        if (y > document.body.scrollHeight + 1000) { clearInterval(t); res(); }
      }, 250);
    });
    window.scrollTo(0, 0);
  });
}
const parseBRL = s => {
  if (!s) return null;
  const v = parseFloat(s.replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const brandSchema = z.enum(['honda', 'yamaha', 'kawasaki', 'bmw']).describe('marca (preset)');

async function scrapeListing(brandKey) {
  const cfg = BRANDS[brandKey];
  if (!cfg) throw new Error('marca desconhecida: ' + brandKey);
  const b = await getBrowser();
  const page = await newPage(b);
  try {
    await page.goto(cfg.listing, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await fullScroll(page);
    await page.waitForTimeout(2500);
    return await page.evaluate(({ base, linkReSrc, priceCardSel }) => {
      const linkRe = new RegExp(linkReSrc);
      const full = u => u; // transform aplicado no Node
      const seen = new Set(); const cards = [];
      const pushCard = (scope, url) => {
        if (!scope || seen.has(url)) return;
        seen.add(url);
        const txt = scope.innerText || '';
        const price = (txt.match(/R\$ [\d.,]+/) || [''])[0];
        const img = scope.querySelector('img');
        let imgRaw = '';
        if (img) {
          const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
          const cands = ss.split(',').map(s => s.trim().split(' ')[0]).filter(Boolean);
          imgRaw = cands.length ? cands[cands.length - 1] : (img.getAttribute('src') || img.getAttribute('data-src') || '');
          if (imgRaw.startsWith('/')) imgRaw = base + imgRaw;
        }
        cards.push({ slug: url.split('/').filter(Boolean).pop().replace(/\.html$/, ''), url, price, img: imgRaw });
      };
      if (priceCardSel) {
        document.querySelectorAll(priceCardSel).forEach(pe => {
          let root = pe.parentElement;
          for (let i = 0; i < 8 && root; i++) {
            if (root.querySelector('img') && root.querySelector('a[href]')) break;
            root = root.parentElement;
          }
          if (!root) return;
          const link = Array.from(root.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href')).find(h => h && linkRe.test(h));
          if (!link) return;
          pushCard(root, link.startsWith('/') ? base + link : link);
        });
      }
      //Fallback/enriquecimento: toda âncora que casa o padrão da marca
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!linkRe.test(href)) return;
        const url = href.startsWith('/') ? base + href : (/^https?:\/\//.test(href) ? href : base + '/' + href);
        if (seen.has(url)) return;
        let root = a.parentElement;
        for (let i = 0; i < 5 && root && root !== document.body; i++) {
          if (root.querySelector('img')) break;
          root = root.parentElement;
        }
        pushCard(root, url);
      });
      return cards;
    }, { base: cfg.base, linkReSrc: cfg.linkRe, priceCardSel: cfg.priceCard });
  } finally {
    await page.close();
  }
}

async function scrapeDetail(url) {
  const b = await getBrowser();
  const page = await newPage(b);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const status = resp && resp.status();
    await page.waitForTimeout(4000);
    return {
      url, status,
      ...(await page.evaluate((base) => {
        const txt = document.body.innerText || '';
        const spec = {};
        document.querySelectorAll('table tr').forEach(tr => {
          const tds = tr.querySelectorAll('td,th');
          if (tds.length >= 2) {
            const k = tds[0].textContent.trim().replace(/\s+/g, ' ');
            const v = tds[1].textContent.trim().replace(/\s+/g, ' ');
            if (k && v && k.length < 80) spec[k] = v;
          }
        });
        const og = (document.querySelector('meta[property="og:image"]') || {}).content || '';
        let jsonLd = null;
        try {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
            .filter(Boolean);
          jsonLd = scripts.length ? scripts[0] : null;
        } catch { jsonLd = null; }
        const origin = new URL(base).origin;
        const rawImgs = Array.from(document.querySelectorAll('img')).map(i => i.getAttribute('src') || '');
        const okImgs = rawImgs.filter(s => s && /\.(webp|png|jpe?g)(\?|$)/i.test(s));
        const absImgs = okImgs.map(s => (s.startsWith('/') ? origin + s : s).split('?')[0]);
        const ownImgs = absImgs.filter(s => s.startsWith(origin));
        const gallery = [...new Set(ownImgs)].slice(0, 15);
        return {
          title: document.title,
          h1: ((document.querySelector('h1') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
          prices: [...new Set(txt.match(/R\$ [\d.,]+/g) || [])],
          ogImage: og, jsonLd, gallery, specs: spec
        };
      }, new URL(url).origin))
    };
  } finally {
    await page.close();
  }
}

const server = new McpServer({ name: 'moto-catalog', version: '1.0.0' });

server.tool('list_models',
  'Lista os modelos de uma marca via navegador real (fura bloqueio 403). Retorna slug, url, preco (quando o card exibe) e foto.',
  { brand: brandSchema },
  async ({ brand }) => {
    const cfg = BRANDS[brand];
    let cards = await scrapeListing(brand);
    cards = cards.map(c => ({ ...c, imgOfficial: cfg.imgFull(c.img) }));
    return { content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }] };
  }
);

server.tool('get_model',
  'Extrai a pagina de detalhe de um modelo (titulo, precos, og:image, JSON-LD, galeria same-origin, tabelas de ficha). Funciona p/ qualquer marca/URL.',
  { url: z.string().describe('URL completa da pagina do modelo') },
  async ({ url }) => ({ content: [{ type: 'text', text: JSON.stringify(await scrapeDetail(url), null, 2) }] })
);

server.tool('download_images',
  'Baixa imagens via navegacao (fura 403 de CDN que barra fetch direto). Recebe lista {slug,url} e salva em outDir. Retorna manifesto.',
  {
    items: z.array(z.object({ slug: z.string(), url: z.string().url() })).describe('imagens a baixar'),
    outDir: z.string().describe('diretorio de destino'),
    urlPrefix: z.string().optional().describe('prefixo p/ URL local no manifesto (ex: /img/catalogo/honda)')
  },
  async ({ items, outDir, urlPrefix }) => {
    fs.mkdirSync(outDir, { recursive: true });
    const b = await getBrowser();
    const page = await newPage(b);
    const manifest = [];
    try {
      await page.goto(BRANDS.honda.listing, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
      for (const it of items) {
        let ext = (it.url.split('.').pop() || 'webp').toLowerCase().slice(0, 4);
        if (!/^(webp|png|jpg|jpeg)$/.test(ext)) ext = 'webp';
        const file = path.join(outDir, it.slug + '.' + ext);
        try {
          const resp = await page.goto(it.url, { timeout: 30000 });
          const buf = resp && resp.status() === 200 ? await resp.body() : null;
          const ct = (resp && resp.headers()['content-type']) || '';
          if (buf && buf.length > 5000 && ct.includes('image')) {
            fs.writeFileSync(file, buf);
            manifest.push({ slug: it.slug, file, bytes: buf.length, localUrl: (urlPrefix || '') + '/' + it.slug + '.' + ext });
          } else {
            manifest.push({ slug: it.slug, error: 'status=' + (resp && resp.status()) });
          }
        } catch (e) { manifest.push({ slug: it.slug, error: e.message }); }
      }
    } finally {
      await page.close();
    }
    return { content: [{ type: 'text', text: JSON.stringify(manifest, null, 2) }] };
  }
);

server.tool('sync_moto_catalog',
  'Pipeline Honda: aplica fotos+precos oficiais do /modelos no MOTO.json (1a foto = /modelos, rename Sahara) e opcionalmente sincroniza o Postgres. Para outras marcas, use list_models/get_model/download_images e monte o JSON.',
  {
    motoJson: z.string().optional().describe('caminho do MOTO.json'),
    imgBaseUrl: z.string().optional().describe('prefixo das fotos locais (padrao /img/catalogo/honda)'),
    syncDb: z.boolean().optional().describe('sincronizar Postgres via prisma do server-consorcio (padrao false)'),
    serverDir: z.string().optional().describe('pasta do server-consorcio (p/ syncDb)')
  },
  async ({ motoJson, imgBaseUrl, syncDb, serverDir }) => {
    const jsonPath = motoJson || DEFAULT_MOTO_JSON;
    const prefix = imgBaseUrl || '/img/catalogo/honda';
    const cards = await scrapeListing('honda');
    const cfg = BRANDS.honda;
    const bySlug = new Map(cards.map(c => [c.slug, c]));
    const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const byModel = new Map(d.produtos.map(p => [p.model, p]));
    const report = [];
    for (const [slug, model] of Object.entries(HONDA_SLUG_TO_MODEL)) {
      const card = bySlug.get(slug);
      const p = byModel.get(model) || byModel.get('Sahara 300 Adventure');
      if (!card) { report.push('SEM CARD: ' + slug); continue; }
      if (!p) { report.push('SEM ENTRY: ' + model); continue; }
      let ext = (cfg.imgFull(card.img).split('.').pop() || 'webp').toLowerCase().slice(0, 4);
      if (!/^(webp|png|jpg|jpeg)$/.test(ext)) ext = 'webp';
      const local = prefix + '/' + slug + '.' + ext;
      const ch = [];
      if (p.imageUrl !== local) { p.imageUrl = local; ch.push('foto'); }
      // REGRA: sem URL repetida dentro da galeria
      p.imageUrls = [...new Set([local, ...p.imageUrls.filter(u => u !== local)])];
      const pr = parseBRL(card.price);
      if (pr && p.price !== pr) { ch.push(p.price + '->' + pr); p.price = pr; }
      if (model === 'Sahara 300' && p.model === 'Sahara 300 Adventure') {
        p.model = 'Sahara 300'; p.name = 'Honda Sahara 300 2024'; ch.push('rename');
      }
      if (ch.length) report.push('~ ' + p.name + ' [' + ch.join(', ') + ']');
    }
    // REGRA DURA: nenhuma URL pode se repetir — nem dentro da galeria,
    // nem entre produtos. Repetida encontrada = deletada na hora; reuso entre
    // modelos diferentes = sync RECUSADO com erro explícito.
    for (const p of d.produtos) {
      const antes = (p.imageUrls || []).length;
      p.imageUrls = [...new Set(p.imageUrls || [])];
      if (!p.imageUrl || !p.imageUrls.includes(p.imageUrl)) p.imageUrl = p.imageUrls[0] || '';
      if (p.imageUrls.length !== antes) report.push('DELETADA repetida em ' + p.name);
    }
    const owners = new Map();
    for (const p of d.produtos) {
      for (const u of p.imageUrls) {
        if (!owners.has(u)) owners.set(u, []);
        if (!owners.get(u).includes(p.name)) owners.get(u).push(p.name);
      }
    }
    const reuso = [...owners.entries()].filter(([, ns]) => ns.length > 1);
    if (reuso.length) {
      throw new Error('SYNC RECUSADO — URL repetida entre modelos:\n'
        + reuso.map(([u, ns]) => '  ' + u.slice(-70) + ' <- ' + ns.join(' + ')).join('\n'));
    }
    fs.writeFileSync(jsonPath, JSON.stringify(d, null, 2), 'utf8');

    if (syncDb) {
      const { createRequire } = require('module');
      const req = createRequire((serverDir || DEFAULT_SERVER_DIR) + '/package.json');
      const { PrismaClient, Prisma } = req('@prisma/client');
      const prisma = new PrismaClient();
      const ALIAS = { 'CB 500 Hornet': ['CB 500F'] };
      const dbRep = { updated: 0, inserted: 0 };
      try {
        for (const j of d.produtos.filter(p => p.brand === 'Honda')) {
          const data = {
            name: j.name, description: j.description, type: j.type, category: j.category,
            imageUrl: j.imageUrl, imageUrls: JSON.stringify(j.imageUrls),
            price: new Prisma.Decimal(j.price), active: true,
            isFeatured: j.isFeatured, isPopular: j.isPopular,
            brand: j.brand, model: j.model, year: j.year, specs: JSON.stringify(j.specs),
            minDuration: j.minDuration, maxDuration: j.maxDuration,
            adminFeeRate: new Prisma.Decimal(j.adminFeeRate)
          };
          const or = [{ brand: 'Honda', model: j.model }, ...(ALIAS[j.model] || []).map(m => ({ brand: 'Honda', model: m }))];
          const existing = await prisma.product.findFirst({ where: { OR: or } });
          if (existing) {
            await prisma.product.update({ where: { id: existing.id }, data });
            dbRep.updated++;
          } else {
            const ds = new Set([j.minDuration, j.maxDuration]);
            for (let x = j.minDuration; x <= j.maxDuration; x += 12) ds.add(x);
            const plans = [...ds].sort((a, b) => a - b).map(x => ({
              name: x + ' Meses', durationMonths: x,
              adminFeeRate: new Prisma.Decimal(j.adminFeeRate), fundRate: new Prisma.Decimal(2.0), active: true
            }));
            await prisma.product.create({ data: { ...data, plans: { create: plans } } });
            dbRep.inserted++;
          }
        }
      } finally {
        await prisma.$disconnect();
      }
      report.push('DB: ' + dbRep.updated + ' atualizados, ' + dbRep.inserted + ' inseridos');
    }
    return { content: [{ type: 'text', text: report.join('\n') || 'nada a fazer' }] };
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
}
main().catch(e => { console.error(e); process.exit(1); });
process.on('SIGINT', async () => { if (browser) await browser.close(); process.exit(0); });
