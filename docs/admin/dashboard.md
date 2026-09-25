# Admin · Dashboard — endpoints

- **Rota-base:** `src/routes/admin/dashboardRoutes.ts` (3 `router.*`: L7, 8, 9). Controller: `src/controllers/admin/dashboardController.ts`.
- **View:** `src/views/pages/dashboard/index.ejs`. Disparo global dos alertas: `src/views/partials/sidebar.ejs` (sininho, L7-174) — presente em todas as páginas com sidebar, não só no dashboard.
- **Gate global do sino:** `src/routes/admin/index.ts:48-66` injeta `res.locals.alertBell = { unread, alerts }` (até 8 não lidos + count) em todo `GET` com sessão; falha silenciosa (sino apagado, página não quebra).
- **Checklist de cobertura:** `GET /dashboard`, `POST /alerts/:id/read`, `POST /alerts/read-all` — todos abaixo.

---

### `GET /admin/dashboard`
- **Gate:** `isAdmin` + `requireCapability('dashboard.view')` (`dashboardRoutes.ts:7`). Papéis com acesso: MASTER, MANAGER, SUPPORT (`src/security/adminCapabilities.ts:31-54`). Negação: flash `error_msg='Seu perfil não pode executar a ação "dashboard.view".'` + redirect `Referer` ou `/admin/dashboard` (HTML) ou `403 JSON` — `adminAuthMiddleware.ts:9-16, 83-92`.
- **Ativado por (tela):** sidebar **“Dashboard”** (`sidebar.ejs:178`, `<a href="/admin/dashboard">`, capability `dashboard.view`); redirect pós-`setupAdminSession` (`authRoutes.ts:45`); fallback do sino `openBellAlert` sem `subscriptionId` → `window.location.href='/admin/dashboard'` (`sidebar.ejs:144`).
- **Request:** sem params/query/body.
- **Resposta do servidor:** `render('pages/dashboard/index', {...})` (`dashboardController.ts:87-104`) com **todas** as vars:
  - `path: '/dashboard'`
  - `stats: { totalUsers, totalContracts, activeContracts, contemplatedContracts, pendingAdesoes, openTickets, kycPending }`
  - `recentContracts: Subscription[5]` (com `user`, `plan.product`)
  - `recentTickets: SupportTicket[5]` (com `user.name`)
  - `contractsByMonth: [{ label, total } × 6]` (contagem por mês, últimos 6)
  - `contractsByStatus: { pending, active, contemplated, cancelled, completed }` (de `groupBy status`)
  - `systemAlerts: SystemAlert[10]`, `unreadAlertsCount: number`
- **Efeitos / leituras (sem escrita):** `User.count(role=CLIENT)`; `Subscription.count()` total / `status=ACTIVE` / `contemplated=true`; `Installment.count(number=1, status∈{PENDING,OVERDUE})` (= `pendingAdesoes`); `SupportTicket.count(status=OPEN)`; `User.count(kycStatus=SUBMITTED)`; 5 subscriptions + 5 tickets recentes; `groupBy status`; 6 counts mensais; `SystemAlert.findMany(10)` + `count(read=false)` (com `try/catch` + `logger.warn`, não quebra a página — `:69-85`).
- **Erros:** exceção → `logger.error('Dashboard error:')` + `500 text 'Erro ao carregar dashboard'` (`:105-108`). Sem flash.
- **Consumo na view (`dashboard/index.ejs`):** cards `stats.totalUsers / activeContracts / pendingAdesoes / openTickets / kycPending / totalContracts / contemplatedContracts` (`:57,72,87,102,121,137,150`); links **“Cobrar no Financeiro →”** (`:88`, `/admin/payments?status=ADESOES`), **“Ver atendimentos →”** (`:103`, `/admin/tickets`), **“Revisar documentos →”** (`:123`, `/admin/kyc`), **“Ver todos”** (`:258`, `/admin/tickets`); tabela Contratos Recentes (`:199-247`) e Atendimentos Recentes (`:261-306`); gráficos `contractsMonthChart` (barras, `:363-400`) e `contractsStatusChart` (doughnut, `:319-360`) hidratados de `contractsByMonth`/`contractsByStatus` (`:315-316`).

### `POST /admin/alerts/:id/read`
- **Gate:** `isAdmin` + `requireCapability('dashboard.view')` (`dashboardRoutes.ts:8`). Mesmo deny do módulo.
- **Ativado por (tela):** sininho em `partials/sidebar.ejs` — botão **dispensar (×)** de cada alerta (`:48`, `onclick="markAlertAsRead('<id>')"`) e clique no corpo do alerta via `openBellAlert(id, subscriptionId)` (`:39`, `:138-146`). Ambos fazem `fetch('/admin/alerts/' + id + '/read', { method: 'POST', headers: { 'csrf-token': bellCsrf() } })` (`:139`, `:149`); CSRF vai no **header** `csrf-token` (lido de `<%= csrfToken %>` em `:126`), validado pelo middleware global de POST (`index.ts:35-43`).
- **Request:** `params.id: string` (obrigatório — id do `SystemAlert`); sem query/body. Usa `(req).user?.id` como `readBy` (`dashboardController.ts:115`).
- **Resposta do servidor:** JSON `200 { success: true, message: 'Alerta marcado como lido' }` (`:126`); erro → `500 { success: false, message: 'Erro ao atualizar alerta' }` (`:129`).
- **Efeitos:** escrita em `SystemAlert.update({ where: { id }, data: { read: true, readAt: now, readBy } })` (`:117-124`). Sem e-mail. No cliente: `markAlertAsRead` remove o item do DOM e decrementa o badge (`sidebar.ejs:152-157`); `openBellAlert` marca e navega para `/admin/contracts/:subscriptionId` (se `details.subscriptionId`) ou `/admin/dashboard` (`:142-145`).
- **Erros:** id inexistente / falha Prisma → `logger.error('Error marking alert as read:')` + `500 JSON` acima. Falta de capability → deny padrão (`403 JSON`, pois `fetch` sem `text/html` cai em `wantsJson`).

### `POST /admin/alerts/read-all`
- **Gate:** `isAdmin` + `requireCapability('dashboard.view')` (`dashboardRoutes.ts:9`).
- **Ativado por (tela):** sininho em `partials/sidebar.ejs:23` — botão **“Marcar todas”** (`onclick="markAllAlertsAsRead()"`), visível só com `_bell.unread > 0`; `fetch('/admin/alerts/read-all', { method: 'POST', headers: { 'csrf-token': bellCsrf() } })` (`:162-164`).
- **Request:** sem params/query/body. Usa `(req).user?.id` como `readBy` (`dashboardController.ts:136`).
- **Resposta do servidor:** JSON `200 { success: true, message: 'Todos os alertas foram marcados como lidos' }` (`:147`); erro → `500 { success: false, message: 'Erro ao atualizar alertas' }` (`:150`).
- **Efeitos:** escrita em massa `SystemAlert.updateMany({ where: { read: false }, data: { read: true, readAt: now, readBy } })` (`:138-145`). No cliente: remove todos `.bell-alert-item`, zera badge e mostra “Nenhum aviso pendente.” (`sidebar.ejs:165-170`). Sem e-mail.
- **Erros:** falha Prisma → `logger.error('Error marking all alerts as read:')` + `500 JSON` acima. Sem flash (resposta é JSON puro).
