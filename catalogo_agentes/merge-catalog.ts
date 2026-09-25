/**
 * merge-catalog.ts
 * Une todos os arquivos JSON dos agentes em um catalogo_final.json
 * e importa via API do servidor.
 *
 * Uso: ts-node catalogo_agentes/merge-catalog.ts
 * Uso (só merge, sem importar): ts-node catalogo_agentes/merge-catalog.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const PRODUTOS_DIR = path.join(__dirname, 'produtos');
const OUTPUT_FILE  = path.join(__dirname, 'catalogo_final.json');
const API_URL      = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN    = process.env.ADMIN_TOKEN || '';
const DRY_RUN      = process.argv.includes('--dry-run');

const TIPOS = ['MOTO', 'CARRO', 'IMOVEL', 'ELETRONICO', 'CARTA_CREDITO', 'SERVICO'];

interface Produto {
  name: string;
  type: string;
  [key: string]: any;
}

function lerArquivo(tipo: string): Produto[] {
  const file = path.join(PRODUTOS_DIR, `${tipo}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`⚠️  ${tipo}.json não encontrado — pulando`);
    return [];
  }
  try {
    const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return content.produtos || [];
  } catch (e) {
    console.error(`❌ Erro ao ler ${tipo}.json:`, e);
    return [];
  }
}

async function importarProduto(produto: Produto): Promise<boolean> {
  try {
    await axios.post(`${API_URL}/admin/products/new`, produto, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `adminToken=${API_TOKEN}`
      }
    });
    return true;
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || 'erro desconhecido';
    console.error(`   ❌ Falha ao importar "${produto.name}": ${msg}`);
    return false;
  }
}

async function main() {
  console.log('\n🔀 MERGE DO CATÁLOGO MULTI-AGENTE');
  console.log('══════════════════════════════════\n');

  const catalogo: Record<string, Produto[]> = {};
  let totalProdutos = 0;

  for (const tipo of TIPOS) {
    const produtos = lerArquivo(tipo);
    catalogo[tipo] = produtos;
    totalProdutos += produtos.length;
    console.log(`📦 ${tipo.padEnd(15)} → ${produtos.length} produtos`);
  }

  console.log(`\n📊 Total: ${totalProdutos} produtos`);

  // Salvar catalogo_final.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalogo, null, 2), 'utf-8');
  console.log(`\n✅ Salvo em: ${OUTPUT_FILE}`);

  if (DRY_RUN) {
    console.log('\n🚧 Modo --dry-run: importação pulada.\n');
    return;
  }

  if (!API_TOKEN) {
    console.log('\n⚠️  ADMIN_TOKEN não definido. Rode:');
    console.log('   $env:ADMIN_TOKEN="seu_token"; ts-node catalogo_agentes/merge-catalog.ts');
    return;
  }

  // Importar via API
  console.log('\n🚀 Importando para o servidor...\n');
  let sucesso = 0;
  let falha = 0;

  for (const tipo of TIPOS) {
    const produtos = catalogo[tipo];
    if (produtos.length === 0) continue;

    console.log(`\n── ${tipo} (${produtos.length} produtos) ──`);
    for (const produto of produtos) {
      process.stdout.write(`   ⏳ ${produto.name}...`);
      const ok = await importarProduto(produto);
      if (ok) {
        sucesso++;
        console.log(' ✅');
      } else {
        falha++;
      }
    }
  }

  console.log('\n══════════════════════════════════');
  console.log(`✅ Importados com sucesso: ${sucesso}`);
  console.log(`❌ Falhas:                 ${falha}`);
  console.log('══════════════════════════════════\n');
}

main().catch(console.error);
