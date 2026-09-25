# AUDITORIA PRÉ-PRODUÇÃO — concorciov2 (Katari Consórcios)
**Data:** 2026-09-21 · **Escopo:** leitura ponta a ponta + falhas + CVEs + 0-days lógicos
**Veredito geral:** ⛔ NÃO LANÇAR em produção até corrigir os BLOQUEANTES abaixo.

## 0. Status operacional (projeto LIGADO em 2026-09-21)

| Serviço | Estado | Evidência |
|---|---|---|
| `consorcio-backend` :3030 | active (running) | `/health` → `{"status":"OK","database":"ok"}` |
| `consorcio-web` :3001 | active (running) | `GET /` → `302 /welcome?redirect=/` OK |
| `eldorado-gateway` :8765 | active | `/health` → `renovado via refreshTokens` |
| `g2g-gateway` :8766 | active | `/health` → `{"status":"online"}` |
| docker `katari-postgres` 5434, `katari-redis` 6379, `consorcio-waha` 127.0.0.1:3000, `consorcio-redis` | Up | `docker ps` OK |

Cobertura da leitura: `server-consorcio/src/**/*.ts` (169 arquivos: app, server, config, middlewares×14, security×5, application×16, controllers api×8 + admin×14, routes×27, services/integrations×14, domain/repositories/mappers/schemas/jobs), `package.json`, `.env`, `.env.example`, `docker-compose.yml`, `prisma/schema.prisma`, `prisma/seed*.ts`, `zuvio-web` (70 arquivos: nuxt.config, app/, pages×15, stores×6 Pinia, server/api×24 + backendProxy, shared/), `gateways-codadas/eldoradov2/*.py`, `gateways-codadas/g2g/src/**`, `app-consorcio` (Capacitor), `catalogo_agentes`, `mcp-moto-catalog`, `dev-fotos/server.cjs`. Ignorados: `node_modules`, `dist`, `.nuxt`, `.output`, `.git`.

---

## 1. BLOQUEANTES — corrigir antes de qualquer deploy público (CRÍTICOS)

### B1. Segredos reais commitados no git (CWE-798) — TAKEOVER TOTAL
- `server-consorcio/.env.example` repete valores reais de produção byte-iguais ao `.env`: `JWT_SECRET`, `SESSION_SECRET`, `PASSWORD_PEPPER`, `REQUEST_SIGNING_SECRET`, `PIXGO_API_KEY=pk_dd00749f...`, `PIXGO_WEBHOOK_SECRET`, `SIGILOPAY_API_KEY=artemisbkl_...`, `SIGILOPAY_API_SECRET`, `ADMIN_PASSWORD=0908BK##`, `PAYLOAD_BOOTSTRAP_KEY`, `ENCRYPTION_BYPASS_SECRET=admin-bypass-2026-change-in-prod`, `ELDORADO_API_TOKEN`, `G2G_API_TOKEN`. `git ls-files` confirma 3 `.env.example` versionados (`server-consorcio`, `zuvio-web`, `eldoradov2` — este com `ELD_EMAIL`/`ELD_PASS` reais).
- HMAC estático hardcoded em 3 arquivos do frontend, um client-reachable: `zuvio-web/shared/utils/security.ts:3`, `zuvio-web/server/utils/backendProxy.ts:12`, `zuvio-web/server/api/auth/upload.post.ts:31` → valor `d8f9a2b3c4e5...abcde`. Forja `X-Signature` e bypassa anti-tamper do backend.
- **Fix:** rotacionar TODOS agora; `git filter-repo`/BFG + force-push + revoke; `.env.example` vira `change_me_*`; secret HMAC só em `NUXT_HMAC_SECRET` server-only (runtimeConfig), deletar de `shared/`; CI com `gitleaks` + teste que falha se `pk_` aparecer em diff.

### B2. Infra com credencial fraca/ausente + exposta
- `server-consorcio/docker-compose.yml:17` `POSTGRES_PASSWORD: "099"` (3 chars) + bind `5434:5432` em 0.0.0.0; `DATABASE_URL=postgresql://postgres:099@...` em `.env:7`.
- Redis sem `requirepass`, porta `6379:6379` publicada, `redis-server --save "" --appendonly no` → restart apaga blacklist JWT/nonces/sessões (logout e anti-replay viram best-effort); `REDIS_URL=redis://localhost:6379` sem senha.
- `.env` com modo `755` (legível por qualquer usuário local).
- **Fix:** senha pg 32h via vault, bind `127.0.0.1`, `requirepass` + `REDIS_URL=redis://:pass@127.0.0.1:6379`, `appendonly yes`, `chmod 600 **/.env`.

