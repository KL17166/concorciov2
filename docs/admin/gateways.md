# Admin — Gateways (integrações)

Fontes: `server-consorcio/src/routes/admin/gatewayRoutes.ts` (5 rotas: 2× `router.get` + 3× `router.post`, linhas 7–11),
`server-consorcio/src/controllers/admin/gatewayController.ts`,
`server-consorcio/src/services/gateways/sigiloPayService.ts` (`getBalance`, `requestWithdraw`),
`server-consorcio/src/views/pages/gateways/index.ejs`.
Prefixo: `/admin`. Seeds: `DEFAULT_GATEWAYS` = pixgo / sigilopay / eldorado / g2g (`gatewayController.ts:8-41`).

## Rotas (5/5 — conferidas uma a uma contra `gatewayRoutes.ts:7-11`)

### `GET /admin/gateways`
- **Gate:** `isAdmin` + `requireCapability('integrations.view')` (`gatewayRoutes.ts:7`)
- **Ativado por (tela):** `pages/gateways/index.ejs` — sidebar (`path:'/gateways'`, `:3`); 3 abas (`Visão Geral/Configurações/Saques`, `:248-258`) consomem a mesma var `gateways`
- **Request:** nenhum (sem params/query/body)
- **Resposta do servidor:** `render('pages/gateways/index', { path:'/gateways', gateways, csrfToken })` (`:99-103`; `csrfToken = res.locals.csrfToken || session.csrfToken || ''`, `:102`)
- **Efeitos:** auto-seed: p/ cada `DEFAULT_GATEWAYS`, `findFirst({name})` → `create` se inexistente (`:47-50`); se `sigilopay` existir com `supportsBoleto=true` → `update({supportsBoleto:false, isDefaultBoleto:false})` (`:51-57`). Enriquecimento só p/ display: `envApiKey = !!process.env.{PIXGO_API_KEY|SIGILOPAY_API_KEY|ELDORADO_API_TOKEN|G2G_API_TOKEN}` (+ `envWebhookSecret` pixgo, `envApiSecret` sigilopay, `:68-94`); se `!db.apiKey && env` → exibe `apiKey='Presente no .env'` (`:73-88`, máscara, não persiste). Tabela de status (`:322-384`), picker (`:393-411`) e forms de config (`:413-533`) iteram `gateways`
- **Erros:** `catch` → `res.status(500).send('Erro ao carregar gateways')` (`:104-107`, log `:105`)

### `GET /admin/gateways/sigilopay/balance`
- **Gate:** `isAdmin` + `requireCapability('integrations.view')` (`gatewayRoutes.ts:8`)
- **Ativado por (tela):** `gateways/index.ejs` IIFE `loadBal()` (`:691-719`): `fetch('/admin/gateways/sigilopay/balance')` (`:693`) → preenche cards `#ovAvailable/#ovPending/#ovLocked` (`:700-703`, formato `R$ x,xx`) e painel saque `#wdBalance/#wdPending/#wdLocked` (`:706-711`); falha → badges "Sem conexão" (`:713-716`) + `setWithdrawAvailability(false)` (`:717`), que desabilita `#wdBtn` e mostra `#wdConnectionNotice` (`:676-689`)
- **Request:** nenhum
- **Resposta do servidor:** proxy JSON direto de `SigiloPayService.getBalance()` (`gatewayController.ts:217`): `{ available:number, pending:number, fundLock:number }` (GET externo `{baseUrl}/gateway/producer/balance`, `sigiloPayService.ts:184-203`; log `:197`)
- **Efeitos:** leitura externa (axios GET com `buildHeaders(apiKey,apiSecret)`); `logger.info` saldo (`:197`). Nenhum write no banco
- **Erros:** credenciais ausentes (`!isConfigured||!apiKey||!apiSecret`) → `throw 'SigiloPay credentials not configured'` (`:186-189`) → cai em `handleApiError(res, err, 'Erro ao consultar saldo do gateway SigiloPay')` (`:220`) → JSON `{ success:false, error, message, requestId }` (`src/utils/errors.ts:87-92`, status do erro ou 500); falha HTTP externa → `throw 'Failed to fetch SigiloPay balance'` (`:202`)

