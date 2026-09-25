# Admin — KYC (compliance)

Fontes: `server-consorcio/src/routes/admin/kycRoutes.ts` (8 `router.*`: 3 GET + 5 POST, todos conferidos abaixo),
`server-consorcio/src/controllers/admin/kycController.ts`,
`server-consorcio/src/views/pages/kyc/index.ejs`.
Montagem: `src/app.ts:154` `app.use('/admin', adminRoutes)` + `src/routes/admin/index.ts:85` `router.use(kycRoutes)`.
CSRF global (`routes/admin/index.ts:24-43`): todo POST exige `_csrf` válido (validateToken), exceto `/login`.
Gate base `isAdmin` (`middlewares/adminAuthMiddleware.ts:37-81`): sessão com `role` ∈ MASTER/MANAGER/SUPPORT; senão
`redirect /admin/login` (flash `error='Por favor, faça login como administrador.'`) ou `403 JSON {error:'UNAUTHORIZED',...}` se `wantsJson`.
`requireCapability` (`adminAuthMiddleware.ts:83-92`): sem capability → `403 JSON {error:'FORBIDDEN',...}` ou
flash `error_msg='Seu perfil não pode executar a ação "<cap>".'` + redirect `Referer||/admin/dashboard`.
Matriz (`security/adminCapabilities.ts:32-55`): `compliance.view` = MASTER/MANAGER/SUPPORT;
`compliance.review` = MASTER/MANAGER apenas (SUPPORT vê fila/detalhe/documento, mas NÃO aprova/rejeita/reabre/override/retrigger).

### `GET /admin/kyc`
- **Gate:** `isAdmin` + `compliance.view` (`kycRoutes.ts:7`).
- **Ativado por (tela):** `src/views/pages/kyc/index.ejs:120,124,128` — abas-link
  `href="/admin/kyc?filter=pending"` (label "Pendentes"), `?filter=approved` ("Aprovados"),
  `?filter=rejected` ("Rejeitados"), cada uma com badge de contagem; entrada via sidebar (`path:'/kyc'`).
- **Request:** query `filter?: string` — opcional, default `'pending'`; só aceita `pending|approved|rejected`,
  qualquer outro valor cai em `pending` (controller:78-79). Sem body, sem params.
- **Resposta do servidor:** `render('pages/kyc/index')` (controller:117-127) com vars **todas**:
  `path='/kyc'`, `filter` (normalizado), `pendingUsers` (até 100 `User` `role='CLIENT'`,
  `kycStatus` = SUBMITTED/APPROVED/REJECTED via `statusMap`, include `subscriptions` →
  `plan→product` + `installments where number=1 take=1`; se `filter==='pending'` subscriptions filtradas
  `status='PENDING_KYC'`; orderBy `updatedAt desc` se pending senão `kycReviewedAt desc`),
  `recentlyReviewed` (só se `filter==='pending'`: 20 CLIENTs APPROVED/REJECTED com `kycReviewedAt` ≤7d,
  senão `[]`), `counts={pending,approved,rejected}` (groupBy `kycStatus` where `role='CLIENT'`).
- **Efeitos:** leitura pura (2 `findMany` + 1 `groupBy`, +1 `findMany` se pending). Sem escrita, sem e-mail, sem alerta.
- **Erros:** `catch` → `500 send('Erro ao carregar fila de KYC')` (controller:130). Gate negado → ver padrão acima.

### `GET /admin/kyc/:userId`
- **Gate:** `isAdmin` + `compliance.view` (`kycRoutes.ts:8`).
- **Ativado por (tela):** **nenhum** — `index.ejs` não tem link/form/fetch para este endpoint
  (grep no EJS só retorna os 3 forms approve/reject/reopen). Endpoint JSON p/ consumo manual/API.
- **Request:** param `userId: string` (obrigatório, via path; `param()` extrai scalar — controller:18-20,142).
  Sem query/body.
