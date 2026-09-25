# PIXEL PRÓPRIO + FLUXO DO LANCE — entregue 2026-09-21
Responde: (1) PIX do lance pós-aprovação gera certinho com proteções? (2) rastreio de telas/cliques.

## 1. PIX do lance: SIM, com proteções (verificado de ponta a ponta)
Fluxo: admin aprova (`APPROVED`) → cliente abre Lances → paga → `POST /api/bids/:id/pix`
→ `generateBidPix` → failover de gateways → QR no modal.

Proteções ativas (código + smoke):
- Dono confere (`403` p/ lance alheio), só `APPROVED` gera (`400` caso contrário),
  **contrato `CANCELLED` não gera** (gap D4 fechado hoje).
- Idempotência: voucher `ACTIVE` válido é **reexibido** (sem nova cobrança);
  duplo clique simultâneo → trava `Serializable` (2º recebe `429`).
- Voucher registrado em `bid_payments` (provider, externalId, copia-e-cola, expiração 30min).
- Webhook liquida `bid-<uuid>` (fim do 404/valor órfão); valor validado ±5%;
  voucher expirado → `410`; pagamento de lance/contrato cancelado → alerta CRITICAL.
- Cancel invalida vouchers pendentes; PixGo fail-closed (sem secret = 500).
- Smoke: token 15m, `pix` de lance inexistente → 404 limpo, `payment-check` inexistente → 404.

**Ressalva Eldorado (manual):** webhook automático nunca chega — a liquidação é a
confirmação manual em **Lances → nova tela "Pagamentos de Lances"**
(`GET /admin/bids/payments`, filtro por status, botão **Confirmar baixa** com
trava: só `ACTIVE`, não-expirado, lance/contrato não-cancelado + `auditLog`).
Antes, o admin nem **via** os vouchers — agora vê e baixa.

## 2. Pixel próprio (tracking_events)
Tabela `tracking_events` (userId, event, screen, entityType, entityId, metadata ≤2KB,
ip, UA ≤512; índices por evento e usuário; sem PII além do userId).

- `POST /api/track` (auth + `trackingLimiter` 200/15m por usuário): allowlist de
  6 eventos × 8 telas × 3 entidades; userId sai do JWT (sem spoof); inválido →
  `200 recorded:false` (nunca quebra o app).
- BFF `POST /api/track` revalida tudo (400 p/ evento/tela/entidade/uuid/metadata ruins).
- Eventos instrumentados:
  - `bids.vue`: `SCREEN_VIEW` (montagem), `GENERATE_QR_CLICK` + `QR_SHOWN` (modal,
    com `metadata.reused`), `COPY_PIX_CLICK`, `VERIFY_PAYMENT_CLICK` (botão
    "Entendi, já realizei o pagamento" → também chama o payment-check do lance).
  - `payment.vue` (adesão): `SCREEN_VIEW`, `VERIFY_PAYMENT_CLICK` (+ `PAYMENT_CONFIRMED_VIEW`
    quando o polling confirma).
- Botão "Já paguei" do lance: `POST /api/bids/:id/payment-check` → alerta
  `BID_PAYMENT_CHECK` (dedupe 5min) + evento no pixel. (Adesão já tinha o equivalente.)
- Status do voucher na UI: selo "PIX gerado — toque em Já realizei" (`ACTIVE`) /
  "Pagamento confirmado" (`PAID`) na tela de lance aprovado.
- Admin **Tracking** (`/admin/tracking`, `reports.view`): funil 6 etapas + conversão
  telas→"já paguei" + usuários únicos + 100 eventos recentes (filtro por evento e 7/30/90d).
- CPF mascarado também no alerta de adesão (`notifyPaymentCheck`).

## 3. Validação
- Migration `tracking_events` aplicada; `tsc` backend OK; `jest` 71/71 (6 testes novos
  de schema do pixel); EJS novos compilam; BFF 200/400/404 corretos; serviços UP.

## 4. Limites conhecidos (próximos passos)
- `welcome` (guest) não é rastreada — `/api/track` exige login (anti-spam).
  P/ ads top-of-funnel: criar pixel anônimo assinado (fingerprint + HMAC) depois.
- Polling de 8s do `payment.vue` não gera evento (ruído); só o clique e a confirmação.
- PixGo automático um dia: corrigir `webhook_url` (`/webhooks` → `/api/webhooks`, item B4
  da auditoria) antes de confiar em liquidação automática de lance.
- `overrideKyc` reject ainda não cancela contratos nem alerta estorno (diverge do
  `rejectKyc`); `performDraw` aceita `numberOfWinners` negativo — backlog da varredura.
