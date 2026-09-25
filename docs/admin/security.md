# Admin — Security (segurança)

Fontes: `server-consorcio/src/routes/admin/securityRoutes.ts` (2 rotas: 1× `router.get` + 1× `router.post`, linhas 7–8),
`server-consorcio/src/controllers/admin/securityController.ts`,
`server-consorcio/src/views/pages/security/index.ejs`.
Prefixo: `/admin`.

## Rotas (2/2 — conferidas uma a uma contra `securityRoutes.ts:7-8`)

### `GET /admin/security`
- **Gate:** `isAdmin` + `requireCapability('security.view')` (`securityRoutes.ts:7`)
- **Ativado por (tela):** `pages/security/index.ejs` — sidebar (`path:'/security'`, `:3`); sem filtros, paginação ou form GET na tela (leitura direta ao abrir)
- **Request:** nenhum (sem params/query/body)
- **Resposta do servidor:** `render('pages/security/index', { path:'/security', blockedDevices, recentThreats, blockedCount, threatsToday, honeypotHits, totalBlockedScore })` (`securityController.ts:36-44`). `blockedDevices` = `blockedDevice.findMany({orderBy:{blockedAt:'desc'}, take:50})` (`:11-14`); `recentThreats` = `securityThreat.findMany({where:{createdAt:{gte: ontem−24h}}, orderBy:{createdAt:'desc'}, take:100})` (`:17-23`); `blockedCount` = `blockedDevice.count({where:{active:true}})` (`:26`); `threatsToday = recentThreats.length` (`:27`); `honeypotHits = recentThreats.filter(threatType==='HONEYPOT').length` (`:28`); `totalBlockedScore = Σ threatScore` dos ativos (`aggregate _sum`, `:30-34`, `|| 0`)
- **Efeitos:** somente leitura (2× `findMany` + 1× `count` + 1× `aggregate`). Nenhum write, e-mail ou alerta. Cards da tela consomem `blockedCount/threatsToday/honeypotHits/totalBlockedScore` (`index.ejs:50-118`); tabelas consomem `blockedDevices` (`:128-191`) e `recentThreats` (`:211-267`, badges por `threatType` HONEYPOT/INJECTION/IDOR/BRUTE_FORCE em `:228-244`)
- **Erros:** `catch` → `res.status(500).send('Erro ao carregar página de segurança')` (`:46-48`, log `:46`)

### `POST /admin/security/unblock/:id`
- **Gate:** `isAdmin` + `requireCapability('security.manage')` (`securityRoutes.ts:8`)
- **Ativado por (tela):** `security/index.ejs:170-180` — por linha ativa (`if (device.active)`, `:169`): `<form action="/admin/security/unblock/<%= device.id %>" method="POST">` + `_csrf` hidden (`:173-174`) + submit "Desbloquear" (`btn-success btn-sm`, `:175-179`) com `confirm('Desbloquear este dispositivo?')`; linhas já inativas mostram `Desbloqueado por <%= device.unblockedBy %>` (`:182-184`) sem form
- **Request:** params `id: string` (obrigatório, `req.params.id`, controller `:54`); sem body além de `_csrf`
- **Resposta do servidor:** `redirect('/admin/security')` + flash `success_msg='Dispositivo desbloqueado com sucesso!'` (`:66-67`)
- **Efeitos:** soft-unblock `blockedDevice.update({where:{id}, data:{ active:false, unblockedAt:new Date(), unblockedBy: session.user.name || 'Admin' }})` (`:55-64`, admin lido de `session.user`, `:55`). Registro mantido (aparece como "Desbloqueado"). Nenhum e-mail/alerta
- **Erros:** `catch` (ex.: `id` inexistente → `P2025`) → flash `error_msg='Erro ao desbloquear dispositivo'` + `redirect('/admin/security')` (`:68-72`, log `:69`); sem checagem de já-inativo (re-desbloqueio sobrescreve `unblockedAt/By` sem erro)
