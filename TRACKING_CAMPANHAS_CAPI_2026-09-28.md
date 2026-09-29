# TRACKING P/ CAMPANHAS + CAPI — entregue 2026-09-28
Responde: (1) o rastreamento serve p/ melhorar campanhas? (2) e os pixels Google/Meta/TikTok?
Auditoria achou o esqueleto bom mas 3 furos (sem atribuição, só logado, proxy barrando 3/4 dos
eventos) + pixels desligados e só browser-side. Plano em 5 fases aprovado e executado (F3→F1→F2→F4→F5).

## O que mudou (código)
- **Allowlist 7→27 eventos** — `server-consorcio/src/schemas/trackingSchema.ts` (`TRACK_EVENTS`,
  +`product_detail` em `TRACK_SCREENS`, +`product`/`user` em `TRACK_ENTITY_TYPES`) espelhado em
  `zuvio-web/server/api/track.post.ts`. `learningService.ts` ganhou sinais VIEW_ITEM/ADD_TO_CART/
  BEGIN_CHECKOUT/REGISTER/KYC.
- **Atribuição first-touch** — `zuvio-web/app/composables/useAttribution.ts` (UTM + fbclid/gclid/
  ttclid + landing/referrer, cookie `kat_attrib` 90d); `useTrack.trackEvent` anexa achatado no
  metadata (guarda de 2KB). Dashboard ganhou seção **Por campanha** (top-20 utm_campaign/utm_source).
- **Jornada anônima** — `useGuestId.ts` (UUID em `kat_gid`); `guestId` via proxy→schema→coluna nova
  `tracking_events.guestId` + índice (migration `20260928000004_add_tracking_guest_id`, aplicada);
  `POST /api/track` usa `optionalAuth` (nunca 401; userId só do JWT); `track.global.ts` sem gate de
  login; `LOGIN`/`REGISTER` costuram guest→user; únicos = users + guests.
- **Pixels + LGPD** — `analytics.client.ts` só carrega GA4/Meta/TikTok com opt-in (`kat_consent`);
  banner `ui/CookieConsent.vue` montado no `app.vue`; snippet oficial TikTok (o stub caseiro perdia
  tudo); `Purchase` com `content_ids` (DPA). IDs por env — vazios = desligado.
- **Server-side** — `src/services/conversionsService.ts` (Meta CAPI + GA4 MP, fire-and-forget,
  `external_id`=sha256(userId), dedup por `eid` gerado no front e enviado no fbq via `{eventID}`,
  `fbp`/`fbc`/`ga_client_id` lidos dos cookies; GA4 só com client_id real; flags `*_ENABLED`,
  `META_TEST_EVENT_CODE`, `GA4_MP_DEBUG`). Hook em `recordEvent.ts` p/ 5 eventos de dinheiro/cadastro.
  Teste novo: `src/__tests__/conversionsService.test.ts` (8 casos).
- **Infra de teste** — `tsconfig` `types: ["node","jest"]` (a suíte inteira nem compilava antes).

## Verificação (de verdade, não promessa)
- `tsc` limpo; **jest 91/91** (83 + 8 novas); backend restartado via systemd.
- Smoke: `VIEW_ITEM`/`ADD_TO_CART` anônimos com UTM gravados sem JWT (`recorded:true`); campanha
  `teste-smoke` visível na tabela Por campanha; `/admin/tracking` 200 com login real.
- Front: `/welcome` 200 sem erros no log; proxy `/api/track` grava e rejeita inválido (400).

## Pendente do OPERADOR (nada disso é código)
1. **Preencher IDs no painel** — `/admin/tracking` (seção "Pixels de marketing", só mestre):
   GA4 (`G-...`), Meta (só números), TikTok (`C...`) + chave Ativado. Sem ID ou desativado =
   pixel não carrega. Tokens continuam no `.env` (CAPI/MP).
   (Antes era só por env; o painel virou a fonte principal, env é fallback.)
2. **Validar disparo** — Meta Test Events (ver browser + CAPI com mesmo `event_id` dedupado),
   GA4 DebugView, TikTok Event Checker. Dica: `META_TEST_EVENT_CODE` / `GA4_MP_DEBUG=true`.
3. **Build de produção do front quebrado no servidor** — Node 20 x Nuxt 4.5/Vite 8
   (`trustedFunctions.difference is not a function`); precisa **Node 22** p/ `nuxt build`.
   Pré-existente, dev funciona. Afeta qualquer deploy em prod do zuvio-web.
4. **INPI**: domínio livre ≠ marca livre — buscar antes de registrar nomes.

## Adendo 2026-09-29 — painel de pixels + emergência disco
- Painel MASTER em `/admin/tracking`: salva IDs (`POST /admin/tracking/pixels`, CSRF + auditLog),
  mostra status por provider + tabela "o que está sendo capturado" (mapeamento interno→GA4/Meta/
  TikTok/CAPI + contagens 7d). Front busca em `/api/pixel-config` (BFF) com fallback env.
- `pixel_configs` (migration `20260928000005_pixel_configs`).
- Banner cookies no tema do site (fundo claro, slate #263238, CTA laranja #FF6D00).
- **Adendo 23:30 — banner LGPD removido a pedido do operador** (pixels sempre carregam,
  sem pergunta de consentimento): `CookieConsent.vue` + `useConsent.ts` apagados, `app.vue`
  limpo, plugin com `consented = true` permanente. Reversível se a LGPD apertar.
- **Disco cheio derrubou o Postgres** (`/var/lib/docker` 100%): removidas imagens órfãs
  mysql:5.7 + mxbet-php + php-cli (projeto casino já desmontado, ~670MB) → banco recuperou sozinho.
  Partição docker segue apertada (90%) — vigiar; imagem do WAHA tem 3GB.
- Aviso: arquivos novos no front exigem `nuxi prepare` ou restart do `consorcio-web`
  (watcher não pega arquivo novo no /mnt/win).

## Arquivos (mapa rápido)
- Front: `app/composables/use{Attribution,GuestId,Consent,Track}.ts`, `app/middleware/track.global.ts`,
  `app/plugins/analytics.client.ts`, `app/components/ui/CookieConsent.vue`, `app/stores/auth.ts`
  (eventos LOGIN/REGISTER), `app/app.vue` (banner), `server/api/track.post.ts`.
- Backend: `schemas/trackingSchema.ts`, `middlewares/authMiddleware.ts` (`optionalAuth`),
  `routes/api/trackingRoutes.ts`, `controllers/{api/trackingController,admin/trackingController}.ts`,
  `application/tracking/recordEvent.ts`, `services/{learningService,conversionsService}.ts`,
  `views/pages/tracking/index.ejs` (+seção campanha), `prisma/schema.prisma` + migration,
  `__tests__/conversionsService.test.ts`, `tsconfig.json`, `.env.example`.
- Docs atualizados (regra-doc-por-funcao): `docs/api/POST-track.md`,
  `docs/funcoes/recordTrackingEvent.md`, `docs/admin/tracking.md`.
