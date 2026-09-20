# G2G — Fluxo anotado + Manutenção (WOW Gold por unidade)

Projeto: `/home/d/Documents/g2g/` (separado do `eldorado/`, não mexe lá).
Meta padrão: `budget 3500 BRL` em `wow-gold` por unidade, mesmo modelo do chk Eldorado
(`pricePerUnit / inStock / minQty -> unitsToBuy`).

---

## 1. Grafo do fluxo (de trás pra frente)

```
1. POST https://www.g2g.com/api/authenticate-user
   -> accessToken (JWT ~15min, sub=userId) + userInfo.userId
   -> expirou = tudo depois falha (até status 0 no offer detail)

2. GET https://sls.g2g.com/offer/keyword_relation/collection/?brand_id=263f...&region_id=5479...&service_id=8f88...
   -> mapa fa: collection aa41dff6 = face value
   -> ex: 5a1f87af = "Steam Wallet Code BRL 700 (BR)"
   -> pra gold não precisa de fa, mas serve pra gift cards

3. GET https://sls.g2g.com/v3/offer/search?seo_term=wow-gold&country=BR&currency=BRL&page_size=100&sort=recommended_v2&v=v2
   -> lista com converted_unit_price BRL (já convertido, usar esse, NÃO display USD do SSR)
   -> campos: offer_id, title, seller_id/username, relation_id, available_qty, min_qty, offer_currency/unit_price
   -> ex real: Silvermoon 0.213922 BRL/un, stock 9.256.971, min 200

4. GET https://sls.g2g.com/v3/offer/{offer_id}?currency=BRL&country=BR&include_out_of_stock=1&is_precheckout_page=1&setState=false&tree_version=v2
   -> valida estoque real, relation_id, seller_id, unit_price fresco
   -> ex: G1757942863385OU = 971.02 BRL / 159.66 EUR / relation 9a2878ef...
   -> gold: relation_id = `lgc_1_2299_{region_id}` (ex G1744088792265KM);
      gift cards usam uuid. `delivery_method_details[]` lista os métodos
      (mail=8bd2d339..., guild_bank, auction_house, face_to_face).

4b. GET https://sls.g2g.com/offer/product_settings/service/{service_id}/brand/{brand_id}/product_settings (auth, sem query)
   -> payload.results[] por product_settings_type:
      `delivery_method`: results[].product_settings_id == delivery_method_id
      do detail; form_attributes[] dá os campos (ex delivery_info_1 /
      'World Of Warcraft - Character Name' -> collection_id 4fc60dc7)
      `purchase_form`: campo opcional (ex additional_info_1 / note 510b91cf)
   -> ⚠️ o VALUE do delivery_info (ex 'LEA') é INPUT do comprador
      (nome do personagem), não vem de API nenhuma.

5. GET https://sls.g2g.com/gcart/{userId}/product/{relation_id}/checkout_histories
   -> tem que vir checkout_histories:[] (sem histórico trava)

6. POST https://sls.g2g.com/gcart/buy-now (467B c/ 1 delivery_info; varia c/ nº de campos)
   -> body: product_type Offer + product{offer_id, quantity, unit_price (na
      moeda da OFERTA, ex USD 0.0479), currency, seller_id} + currency BRL,
      language pt, user_id + checkout_info{delivery_method_details
      {delivery_method_id, delivery_info[{collection_id, value}], remember
      false}, gp_checkout_info zerado}
   -> response 200: {payload: {auth_token (32hex), checkout_version v4}}
      (checkout_version confirmado no HAR 41M [236]; captura antiga não
      trouxe o body por quirk Firefox)
   -> ex real: 2000un K Gold Silvermoon/EternalStock (G174...65KM)

7. WS `wss://gcart-ws.g2g.com?token={auth_token}` (URL EXATA do frontend,
   sem path — o Playwright normaliza c/ `/`, tanto faz).
   Na tela de pagamento o host varia: `wss://order-ws.g2g.com/?token={...}`
   (visto no www.g2g.com.har [0], token NÃO-hex 32 — outro emissor)
   -> prova: token do passo 6 = token da URL (32hex validado)
   -> server empurra 1 frame: {order_id, pipwave_token, pipwave_api_key,
      redirect_url, code 2000, type message}; frontend fecha e vai p/
      /secure/payment?order_id=&pipwave_token=&pipwave_api_key=
   -> regras do frontend: message_code presente = erro; sem order_id = erro;
      payment_status 'paid' = vai p/ /secure/payment/success
   -> ruído na mesma captura (ignorar): firebase rtdb (auth anonymous) e
      `wss://api.sardine.ai/...` (antifraude device fingerprint — esperado)