### B3. Webhook PixGo sem autenticação quando secret ausente → liquidação fraudulenta
- `server-consorcio/src/routes/webhookRoutes.ts:19-62`: se `webhookSecret` falsy, bloco HMAC é pulado e só resta `if (!signature) 401` — qualquer valor em `X-Pixgo-Signature` autentica; chave de idempotência = header controlado pelo atacante (`processPaymentWebhook.ts:29-41`).
- **Fix:** fail-closed (`if (!webhookSecret) return 500`), `timestamp` obrigatório + nonce persistido, idempotência = `hash(payload_canônico)`, `timingSafeEqual` em try/catch.

### B4. URL de callback PixGo montada errada → receita sem conciliação
- `PixGoAdapter.ts:16-18` envia `webhook_url=${PIXGO_WEBHOOK_URL}/webhooks/pixgo`, mas rota vive em `/api/webhooks/pixgo` (`app.ts:141`). Provedor recebe 404, pode desabilitar callback; parcelas pagas apodrecem em `PENDING`.
- **Fix:** `buildWebhookUrl(provider)` central + teste de contrato + job de reconciliação (`getPaymentStatus` em `PaymentAttempt ACTIVE` expiradas).

### B5. PIX de lance órfão + duplicável (0-day lógico Z01) — DINHEIRO ÓRFÃO
- `application/bids/generateBidPix.ts:49-61` passa `installmentId='bid-<uuid>'`: Eldorado/G2G tentam `installment.update` (erro engolido), Sandbox quebra (throw), PixGo registra `external_id='bid-…'` mas webhook procura `installment` → 404 sempre. Sem `PaymentAttempt`, sem idempotência, sem liquidação; `cancelBid` permite cancelar `APPROVED` sem invalidar cobrança já emitida.
- **Fix:** CONGELAR `POST /api/bids/:id/pix` até existir `bid_payments(bidId, provider, externalId, amount, status)` + webhook que entende `bid-` + invalidação ao cancelar + idempotência.

### B6. Escalação MANAGER→MASTER (Broken Access Control)
- `controllers/admin/adminUserController.ts:48-96` (create) e `:133-176` (update) aceitam `role` arbitrário dentre `ALL_VALID_ROLES` sem `canManageRole`; rota `routes/admin/userRoutes.ts:8-11` exige só `people.create/edit_profile` — que MANAGER tem (`security/adminCapabilities.ts:41-47`). Controller novo (`peopleController`) filtra certo; legado não.
- **Fix:** aplicar `canManageRole()` nos legados ou removê-los; teste MANAGER+`role=MASTER` → 403.

### B7. Reembolso fictício no KYC + ativação sem KYC
- `controllers/admin/kycController.ts:241-290` (`rejectKyc`) marca `PAID→REFUNDED` com `paymentMethod='REFUND_...'` — rótulo, sem chamada à gateway, sem `providerRefundId`. `approveKyc` N updates fora de transação (estado parcial). `controllers/admin/paymentsController.ts:354-437` (`updatePayment`) ativa parcela 1 `PENDING→ACTIVE` pulando `PENDING_KYC` e permite `PAID→PENDING` sem prova de estorno.
- **Fix:** CONGELAR `REFUNDED` manual; máquina de estados (`PAID→REFUND_PENDING→REFUNDED` só com `providerRefundId` + dupla aprovação); `updatePayment` reutiliza `markInstallmentAsPaid`.

### B8. Saque SigiloPay sem step-up/teto/dupla aprovação
- `controllers/admin/gatewayController.ts:224-275` + `POST /gateways/sigilopay/withdraw` (só `integrations.manage`): sessão admin roubada saca qualquer valor p/ qualquer `pixKey`; `pixKey` não validado por tipo; sem 2FA fresh, sem teto/dia, sem segundo aprovador.
- **Fix:** CONGELAR saques até: senha+2FA fresh (<5min), teto/operação/dia, fila com aprovação de 2º MASTER, alerta externo.

### B9. CORS `credentials:true` + `Origin: null` + CORS `*` nos gateways
- `server-consorcio/src/app.ts:56-69` permite `!origin || origin==='null'` com credentials → `file://`/sandbox faz chamadas autenticadas. `eldorado_pix_api.py:215,224,239` e `g2g/src/server.ts:22,384,480` e `dev-fotos/server.cjs:60` retornam `Access-Control-Allow-Origin: *` em `POST /pix` (BR Code legível cross-site).
- **Fix:** remover `null`, lista fechada por env, `Vary: Origin`; gateways sem CORS (server-to-server) ou `origin: ['http://127.0.0.1:3030']`.

