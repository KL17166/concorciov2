
## Adendo 23/09 (5): botões ilegíveis no dark (print /admin/payments)
- Causa: overrides sóbrios cobriam só o tema claro — `.btn-outline-*` inativo, `.btn-light` (Filtrar) e `.btn-danger` (Atrasados) ficavam com texto escuro no fundo escuro.
- Fix no CSS (seção dark): outlines com texto #cbd5e1/borda #475569, `.btn-light` vira slate, `.btn-danger` vira vermelho-escuro sólido, `btn-close` invertido, selos de contagem nas abas legíveis.
- Verificação por contraste automatizado (luminância <2.5 = ilegível): payments, contracts, bids, kyc, notifications, gateways, bids/payments — todos OK. CSS v20260923e.

## Adendo 24/09 (2): bug de cor no "Assumir" + sweep de contraste
- Print mostrava "Assumir" ilegível: `.btn-warning` clareava no hover do dark + `.btn-info` ciano sólido. Fix: warning vira texto âmbar + borda no dark (hover nunca clareia); info vira neutro nos dois temas. CSS v20260923h.
- Sweep de contraste efetivo (luminância botão por botão): notifications, payments, contracts, bids, kyc, gateways, bids/payments, dashboard, people, tickets, bids/draw — OK. Achados extras: th (clareado) e "Expandir todas" (clareado).
- Mantido 1 alerta demo (Parcelas 3 e 7) p/ exibir o sanduíche.
- Validação: jest 14 suites 83/83.

## Adendo 24/09 (3): admin mostrava 25 produtos, app 62
- Causa: `products/index.ejs` contava `products.length` (página de 25) nos cards e no "Catálogo (N)". Banco sempre teve 62 (páginas 1-3 conferidas).
- Front NÃO usa catálogo local: `DEFAULT_PRODUCTS` tem ~5 itens e só vale se a API falhar; `/api/products` retorna os mesmos 62 do banco.
- Fix: controller passa `totals {total, active, inactive, motos, filtered}` (groupBy) e o EJS usa nos cards/contador/busca.
- Validação: admin exibe "Catálogo (62)"; tsc OK; jest 14 suites 83/83.

## Adendo 24/09 (5): "Exibir Todos" do catálogo não funcionava
- Causa: `#sharedPerPage` decorativo (sem JS/envio); backend pagina 25 por padrão. Trocado "Todos" (-1, inválido) por 100 (teto do `paginate`) + JS que recarrega com `?limit=` preservando filtros.
- Contagem atual: 56 produtos no banco (admin = app, antes 62 — 6 saíram do banco).
- Validação: limit=12 → 12 produtos; limit=100 → 56; jest 83/83.

## Adendo 24/09 (6): revisão de fotos (dev)
- `products.verifiedImageUrls` (migration 20260924000003) + `POST /admin/products/:id/verify-image` (404 em produção).
- Galeria (só edit + dev): selo "verificada" + botão fogo por foto não conferida → marca e foca a próxima pendente.
- Validação: fogo no form, marcar OK, tsc OK, jest 83/83. (1ª foto da FZ marcada no teste.)

## Adendo 24/09 (7): selo de verificação na lista + toggle resiliente
- Lista de produtos (tabela e cards): ao lado do fogo (popular) agora há o selo `patch-check` — verde "Verificadas" (todas) ou "X/Y fotos" (parcial). Controller calcula `photosTotal/photosVerified/photosAllVerified`.
- Verificação na galeria usa `patch-check` (fogo ficou só p/ popular).
- `toggleFlag`: 401/403 com mensagem de sessão expirada redireciona p/ login (era só "erro").
- Validação: selos renderizando (FZ 1/3), tsc OK, jest 83/83.