- **Resposta do servidor:** JSON (controller:173-193): `{id, name, email, cpf, kycStatus, kycReviewedAt,
  kycReviewedBy, kycRejectReason, createdAt, selfieUrl?, documentFrontUrl?, documentBackUrl?, datavalid?, viewerRole}`.
  Role-gating (controller:42-44,167): MASTER/MANAGER (`canViewFullData`) → CPF cheio + 3 URLs de imagem +
  `datavalid={facial,biographical}` (sidecars `kyc-facial-result.json` / `kyc-biographical-result.json`
  lidos de `storage/kyc/<userId>/` com fallback `public/uploads/documents/<userId>/` via `readSidecar`, controller:22-36);
  SUPPORT → `cpf=maskCpf(cpf)` (`services/kycStorageService`), imagens `undefined`, `datavalid` `undefined`.
- **Efeitos:** leitura (`prisma.user.findUnique` select 13 campos, controller:145-161) + leitura de disco (sidecars,
  só MASTER/MANAGER). Sem escrita.
- **Erros:** usuário inexistente → `404 JSON {error:'User not found'}` (controller:164);
  exceção → `500 JSON {error:'Erro ao carregar detalhes do KYC'}` (controller:196).

### `GET /admin/kyc/:userId/documents/:fileName`
- **Gate:** `isAdmin` + `compliance.view` (`kycRoutes.ts:9`).
- **Ativado por (tela):** **nenhum** — o EJS exibe docs via `<img src="<%= pUser.documentFrontUrl %>">`
  (linhas 183/195/207, URLs públicas), não via este endpoint. Download/visualização direta manual.
- **Request:** params `userId: string` (obrigatório), `fileName: string` (obrigatório, só basename).
  Sem query/body.
- **Resposta do servidor:** arquivo binário via `res.sendFile(path.resolve(...))` (controller:71) com headers
  `X-Content-Type-Options: nosniff` + `Cache-Control: private, no-cache, no-store, must-revalidate`
  (controller:69-70). Ordem: `storage/kyc/<userId>/<safeFileName>` → fallback
  `public/uploads/documents/<userId>/<safeFileName>` (controller:55-63).
- **Efeitos:** leitura de disco. Sem DB, sem escrita.
- **Erros:** traversal (`basename(raw)!==raw` ou contém `..`) → `400 send('Nome de arquivo inválido.')`
  (controller:52); inexistente nos 2 paths → `404 send('Documento não encontrado.')` (controller:66).

### `POST /admin/kyc/:userId/approve`
- **Gate:** `isAdmin` + `compliance.review` (`kycRoutes.ts:10`) — SUPPORT bloqueado.
- **Ativado por (tela):** `index.ejs:256` (só renderizado se `filter==='pending'`, linha 254) —
  `<form action="/admin/kyc/<%= pUser.id %>/approve" method="POST">` + hidden `_csrf` +
  botão `type=submit` label "Aprovar" (ícone `bi-check-lg`) com `onclick="return confirm('Aprovar KYC de <%= pUser.name %>? Os contratos serão ativados.')"`.
- **Request:** param `userId: string` (obrigatório). Sem query; body ignorado (só `_csrf`). Sem `reason`.
- **Resposta do servidor:** `redirect('/admin/kyc')` sempre (controller:237,241) + flash via
  `(req as any).flash?.('success'|'error', ...)` — **chave `success`/`error`, não `success_msg`/`error_msg`**:
  sucesso → `flash('success', 'KYC aprovado! ${activated} contrato(s) ativado(s).')` (controller:236);
  EJS lê `success_msg/error_msg/successMessage/errorMessage` (linhas 33-62), então conferir middleware de mapeamento.
- **Efeitos:** transação `prisma.$transaction(..., {isolationLevel:'Serializable', timeout:10000})`
  (controller:209-232): `user.update → kycStatus='APPROVED'`, `kycReviewedAt=now`, `kycReviewedBy=adminId`
  (sessão ou `'unknown'`), `kycRejectReason=null`; + `subscription.findMany where {userId, status:'PENDING_KYC'}`
  e cada uma → `status='ACTIVE'`. Retorna nº ativados. `logger.info KYC APPROVED...`. Sem notificação, sem e-mail.
- **Erros:** exceção (ex: user inexistente no `update`) → `flash('error','Erro ao aprovar KYC')` +
  `redirect('/admin/kyc')` (controller:240-241). Gate negado → padrão.

