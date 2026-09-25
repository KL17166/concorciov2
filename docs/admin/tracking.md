# Admin — Tracking (pixel próprio, funil do app)

Fontes: `server-consorcio/src/routes/admin/trackingRoutes.ts` (1 `router.get`, único — conferido),
`server-consorcio/src/controllers/admin/trackingController.ts`,
`server-consorcio/src/views/pages/tracking/index.ejs`.
Montagem: `src/app.ts:154` `app.use('/admin', adminRoutes)` + `src/routes/admin/index.ts:82` `router.use(trackingRoutes)`.
Sem POST → CSRF não se aplica (validateToken só em POST/PUT/DELETE, `routes/admin/index.ts:34-43`).
Gate base `isAdmin` (`middlewares/adminAuthMiddleware.ts:37-81`): sessão `role` ∈ MASTER/MANAGER/SUPPORT; senão
`redirect /admin/login` ou `403 JSON` se `wantsJson`. `requireCapability` (`adminAuthMiddleware.ts:83-92`): padrão.
**Observação de capability: usa `reports.view`, não existe `tracking.*`** (`trackingRoutes.ts:7`).
Matriz (`security/adminCapabilities.ts:32-55`): `reports.view` = MASTER/MANAGER apenas — **SUPPORT não tem
`reports.view`** (linhas 50-51), logo é bloqueado nesta tela (deny → flash `error_msg` + volta p/ Referer/dashboard).

### `GET /admin/tracking`
- **Gate:** `isAdmin` + `reports.view` (`trackingRoutes.ts:7`).
- **Ativado por (tela):** `src/views/pages/tracking/index.ejs:13-15` — atalhos-link
  `href="/admin/tracking?days=7"` (label "7d"), `?days=30` ("30d"), `?days=90` ("90d"), ativo=`btn-primary`
  quando `days` igual; + form-filtro linha 80 `<form method="GET" action="/admin/tracking">` com
  `<input type="hidden" name="days" value="<%= days %>">` (linha 81) e `<select name="event" onchange="this.form.submit()">`
  (linha 82) com `option value=""` ("Todos os eventos") + uma `option` por `funnelOrder` (selected se `===eventFilter`,
  linhas 84-86). Entrada via sidebar (`path:'/tracking'`, linha 3).
- **Request:** query `days?: string` (opcional, default `'7'`; `parseInt(...)||7` com clamp `min(max(d,1),90)` —
  controller:17, então `0/NaN→7`, `>90→90`, `<1→1`); `event?: string` (opcional, default `''`; **só filtra se
  ∈ `FUNNEL_ORDER`**); `screen?: string` (opcional, default `''`; **só filtra se ∈ `KNOWN_SCREENS`**
  de 14 telas). `FUNNEL_ORDER` (controller:5-13) inclui `BID_CREATED`. `since=now-days*24h`.
  Sem params/body.
- **Resposta do servidor:** `render('pages/tracking/index')` com vars **todas**:
  `path='/tracking'`, `funnel` (`[{event,count}]` na ordem fixa; counts via `trackingEvent.groupBy by:[event]
  where {createdAt:{gte:since}}` **sem** filtro de evento — totais do período),
  `conversion` (string 1 casa: `VERIFY_PAYMENT_CLICK/SCREEN_VIEW*100`, `'0.0'` se views=0),
  `totalEvents` (soma dos groups), `uniqueUsers` (`groupBy by:[userId]` → `.length`),
  `recent` (100 últimos `findMany where {createdAt[, event][, screen]}` — respeita ambos os filtros),
  `days`, `eventFilter` (raw), `screenFilter` (raw), `funnelOrder`, `knownScreens` (14 telas p/ o select),
  `screenStats` (`[{screen, views, qr, verifies, viewToVerify%}]` via 3 groupBy por tela, ordenado por views),
  `dailySeries` (`[{day MM-DD, total, verifies}]` últimos N dias, agregados em JS de até 5000 eventos),
  `topEntities` (top-10 `entityType:id` por QR+verifica, de até 2000 eventos com entityId).
- **Efeitos:** leitura pura (groupBys + 2 `findMany` capped). Sem escrita, sem e-mail, sem alerta.
  Base p/ algoritmo/ads.
- **Erros:** exceção → `500 send('Erro ao carregar tracking')` (controller:61). `event` inválido **não** erra —
  é ignorado no filtro (controller:22) mas ecoado em `eventFilter` (select volta a "Todos"). Gate negado → padrão
  (SUPPORT cai aqui por falta de `reports.view`).
