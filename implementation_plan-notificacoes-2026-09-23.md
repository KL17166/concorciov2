# Plano de Implementação: Central de Notificações + fluxo atendente→gerente + verificação manual PIX (2026-09-23)

Status: APROVADO pelo operador em 2026-09-23. Decisões: EJS admin atual + live SSE/polling + SUPPORT=atendente / MANAGER=gerente + fase 1 completa.

## 1. Objetivo

Trocar o gerenciamento atual de notificações (banner KYC + sino global sem dono) por um fluxo com controle:
atendente atende cliente e faz/propõe contrato → gerente aprova; pagamento de gateway que precisa de verificação manual cai numa tela de conferência decente.

## 2. Base documental (mds que ajudam)

- `docs/CONVENCAO-DOC.md` — regra permanente: criou/mudou comportamento → atualiza o `.md` no mesmo commit. Sem `.md`, task não está pronta.
- `docs/INDICE.md` — mapa de tudo (funcoes/api/telas/admin).
- `docs/admin/kyc.md` — fila KYC, gates `compliance.view/review`, forms approve/reject/reopen.
- `docs/admin/bids.md` — 10/10 rotas bids, travas do `confirmBidPayment`, gap `payments.ejs` invisível.
- `docs/admin/payments.md` — padrão a copiar: `*_WAITING_APPROVAL` + Aprovar/Rejeitar/Expirar + trava MASTER+motivo≥8. Nota: não existe `REFUND_PENDING` no código.
- `docs/api/GET-notifications.md`, `PATCH-notifications-id-read.md` — contrato cliente atual.
- `docs/funcoes/notifyBidPaymentCheck.md`, `notifyPaymentCheck.md`, `reviewKyc.md`, `submitKyc.md` — quem cria alerta hoje.
- `FIXES_APLICADOS_2026-09-21.md §11` — origem do `Notification(KYC_REJECTED)` + banner; `§7` — proposta antiga de `REFUND_PENDING` nunca codada.
- `TRACKING_PIXEL_2026-09-21.md`, `ALGORITMO_APRENDIZADO_2026-09-21.md` — eventos `VERIFY_PAYMENT_CLICK`.

## 3. Estado atual (onde mexe)

- Cliente: `server-consorcio/prisma/schema.prisma:239-252` (`Notification`, só `KYC_REJECTED`), `src/routes/api/notificationsRoutes.ts`, `src/controllers/api/notificationsController.ts`, `zuvio-web/app/stores/notifications.ts`, banner `zuvio-web/app/app.vue`.
- Admin: `SystemAlert` (`schema.prisma:356-369`), criação em `src/application/payments/notifyPaymentCheck.ts`, `src/application/bids/notifyBidPaymentCheck.ts`, `src/services/paymentFailoverService.ts`, `src/application/payments/processBidPaymentWebhook.ts`; sino `src/views/partials/sidebar.ejs`, global `src/routes/admin/index.ts:48-66`, leitura `src/controllers/admin/dashboardController.ts:186-226`.
- Papéis: `src/config/roles.ts`, `src/security/adminCapabilities.ts` (MASTER/MANAGER/SUPPORT/CLIENT; SUPPORT vê, não aprova).
- Contrato/KYC: `src/application/subscriptions/createSubscription.ts`, `src/services/installmentService.ts`, `src/controllers/admin/kycController.ts`, rotas `src/routes/admin/kycRoutes.ts`, `contractRoutes.ts`; telas EJS `src/views/pages/kyc/index.ejs`, `contracts/*.ejs`; cliente `zuvio-web/app/pages/profile/kyc.vue`, `consortium/contracts.vue`.
- PIX manual: gateways `gateways-codadas/eldoradov2/eldorado_pix_api.py`, `gateways-codadas/g2g/src/server.ts`; backend `src/application/bids/generateBidPix.ts`, `cancelBid.ts`, `src/controllers/admin/bidsController.ts:209-319`, rotas `src/routes/admin/bidRoutes.ts`, tela `src/views/pages/bids/payments.ejs`; cliente `zuvio-web/app/pages/consortium/bids.vue`, `checkout/payment.vue`.

## 4. Mudanças propostas

### 4.1 Modelo (Prisma + migration)
- `SystemAlert` += `status OPEN|ACK|IN_PROGRESS|RESOLVED|DISMISSED` (default OPEN), `assignedTo String?`, `assignedAt DateTime?`, `resolvedAt DateTime?`, `entityKind String?`, `entityId String?`, `claimToken String?`.
- Novos `type`: `KYC_SUBMITTED`, `CONTRACT_PROPOSAL`, `PAYMENT_MANUAL_REVIEW`, `REFUND_REQUEST`, `TICKET_NEW`. Manter antigos.
- Backfill: `read=false→OPEN`, `read=true→RESOLVED`.
- `AuditLog`: passar a gravar `KYC_PROPOSED/APPROVED/REJECTED`, `CONTRACT_PROPOSED/APPROVED`, `BID_PAYMENT_CONFIRMED_MANUAL/REFUSED/REFUNDED`, `ALERT_CLAIMED/ASSIGNED/RESOLVED` (adminName+IP+motivo).

