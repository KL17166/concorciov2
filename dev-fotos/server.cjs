#!/usr/bin/env node
/**
 * dev-fotos — modo DEV de alinhamento de fotos (Honda).
 *
 * Uso:  node server.cjs   → abre http://localhost:3002
 *
 * O que faz:
 *  - Lista os modelos Honda do catalogo_agentes/produtos/MOTO.json
 *  - Para o modelo selecionado mostra SÓ as fotos extraídas dele
 *    (arquivos em zuvio-web/public/img/catalogo/honda/<slug>*)
 *  - Permite reordenar, definir capa, remover, subir foto do PC e salvar
 *  - Salva direto no MOTO.json (imageUrl = 1ª foto, imageUrls = ordem)
 *  - Aplica a REGRA DURA: recusa salvar se a mesma URL estiver em 2 modelos
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = '/mnt/win/Users/kl/Documents/concorciov2';
const MOTO_JSON = path.join(BASE, 'catalogo_agentes/produtos/MOTO.json');
const IMG_DIR = path.join(BASE, 'zuvio-web/public/img/catalogo/honda');
const HERE = __dirname;
const MANIFEST = path.join(HERE, 'extracao-2026-09-18.json');
const PORT = 3002;
const IMG_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg']);

const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

function loadMoto() { return JSON.parse(fs.readFileSync(MOTO_JSON, 'utf8')); }
function loadManifest() { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { listing: [], details: {} }; } }
// slug do modelo = basename da imageUrl atual (ex: hornet-750.webp -> hornet-750)
function slugOf(p) {
  const b = path.basename(p.imageUrl || '');
  return b.replace(/\.(webp|png|jpe?g)$/i, '');
}
function localFiles(slug) {
  if (!fs.existsSync(IMG_DIR)) return [];
  return fs.readdirSync(IMG_DIR)
    .filter(f => {
      const e = path.extname(f).toLowerCase();
      if (!IMG_EXTS.has(e)) return false;
      const base = f.slice(0, -e.length);
      return base === slug || base.startsWith(slug + '-') || base.startsWith(slug + '.');
    })
    .sort();
}
function fileInfo(f) {
  const fp = path.join(IMG_DIR, f);
  const buf = fs.readFileSync(fp);
  return {
    name: f,
    url: '/img/catalogo/honda/' + f,
    bytes: buf.length,
    md5: crypto.createHash('md5').update(buf).digest('hex')
  };
}
function send(res, code, body, type = 'application/json; charset=utf-8') {
  const b = typeof body === 'string' ? body : JSON.stringify(body);
  // B9: ferramenta de DEV — sem CORS aberto (antes `*`). Mesma origem não precisa.
  res.writeHead(code, { 'Content-Type': type });
  res.end(b);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => { chunks.push(c); if (chunks.reduce((a, x) => a + x.length, 0) > 30 * 1024 * 1024) { req.destroy(); reject(new Error('body muito grande')); } });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// Parser multipart mínimo (suficiente p/ upload de imagens do PC)
function parseMultipart(buf, boundary) {
  const files = [];
  const parts = buf.toString('latin1').split('--' + boundary);
  for (const part of parts) {
    const m = part.match(/Content-Disposition: form-data;[^;]*filename="([^"]+)"/i);
    if (!m) continue;
    const filename = path.basename(m[1]);
    const tm = part.match(/Content-Type:\s*([^\r\n]+)/i);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    let data = Buffer.from(part.slice(headerEnd + 4), 'latin1');
    // remove \r\n final do part
    if (data.length >= 2 && data[data.length - 2] === 13 && data[data.length - 1] === 10) data = data.slice(0, -2);
    files.push({ filename, contentType: tm ? tm[1].trim() : 'application/octet-stream', data });
  }
  return files;
}
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;

    // ── UI ──
    if (p === '/' || p === '/index.html') {
      return send(res, 200, fs.readFileSync(path.join(HERE, 'index.html'), 'utf8'), mime['.html']);
    }
    // ── imagens locais (mesmo prefixo do front: /img/catalogo/honda/...) ──
    if (p.startsWith('/img/')) {
      const fp = path.normalize(path.join(BASE, 'zuvio-web/public', decodeURIComponent(p)));
      if (!fp.startsWith(path.join(BASE, 'zuvio-web/public')) || !fs.existsSync(fp)) return send(res, 404, { error: 'não achei' });
      res.writeHead(200, { 'Content-Type': mime[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      return fs.createReadStream(fp).pipe(res);
    }
    // ── GET /api/models ──
    if (p === '/api/models' && req.method === 'GET') {
      const d = loadMoto();
      const man = loadManifest();
      const sitePrice = new Map((man.listing || []).map(c => [c.slug, c.price]));
      const hondas = d.produtos.filter(x => x.brand === 'Honda');
      return send(res, 200, hondas.map(x => {
        const slug = slugOf(x);
        return { slug, name: x.name, model: x.model, price: x.price, sitePrice: sitePrice.get(slug) || null, imageUrl: x.imageUrl, galleryCount: (x.imageUrls || []).length, localCount: localFiles(slug).length };
      }));
    }
    // ── GET /api/model?slug= ──
    if (p === '/api/model' && req.method === 'GET') {
      const slug = u.searchParams.get('slug') || '';
      const d = loadMoto();
      const entry = d.produtos.find(x => x.brand === 'Honda' && slugOf(x) === slug);
      if (!entry) return send(res, 404, { error: 'modelo não achei: ' + slug });
      const files = localFiles(slug).map(fileInfo);
      const byMd5 = new Map();
      for (const f of files) { if (!byMd5.has(f.md5)) byMd5.set(f.md5, []); byMd5.get(f.md5).push(f.name); }
      const dups = [...byMd5.values()].filter(g => g.length > 1);
      const gallery = entry.imageUrls || [];
      const man = loadManifest();
      const card = (man.listing || []).find(c => c.slug === slug) || null;
      const detail = (man.details || {})[slug] || null;
      return send(res, 200, { entry: { name: entry.name, model: entry.model, price: entry.price, imageUrl: entry.imageUrl, imageUrls: gallery }, files, dups, siteCard: card, siteDetail: detail });
    }
    // ── POST /api/upload?slug= (multipart do PC) ──
    if (p === '/api/upload' && req.method === 'POST') {
      const slug = u.searchParams.get('slug') || 'geral';
      const ct = req.headers['content-type'] || '';
      const bm = ct.match(/boundary=(.+)$/);
      if (!bm) return send(res, 400, { error: 'esperava multipart' });
      const body = await readBody(req);
      const uploads = parseMultipart(body, bm[1]);
      if (!uploads.length) return send(res, 400, { error: 'nenhum arquivo veio' });
      const saved = [];
      let n = localFiles(slug).filter(f => f.includes('-pc-')).length;
      for (const up of uploads) {
        let ext = path.extname(up.filename).toLowerCase();
        if (!IMG_EXTS.has(ext)) {
          if (/png/i.test(up.contentType)) ext = '.png';
          else if (/jpe?g/i.test(up.contentType)) ext = '.jpg';
          else ext = '.webp';
        }
        if (up.data.length < 1024) continue;
        n++;
        const name = `${slug}-pc-${Date.now()}-${n}${ext}`;
        fs.writeFileSync(path.join(IMG_DIR, name), up.data);
        saved.push({ ...fileInfo(name) });
      }
      return send(res, 200, { saved });
    }
    // ── POST /api/delete {file} ──
    if (p === '/api/delete' && req.method === 'POST') {
      const { file } = JSON.parse((await readBody(req)).toString('utf8'));
      const fp = path.normalize(path.join(IMG_DIR, path.basename(file || '')));
      if (!fp.startsWith(IMG_DIR) || !fs.existsSync(fp)) return send(res, 404, { error: 'arquivo não achei' });
      fs.unlinkSync(fp);
      return send(res, 200, { deleted: path.basename(fp) });
    }
    // ── POST /api/save {slug, imageUrls} ──
    if (p === '/api/save' && req.method === 'POST') {
      const { slug, imageUrls } = JSON.parse((await readBody(req)).toString('utf8'));
      if (!slug || !Array.isArray(imageUrls) || !imageUrls.length) return send(res, 400, { error: 'manda slug + imageUrls (mínimo 1)' });
      const d = loadMoto();
      const entry = d.produtos.find(x => x.brand === 'Honda' && slugOf(x) === slug);
      if (!entry) return send(res, 404, { error: 'modelo não achei: ' + slug });
      const clean = [...new Set(imageUrls)];
      // REGRA DURA: URL repetida entre modelos = recusa
      const offenders = [];
      for (const prod of d.produtos) {
        if (prod === entry) continue;
        for (const url of (prod.imageUrls || [])) {
          if (clean.includes(url)) offenders.push(`${url.slice(-60)} já está em ${prod.name}`);
        }
      }
      if (offenders.length) return send(res, 409, { error: 'SYNC RECUSADO — URL repetida entre modelos', offenders });
      fs.copyFileSync(MOTO_JSON, MOTO_JSON + '.bak');
      entry.imageUrls = clean;
      entry.imageUrl = clean[0];
      fs.writeFileSync(MOTO_JSON, JSON.stringify(d, null, 2), 'utf8');
      return send(res, 200, { ok: true, name: entry.name, imageUrl: entry.imageUrl, total: clean.length });
    }
    return send(res, 404, { error: 'rota não existe' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});
server.listen(PORT, () => console.log(`dev-fotos no ar → http://localhost:${PORT}`));
