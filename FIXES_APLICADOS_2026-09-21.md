# FIXES APLICADOS — itens 5, 6, 7, 9, 10 (2026-09-21)
Referência: `AUDITORIA_PRE_PRODUCAO_2026-09-21.md`. Serviços reiniciados e validados após as mudanças.

## Validação (tudo verde)
- `tsc --noEmit` backend: OK · `tsc --noEmit` g2g: OK · `py_compile` eldorado: OK · esbuild `auth.ts`: OK
- `jest`: **9 suites, 65/65 testes passando** (incl. 1 teste novo B5 + mock corrigido do installmentService)
- Migration: tabela `bid_payments` criada no Postgres (`prisma db push` + `generate`)
- Smoke em produção local: `/health` OK · JWT `exp−iat` = **15 min** · CORS `null`/`evil.com` bloqueados, `localhost:3001` permitido · webhook sem assinatura → 401 · `POST /api/bids/:id/pix` inexistente → 404 limpo · Eldorado CORS escopado + `?token=` → 401 · g2g online · front `302 → /welcome 200`

---

## 5. PIX de lance órfão → CORRIGIDO
- `prisma/schema.prisma`: novo model `BidPayment` (+ relação `Bid.payments`): `provider, externalId, amount, status (RESERVED→ACTIVE→PAID | EXPIRED | CANCELLED), copyPaste, expiresAt, paidAt`.
- `application/bids/generateBidPix.ts` (reescrito): idempotência real — voucher `ACTIVE` válido é **reexibido** (sem nova cobrança); emissão usa trava `Serializable` (RESERVED + 429 se já houver emissão em voo); expira vouchers antigos; registra `BidPayment` com `provider/externalId/copyPaste/expiresAt`; falha na gateway marca RESERVED→EXPIRED.
- `application/payments/processBidPaymentWebhook.ts` (novo): liquidação de `external_id = bid-<uuid>` — valida lance, voucher, valor **simétrico** (±5%), expiração (410 se vencido), liquida em tx atômica + `auditLog`; pagamento de lance cancelado gera alerta `BID_ORPHAN_PAYMENT` CRITICAL.
- `application/payments/processPaymentWebhook.ts`: roteia prefixo `bid-` p/ liquidação de lance (fim do 404 garantido); validação de valor de parcela também ficou simétrica (rejeita >105%).
- `application/bids/cancelBid.ts`: cancelamento em tx + **invalida vouchers** (`ACTIVE/RESERVED → CANCELLED`) + auditoria best-effort.
- `integrations/payments/{Eldorado,G2g,Sandbox}Adapter.ts`: guard `bid-` — não tocam mais `installments` em pagamento de lance (o Sandbox **estourava** e o PIX de lance falhava sempre nesse modo).
- `routes/webhookRoutes.ts` (carona necessária): **fail-closed** — sem `webhookSecret` configurado, nenhum webhook PixGo é aceito (antes, qualquer header autenticava); HMAC incondicional + `Buffer.from` em try/catch (assinatura não-hex → 401, não 500).
- `__tests__/bidUseCases.test.ts`: mocks atualizados p/ tx + **teste novo** (vouchers invalidados no cancel).

## 6. MANAGER→MASTER → CORRIGIDO
- `controllers/admin/adminUserController.ts` (legado): `createUser`/`updateUser` agora passam por `resolveRoleOrDeny` (`canManageRole` — só MASTER atribui papel privilegiado) + trava anti auto-rebaixamento; tentativa vira 403 com flash + warn no log.
- `controllers/admin/peopleController.ts` (`updateAccess`, rota ativa): mesma trava `canManageRole` como defesa em profundidade (a rota já exigia `people.change_role`, exclusivo de MASTER).

## 7. REFUNDED fictício + ativação sem KYC → CORRIGIDO
- `controllers/admin/kycController.ts`:
  - `rejectKyc`: **fim do `REFUNDED` sem estorno**. Parcelas PAID → `REFUND_PENDING` + alerta CRITICAL `KYC_REFUND_REQUIRED` (total + responsável) p/ o financeiro concluir o estorno **na gateway**; PENDING/OVERDUE → CANCELLED. Tudo em **uma transação**.
  - `approveKyc`: user + ativações de `PENDING_KYC` na mesma tx (fim do estado parcial).
- `controllers/admin/paymentsController.ts` (`updatePayment`):
  - Ativação manual de adesão respeita KYC (sem `APPROVED` → `PENDING_KYC`, igual ao `markInstallmentAsPaid`).
  - Reversão `PAID → não-PAID`: só **MASTER** + **motivo ≥ 8 chars** (nº do comprovante), registrado no `auditLog`.
  - `paymentMethod` restrito a `/^[A-Z0-9_\-]{2,32}$/` (fim do XSS/log-injection persistido); `paymentDate` validada (fim do 500 por `Invalid Date`).
  - Caronas: filtro `month` validado por regex (mês inválido é ignorado, não 500) + query mensal parametrizada (`$1`, fim da interpolação em `$queryRawUnsafe`).