### B10. JWT em localStorage + cookie não-HttpOnly + 7 dias + senha seed fraca
- `zuvio-web/app/stores/auth.ts:42-43,58-59,163-171`: token em `localStorage katari_jwt_token` + perfil c/ CPF + cookie `SameSite=Lax` sem `HttpOnly/Secure`; qualquer XSS sequestra sessão de 7d (`JWT_EXPIRES_IN=7d` em `.env:15` vs `15m` no exemplo; `authController.ts:116-120` lê `process.env` bruto e ignora `JWT_REFRESH_EXPIRES_IN`).
- Seed: `ADMIN_PASSWORD=0908BK##` + `ADMIN_CPF=00000000000` (`prisma/seed.ts` sem validação) + conta teste `cliente@teste.com/cliente123` c/ bypass KYC hardcoded (`authController.ts:212` `userCpf !== '11111111111'`).
- **Fix:** BFF com cookie `HttpOnly;Secure;SameSite=Strict`, access 15min + refresh rotativo c/ reuse-detection; seed teste só se `NODE_ENV!=production`; remover exceção por CPF; senha admin 24+ aleatória + 2FA MASTER obrigatório.

---

## 2. ALTAS (corrigir na mesma janela — exploráveis)

- **A1. Duplo PIX de parcela (double-charge):** `generatePayment.ts:122-140` expira tentativa depois de chamar gateway; retry gera 2 vouchers reais; limiter é fail-open (A6). Fix: `Idempotency-Key` + trava `SET NX installmentId` + `PaymentAttempt RESERVED` antes da gateway + teste 20 req paralelas → 1 cobrança.
- **A2. IDOR no BFF:** `server/api/bids/[userId].get.ts`, `subscriptions/[userId].get.ts`, `subscription/[subscriptionId].get.ts`, `payments/[installmentId]/pix|boleto.post.ts`, `bids/[id]/cancel|pix.post.ts` confiam no id da URL sem comparar `sub` do JWT. Fix: checar `sub` no Nitro ou rotas `/me`.
- **A3. Guard só client-side + `isAdmin` decorativo:** `app/middleware/auth.ts` só checa `isAuthenticated` de localStorage; sem `middleware/admin.ts`; `isAdmin` nunca consumido. Fix: middleware admin + checagem de role server-side.
- **A4. Upload sem validação:** `server/api/auth/upload.post.ts:14-28,52` sem allowlist `type`, sem limite tamanho, sem magic-bytes, sem `encodeURIComponent`; client só `accept="image/*"`. Fix: allowlist `{document,document_back,selfie}`, 8MB, MIME+magic, sanitize filename. (Backend tem magic-bytes — ponto positivo — mas rota BFF é o buraco.)
- **A5. Path traversal via `userId` no KYC:** `api/kycApiController.ts:75-111` + `admin/kycController.ts:46-72` sanitizam `fileName` (`basename`) mas não `userId` em `path.join(storage/kyc, userId, file)`. WAF que bloquearia `../` não montado (A10). Fix: UUID v4 + `resolve`+assert prefixo.
- **A6. Fail-open triplo sem Redis:** `authMiddleware.ts:65-70`, `rateLimitMiddleware.ts:21-23`, `requestSignatureMiddleware.ts:78-82` chamam `next()` se Redis down. Fix: fail-closed em prod p/ `/auth/*`, `/payments/*`, `/bids`, webhooks (503+alerta).
- **A7. Token gateway via query (`?token=`):** `eldorado_pix_api.py:53-56`, `g2g/src/server.ts:35` aceitam token na URL (fica em access.log/tunnel.log/histórico). Fix: só header `X-Gateway-Token`; rotacionar tokens.
- **A8. SSRF via `baseUrl`/`callbackUrl`/`storageUrl`:** `pixGoService.ts:103`, `sigiloPayService.ts`, `kycStorageService.ts:73`, `EldoradoAdapter.ts:49`, `G2gAdapter.ts:57` usam `gatewayConfig.baseUrl` (editável em `gatewayController.updateGateway` sem allowlist) + `mcp-moto-catalog/index.js:244 page.goto(url)` sem allowlist. Fix: allowlist `https://pixgo.org|sigilopay` + `127.0.0.1:8765/6`, bloqueia IP privado/metadata, `maxRedirects:0`, timeout 12s.
- **A9. Efeito colateral no adapter + timeouts de minutos:** `EldoradoAdapter.ts:98-105`, `G2gAdapter.ts:102-110` fazem `installment.update(WAITING_APPROVAL)` dentro do adapter; `REQUEST_TIMEOUT_MS` 150s/300s + fila `withSlot` 240s = socket preso até 9min (`server.ts:21` timeout 30s → trabalho órfão). Fix: mutação só no use-case pós-sucesso; timeout 15-25s + abort; fila curta c/ 429.
- **A10. Defesas montadas no papel, mortas no runtime:** `app.ts` nunca monta `wafMiddleware`, `requestSignatureMiddleware`, `payloadObfuscationMiddleware`, `antiScrapingMiddleware`, `jsChallengeMiddleware`, `helmetMiddleware` (usa `helmet({csp:false})`); `X-Admin-Token` (`security/adminAuth.ts:8-20`) desliga WAF/scoring/cifragem e é exposto em `GET /admin/token` lido por `header.ejs:713` (qualquer XSS pega). Fix: montar ordem correta ou deletar teatro; sumir com `/admin/token` do DOM; CSP c/ nonces.
- **A11. XSS armazenado no painel:** `views/pages/gateways/index.ejs:754`, `products/index.ejs:795-847`, `payments/index.ejs:584-601` usam `innerHTML` c/ resposta; vetores `ticket.message` (2000ch), `adminReply`, `paymentMethod` livre, `description`. Sem CSP/WAF (A10). Fix: `textContent/createElement`, auditar `<%=` vs `<%-`, CSP `script-src 'self'`.
- **A12. PII/biometria em disco e logs (LGPD art. 11/46):** `authController.ts:89,156,394` loga email+CPF; `auditLog.details` c/ CPF/endereço; `SystemAlert` c/ nome+CPF+valor; sidecars `kyc-*-result.json` c/ raw Serpro em texto puro em `storage/kyc/` e legado `public/uploads/`; `katari_docs_cache` (RG/CNH/selfie base64) em localStorage sem TTL; `tunnel.log` c/ IP interno; scripts `debugUser/createGabriella/seedDevUsers` logam senhas/CPFs; `g2g/routes/pix.ts:62` CPF default `21275117783`. Fix: `maskCpf` em todo log, details só IDs, quota/permissão/cripto at-rest, limpar legado, retenção documentada, remover CPF default.
- **A13. Validação financeira frouxa:** lance `percentage min(0)` (`bidSchema.ts:3-8`) permite 0%; produto admin sem zod (`adminProductController.ts:80-125`) aceita preço negativo/`type` livre/`JSON.parse` engolido; `performDraw` `parseInt||1` aceita NaN/negativo/99999; `updatePaymentSchema` `paymentMethod` livre + `paymentDate` sem check; `pixKey` sem validação; webhook valida `paidAmount >= expected*0.95` sem teto e contra `amount` em vez de `valueToPay` (desconto antecipação ~28% em 80m sem teto → legítimo falha, calote 5% passa). Fix: zod estrito em tudo, `CreateProductSchema` (existe e não é usado!), validar contra `valueToPay` ±1%.
- **A14. Sessão admin sem revogação + 2FA fraco:** `setupAdminSession` 24h/30d (`rememberMe`) sem teto absoluto; `adminAuthMiddleware` confia em `session.user.role` sem reconsulta (demotado continua admin); 2FA sem rate-limit dedicado/lockout/`window`, desativável só c/ TOTP (`profileController.ts:62-82`) sem senha; `POST /admin/login/2fa` e `GET /admin/token|reports` sem limiter. Fix: `sessionVersion`, teto 12h+idle 30min, revalidar role, limiter 5/15min+lockout, exigir senha p/ desligar, backup codes.
- **A15. TLS ausente + Capacitor inseguro:** tudo HTTP puro (`server.ts:13`, g2g `http.createServer`, eldorado `HTTPServer`); TLS só no túnel Cloudflare efêmero (`CLOUDFLARE_TUNNEL_URL` + `tunnel.log` versionado expõe origem); `capacitor.config.json` c/ `server.url` efêmera + `allowMixedContent:true` + `webContentsDebuggingEnabled:true`; Nuxt `vite.allowedHosts:true` (DNS-rebinding) + `devtools:true`. Fix: TLS interno, remover `server.url` em release, `allowMixedContent:false`, debug off, `allowedHosts:['localhost']`, HSTS.
- **A16. `Icashpay` reescreve `.env` em runtime:** `Icashpay.ts:116-134` persiste `TELEGRAM_SESSION` via `writeFileSync(.env)` (corrida c/ deploy, sessão MTProto permanente em texto puro). Fix: vault/arquivo `0600` fora do repo.