8. GET https://sls.g2g.com/order/{order_id}/summary?include_items=1&buyer_id={userId}&include_ga_info=1
   -> total REAL: sub_total/total/checkout_total_amount + checkout_currency BRL
   -> ex: 1788833743105B6OK = 460.95 BRL (356.58 MYR, GameKongs)
   -> ex2: 1788894440354GMGK = 496.89 BRL, payment_status to_pay,
      2000un K Gold, seller EternalStock, auto_cancel_at ~2h
   -> ex3: 1788897862001VSXQ = 49.69 BRL (200un, value l3w, HAR 41M [251])
   -> ex4: 1788898616101ZWXU = 49.69 BRL (200un, run da API ao vivo)
   -> ex5: 1788907270286YBMJ (pedido do fluxo Pix, www.g2g.com.har)
   -> é esse total que decide parar quando >= 3500, não o estimado da busca

8b. POST https://api.pipwave.com/payment/sdk/{pipwave_token}/get-config
   -> body: {timestamp, api_key (FUN3...B6UL), version pipwave HPP v1.0 pwsdk
      v2.1.0, referrer_url, location_url (/secure/payment?order_id=...)}
   -> response 200: CARDÁPIO (20KB). Tela abre no cartão sozinha
      (autoopen_cat cat_1). Categorias reais:
      cat_1 Credit & Debit Card: 891 airwallex.visa_mor (Visa),
      892 airwallex.mastercard_mor (Mastercard);
      cat_13 Cryptocurrency (13: BTC/ETH/USDT×5/USDC×4/Binance/Crypto.com);
      cat_2 Online Banking: **856 tazapay.PIX-QR = PIX ⬅ CLICA AQUI**
   -> payable_amount ex: 49.72 BRL; txn_id = {order_id}-Pay2

