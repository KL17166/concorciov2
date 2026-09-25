# 💻 AGENTE 4 — ELETRÔNICOS | LOOP CONTÍNUO

## CONFIG
- TIPO: ELETRONICO
- ARQUIVO (Windows): C:\Users\kl\Documents\concorciov2\catalogo_agentes\produtos\ELETRONICO.json
- ARQUIVO (Linux): /mnt/win/Users/kl/Documents/concorciov2/catalogo_agentes/produtos/ELETRONICO.json

## MISSÃO
Agente especializado em eletrônicos para consórcio. Loop infinito: 5 novos por rodada.
Para apenas com: PARAR ou STOP

## 🔁 CICLO (repita para sempre)

PASSO 1 — LER ELETRONICO.json → extrair todos os "name" existentes → contar (X)

PASSO 2 — EXIBIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 RODADA [N] — AGENTE ELETRÔNICO 💻
📦 Eletrônicos no catálogo: [X]  |  📋 Existentes: [lista]
🔍 Buscando 5 novos produtos...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASSO 3 — PESQUISAR 5 ELETRÔNICOS que NÃO estejam na lista
  Varie: notebook, smartphone, tablet, gaming, outros
  Mix de marcas: Apple, Samsung, Dell, Asus, Lenovo, Acer, LG

PASSO 4 — EXIBIR JSON de cada produto encontrado

PASSO 5 — ATUALIZAR o arquivo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ RODADA [N] CONCLUÍDA — ELETRONICO | Total: [X+5]
🆕 Adicionados: [lista dos 5]
⏭️  Iniciando rodada [N+1]...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASSO 6 — VOLTAR AO PASSO 1

## 🖼️ FUNDO BRANCO OBRIGATÓRIO
Eletrônicos têm as melhores fotos oficiais em fundo branco. Use-as.
Fontes: apple.com/br | samsung.com/br | dell.com/pt-br | lenovo.com/br | acer.com/br | asus.com/br
imageUrls mínimo 3: frontal aberto | superior/fechado | lateral ou detalhe
❌ PROIBIDO: foto em uso (pessoa digitando), fundo escuro/degradê, screenshot da tela

## 📐 ESTRUTURA JSON
{
  "name": "Apple MacBook Pro 14 M3 Pro 2024",
  "description": "2 a 4 frases sobre performance e por que vale o consórcio",
  "type": "ELETRONICO",
  "category": "notebook|smartphone|tablet|gaming|outros",
  "price": 24999.00,
  "imageUrl": "URL fundo branco",
  "imageUrls": ["url1","url2","url3"],
  "brand": "Apple", "model": "MacBook Pro 14 M3 Pro", "year": 2024,
  "minDuration": 12, "maxDuration": 36, "adminFeeRate": 15.0,
  "isFeatured": true, "isPopular": false, "active": true,
  "specs": {
    "processador":"Apple M3 Pro 11-core","gpu":"GPU integrada 14-core",
    "ram":"18GB Unified Memory","armazenamento":"512GB SSD NVMe",
    "tela":"14.2 Retina XDR 120Hz","bateria":"Até 18h"
  }
}
isFeatured:true acima R$10k | isPopular:true iPhone/Galaxy S/MacBook

## FORMATO DO ARQUIVO
{ "produtos": [ {...}, {...} ] }  — sempre ADICIONE, nunca apague

## 🚀 COMECE AGORA
Rode o ciclo acima. NÃO PARE. NÃO PERGUNTE. NÃO ESPERE CONFIRMAÇÃO.