### 4.2 Fluxos
- Atendente (SUPPORT): cria contrato / propõe KYC approve / propõe baixa → alerta OPEN na fila do gerente.
- Gerente (MANAGER): fila → claim (vira dono) → Aprovar / Recusar com motivo obrigatório → RESOLVED + notifica atendente + cliente.
- PIX manual (Eldorado/G2G sem webhook): "Já paguei" → `*_PAYMENT_CHECK` com join no voucher → gerente confere: Confirma (modal valor conferido+conta+anexo) / Recusa (motivo→EXPIRED+avisa cliente) / Estorna (só PAID de bid CANCELLED, dupla aprovação MANAGER+MASTER).

### 4.3 Telas (EJS, copiar padrão `payments/index.ejs`)
1. `GET /admin/notifications` — Central: filtros tipo/status/só-meus/sem-dono/busca, ordenação expira-primeiro, paginação, Claim/Liberar, deep-link `?alertId=`. Sidebar + badge OPEN.
2. `/admin/bids/payments` v2 — colunas voucher/bid/contrato-grupo-cota, CPF mascarado+email, gateway+externalId, gerado-em+expira countdown, esperado-vs-conferido, selo "Já paguei"; filtros busca/gateway/só-com-Já-paguei; timeline + audit inline.
3. `/admin/kyc` v2 — SUPPORT "Propor aprovação" → `CONTRACT_PROPOSAL`; MANAGER aprova/rejeita com motivo + histórico.
4. Sino — lê OPEN/ACK com assignedTo, click → `/admin/notifications?alertId=` ou voucher/contrato via entityKind/entityId. `read-all` vira "dispensar meus".
5. Cliente (mínimo) — texto "confirmação manual em até X min", poll status lance, "Já paguei" travado até copiar código.

### 4.4 Endpoints novos (`isAdmin+capability+CSRF`)
- `GET /admin/notifications?status&type&q&assignee&page`
- `POST /admin/notifications/:id/ack|assign|resolve|dismiss` (resolve com recusa/estorno exige motivo≥8)
- `POST /admin/kyc/:userId/propose` (SUPPORT)
- `POST /admin/bids/payments/:id/refuse {motivo}`, `POST /:id/refund-request`, `POST /:id/refund-confirm` (dupla)
- `GET /admin/notifications/stream` (SSE mesma sessão; fallback polling 15s no sino)

### 4.5 Capabilities (sem role novo)
- SUPPORT: `notifications.view` + propor/claim/responder ticket. Sem approve.
- MANAGER: `notifications.manage` + `compliance.review` + `bids.manage` + `payments.manage`.
- MASTER: tudo + regressão PAID→não-PAID + `people.change_role`.

## 5. Ordem de execução

1. Migration + backfill + generate.
2. Helpers `claimAlert/transitionAlert` (Serializable, idempotente, AuditLog).
3. Central + sidebar + sino deep-link.
4. `payments.ejs` v2 + refuse/refund + modal.
5. `kyc/index.ejs` propose + motivo + histórico.
6. SSE + fallback polling.
7. Cliente textos + poll + trava botão.
8. Jest + tsc + smoke.
9. Docs + vault (ver §7).

## 6. Verificação

- `tsc --noEmit` backend + g2g, `py_compile` eldorado.
- `jest` (manter 71/71 + novos: claim race, dupla aprovação, refuse sem motivo=400, SUPPORT aprova=403).
- Smoke: proposta SUPPORT→OPEN, claim, approve/recusa, PIX confirma/recusa/estorno, sino badge, SSE.
- Pronto quando: atendente nunca aprova sozinho; todo ato tem dono+motivo+audit; voucher rastreável do sino à baixa.

## 7. Anotação nos mds no fim (obrigatório pela CONVENCAO-DOC)

No mesmo commit da entrega, atualizar:
- `docs/admin/notifications.md` (novo), `docs/admin/kyc.md`, `docs/admin/bids.md`, `docs/admin/payments.md` (se tocar).
- `docs/funcoes/*` novos, `docs/api/*` novos, `docs/telas/*` tocadas, `docs/INDICE.md` (contadores).
- Raiz: apêndice `CENTRAL_NOTIFICACOES_2026-09-23.md` ou seção em `FIXES_*` + link no INDICE.
- Vault: `memory_save projetos/concorciov2-notificacoes` + diário.