### `POST /admin/gateways/sigilopay/withdraw`
- **Gate:** `isAdmin` + `requireCapability('integrations.manage')` (`gatewayRoutes.ts:9`)
- **Ativado por (tela):** aba Saques (`#panel-withdraw`, `:539`): picker tipo `.pix-type-btn[data-type]` default `cpf` (`pickPix()`, `:662-669`, placeholders `:663`); inputs `#wdKey` (chave, `:591`), `#wdAmount` (number, `:596`), `#wdDesc` (opcional, `:600`); botão `#wdBtn onclick="doWithdraw()"` (`:605`, desabilitado até `setWithdrawAvailability(true)`); `doWithdraw()` faz `fetch('/admin/gateways/sigilopay/withdraw', {method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf}, body:JSON.stringify({amount, pixKey, pixKeyType:pixType, description:desc}) })` com CSRF de `meta[name=csrf-token]` ou `input[name=_csrf]` (`:724-750`); resultado em `#wdResult` (`:752-760`)
- **Request:** body JSON: `amount: string|number` (obrigatório; `parseFloat`, `:238`), `pixKey: string` (obrigatório), `pixKeyType: 'cpf'|'cnpj'|'email'|'phone'|'random'` (obrigatório), `description?: string` (opcional; service usa default `'Saque via painel admin'`, `sigiloPayService.ts:234`)
- **Resposta do servidor:** `200 JSON { success:true, message:'Saque solicitado com sucesso', data:result }` (`:267-271`, `result` = retorno do POST externo)
- **Efeitos:** POST externo `{baseUrl}/gateway/producer/withdraw` com `{ amount:numAmount, pix_key, pix_key_type, description }` (`sigiloPayService.ts:228-237`); `logger.info('[Admin] Withdrawal requested: R$ N by email')` (`gatewayController.ts:265`)
- **Erros:** `!amount||!pixKey||!pixKeyType` → `400 JSON { success:false, error:'BAD_REQUEST', message:'Campos obrigatórios: amount, pixKey, pixKeyType' }` (`:229-236`); `NaN||≤0` → `400 { success:false, error:'BAD_REQUEST', message:'Valor de saque inválido' }` (`:238-246`); tipo fora da lista → `400 { success:false, error:'BAD_REQUEST', message:'Tipo de chave PIX inválido' }` (`:248-256`); exceção do service → `handleApiError(res, err, 'Erro ao solicitar saque no gateway SigiloPay')` (`:272-274`)

### `POST /admin/gateways/:id/update`
- **Gate:** `isAdmin` + `requireCapability('integrations.manage')` (`gatewayRoutes.ts:10`)
- **Ativado por (tela):** por gateway: `div#cfg-<%= gw.id %>` (`:415`) com `<form action="/admin/gateways/<%= gw.id %>/update" method="POST">` + `_csrf` (`:438-439`); submit "Salvar Alterações" (`:525-529`). Campos (`:441-523`): `apiKey` (password, `:447-449`; label varia: pixgo "API Key", eldorado/g2g "Token da gateway (X-Gateway-Token)", demais "API Key (Public)", `:445`), secret password `name = webhookSecret` (pixgo) ou `apiSecret` (demais) (`:459-463`), `baseUrl` (text + hint de padrão por provider, `:470-480`), `environment` (select `production|sandbox`, `:484-487`), `platformId` (só sigilopay, `:489-495`), switch `requiresManualReview` (“Exige conferência manual”), switches `isDefaultPix|isDefaultBoleto|isDefaultCard` (`value="true"`, só renderizados se `supports*`, `:504-521`)
- **Request:** params `id: string`; body: `apiKey?:string`, `apiSecret?:string`, `webhookSecret?:string`, `baseUrl?:string`, `environment?:string`, `platformId?:string`, `requiresManualReview?: 'true'`, `isDefaultPix|isDefaultBoleto|isDefaultCard?: 'true'` (checkbox ausente = `undefined` → `false`; controller `:114-118`)
- **Resposta do servidor:** `redirect('/admin/gateways')` + flash `success_msg='Configuração do gateway atualizada com sucesso!'` (`:155-156`)
- **Efeitos:** exclusividade de default por método: se `isDefaultPix==='true'` → `updateMany({where:{id:{not:id}}, data:{isDefaultPix:false}})` (idem Boleto/Card, `:121-138`); depois `gatewayConfig.update` **parcial** (só campos enviados; ausente = mantém — antes apagava apiKey/baseUrl). `requiresManualReview` aceita `["false","true"]` (hidden + checkbox, vale o último). `requiresManualReview=true` (Eldorado/G2G por padrão) faz o app exibir “confirmação manual” só quando o PIX vier dessa gateway (`generateBidPix`/`generateBatchPayment` retornam `provider+isManualApproval`).
- **Erros:** `catch` (ex.: `id` inexistente → `P2025`) → flash `error_msg='Erro ao atualizar configuração do gateway.'` + `redirect('/admin/gateways')` (`:157-161`, log `:158`)

### `POST /admin/gateways/:id/toggle`
- **Gate:** `isAdmin` + `requireCapability('integrations.manage')` (`gatewayRoutes.ts:11`)
- **Ativado por (tela):** header de cada card `cfg-*`: `<form action="/admin/gateways/<%= gw.id %>/toggle" method="POST">` + `_csrf` (`:429-430`); submit "Ativar|Desativar" (`btn-outline-success|danger`, `:431-434`)
- **Request:** params `id: string`; sem body além de `_csrf`
- **Resposta do servidor:** `redirect('/admin/gateways')` + flash `success_msg='Gateway ${displayName} ativado|desativado com sucesso!'` (`:205-206`)
- **Efeitos:** `findUnique({id})` (`:168`); `gatewayConfig.update({data:{enabled:!enabled}})` (`:188-191`); se desativou → segundo `update` zerando `{isDefaultPix:false, isDefaultBoleto:false, isDefaultCard:false}` (`:194-203`)
- **Erros:** `!gateway` → flash `error_msg='Gateway não encontrado.'` + redirect, sem alterar (`:170-173`); ativar sem chave (`!db.apiKey && !env`, env por provider: `PIXGO_API_KEY|SIGILOPAY_API_KEY|ELDORADO_API_TOKEN|G2G_API_TOKEN`, `:178-181`) → flash `error_msg='Configure a API Key antes de ativar o gateway.'` + redirect, sem alterar (`:183-186`); `catch` → flash `error_msg='Erro ao alternar status do gateway.'` + redirect (`:207-211`, log `:208`)
