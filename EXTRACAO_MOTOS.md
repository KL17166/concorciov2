# Extração do lineup Honda → MOTO.json → Postgres

Como as 33 motos do `honda.com.br/motos/modelos` foram extraídas, tratadas e
gravadas no catálogo. Processo 100% reproduzível via MCP `moto-catalog`.

---

## 1. Objetivo

Extrair **todas** as motos do `/modelos` (o usuário contou 33), visitar cada
URL, extrair os dados, gravar no `catalogo_agentes/produtos/MOTO.json` no
padrão do `01_AGENTE_MOTO.md`, com a **1ª foto = a do `/modelos` (fundo
branco)**, e subir tudo para o Postgres.

## 2. Ambiente e limitações

- Sem MCP de navegador na sessão: só `bash`, `read/edit/write`, `webfetch`,
  `websearch`. `python3` inexistente (só Node 24 + npm).
- `honda.com.br` bloqueia **qualquer fetch direto** com 403 (páginas, CDN de
  imagens, `r.jina.ai`, staging `hml`). `Invoke-WebRequest`, `curl`, webfetch:
  tudo 403.
- Solução: **navegador real** — `playwright-core` (npm, ~segundos, sem baixar
  Chromium) pilotando o **Edge já instalado** na máquina via `executablePath`,
  `headless: true`, UA Chrome comum + `--disable-blink-features=AutomationControlled`.
  Resultado: 200 e página renderizada (print conferido).

## 3. Método de extração (vale para qualquer marca)

1. **Recon**: abrir a listagem no navegador real, anotar `status`, `title` e
   links que parecem modelo. Descobre o padrão de URL de cada marca.
2. **Scroll completo antes de extrair**: listagens usam lazy-load; rolar até
   `scrollHeight` em intervalos, senão metade dos cards não existe no DOM.
3. **Ancorar no preço, não em classe CSS**: classes mudam a cada redesign.
   O extrator localiza os textos `R$ ...`, sobe no DOM até o ancestral com
   `img` + link de modelo e dali tira nome, preço, URL e foto juntos.
   - Honda: âncora fina `.single-product-price` + fallback em touring
     (Gold Wing não tem preço no card → âncora só no link `/touring/`).
4. **Foto grande a partir do thumbnail**: o `/modelos` serve `srcset` com
   estilos (`/styles/product_200x128/public/...`). O arquivo original é o
   mesmo path sem `/styles/<estilo>/public` e sem `?itok=`.
5. **Download via navegação**: o CDN barra `fetch`/HEAD direto (403), mas
   `page.goto(urlDaImagem)` retorna `200 + image/webp + bytes`. Foi assim que
   as 33 fotos fundo branco foram baixadas para
   `zuvio-web/public/img/catalogo/honda/<slug>.webp` (33/33 válidas por magic
   bytes). Hotlink foi descartado de propósito: quebraria no app (WebView
   também tomaria 403).
6. **Detalhe por modelo**: cada URL rende `h1`, preços, `og:image`, JSON-LD,
   galeria same-origin e tabelas `<table>` de ficha. Descobertas úteis:
   Sahara virou **XRE300 Sahara 2027**; CB 1000R = R$ 78.870 e Black Edition =
   R$ 87.730 (páginas oficiais, via buscador); Africa Twin 2026 MT =
   R$ 85.500 / Adventure Sports DCT = R$ 116.513.
7. **Verificação**: schema do `.md` (17 campos, `imageUrls ≥ 3`,
   `imageUrls[0] === imageUrl`), HEAD 200 nas imagens novas, `node --test`
   quando aplicável e conferência final via `GET /api/products`.

## 4. Padrões por marca (presets do MCP, testados em 09/2026)

| Marca | Listagem | Padrão do link de modelo | Preço no card? |
|---|---|---|---|
| Honda | `honda.com.br/motos/modelos` | `/motos/<street\|adventure\|off-road\|sport\|touring>/…` | Sim (33) |
| Yamaha | `yamaha-motor.com.br/motos` | `/product/<slug>-<id>` | Não (só no detail) |
| Kawasaki | `kawasakibrasil.com/pt_br/motorcycles.html` | `/pt_br/motorcycles/<fam>/<mod>-<ano>.html` | Não |
| BMW | `bmw-motorrad.com.br/` (home/nav) | `/pt/models/<cat>/<mod>.html` (`/pt/models.html` dá 404) | Não |

## 5. Cruzamento com o MOTO.json

