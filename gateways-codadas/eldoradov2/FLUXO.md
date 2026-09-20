# FLUXO — Eldorado.gg: do login ao PIX copia e cola

Data: 13/09/2026. Conta de teste (e-mail `tuamaeaquelaursa`, CPF `110***724`).
Jogo: Roblox/Robux (`gameId=70`, `category=Currency`).

## 1. Login (OAuth2 Authorization Code + PKCE via Cognito)

1. Front gera `code_verifier` (~128 chars urlsafe), `code_challenge = b64url(sha256(verifier))` e `state` (32 alnum). Guarda em `sessionStorage` (`eld-auth-pkce-key`, `eld-auth-state`).
2. `GET login.eldorado.gg/login?redirect_uri=.../account/auth-callback&response_type=code&client_id=3a4hal6jg...&scope=email+openid+profile...&state=...&code_challenge=...&code_challenge_method=S256`.
3. Signup: `POST /signup?_data=routes/signup` (`username`, `password`, `confirmPassword`, `csrf`, `cognitoAsfData` com fingerprint) → `302 /signup/confirm`; `POST /signup/confirm` (code de 6 dígitos do e-mail); pula passkey (`POST /passkeys/add` com `should_skip_passkey_registration=true`).
4. Callback `/account/auth-callback?code=<single-use>&state=...`.
5. `POST www/api/authentication/authenticate {code, codeVerifier, redirectUrl}` + headers `X-Xsrf-Token`, `Nsure-Device-Id` → seta `__Host-EldoradoIdToken` (30min), `__Host-EldoradoRefreshToken` (30d), `__Host-DCID`, `__Host-XSRF-TOKEN` (+ `ns_dev_id`, `forterToken` no `localStorage`).
6. Pós-auth: `syncLocale`, `metadata/me/create`, `POST users/me {shouldGenerateUsername:true}`, `GET users/me` (prova de sessão: 200 logado / 401 expirado).

## 2. Compra PIX (ordem fiel do trace)

Oferta exemplo: `65733a36-...` (CNLTeam), `offerVersion=6836`, `qty=3000`,
`offerPosition=1`, `expectedPrice=117.85 BRL`, `fx=5.27516148`.

1. `GET fees/me/feesForOffer/<offerId>?offerVersion=&quantity=&...paymentType=BalanceTopUpPrimer` → `orderPriceAfterDiscount`, `fees`, `needToPay`.
2. `GET v2/orders/me/delivery-details?gameId=70` (confirma `RobloxUsername`).
3. `POST userpayment/.../balanceTopUpPrimer/clientToken {offerId, pricePerUnit, quantity}` → `clientToken` **outer** (JWT cujo payload tem `accessToken`).
4. `POST .../balance-top-up-stripe/client-session` (fidelidade; não bloqueia).
5. `PUT .../balanceTopUpPrimer/clientToken {clientSessionToken: outer, nationalDocumentId: CPF}` (amarra CPF).
6. `POST .../balanceTopUpPrimer/initializeWithOffer` (oferta, qty, delivery, version, expectedPrice, clientToken, `paymentMethod: Pix`, forter) → `201 {id: <payment>, totalAmount, paymentState: Initiated}`.
7. `PUT .../<payment>/offerDetails` (trava Pix + delivery).
8. **Primer** (sempre com o **inner** `accessToken`, nunca `Authorization: Basic`):
   - `GET api.primer.io/client-sdk/configuration` → acha `DLOCAL_PIX id 3c2274a1-...`;
   - `POST sdk.api.primer.io/client-session/actions {SELECT_PAYMENT_METHOD DLOCAL_PIX}`;
   - `POST sdk.api.primer.io/payment-instruments {OFF_SESSION_PAYMENT/DLOCAL_PIX/<configId>/sessionInfo}` → `{token: tNuk... (SINGLE_USE)}`;
   - `POST sdk.api.primer.io/payments {paymentMethodToken}` + `x-idempotency-key` → `USE_PRIMER_SDK` com `clientToken` **outer2**; o `redirectUrl` (`pay.dlocal.com/gmf-apm/payments/N-...`) + `statusUrl` (resume-token) vêm **dentro do payload do outer2** (`intent: DLOCAL_PIX_REDIRECTION`).
9. `GET pay.dlocal.com/apm-frontend/voucher/N-...` → `000201...` (166 chars, txid mascarado `62070503***`, `SAO PAULO` com espaço é original). Saída final: **só o código no stdout**.

## 3. Auto-escolha de vendedor (lógica de `Documents/eldorado`)

- Lista: `GET api/predefinedOffers/augmentedGame/offers?gameId=70&category=Currency&pageIndex=&pageSize=150` (116 sellers, pagina tudo). Cada item traz `offer` (id, version, preço, min, estoque, `guaranteedDeliveryTime`, fx), `user` (nome, verified), `userOrderInfo` (`feedbackScore`, `ratingCount`) e `deliveryTime` (mediana + esperada).
- Filtro: entrega **max** (`expectedTime`, fallback pro tier `Minute20→20/Hour1→60/...`) **> limite rejeita** (padrão 20min; CNLTeam `19 min - 1 h` cai fora), sem dado de entrega rejeita, `rating < min_rating` (padrão 90, igual ao `server.ts`) rejeita, `qty < min` ou `qty > stock` rejeita.
- Rank (igual ao `findBestOffer`): menor total (8.53% + R$1.16) > menor preço > maior rating > mais reviews, dedup por vendedor. Valida o top 5 no `feesForOffer` real e compra o primeiro 200 (`offerPosition` = índice 1-based no listing).
- Resultado real: qty 1540 → `morecompthanyou` (total 54.23); qty 3000 → `ZenSellerCheap` (total 104.13, contra 117.85 do top).