## 9. CORS + JWT + seed → CORRIGIDO
- `src/app.ts`: `Origin: null` **não** é mais aceito com credentials (`file://`/sandbox não fazem chamadas autenticadas); origem legítima segue funcionando.
- `eldorado_pix_api.py`: CORS `*` → origem única (`ELD_ALLOWED_ORIGIN`, default `127.0.0.1:3030`) + `Vary: Origin`; **removido `?token=`** (só header `X-Gateway-Token`); página `/` sem ACAO.
- `g2g/src/server.ts`: `cors()` aberto → allowlist (`G2G_ALLOWED_ORIGINS`); **removido `?token=`**; SSE com origem restrita; fim do CPF default hardcoded no `/api/buy-g2g/live` (CPF do cliente passa a ser obrigatório).
- `dev-fotos/server.cjs` (dev): removido ACAO `*`.
- JWT: `JWT_EXPIRES_IN 7d → 15m` (`.env` + schema `env.ts` com default `15m`); `authController` usa `env.JWT_EXPIRES_IN` (fim da leitura de `process.env` bruto); Redis TTL deriva do `exp` automaticamente. **Sessões antigas de 7d expiraram no restart.**
- `zuvio-web/app/stores/auth.ts`: **fim do JWT em `localStorage`** (só memória Pinia + cookie de 15 min; resquícios antigos são apagados no login); cookie 7d → 15 min.
- `prisma/seed.ts`: conta `cliente@teste.com/cliente123` **só** com `ALLOW_TEST_SEED=true` e fora de produção; `ADMIN_CPF` validado (mod-11, fim do `00000000000`); `authController`: **removido bypass de KYC por CPF** (`11111111111`); logs/auditoria com CPF mascarado (`maskCpf`).
- `.env.example` (server) e `eldoradov2/.env.example`: segredos reais trocados por placeholders.

## 10. CVEs → CORRIGIDO
- `multer 2.1.1 → 2.4.0` (cobre **CVE-2026-5079**; `npm ls` confirma) + `limits` endurecidos (`parts/fields/fieldNameSize/fieldSize`) em `uploadMiddleware.ts`.
- `requests 2.32.3 → 2.34.2`, `urllib3 2.3.0 → 2.8.0` (`pip --break-system-packages`; cobre **CVE-2024-47081**).

---

## ⚠️ Ações pendentes do OPERADOR (não dá p/ fazer sozinho sem quebrar o ambiente)
1. **Rotacionar segredos vazados** (estão no histórico do git): `JWT_SECRET`, `SESSION_SECRET`, `PASSWORD_PEPPER`, `REQUEST_SIGNING_SECRET`, `PIXGO_API_KEY/WEBHOOK_SECRET`, `SIGILOPAY_*`, `ELDORADO/G2G_API_TOKEN`, `PAYLOAD_*`, `ENCRYPTION_BYPASS_SECRET` + `git filter-repo`/BFG nos `.env.example` + revogar no provedor. ( operating services usam os valores atuais — troque com janela de restart.)
2. **`ADMIN_CPF`/`ADMIN_PASSWORD`**: o seed agora recusa `00000000000` — defina CPF válido + senha 24+ e rode o seed; ative 2FA do MASTER.
3. **Reembolsos `REFUND_PENDING`**: concluir estornos na gateway e só então marcar `REFUNDED` com `providerRefundId` (fluxo manual até o item de automação sair do backlog).
4. **Restante da auditoria** (fora do escopo pedido): HMAC do BFF em `shared/` (F1), `DevFloatingTool` com CPFs/senha no bundle (F3), open redirect `?redirect=` (F4), IDOR no BFF (F5), upload BFF sem allowlist (F7), Redis/Postgres sem senha (B2), failover double-charge em parcelas (A1), `katari_docs_cache` com biometria em disco (F11), `overrideKyc` reject deixando `PENDING_KYC` órfão.

## 11. Reprovar KYC ≠ reembolsar — notificação de reenvio no app (ajuste de produto)
- `rejectKyc`/`overrideKyc(reject)`: **não cancelam contratos nem tocam em parcelas/reembolso**.
  Marcam `REJECTED` + motivo e criam `Notification(KYC_REJECTED)` em tx atômica; o contrato
  continua `PENDING_KYC` e o cliente reenvia (o `submitKyc` já aceitava `REJECTED→SUBMITTED`).
- Nova tabela `notifications` + `GET /api/notifications` (só do dono, take 20 + `unreadCount`)
  + `PATCH /api/notifications/:id/read` (uuid validado, `updateMany` dono-escopado) + BFF espelho.
- Front: store `useNotifications`, **banner global** no `app.vue` ("Documentos recusados →
  Reenviar documentos", some ao dispensar/reenviar), `kyc.vue` marca como lida ao resubmeter
  + evento `SCREEN_VIEW kyc` no pixel. Tela do KYC já exibia motivo + formulário de reenvio.
- Validação: migration OK, `tsc` OK, jest 71/71, smoke (401/200/400/marked:0, BFF 200/400), UP.

## 12. Pós-fixes (CORS null + admin)
- `Origin: null` (webview sandbox/Capacitor/file) liberado SOMENTE em dev via
  `ALLOW_NULL_ORIGIN` (default true); produção continua 403. Erro CORS agora
  responde 403 (não mais 500) — `errorHandler` respeita `statusCode` 403.
- `.env ADMIN_EMAIL` corrigido para `admin.master@katari.com.br` (o anterior não
  existia no banco) + senha do MASTER redefinida e login verificado (302 → /admin/dashboard).