9. POST .../get-payment-method-details + POST .../submit-payment
   (payment_method_code = tazapay.PIX-QR)
   -> details: {timestamp, api_key, version, payment_method_code}
      <- {amount: {surcharge 2.98, tax 0, total 52.70 BRL...}} (ex 200un)
   -> submit: + user_input{disclaimer_message_agreement 1,
      tazapay_session_id (do device-intel shield-fp), pw-phone-token ""}
      <- 200 {redirect_url: https://secure.pipwave.com/load?token=...}
   -> POST .../prepayment-check <- 200 {redirect_url, challenge: null
      (null = Pix; no cartão vem preenchido = 3DS), pm_id 856}
   -> 302 GET secure.pipwave.com/load?token= -> Location:
      load/checkout?pw_id=pw20260909072713965&token_id=... ("outra tela")

10. GET https://checkout.tazapay.com/transaction/{id} (checkout hospedado)
    -> shell: main-D7kwmRAm.js, Main-tRGMWr4_.js, shieldHelper...;
       pollers PaymentDetailPoller / PaymentAwaiting
    -> antifraude: device_score 50, is_bot true no Chromium Playwright
       (não bloqueou o Pix; no cartão pode pesar no challenge)

11. CPF -> Pix copia-e-cola (VALIDADO ao vivo — HAR Firefox 03:32:27)
    -> 11a: GET https://service.tazapay.com/v3/payin/session/{session_token}
       Header: x-session-token: {session_token}
       Response: { data: { payin_id: "chk_..." } }
    -> 11b: POST https://service.tazapay.com/v3/payin/attempt
       Header: x-session-token: {session_token}
       Body: { payin_id, payment_method_type: "pix_brl", psp_metadata: { document_id: "CPF", document_type: "cpf" }, ... }
       Response 200: { status: "success", data: { qr_code (Base64), instrument: { expiry_date, qr_code }, payment_attempt_id, psp_reference_id } }
    -> Decodificação do BR Code:
       base64_decode(data.qr_code) -> "00020101021226790014br.gov.bcb.pix2557brcode.starkinfra.com/v2/..."
```

Ordem no browser pra meta 3500 que validamos:
`/` -> `/categories/steam-wallet-gift-cards?region_id=...` -> `...&fa=...` -> `/offer/group?fa=...&region_id=...` -> sls acima.
Pro chk por unidade pula o HTML e vai direto na sls (passos 1,3,4,5).

---

## 2. Valores dinâmicos (nunca hardcodar)

| Valor | Onde nasce | Onde é usado | Validade |
|---|---|---|---|
| `accessToken` (JWT) | response `POST /api/authenticate-user` | header `authorization` em toda `sls.g2g.com` | ~15min, renova sempre |
| `userId` (ex 1004386074) | mesmo payload + prefixo do `refresh_token` antes do `.` | path `/gcart/{userId}/...`, `/order/...?buyer_id=` | fixo por conta |
| `G2GSSRSESID` | cookie Set-Cookie / rotação (b3145... -> d189... -> 85679...) | Cookie | gira no meio do fluxo, relê do jar |
| `region_id BR` | `regionOptions`: `BR = 5479928c-273e-455a-a072-bba00871543d` | query `search`, `offer detail` | fixo, mas confirma via `__data.json` |
| `fa` (ex 5a1f87af=700) | `keyword_relation/collection` ou `__data.json` da categoria | query `fa=collection:dataset` | muda por face value |
| `offer_id / seller_id / relation_id / unit_price` | `search` -> `offer detail` | body `buy-now` | preço/estoque mudam, sempre refetch |
| `delivery_method_id` | `offer detail` (`delivery_method_details[]`, ex mail) | body `buy-now` | fixo por oferta, mas confirma no detail |
| `collection_id` | `product_settings` (passo 4b, `form_attributes[]`) | `delivery_info[]` do `buy-now` | por service/brand; muda o value, não o id |
| `delivery value` (ex Character Name) | **INPUT do comprador** (não nasce de API) | `delivery_info[].value` | informar por compra (`characterName`) |
| `auth_token` (32hex) | response `buy-now` (`payload.auth_token`) | query `wss?token=` (mesmo valor, validado) | uso único por order |
| `order_id` | frame ws (`type:message`, code 2000) | path `/order/{id}/summary` + redirect `/secure/payment` | por compra |
| `pipwave_token / redirect_url` | frame ws `type:message` | redirect pagamento | uso único, expira rápido |
| `pipwave_api_key` | frame ws (ex `FUN3...B6UL`, 40 chars) | body de todo POST no `api.pipwave.com` | fixo por merchant (41), mas lê do ws |
| `payment_method_code` | `get-config` (cardápio) | `get-payment-method-details` + `submit-payment` | por escolha (ex `tazapay.PIX-QR`) |
| `tazapay_session_id` | response device-intel shield-fp (= `session_id`) | `user_input` do `submit-payment` | por sessão de pagamento |
| `challenge` | response `prepayment-check` | `null` = Pix direto; objeto = 3DS do cartão | por tentativa |
| `pw_id` (ex pw2026...) | `Location` do 302 `load?token=` | tela `load/checkout?pw_id=&token_id=` | por pagamento |
| `BR Code copia-e-cola` | response do POST do CPF no tazapay (passo 11, pendente) | exibição + pagamento | por cobrança, expira rápido |
| `converted_unit_price BRL` | `search` / `offer detail` | cálculo `units = floor(budget/price)` | flutua com câmbio |

Regra de ouro: **toda request é consequência da anterior.** Se der `401/status 0`, volta 1 casa e renova o token.

---

## 3. Como rodar

```bash
cd /home/d/Documents/g2g
npm install
# coloca export de cookies da G2G em ./cookies.json  ([{name,value,domain...}])
npm test        # 16361un x 0.213922 = 3499.98 + buildBuyNowBody 467B
npm run api     # sobe :3001
curl -X POST http://localhost:3001/api/optimize-g2g \
  -H 'Content-Type: application/json' \
  -d '{"budget":3500,"seoTerm":"wow-gold"}'
# fluxo completo (CRIA PEDIDO REAL to_pay — exige characterName):
curl -X POST http://localhost:3001/api/buy-g2g \
  -H 'Content-Type: application/json' \
  -d '{"budget":3500,"seoTerm":"wow-gold","characterName":"SEU_PERSONAGEM"}'
```

Estrutura:
```
g2g/src/types.ts     -> Offer/CalculationResult
g2g/src/optimizer.ts -> evaluateOffer/findBestOffer (fee default 0)
g2g/src/g2g.ts       -> authenticate/search/validate/product_settings/
                        buildBuyNowBody/postBuyNow/waitForOrder/getOrderSummary
g2g/src/server.ts    -> GET /health, POST /api/optimize-g2g (cotação),
                        POST /api/buy-g2g (compra real gated),
                        GET /api/optimize-g2g/live + /api/buy-g2g/live (SSE)
g2g/src/tests.ts     -> evaluateOffer + ranking + buildBuyNowBody 467B
g2g/fluxo.html       -> visual do fluxo (passos 1-11) + botões ao vivo:
                        cotação (só leitura), método PIX (ativo) /
                        Cartão (cinza, libera após passo 11), Comprar
                        (passos 1-8, exige PIX + characterName + confirm)
g2g/capture.py       -> capturador Playwright Firefox (profile .pw-profile/)
g2g/capture_3ds.py   -> capturador 3DS Firefox (profile .pw-profile-3ds/,
                        HAR full + bodies/ + fases PIX_DONE/DONE)
g2g/capture_3ds_chrome.py -> janela Chromium + extensão, modo leve c/ watchdog
                        (profile .pw-profile-3ds-chrome/; rede fica 100%
                        com a extensão — listeners Playwright derrubam o
                        driver com ERR_STRING_TOO_LONG, ver §4.8)
g2g/captures/        -> evidências por data (gitignored)
g2g/www.g2g.com.har  -> HAR DevTools do fluxo Pix (240 entries, 14MB —
                        ⚠️ veio SEM response bodies; requests ok)
g2g/www.g2g.com_Archive [26-09-08 16-11-57].har -> HAR 41M do buy-now/summary
g2g/cookies.json     -> NÃO commitar (gitignored), só sessão local
```

Captura com a extensão (Request Inspector Pro / tetsee):
```
extensão (Chrome MV3): webRequest em todas abas/iframes + hooks fetch/XHR
  no contexto da página (pega body de response de API, não de navegação)
servidor: node server.js na pasta da extensão -> http://localhost:7331
  (POST /save auto a cada ~15s -> tetsee/captures/auto_*.json;
   GET /list, /analyze, /status)
popup: contador ao vivo, SAVE_NOW, EXPORT_HAR (é esse HAR que tem bodies)
prova: auto_2026-09-08T22-43-57.json (558 reqs, 264 PAYMENT) trouxe
  get-config (cardápio 20KB), submit-payment + redirect_url,
  prepayment-check (challenge null), details (52.70 BRL)
```

---

## 4. Manutenção

### 4.1 Sessão / cookies
- Exporte de novo quando `authenticate-user` der `401` ou `userId` vazio.
- Não edite `G2GSSRSESID` na mão, ele gira sozinho; mantenha o jar inteiro.
- `cookies.json` fora do git. Se vazar, desloga/loga de novo na G2G pra invalidar `long_lived/refresh`.

### 4.2 Preço e câmbio
- Nunca confie no `display_price USD` do SSR. Fonte da verdade pra soma estimada = `converted_unit_price BRL` da `search`; fonte final = `summary.total`.
- `unit_price EUR/MYR` muda (ex 159.74 -> 159.66). Sempre `GET /v3/offer/{id}` antes do `buy-now`.
- Se `summary.total` divergir >1% do estimado, revise `currency/country` (tem que ser `BRL/BR` nos dois).

### 4.3 Estoque / mínimo
- Gold: `available_qty` em milhões, `min_qty 200`. Se `unitsToBuy < min` o `evaluateOffer` já invalida (igual Eldorado).
- Gift cards: `available 280`, `wholesale min 10 max 100` com descontinho no `wholesale_details`. Pra 3500 prefira gold.
- Se `available_qty` cair, o ranking recalcula sozinho no próximo `/search`.

### 4.4 Catálogo (seo_term / region)
- `wow-gold` e `wow-classic-era-vanilla-gold` validados. Pra trocar produto, descubra o `seo_term` pelo `href` da home (`/__data.json` -> `/categories/...`) e teste:
  `GET /v3/offer/search?seo_term=NOVO&country=BR&currency=BRL&page_size=3`
- Se voltar `[]`, falta `region_id` certo ou produto não tem BR. Inspecione o `__data.json` da categoria.
- `page_size=100` cobre ~100 resultados; se `total_result>100`, pagina `page=2...`.

### 4.5 Buy-now / ws / order (✅ implementado a partir da captura 20260908_150049)
- `buy-now` validado byte a byte: `npm test` confere o body de 467B.
  Tamanho varia com nº de campos delivery_info e tamanho dos ids.
- `checkout_version: v4` CONFIRMADO no HAR 41M [236]
  (`auth_token fcb4...12f3`, 200un value `l3w`) — o código aceita o
  payload como vier e só exige `payload.auth_token`.
- `auth_token` só vale pra 1 `order_id`. Não reutiliza entre loops.
  Prova: token da response == token da URL do ws (32hex validado).
- Pedidos reais criados até aqui (todos `to_pay`, expiram ~2h sozinhos):
  `1788894440354GMGK` (2000un = 496.89), `1788897862001VSXQ` (200un =
  49.69, HAR), `1788898616101ZWXU` (200un = 49.69, API live),
  `1788907270286YBMJ` (fluxo Pix).
- Cada run cria 1 pedido NOVO por design (ver fluxo.html: veredito verde).
- `summary?include_items=1` é idempotente, pode repoll até `payment_status`
  sair de `to_pay` ou `auto_cancel_at` chegar (~2h).
- `OPTIONS` antes de cada `GET/POST sls` é preflight CORS normal, ignora no Node.
- Quirk do capturador: Firefox+Playwright às vezes falha em
  `Response.text()` (NS_ERROR_FAILURE) e o HAR em modo `minimal` omite bodies
  — por isso `buy-now_response.json` não foi salvo e o token veio do ws_url.
  Os listeners gravam com flush imediato; confira `events.jsonl` SÓ após o
  flush/close (buffer engana).
- Pedido real desta validação: `1788894440354GMGK` (2000 K Gold Silvermoon
  Alliance/EternalStock = 496.89 BRL, `to_pay`, sem pagamento executado —
  expira sozinho; não é APPROVED nem DECLINED, é mapeamento).

### 4.6 Antifraude / timing
- Ordem importa: `auth -> search -> detail -> histories -> buy-now -> ws -> summary`. Pular etapa ou trocar header `Origin/Referer` derruba.
- `accessToken` expira em ~15min (`iat/exp` no JWT). Se o loop passar disso, renova no meio.
- Espaça `buy-now` (não rajada). Se voltar `code != 2000`, loga `request_id` e para, não retry cego.
- `User-Agent` fixo do projeto. Não fica trocando por request.

### 4.7 Quando quebrar, olhe nessa ordem
1. `POST authenticate-user` 200 + tem `accessToken`? Não -> cookies.
2. `GET search` 200 + `results[]`? Não -> `seo_term/region/currency` ou token.
3. `GET offer/{id}` 200? `status 0` -> token expirado, renova e retry 1x.
4. `checkout_histories` 200? Não bloqueia, só loga.
5. `POST buy-now` 200 + `auth_token`? Não -> compara Raw salvo vs enviado (diff de campo).
6. `wss?token=` 101? Não -> `auth_token` errado/expirado.
7. `summary.total` bate com estimado? Não -> câmbio/taxa mudou, recalcula `units`.
8. Pagamento: `get-config` 200 + cardápio? Não -> `pipwave_token` expirado, refaz do passo 6.
9. `submit-payment` sem `redirect_url`? -> método errado ou sessão tazapay vencida.
10. `This transaction cannot be processed` -> pagamento anterior em aberto
    (cancela o `to_pay` em Orders; nunca 2 pagamentos em paralelo).

### 4.8 Captura: extensão x Playwright x HAR (lições 08/09)
- Fonte da verdade p/ bodies de API = extensão (hooks fetch/XHR). HAR do
  DevTools pode vir SEM bodies (`www.g2g.com.har` 14MB, 0 bodies) — nesse
  caso só os requests prestam; re-exporta com a tela aberta.
- Navegação top-level (HTML da tela) a extensão NÃO pega body (só URL) —
  é o que o HAR/Snapshot cobre. São complementares, não concorrentes.
- Playwright NÃO pode ter listener global de request/response em página
  barulhenta (ads/pixels): o pipe driver<->browser inunda e o Node morre
  com `ERR_STRING_TOO_LONG` (3 quedas seguidas, com e sem HAR full).
  Modo que aguenta: `capture_3ds_chrome.py` leve (só abre janela +
  snapshots + watchdog que reabre sozinho até 10x).
- `is_bot: true` + `device_score 50` no Chromium Playwright (tazapay
  device-intel). Não bloqueou o Pix; observar no cartão/3DS.
- `429` no `authenticate-user` = martelada (browser + API juntos).
  O código cacheia o JWT até 60s antes do exp; não abre 2 browsers juntos.

---

## 5. Checklist rápido de saúde

- [ ] `npm test` passa (`16361un = 3499.98`)
- [ ] `GET /health` online
- [ ] `authenticate-user` renova sem `401`
- [ ] `search wow-gold` retorna ~100 com `converted_unit_price > 0`
- [ ] `offer detail` de 1 id retorna `available_qty` e `relation_id`
- [ ] `cookies.json` não está no git (`git status` limpo)
- [ ] Pix: `get-config` traz cardápio c/ `856 tazapay.PIX-QR`
- [ ] Pix: `prepayment-check` volta `challenge: null` + `redirect_url`
- [ ] Servidor da extensão `:7331/status` ok + auto-save <1min
- [ ] `fluxo.html` abre sem erro de JS (sem `const` duplicado)

## 6. Segurança

- Nunca commita `cookies.json` (já está no `.gitignore`).
- Tokens `accessToken/auth_token/pipwave_token` são de uso único e curta vida — não cola em log público, máscara no meio (`5c07...5620`).
- CPF e BR Code copia-e-cola (passo 11): dado pessoal + instrumento de
  pagamento — máscara total fora da máquina local, nunca em log/API.
- Conta sem saldo usada só pra mapear fluxo. Pra qualquer teste com pagamento real, usar ambiente/conta de homologação e cartão de teste do gateway, nunca produção.

---

## 7. Cancelamento — regra de status (validada 09/09)

O cancelamento SÓ funciona conforme o status do pedido. Cada status tem sua rota:

| Status | Rota | Prova |
|---|---|---|
| `to_pay` (pagamento pendente) | `PUT /order/{orderId}/mark_as_cancel` body `{"buyer_id"}` <- 200 `{code:2000, payload:{task_id}}` (usa **orderId**, não itemId) | pedido `1788977570920ON7K` (200un, R$49,87) cancelado ao vivo, fila zerou |
| `paid` (pago) | `POST /order/item/{itemId}/report_case` body `{"buyer_id","report_case":"cancel","report_reason","buyer_refund_option":"pg"}` <- 200 `{code:2000, payload:{case_id}}` | `cancelando-compra.har`: item `...DS2J-1` pago R$5,47 |
| já cancelado | nenhuma — 400 `Cannot report cancel when order item status is cancelled` | pedido `1788976894356FT8I` |

Fontes:
- `cancelamento-mapeado.har` (página `/g2g-user/purchase`): `GET list_my_order?buyer_id=&status=to_pay&include_pending_proof_only=0` (lista todos os IDs), `GET count-my-orders`, `PUT mark_order_as_read`, `PUT mark_as_cancel` (pedido `1788977278582JCPO`, R$3709).
- `cancelando-compra.har` (Downloads): `GET report_reasons` + `POST report_case`.

Gateway (`src/cancel.ts`, rotas em `/api`):
- `POST /api/order/cancel` lê o status real e escolhe sozinho (pendente -> `mark_as_cancel`, pago -> `report_case`).
- Timer auto-cancel 10m (default `600000ms`) usa o mesmo caminho forçado; `GET /api/order/auto-cancel` lista pendentes, `DELETE /api/order/auto-cancel/:id` desarma.
- `GET /api/orders?status=` espelha a página purchase; `GET /api/orders/count` os contadores.
- Rotas de pagamento separadas fisicamente: `POST /api/pay/pix` (`src/routes/pix.ts`, 8b–11) e `POST /api/pay/card` (`src/routes/card.ts`, airwallex visa/mastercard + 3DS).