### `POST /admin/kyc/:userId/reject`
- **Gate:** `isAdmin` + `compliance.review` (`kycRoutes.ts:11`) — SUPPORT bloqueado.
- **Ativado por (tela):** `index.ejs:262` (só se `filter==='pending'`) —
  `<form action="/admin/kyc/<%= pUser.id %>/reject" method="POST">` + hidden `_csrf` +
  `<input type="text" name="reason" placeholder="Motivo da rejeição..." style="min-width:250px">` +
  botão `type=submit` label "Rejeitar" com `confirm('Rejeitar KYC de ...? Os contratos serão cancelados e parcelas reembolsadas.')`.
  **ATENÇÃO:** o texto do `confirm` está DESATUALIZADO — o controller (comentário linhas 254-257) afirma
  expressamente que reprovar **NÃO cancela nem reembolsa**: contratos continuam `PENDING_KYC`, cliente reenvia docs.
- **Request:** param `userId: string` (obrigatório); body `reason?: string` (opcional —
  `const rejectReason = reason || 'Documentos inválidos ou ilegíveis'`, controller:252). Só `_csrf` além disso.
- **Resposta do servidor:** `redirect('/admin/kyc')` + `flash('success','KYC rejeitado. O cliente foi avisado no app para reenviar os documentos.')`
  (controller:281-282).
- **Efeitos:** transação Serializable 10s (controller:258-277): `user.update → kycStatus='REJECTED'`,
  `kycReviewedAt=now`, `kycReviewedBy=adminId`, `kycRejectReason=rejectReason`; +
  **`notification.create {userId, type:'KYC_REJECTED', title:'Documentos recusados',
  message:'${rejectReason} Reenvie novas fotos nítidas em Validação de Documentos para liberar sua conta.'}`**
  — é o side-effect que avisa o cliente no app. **Sem cancelamento de subscription, sem reembolso, sem e-mail.**
  `logger.info KYC REJECTED...` (controller:279).
- **Erros:** exceção → `flash('error','Erro ao rejeitar KYC')` + `redirect('/admin/kyc')` (controller:285-286).

### `POST /admin/kyc/:userId/reopen`
- **Gate:** `isAdmin` + `compliance.review` (`kycRoutes.ts:12`) — SUPPORT bloqueado.
- **Ativado por (tela):** `index.ejs:277` (só se `filter==='rejected'`, linha 272) —
  `<form action="/admin/kyc/<%= pUser.id %>/reopen" method="POST">` + hidden `_csrf` +
  botão `type=submit` label "Reabrir análise" (ícone `bi-arrow-counterclockwise`) com
  `confirm('Devolver <%= pUser.name %> para a fila de análise?')`. Acima, linha 273-275 exibe
  `Motivo da rejeição: <%= pUser.kycRejectReason || '—' %>`.
- **Request:** param `userId: string` (obrigatório). Sem query/body (só `_csrf`).
- **Resposta do servidor:** `redirect` + flash chave `success`/`error`:
  sucesso → `flash('success','KYC devolvido para a fila de análise.')` + `redirect('/admin/kyc')` (controller:318-319).
- **Efeitos:** `user.update → kycStatus='SUBMITTED'`, `kycReviewedAt=null`, `kycReviewedBy=adminId`,
  `kycRejectReason=null` (controller:307-315). Sem notificação, sem tocar subscriptions.
  `logger.info KYC REOPENED...` (controller:317).
- **Erros:** user inexistente → `flash('error','Usuário não encontrado')` + `redirect('/admin/kyc?filter=rejected')`
  (controller:299-300); `kycStatus!=='REJECTED'` → `flash('error','Só é possível reabrir KYC rejeitado')` +
  `redirect('/admin/kyc')` (controller:303-304); exceção → `flash('error','Erro ao reabrir KYC')` +
  `redirect('/admin/kyc?filter=rejected')` (controller:322-323).

### `POST /admin/kyc/:userId/override`
- **Gate:** `isAdmin` + `compliance.review` (`kycRoutes.ts:13`) — SUPPORT bloqueado. Doc do controller
  diz "MASTER/MANAGER only" (controller:327) mas a rota só exige a capability (que SUPPORT não tem).
