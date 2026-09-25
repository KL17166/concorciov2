# Admin — Notificações (Central, fase 1)

Fontes: `server-consorcio/src/routes/admin/notificationsRoutes.ts` (8 registros),
`server-consorcio/src/controllers/admin/notificationsController.ts`,
`server-consorcio/src/application/alerts/alertQueue.ts`,
`server-consorcio/src/views/pages/notifications/index.ejs`.
Montagem: `src/app.ts` `app.use('/admin', adminRoutes)` + `src/routes/admin/index.ts` `router.use(notificationsRoutes)`.
CSRF global: todo POST exige `_csrf`.
Gate base `isAdmin`: sessão `MASTER/MANAGER/SUPPORT`.
`requireCapability`: leitura `notifications.view` (MASTER/MANAGER/SUPPORT); concluir `notifications.manage` (só MASTER/MANAGER — SUPPORT assume/libera/dispensa com motivo, mas não dá RESOLVE final).

Modelo: `SystemAlert.status OPEN|ACK|IN_PROGRESS|RESOLVED|DISMISSED` + `assignedTo/assignedAt/resolvedAt/entityKind/entityId/claimToken`
(migration `20260923000000_alert_queue`). Backfill: `read=false→OPEN`, `read=true→RESOLVED`.
Sino global (`routes/admin/index.ts`): lê `status IN (OPEN,ACK,IN_PROGRESS)` take 8 + count. Poll fallback 30s em `sidebar.ejs` via `GET /admin/notifications/unread-count`; SSE em `GET /admin/notifications/stream` (15s) p/ a Central.

### `GET /admin/notifications`
- **Gate:** `isAdmin` + `notifications.view`.
- **Ativado por:** sidebar `Notificações` (`sidebar.ejs`), sino (deep-link `?alertId=`).
- **Request:** query `status` (default `OPEN`; `ALL` = todos), `type`, `q` (título/mensagem/tipo/details), `mine=1`, `unassigned=1`, `alertId` (highlight), `page/limit` via `paginate`.
- **Resposta:** `render pages/notifications/index` com `alerts (+target/parsed)`, `total/openCount/mineCount/unassignedCount`, `pagination`, `buildPageUrl`.
- **Efeitos:** leitura. `target`: bidPayment→`/admin/bids/payments?paymentId=`, bid→`/admin/bids/:id`, subscription→`/admin/contracts/:id`.
- **Erros:** exceção → `500 send('Erro ao carregar central de notificações')`.

### `POST /admin/notifications/:id/claim`
- **Gate:** `isAdmin` + `notifications.view` (atendente pode assumir).
- **Ativado por:** Central botão `Assumir`.
- **Efeitos:** `claimAlert` (tx Serializable): `OPEN→ACK`, `assignedTo/assignedAt`, `auditLog ALERT_CLAIMED`. `RESOLVED/DISMISSED` → 409; já assumido por outro → 409.
- **Resposta:** `302 Referer||/admin/notifications` + flash.

### `POST /admin/notifications/:id/release`
- **Gate:** `notifications.view`. Central botão `Liberar`. Volta p/ `OPEN`, limpa dono. Audit `ALERT_RELEASED`.

### `POST /admin/notifications/:id/progress`
- **Gate:** `notifications.view`. `ACK→IN_PROGRESS` via `transitionAlert`. Audit `ALERT_TRANSITION`.

### `POST /admin/notifications/:id/resolve`
- **Gate:** `notifications.manage` (gerente). `→RESOLVED` + `read/readAt/readBy/resolvedAt`. Audit `ALERT_RESOLVED`.

### `POST /admin/notifications/:id/dismiss`
- **Gate:** `notifications.view`. Motivo obrigatório ≥8 chars. `→DISMISSED`. Audit `ALERT_DISMISSED`.

### `GET /admin/notifications/stream`
- **Gate:** `notifications.view`. SSE `15s` com `{open, mine, at}`. Mesma sessão.

### `GET /admin/notifications/unread-count`
- **Gate:** `notifications.view`. JSON `{open, alerts[8]}` p/ o sino (poll 30s).

> **Conferência:** `notificationsRoutes.ts` tem 8 registros — todos acima, 8/8.
