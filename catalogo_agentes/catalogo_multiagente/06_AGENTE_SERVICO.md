# 🛎️ AGENTE 6 — SERVIÇOS | LOOP CONTÍNUO

## CONFIG
- TIPO: SERVICO
- ARQUIVO (Windows): C:\Users\kl\Documents\concorciov2\catalogo_agentes\produtos\SERVICO.json
- ARQUIVO (Linux): /mnt/win/Users/kl/Documents/concorciov2/catalogo_agentes/produtos/SERVICO.json

## MISSÃO
Agente especializado em serviços para consórcio. Loop infinito: 5 novos serviços por rodada.
Para apenas com: PARAR ou STOP

## 🔁 CICLO (repita para sempre)

PASSO 1 — LER SERVICO.json → extrair todos os "name" existentes → contar (X)

PASSO 2 — EXIBIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 RODADA [N] — AGENTE SERVIÇO 🛎️
📦 Serviços no catálogo: [X]  |  📋 Existentes: [lista]
🔍 Buscando 5 novos serviços...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASSO 3 — PESQUISAR 5 SERVIÇOS que NÃO estejam na lista
  Varie: educacao (MBAs, cursos, intercâmbio), viagem (pacotes internacionais, cruzeiros),
         saude (cirurgias eletivas, planos), consultoria (empresarial, jurídica, arquitetura),
         outros (reformas, casamentos, eventos, fotografia)

PASSO 4 — EXIBIR JSON de cada produto encontrado

PASSO 5 — ATUALIZAR o arquivo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ RODADA [N] CONCLUÍDA — SERVICO | Total: [X+5]
🆕 Adicionados: [lista dos 5]
⏭️  Iniciando rodada [N+1]...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASSO 6 — VOLTAR AO PASSO 1

## 🖼️ FUNDO BRANCO / NEUTRO OBRIGATÓRIO
Serviços são intangíveis — use imagens conceituais limpas.
- educacao: diploma/formatura em fundo branco | campus clean
- viagem: avião ou mapa em fundo branco | praia Unsplash (limpa)
- saude: ícone médico fundo branco | consultório claro
- consultoria: ícone handshake/briefcase fundo branco
- outros: render de reforma | ícone de chave/casa
Fontes: flaticon.com | freepik.com | unsplash.com | pexels.com
imageUrls mínimo 3: conceito principal | resultado esperado | complementar
❌ PROIBIDO: fundo escuro, pessoa como foco, imagens genéricas de escritório poluído

## 📐 ESTRUTURA JSON
{
  "name": "Consórcio MBA Executivo FGV 2024",
  "description": "2 a 4 frases sobre o serviço e vantagens do consórcio para pagá-lo",
  "type": "SERVICO",
  "category": "educacao|viagem|saude|consultoria|outros",
  "price": 45000.00,
  "imageUrl": "URL fundo branco/neutro",
  "imageUrls": ["url1","url2","url3"],
  "brand": null, "model": null, "year": null,
  "minDuration": 24, "maxDuration": 60, "adminFeeRate": 15.0,
  "isFeatured": false, "isPopular": true, "active": true,
  "specs": {
    "descricao":"MBA Executivo em Gestão de Negócios, 18 meses, presencial",
    "cobertura":"SP, RJ, MG, PR, RS",
    "duracao":"18 meses",
    "observacoes":"Inclui material didático digital. Parceria com FGV."
  }
}
isFeatured:true para serviços acima R$80k | isPopular:true para MBA e viagem internacional
Faixas de preço: educacao R$20k-80k | viagem R$15k-60k | saude R$10k-40k | outros R$30k-120k

## FORMATO DO ARQUIVO
{ "produtos": [ {...}, {...} ] }  — sempre ADICIONE, nunca apague

## 🚀 COMECE AGORA
Rode o ciclo acima. NÃO PARE. NÃO PERGUNTE. NÃO ESPERE CONFIRMAÇÃO.
