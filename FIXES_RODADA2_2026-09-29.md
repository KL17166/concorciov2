# FIXES RODADA 2 — falhas da auditoria corrigidas 2026-09-29
Verificação prévia no código confirmou abertos: B4, A1, A5 (só API), M3 (forma),
M8, A11 (3 pontos), A13 (parcial), M7. B1/B2/B8 seguem com o OPERADOR
(rotação+filter-repo, credenciais infra, step-up de saque).

## Corrigido (código + smoke)
- **B4 callback PixGo:** adapter enviava `${BASE}/webhooks/pixgo` (404 no provedor);
  agora `buildWebhookUrl()` central (`src/integrations/payments/webhookUrls.ts`) →
  `/api/webhooks/:provider`. SigiloPay migrado junto.
- **A1 duplo-PIX:** gateway era chamada antes de registrar tentativa. Agora lock Redis
  `pay:gen:{id}` (concorrente → 409) + reserva RESERVED antes da gateway; sucesso
  promove a ACTIVE, falha expira. Sem Redis segue com warn.
- **A5 userId traversal:** `GET /api/kyc/documents/:userId` validava só fileName.
  userId agora restrito a `[A-Za-z0-9_-]{1,64}` (admin já tinha).
- **M3 SQL unsafe:** 9× `$queryRawUnsafe` → `$queryRaw` tipado (já sem interpolação;
  agora impossível interpolar sem parâmetro).
- **M8 register BFF:** `register.post.ts` descartava o body (cadastro pelo app quebrado).
  Agora lê/valida/encaminha allowlist (nome, e-mail, CPF 11d, senha ≥8). Smoke: 201
  com role CLIENT mesmo enviando `role: MASTER`.
- **A11 XSS painéis:** `gateways/index.ejs` (msg do servidor via `textContent`),
  `products/index.ejs` (`imageUrl` com `escapeHtml`), `products/form.ejs` (escape `<`/`>`).
- **A13 financeiro:** produto (preço>0, tipo do enum, taxa 0–100, create+update);
  sorteio (`Math.max(1, ...)`); lance 0% rejeitado (`gt(0)` — já era inócuo pelo
  amarra valor=crédito×%±0,05). Webhook `valueToPay ±1%` e pixKey: NÃO mexidos
  (regra de desconto/antecipação exige contexto de negócio — validar com operador).
- **M7 open redirect:** `shared/utils/redirect.ts` (`safeRedirect`: só path `/` interno)
  aplicado em login/register.

## Verificação
- `tsc` limpo; **jest 91/91**; backend restartado.
- Smoke live: `/admin/payments` 200 (SQL novo), `/admin/tracking` 200, register BFF
  201→role CLIENT (usuário de teste removido), lance 0% → 400.
- Docs atualizados: `docs/funcoes/generatePayment.md`, `docs/api/{POST-auth-register,
  GET-kyc-documents-userId-fileName}.md`.