- **Ativado por (tela):** **nenhum** — sem form/fetch no `index.ejs`. JSON p/ override manual (Datavalid falhou
  mas admin aprova mesmo assim, ou rejeita). Corpo: `{action:'approve'|'reject', reason?:string}` (controller:339).
- **Request:** param `userId: string` (obrigatório); body JSON `action: string` (obrigatório,
  exatamente `'approve'` ou `'reject'`), `reason?: string` (opcional, embutido em `Manual override by <adminId>[: reason]`,
  controller:345).
- **Resposta do servidor:** JSON, sem redirect/flash. `action==='approve'` → `200 {ok:true, kycStatus:'APPROVED',
  activatedSubscriptions:N}` (controller:370); `action==='reject'` → `200 {ok:true, kycStatus:'REJECTED'}`
  (controller:396).
- **Efeitos:** `approve`: `user.update → APPROVED/reviewedAt/reviewedBy/rejectReason=null` (controller:348-356, **fora
  de transação**) + `subscription.findMany PENDING_KYC` e update individual → `ACTIVE` (controller:358-367),
  `logger.info KYC OVERRIDE APPROVED...`. `reject`: transação Serializable (controller:375-393):
  `user.update → REJECTED + kycRejectReason=overrideNote` + `notification.create {type:'KYC_REJECTED',
  title:'Documentos recusados', message:'${overrideNote} Reenvie novas fotos nítidas...'}` —
  **igual ao reject: notificação KYC_REJECTED ao cliente, sem cancelamento/reembolso** (controller:373-374).
- **Erros:** `action` inválida → `400 JSON {error:'action must be "approve" or "reject"'}` (controller:342);
  exceção → `500 JSON {error:'Erro ao processar override de KYC'}` (controller:399). `update` de user
  inexistente cai no 500.

### `POST /admin/kyc/:userId/retrigger`
- **Gate:** `isAdmin` + `compliance.review` (`kycRoutes.ts:14`) — SUPPORT bloqueado. Doc: "MASTER/MANAGER only"
  (controller:403), rota exige só a capability.
- **Ativado por (tela):** **nenhum** — sem form/fetch no `index.ejs`. JSON p/ re-executar Datavalid com os
  arquivos já armazenados. Corpo: `{step:'facial'|'biographical'}` (controller:412).
- **Request:** param `userId: string` (obrigatório); body `step: string` (obrigatório, exatamente
  `'facial'` ou `'biographical'`). Sem query.
- **Resposta do servidor:** JSON `200 {passed:boolean, errorReason:string|null, rawResponse:any}` nos dois steps
  (controller:464,486). Sem redirect/flash, sem escrita em DB.
- **Efeitos:** `facial` (controller:427-464): exige `user.selfieUrl` + arquivo em disco
  (`process.cwd()+selfieUrl`); `runFacialCheck(cpf, buffer)` (`services/datavalidService`); grava sidecar
  `public/uploads/documents/<userId>/kyc-facial-result.json` `{kycStep:'facial_check', timestamp,
  retriggeredBy:adminId, passed, errorReason, rawResponse}`; + `pushToKycStorage({... fileType:'selfie',
  kycStep:'facial_check'})` (push VPS, fire-and-forget). `biographical` (controller:468-486):
  `runBiographicalCheck(cpf, name)`; grava `kyc-biographical-result.json` (mesmo shape, `kycStep:'biographical_check'`);
  **sem push de imagem** (check puro de dados, controller:484). `logger.info KYC retrigger ...` ambos.
- **Erros:** `step` inválido → `400 {error:'step must be "facial" or "biographical"'}` (controller:415);
  user inexistente → `404 {error:'User not found'}` (controller:423); facial sem selfie cadastrada →
  `422 {error:'No selfie on record for this user'}` (controller:429); selfie fora do disco →
  `422 {error:'Selfie file not found on disk'}` (controller:433); exceção →
  `500 {error:'Erro ao re-executar validação Datavalid'}` (controller:489).
- Imagens do painel via rota de sessão `/admin/kyc/:userId/documents/:fileName` (a rota `/api/...` exige JWT e quebrava o `<img>` com 401 → 'indisponível');  validado por allowlist.