## 3. MÉDIAS (30 dias)

- **M1. Rate-limit c/ lacunas + `trust proxy` sem allowlist:** sem limiter em `/auth/upload`, `/api/tickets`, `/kyc/status`, `/admin/login/2fa`, `/admin/token`, `/admin/reports` (full-scan: `reportsController.ts:52-69` carrega todas parcelas na RAM), webhooks; `trust proxy,1` + `X-Forwarded-For` sem allowlist = IP spoofável. Fix: limiters por rota, paginação/cap, proxy allowlist, chave por `userId`.
- **M2. KDF `SHA-256(segredo)` sem salt + bypass fraco + paymentToken 48bits:** `cryptoUtils.ts:14-18`, `payloadObfuscationMiddleware.ts:14-37`; `paymentToken.ts:7,27-31` (12 hex, reuse `JWT_SECRET`, instável por boot). Fix: HKDF+salt, `PAYMENT_TOKEN_SECRET` 256b dedicada, HMAC 128b+, `amount+expiresAt` assinados.
- **M3. SQL `Unsafe` + mês sem validação:** `paymentsController.ts:224-231` interpola ISO no `$queryRawUnsafe` (demais usam `$1` — ok); `month.split('-')` sem regex → `Invalid Date` → 500. Fix: `$queryRaw` tag, banir `Unsafe` no lint, `/^\d{4}-(0[1-9]|1[0-2])$/`.
- **M4. Máquinas de estado sem atomicidade:** `contemplateSubscription` check-then-act; `cancelSubscription` cancela qualquer status fora de trava c/ settle; `performDraw` fora de tx s/ `auditLog`; cota reciclada sem unique parcial (`groupQuotaAllocator`, `schema.prisma:130-133`). Fix: `updateMany` condicional, `SELECT FOR UPDATE`, unique parcial, `auditLog`.
- **M5. Upload KYC sem limiter/quota + PII sem cripto; `dev-fotos`/`mcp` path traversal escrita:** `POST /auth/upload` sem limiter (só submit tem); `dev-fotos/server.cjs:134-153` `slug` cru → `writeFileSync(join(IMG_DIR, slug...))`; `mcp-moto-catalog/index.js:266` `slug` cru. Fix: 5 uploads/h, quota, `0600/0700`, unificar `storage/kyc/`, expurgar legado; `slug /^[a-z0-9-]+$/` + `resolve`+`startsWith`.
- **M6. Axios/fetch sem timeout + `input`/`better-sqlite3` mortos + Prisma 2 majors atrás:** `pixGoService`, `sigiloPayService`, `datavalid token` sem `timeout` (hang=DoS); `input` (CLI) e `better-sqlite3` (datasource é Postgres) no bundle; `prisma 5.17`. Fix: `timeout:12s`, remover mortos, upgrade Prisma 6/7 testado, `npm ci --omit=dev`.
- **M7. Open redirect `?redirect=`:** `login.vue:79-80`, `register.vue:119-120`, `middleware/auth.ts:14-17`, `WelcomeOnboarding.vue` sem allowlist (`//evil.com`). Fix: `safeRedirect()` (só path `/`, sem `//`, `:`, `\`).
- **M8. BFF sem validação server-side + `register` dropa body:** `register.post.ts:19-23` não encaminha `body`; `auth.schema.ts` nunca importado no server; senha ≥6 só client. Fix: `readBody`+validar+encaminhar; política ≥10+zxcvbn+rate-limit Nitro.
- **M9. CSRF parcial + headers ausentes:** 12 rotas state-changing sem token (atenuante: BFF usa header `Authorization`, não cookie); sem CSP/HSTS/X-Frame/CORP/COOP (`nuxt.config.ts` sem `routeRules.headers`); `ejs 4.0.1` suspeita (fixar `3.1.10`); `crypto-js` abandonada (uso atual SHA256/HMAC ok, migrar p/ WebCrypto). Fix: `SameSite=Strict;__Host-` + Origin check + `nuxt-security`.
- **M10. Scripts debug c/ credenciais + `.sessao` c/ 34 cookies + captures c/ PAN:** `seedDevUsers/createGabriella/getTokens/testCarlosBid(fetch :3000)`, `eldoradov2/.sessao/*.json`, `g2g/captures/` c/ `flow.har` (Authorization/pipwave/3DS). Fix: `if (prod) exit(1)`, mover p/ fora do bundle, `shred` captures, retenção 24h, mascarar PAN, `chmod 700`.

## 4. CVEs de dependências (versões pinadas verificadas em 2026-09-21)

| Pacote | Instalada | CVE | Veredito |
|---|---|---|---|
| `multer` 2.1.1 (backend) | 2.1.1 | **CVE-2026-5079 (afeta até 2.1.1, fix 2.2.0)** — DoS multipart aninhado c/ 1 request | **VULNERÁVEL → `multer@2.2.0` + `limits:{fieldNestingDepth:10,fields:20}`** |
| `requests` (py, eldorado/g2g) | 2.32.3 | **CVE-2024-47081 (netrc leak, fix 2.32.4)** | **VULNERÁVEL → `pip install -U "requests>=2.32.4" "urllib3>=2.5.0"`** |
| `axios` 1.17.0 | 1.17.0 | CVE-2025-27152/ CVE-2026-42042/42264/44486 (todos fix ≤1.16.0) | OK (manter `^1.17+`; corrigir SSRF de design A8) |
| `express` 5.2.1, `helmet` 8.1.0, `cors` 2.8.6, `express-rate-limit` 8.5.2, `zod` 4.3.6, `redis` 5.11.0, `argon2` 0.44, `otplib` 12, `ejs` 4.0.1→fixar 3.1.10, `jsonwebtoken` 9.0.3 (`HS256` fixo — ok), `ws` 8.21.3, `prisma` 5.17 | — | nenhum CVE crítico aberto rastreado | OK c/ ressalvas de config (não de CVE) |
| `nuxt` 4.5.2, `vue` 3.5.41, `vue-router` 5.2.0, `h3` 1.15.11, `nitro` 2.13.4, `ofetch` 1.5.1 | — | GHSA-wm8w-6qjm-cv43, CVE-2026-56698/53721/71314 (todos fix ≤4.5.1/1.15.9) | OK nesta versão — não fazer downgrade; corrigir open-redirect aplicativo M7 |
| `crypto-js` 4.2.0 | 4.2.0 | CVE-2023-46233 já fix nesta versão; lib abandonada + `Math.random` p/ nonce | Migrar p/ WebCrypto/`node:crypto` |

```bash
npm --prefix server-consorcio i multer@2.2.0 ejs@3.1.10
pip install -U "requests>=2.32.4" "urllib3>=2.5.0"
npm audit fix --prefix server-consorcio --prefix zuvio-web --prefix gateways-codadas/g2g
```

## 5. Plano de remediação

**Semana 1 (bloqueante):** B1–B10 + `multer`/`requests` + CORS/SSRF allowlist + `git filter-repo` + `chmod 600` + `requirepass` + fail-closed webhooks + congelar PIX-lance/saques/`REFUNDED` + `buildWebhookUrl` + reconciliação.
**30 dias:** A1–A16 + M1–M10 (idempotência, travas, HKDF, BFF HttpOnly, upload allowlist, UUID+prefix-assert, 2FA/lockout, `textContent`, mascaramento LGPD, zod tudo, timeouts, `valueToPay`).
**60–90 dias:** PoW/anti-scrape real, banir `$queryRawUnsafe`, compose endurecido (networks, secrets, digest pin, `read_only`, `user`), Prisma 6/7, SAST/DAST + testes IDOR/concorrência no CI, `npm audit`+`pip-audit`+`gitleaks`, pentest de revalidação.

## 6. Pontos positivos (preservar)

Argon2id+pepper, AES-256-GCM IV aleatório, HMAC `timingSafeEqual`+`rawBody`, magic-bytes+MIME+ext, `Serializable` onde usado, `checkOwnership`+use-case checks, `secureKeyGenerator`, `maskCpf`, RBAC por capacidades, KYC Datavalid+sidecar, `trust proxy`+timeouts+graceful, ausência de `v-html`/`innerHTML`/`eval` no `zuvio-web`, `Math.random`/MD5/ECB ausentes no backend produtivo.

---
*Relatório consolidado de 3 auditorias (backend / frontend / gateways-infra). Sem PoC executado contra produção — estático + health checks. Confiança alta nos itens c/ arquivo:linha; XSS→token e SSRF-administrativa confirmadas em fluxo, sem request real disparado.*