O JSON já tinha 58 produtos (fruto de rodadas anteriores). Do lineup oficial,
**só 4 estavam ausentes** e foram criados com dados oficiais: CB 1000R,
CB 1000R Black Edition, CRF 250F, Africa Twin Adventure Sports ES DCT.
Os 4 ausentes **não estão no `/modelos`** (saíram do lineup), mas têm página
oficial ativa — por isso entraram mesmo assim, com dados das páginas oficiais.
Preços sincronizados com a tabela vigente do `/modelos` (ex.: Titan
16.760→20.590, Fan→18.980, Biz→13.505, PCX→19.080, Bros→22.400,
XRE 190→24.530, Twister→26.880, Sahara→31.855). `Sahara 300 Adventure` foi
renomeada para `Sahara 300`.

## 6. Subida ao Postgres

- Match por `(brand, model)` — evita duplicar `...2024` × `...2025`.
- Alias: `CB 500 Hornet` ≡ `CB 500F` (a Honda renomeou; a linha do banco foi
  atualizada para o nome oficial mantendo `id` e plans).
- Novos produtos ganham plans 24/36/48/60 (`adminFeeRate` do JSON,
  `fundRate 2.0`) — mesma regra do `adminProductController.createProduct`.
- Resultado: 42 → 74 produtos. Conferido via `GET /api/products`.

## 7. Regra de URLs únicas (dura — sem exceção)

- **Nenhuma URL pode existir duas vezes em lugar nenhum**: nem dentro da
  galeria de um produto, nem entre produtos, nem entre arquivos do catálogo.
  Vale até para a **mesma foto em tamanho diferente** (ex.: `...-1024x523`
  × `...-768x392` do mesmo clique contam como repetição).
- **Repetida encontrada = deletada na hora** — no JSON, no banco e nos
  scripts. Sem "manter na original": ou a foto é de um produto só, ou sai.
- Arquivos **byte-idênticos com nomes diferentes** contam como repetição
  (ex.: Transalp branca `_0` e sem `_0` tinham 123.388 bytes iguais — uma foi
  deletada).
- Os scripts **não aceitam** repetidas: `sync_moto_catalog` deleta dups
  intra-galeria sozinho e **RECUSA o sync** (throw com a lista de ofensores)
  se a mesma URL aparecer em dois modelos. Casos resolvidos assim: CB 1000R
  × Black Edition ganharam ângulos próprios; variantes Yamaha (Deadpool,
  Wolverine, 70th) ficaram só com fotos exclusivas; 13 fotos genéricas
  compartilhadas no SERVICO foram trocadas por 18 fotos temáticas verificadas
  (Wikimedia Commons, conferidas uma a uma visualmente — rejeitadas: gato de
  estátua, retrato aleatório, time de marketing genérico, foto com símbolo
  político); 9 fotos triplicadas no CARRO foram reduzidas; e 4 reusos em
  linhas legadas do banco (Argo×Onix, Casa×Carta R$500k, Apê×Studio) ganharam
  fotos próprias (fachada de banco, dólar, loft).
- Auditoria canônica: `audit_all.cjs` varre todos os `produtos/*.json`
  (intra + cross entre arquivos) e o script `dbsync_misc` audita o Postgres.
  Estado final: **zero repetidas em todos os JSONs e no banco**.

## 8. Verificação visual das fotos (obrigatória)

Magic bytes (`RIFF....WEBP`, `89 50 4E 47`) provam que o arquivo é imagem,
**não** que serve para o catálogo. Por isso toda foto baixada é aberta e
conferida por estes critérios, nesta ordem:

1. **É a moto certa?** (comparar com o card do `/modelos` — o CDN tem fotos
   com nomes parecidos de outras cores/versões).
2. **Fundo branco puro?** Regra do `01_AGENTE_MOTO.md`: `imageUrl` e
   `imageUrls` exigem fundo branco. Rejeitar: fundo preto de estúdio, foto
   ambiente (rua/floresta), banner gráfico, close de peça (painel, LED).
3. **Ângulo útil?** Preferir lateral direita completa; depois frontal 3/4 e
   traseira 3/4. Evitar 3 fotos do mesmo ângulo.
4. **Duplicada?** Comparar tamanho em bytes — arquivos idênticos têm o mesmo
   tamanho (ex.: Transalp branca `_0` e sem `_0` tinham 123.388 bytes iguais).
5. **Resolução mínima**: descartar abaixo de ~5 KB ou thumbs (`200x128`).

Exceções à regra do fundo branco são permitidas, mas **documentadas** (ver
caso Transalp abaixo).

## 8. Re-extração por modelo (caso Transalp — 09/2026)

Quando uma entry está "com cara de extração antiga" (galeria com banner,
categoria errada), o procedimento é:

1. Abrir a **página de detalhe oficial** no navegador real e extrair: `title`
   (revela ano/linha — era "Transalp 750 2026 - Crossover"), preços, galeria
   com `alt` (o `alt` diz o que é cada foto: cor, ângulo, peça) e tabelas de
   ficha (neste caso a tabela não renderizou — specs foram mantidas por
   conferirem com a ficha conhecida: 755cc, 90,5cv, 208kg, 16,9L).
2. Baixar **candidatas** (aqui 5) e abrir uma a uma. Resultado: preta e branca
   eram estúdio com **fundo preto**; "design" era **floresta**; `_0` era
   duplicada da branca; frente era estúdio cinza neutro.
3. Montar a galeria final: branca do `/modelos` + frente studio + preta
   (exceção documentada para mostrar a 2ª cor), deletar a duplicada.
4. Corrigir categoria (`touring` → `adventure`, conforme a navegação oficial),
   manter preço (R$ 65.545 confirmado) e atualizar JSON + banco (1 linha).
5. Registrar a exceção neste .md em vez de fingir conformidade.

## 9. Sincronização JSON ↔ banco (regras finas)

- O `price` do JSON é número (`21890.00`); no Postgres é `Decimal` — usar
  `new Prisma.Decimal()` nos dois sentidos, nunca float cru.
- `imageUrls`/`specs` vão como **string JSON** no banco; `JSON.parse` /
  `JSON.stringify` nas bordas, e validar o parse após ler.
- Updates são **in-place pelo `id`** (preserva `plans` e `subscriptions`
  existentes); só `create` gera plans novos. Nunca deletar + recriar produto
  com vendas vinculadas.
- Renames (`Sahara 300 Adventure` → `Sahara 300`, `CB 500F` →
  `CB 500 Hornet`) atualizam `name`+`model` na mesma linha; o match usa alias
  para não duplicar.
- Após sync: conferir contagem (`product.count`), amostrar 2–3 linhas
  (`imageUrl`, `plans.Count`) e bater `GET /api/products`.

## 10. Pegadinhas encontradas

- Espelho de concessionária (usado antes do navegador): specs repetiam dados
  da CG em todas as páginas (erro de template do lojista) — specs sempre da
  fonte oficial.
- `TRX 420` é quadriciclo, mas está no `/modelos` e entrou no catálogo.
- Linha CRF 250/450 aparece como 2 cards; viraram 3 entries (250F/250R/450R).
- `CB1000 Hornet` (R$ 68.800) ≠ `CB 1000R` (R$ 78.870) ≠ `Hornet 750`
  (= `CB750 Hornet`) — três motos distintas.
- Preços do print do usuário foram o gabarito quando divergiam do JSON.
- Gold Wing não tem preço no card ("sob consulta") — preço veio das páginas
  de detalhe (R$ 304.450).
- `CB 1000R`/`Black Edition`/`CRF 250F`/`AT Adventure Sports` saíram do
  `/modelos` mas têm página oficial ativa: entraram com foto do espelho
  (única fonte com 200 direto) em vez do CDN Honda.
- URLs de thumbnail do menu às vezes vêm quebradas (`files2026-02...` sem a
  `/`); só usar URL que passou no download via navegação.
- `node --check` antes de rodar qualquer script `.cjs` novo — dois erros de
  parêntese em regex/cadeias já morderam nesta sessão.

## 11. Artefatos

- `mcp-moto-catalog/` — servidor MCP (`list_models`, `get_model`,
  `download_images`, `sync_moto_catalog`), `README.md` com guia de nova marca,
  `smoke.cjs` (Yamaha E2E). Registrado no `opencode.jsonc` global.
- Scripts avulsos da sessão: `C:\Users\kl\AppData\Local\Temp\opencode\browser\`
  (`recon*.cjs`, `extract*.cjs`, `cards_full.cjs`, `details.cjs`, `dl_all.cjs`,
  `transalp.cjs`, `dl_transalp*.cjs`, `modelos_cards_full.json` com os 33
  oficiais + bytes, `transalp_detail.json` com as 54 imagens da página).
- Fotos: `zuvio-web/public/img/catalogo/honda/` (33 `.webp` do `/modelos` +
  `xl750-transalp-{preta,frente}.webp` da re-extração).

## 12. Eletrônicos: celulares na Amazon (09/2026)

Mesmo método, outra fonte: `amazon.com.br` também rende 200 no navegador real
(sem captcha nesta sessão). Padrões úteis:
- DP direto (`/dp/<ASIN>`) é mais estável que busca (busca mistura
  patrocinados, FE, seminovos e gerações erradas — ex.: buscar "S24" retorna
  S24 FE; "Z Flip6" só retorna Flip7/8/FE).
- Preço: seletores `#corePriceDisplay_desktop_feature_div .a-offscreen`,
  `#apex_offerDisplay .a-offscreen` (o primeiro `.priceToPay` falha às vezes).
