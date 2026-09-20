# Histórico da sessão — 19/09/2026

Tudo que foi feito nesta sessão (backend `server-consorcio` + web `zuvio-web` + `gateways-codadas`).

## 1. Fix: `POST /api/subscriptions` 500 (fotos estourando o body)
- Causa: tela de contrato envia 3 fotos em base64 no JSON; `express.json({ limit: '2mb' })` estourava
  (`PayloadTooLargeError`, confirmado nos logs).
- `server-consorcio/src/app.ts`: `express.json` `2mb` → `15mb`, urlencoded `1mb` → `5mb`.
- `server-consorcio/src/middlewares/errorHandler.ts`: `entity.too.large` agora retorna
  `413 PAYLOAD_TOO_LARGE` com mensagem amigável (antes caía no 500 genérico).

## 2. Gateways Eldorado + G2G plugadas de verdade
- Adapters novos: `src/integrations/payments/EldoradoAdapter.ts`,
  `src/integrations/payments/G2gAdapter.ts` + `ExternalGatewayLimits.ts`
  (token `X-Gateway-Token`, limite por minuto, min/max por cobrança, teto diário,
  1 concorrente por vez, entram no failover existente).
- `PaymentGatewayFactory`: Eldorado/G2G resolvidas antes do fallback sandbox
  (bug: `environment === 'sandbox'` engolia tudo e gerava PIX fake "Cicrano de Tal").
- `gatewayController` + painel `/admin/gateways`: seed, ícones, labels e hints das 2 novas.
- `eldoradov2/eldorado_pix_api.py`: auth por token (`ELD_API_TOKEN`), paths relativos ao arquivo.
- `g2g/src/server.ts`: auth por token (`G2G_API_TOKEN`) em `/api` + endpoint novo
  `POST /api/pay/pix-direct {amount, cpf, characterName}` (pedido + PIX juntos).
- Cópia modificada em `concorciov2/gateways-codadas/` (originais em `Documents/` revertidos).
- `.env`: `ELDORADO_*`, `G2G_*` (URLs, tokens, limites). Tokens também nos units systemd.
- systemd (linger ativo): `eldorado-gateway` (:8765), `g2g-gateway` (:8766),
  `consorcio-backend` (:3030) — sobem no boot, `Restart=always`.
- Sessão Eldorado: transplantada de `Documents/eldoradov2/.sessao`, auto-refresh ok.
  Bug achado e corrigido: `eldorado_auth.py`/`eldorado_pix_compra.py` salvavam a sessão
  no caminho antigo hardcoded (lê num lugar, escreve noutro) — agora usam `_BASE_DIR`
  + `ELD_DATA_DIR` no unit.
- Diagnóstico de CPF: Prime/DLocal barra CPF inexistente (`CHECKOUT_FAILURE`).
  PIX R$640 gerado com sucesso (cobrado R$637,41) usando CPF válido.

## 3. Desconto Eldorado no site
- `PaymentResult.requestedAmount` + `generatePayment` preenche com o valor original;
  respostas `/pix` e `/boleto` incluem `requestedAmount`.
- `checkout.ts` guarda; `payment.vue` e `adhesion.vue` mostram selo
  **"Desconto de R$ X"** quando o total situations vier menor.

## 4. Verificar Pagamento notifica o dev
- Backend: `POST /api/subscription/:id/payment-check` → `SystemAlert PAYMENT_CHECK/INFO`
  (dedupe 5min) + log. BFF proxy + disparo no clique (polling automático não notifica).
- Admin: sininho global no sidebar (badge, dropdown, dispensar, marcar todas),
  respeita tema claro/escuro; seção inline antiga do dashboard removida.

## 5. Boleto removido (temporário)
- `payment.vue`, `adhesion.vue`, `payments.vue`: abas/seções/branch de boleto removidos (só PIX).

## 6. Regra de ordem das parcelas
- Backend `generatePayment`: adesão sempre livre; N>1 normal só se for a atual;
  `anticipate: true` exige adesão paga. Schema + BFF + `paymentStore.generatePix(id, token, anticipate)`.
- `markInstallmentAsPaid`: ordem relaxada para "só exige adesão" (antecipação compensa).
- `payments.vue` (cliente) reorganizada: card do contrato, contadores
  Pagas/A pagar/Agendadas, hero só da atual, sanfonas, guard de adesão mantido.
- Admin Financeiro: card **A Pagar** + linha Agendadas, abas **Pagos/Adesões/Pendentes/Atrasados**
  (default Adesões), selos A pagar/Agendada, **Todos exclui agendadas**,
  totais gerais só contam pós-adesão, hora no vencimento/pagamento.
- Adesão nunca vai para Atrasado (modal esconde a opção + backend barra com aviso).
- `POST /admin/payments/:id/approve|reject` criadas de verdade (botões apontavam p/ 404);
  valem p/ qualquer `*_WAITING_APPROVAL`. Botão **Expirar** manual adicionado.
- `PaymentAttempt` (migration): cada geração expira a anterior; baixa marca PAID;
  selo "Nª via (anterior expirada)" / "PIX expirado" no admin.
- Dashboard sem duplicar o Financeiro: Adesões aguardando, Atendimentos abertos,
  KYC em análise, Contratos por mês/status, Atendimentos recentes.

## 7. Tickets de suporte (cancelamento)
- Model `SupportTicket` + migration. Cliente: `POST/GET /api/tickets` (dedupe 24h).
- Admin: `/admin/tickets` (lista, responder, encerrar) + link no sidebar + capabilities
  `support.view/manage` (SUPPORT incluso).
- Frontend: página `/consortium/contracts` (cancela direto se só adesão, senão abre ticket).

## 8. Menu do usuário + perfil
- Header: chip clicável com dropdown (dados, CPF, selo KYC, Meus dados, Documentos/KYC,
  Meus contratos expansível com prévia + contador, Sair avulso mantido).
- Perfil: caixinha **Meus dados** (nome/CPF leitura, e-mail/telefone editáveis via
  `PATCH /api/profile` novo), card **Meus contratos**, paleta preto/branco/laranja;
  removidos "Contratos Ativos" e "Ofertar Lance" do perfil.
- KYC: `/profile` e `/kyc` sincronizam o status real do servidor (sessão defasada mostrava
  "Pendente" após rejeição).
- Dev panel: preset Mariana com CPF novo + **cache local de fotos** (liga/desliga, x/3, limpar).
- Checkout/contrato: header sem radius/borda no checkout, com radius/borda no contrato;
  aviso duplicado do contrato sem radius; tela de pagamentos bloqueada centralizada, selo flat.
- Adesão: gera o PIX sozinha ao abrir + botão GERAR PIX se falhar.
- Mojibake `â"€` limpo em `checkout/index.vue` e `authController.ts` (680 trechos).

## 9. Dados de teste
- Mariana Oliveira → CPF novo `330...62` (login com o CPF novo, mesma senha).
- Login admin correto: `admin.master@katari.com.br` (senha no `.env`, `ADMIN_PASSWORD` — o `admin@katari.com` de lá não existe no banco).
- KYC Mariana: REJECTED (um contrato novo dela falha com `KYC_REJECTED` — esperado).

## Pendências / próximos
- `G2G_CHARACTER_NAME` vazio no `.env` (adapter G2G retorna 503 claro até configurar).
- Sessões Eldorado/G2G expiram (refresh 30d / cookies) — refazer login quando cair.
- Boleto: reimplementar quando programado.
- `SIGILOPAY` credenciais inválidas (balance 401) — fora do escopo.