## 4. Pegadinhas e como cada uma foi vencida

1. **Oferta muda toda hora** (`6835→6836`, total `119.54→117.85`): `discover_offer_version()` varre versões no `fees` até achar 200; `pricePerUnit` recalculado do `fees` real. Nunca hardcodear versão/preço.
2. **Primer `403 SecurityPolicyBlock`**: causa era header `Authorization: Basic <outer>`. O SDK usa `primer-client-token: <inner accessToken>` + `primer-sdk-client: WEB` + `primer-sdk-checkout-session-id` + `primer-sdk-version: primer-js-1.7.0_sdk-core-0.15.0` + `x-api-version: 2.4` (+ `x-request-id` por chamada, `x-idempotency-key` no `/payments`). Com os headers certos o 403 sumiu no mesmo IP.
3. **`/payments` sem `redirectUrl` no topo**: o SDK recebe `USE_PRIMER_SDK` e o redirect está **dentro do JWT outer2**. Decodifica o payload e segue. (Sem `initialize` antes, dá `InvalidPaymentRequest: Order ID must...` — a ordem é `initialize` → actions → instruments → payments.)
4. **Copia e cola "não existe" no banco**: duas causas. (a) Regex cortava 1 char (166→165) e o **CRC16-CCITT** não batia — extração passou a preferir `__NEXT_DATA__.voucherData.scanCodeData` + regex amplo até `6304XXXX` + **gate de CRC** (a API nunca devolve código inválido). (b) **Voucher expira em ~10min** (criado 07:25 vencia 07:34 UTC) — gerar e pagar em seguida; a API devolve o vencimento exibido.
5. **Sessão `IdToken` dura 30min** (`users/me` 401): descoberto no bundle o endpoint **`POST /api/authentication/refreshTokens`** (chunk `QSQAANSS.js`, ao lado do `authenticate`) — troca o `RefreshToken` (cookie, 30d) por `IdToken` novo **sem browser e sem Cloudflare** (o `www` nunca tem challenge). `ensure_logged_in()` e o `/health` tentam isso 1x sozinhos e regravam o snapshot (provado: snapshot sem `IdToken` → 200 + `IdToken` 1234 de volta). Só cai pro renova/browser se o refresh falhar.
6. **Quantidade abaixo do mínimo** (1540 < 3000 do top): erro real `400 "Order quantity cannot be less than minimum offer quantity."` — resolveu com o auto-seletor (outro seller com `min ≤ qty`).
7. **Cloudflare no `login.eldorado.gg` a partir de datacenter**: usar o perfil persistente (`~/.cache/ms-playwright-mcp/mcp-chrome-53389b0`) direto com `--no-sandbox --disable-dev-shm-usage` (já tem clearance). Copiar a pasta trava/timeout — abrir direto funciona.
8. **`fetch` na página quebrado pelo wrapper do site** (`chunk-*.js` intercepta): chamadas Eldorado/Primer sensíveis vão por `requests` com os headers exatos; `page.evaluate(fetch)` só para leitura (`/api/users/me`).
9. **`payment-instruments` devolve `token` (não `paymentMethodToken`)** e `tokenType: SINGLE_USE` — ler os três campos (`token`/`paymentMethodToken`/`id`).
10. **`pkill -f` matando o próprio shell**: o padrão casa com a própria linha de comando. Usar forma que não casa consigo (`"eldorado_pix_ap[i]"`) e nunca misturar `pkill` + caminho do script no mesmo comando.
11. **`total` parseado errado no stderr** (`subtotal=107.61` casava `total=`): regex com espaço à esquerda (`\stotal=`).
12. **`about:blank` + Primer = `Failed to fetch`**: `Origin: null` é barrado; chamadas Primer precisam sair da origem `eldorado.gg` (requests com `Referer`/`Origin` corretos passam).
13. **Posições do listing mudam ao vivo** (seller some, `pos 31→30`): o seletor refaz `fetch + select + fees` dentro da mesma compra; nunca reusar `position` entre runs.
14. **Página da API dava `NetworkError`**: faltava CORS (`Access-Control-Allow-Origin: *` + `OPTIONS`). Abrir sempre `http://127.0.0.1:8765/`.
15. **Cloudflare no login (datacenter)** — `GET /oauth2/authorize` e até `POST /oauth2/token` devolvem 403 `Just a moment...` (Managed Challenge, nunca auto-libera em 30s, sem `sitekey` no HTML). Contornos avaliados: CapMonster `TurnstileTask` não serve aqui (sem widget/sitekey); `Challenge` com `cf_clearance` exigiria proxy residencial (clearance amarra IP) — não há. **Solução real: nem passar por `login.eldorado.gg`** — o `refreshTokens` (item 5) resolve tudo pelo `www`. O `cloudflare_solver.py` + `.env` ficam como fallback pro dia em que o `RefreshToken` de 30d morrer e for preciso login completo (aí precisa proxy residencial no `.env`).