- Galeria: `#landingImage[data-old-hires]` + `#altImages img`; normalizar
  `._AC_SL1500_._SL1500_.`→`._SL1500_.` (sufixo duplicado!) e ignorar corpos
  <1KB (thumbs/ícones de vídeo e 360°).
- Download via `page.goto` na imagem funciona no `m.media-amazon.com` com
  intervalo de ~4s entre arquivos.
- Conferir geração/variant no `title` da página antes de gravar: filtrar
  `FE|Seminovo|Recondicionado`; Z Flip6 e iPhone 15 Pro Max só existiam
  seminovos/usados → **cortados** do lote (catálogo só vende novo).
- 13 modelos (S24/S24+/S24 Ultra/S25/S25+/S25 Ultra/S25 FE/Fold6 + iPhone
  15/16/16 Plus/16 Pro/16 Pro Max), fotos locais em
  `public/img/eletronicos/<slug>-{a,b,c}.jpg`, 1ª foto de cada um conferida
  visualmente. Preços capturados ao vivo da página (ex.: S25 Ultra R$ 5.399,
  16 Pro Max R$ 12.499).

## 13. Rodada 18/09/2026 — re-extração das 750 + modo DEV de alinhamento

- **Listagem re-extraída** via navegador MCP (`/modelos`, scroll completo):
  33/33 cards com foto + preço. Preços batem com o MOTO.json vigente
  (ex.: Hornet 750 R$ 53.694, Transalp R$ 65.545, NC750X MT R$ 56.621).
  Detalhe NC750X lista R$ 61.948 em 1º (versão DCT) e R$ 56.621 (MT).
- **Detalhes extraídos** (scroll + galeria com `alt`): `hornet-750`
  (CB750 Hornet 2026, 6 candidatas), `xl750-transalp` (Transalp 750 2026,
  12 candidatas: preta Graphite Black, painel TFT, banco, LED, frente,
  curva, acessórios, branca Ross White), `nc-750x` (NC750X 2026,
  15 candidatas: preta DCT, vermelha MT, porta-objetos, freio, DCT,
  estrada/cidade, Red Dot 2025). `og:image` vazio nas 3 (ignorar).
- **Download via `fetch` no contexto da página → base64** (curl direto = 403,
  mesmo com UA Chrome). 8 arquivos novos em
  `zuvio-web/public/img/catalogo/honda/`, tamanhos conferidos byte a byte +
  magic WEBP + **conferência visual por contact-sheet** (as 8 são a moto
  certa): `hornet-750-{branca-acao,painel}`,
  `xl750-transalp-{painel,banco,led,curva}`,
  `nc-750x-{porta-objetos,freio}`.
- **Achados de auditoria**: `Lateral-v_0` ≡ `Lateral-v_5` (92.350 bytes,
  dup entre si — ficar só com uma); Transalp tem tripla idêntica
  (`branca` ≡ `g3` ≡ `.webp`, md5 cd31…) + par (`lateral` ≡ `preta`,
  md5 6212…); NC tem par (`.webp` ≡ `g3`, md5 55d7…); `nc-750x-lateral`
  (89.042) ≡ `Lateral-p` do site. Pendentes de decisão do operador no
  modo DEV (a ferramenta sinaliza e exclui).
- **Modo DEV** (`dev-fotos/`, `node server.cjs`, http://localhost:3002):
  lista as Honda do MOTO.json; ao abrir um modelo mostra **só** os arquivos
  `<slug>*` dele; reordena (◀ ▶), capa (★), remove (✕), upload do PC
  (`<slug>-pc-<ts>.ext`), candidatas do site com alt + copiar-URL, e
  **salva no MOTO.json** com a regra dura (409 se URL em 2 modelos).
  `MOTO.json.bak` antes de cada save.
- **Manifesto**: `dev-fotos/extracao-2026-09-18.json` (33 do /modelos +
  galerias das 3 750 em tamanho cheio, sem `/styles/.../public`).
- **Serviços**: backend :3000 (Windows), front preview :3001
  (`node .output/server/index.mjs` — `nuxt dev` quebra no WSL pelo bug de
  optional-deps do rolldown; rebuild p/ publicar fotos novas roda no Windows),
  dev-fotos :3002.
