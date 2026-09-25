# ALGORITMO QUE APRENDE — entregue 2026-09-21
Loop estilo TikTok adaptado ao consórcio: exposição → interação → aprendizado → ranking → exposição.

## 1. Rastreamento em todas as telas
- Middleware global `app/middleware/track.global.ts`: TODA navegação logada emite
  `SCREEN_VIEW` (mapa path→tela em allowlist). Telas guest (welcome/auth) não emitem
  (endpoint exige JWT — anti-spam). Mounts duplicados removidos (bids/payment/kyc).
- Telas novas herdam o pixel sem código extra.

## 2. Motor de aprendizado (`learningService.ts` + `learning_weights`)
- A cada evento do pixel, `learnFromEvent` atualiza pesos ONLINE (best-effort):
  - `aff:<user>:PROD:<id>` afinidade (+1 QR/copy, +3 lance criado)
  - `pop:PROD:<id>` popularidade global · `prop:verify/pay` propensão (EMA α=0.2)
  - `conv:qr_verify`, `conv:verify_paid` conversão global (EMA)
- Telas de pagamento cobertas: checkout/payment, consortium/adhesion e
  consortium/payments emitem QR/copia/verifica com `productId`; detalhe do produto
  emite view com identidade; `profile` entrou no enum de telas.
- Prova ao vivo (jornada sintética, dados limpos após): cliente focado na CG 160 Fan
  gerou `aff=6/pop=5/prop:verify=1` e o ranking a colocou em 1º ("baseado no seu
  interesse", score 13.79) contra 0.00 dos demais — o algoritmo discrimina.
- `GET /api/recommendations`: `score = 2·afinidade + ln(1+pop) + 0.5·propensão`;
  sem histórico → popularidade → ordem do admin. Epsilon-greedy 15% embaralha o
  top-8 (`explore:true`) para descobrir gostos novos — é assim que ele melhora sozinho.
- App aplica via `recOrder` em `bestOffers`/`popularProducts` (fallback admin intacto).

## 3. Dashboard (`/admin/dashboard` — seção Aprendizado)
- Funil 7d + conversão telas→"já paguei" + taxas QR→verifica e verifica→pago (pesos EMA)
- Top produtos por interesse real (30d) + nº de pesos aprendidos + link p/ Tracking.

## 4. Validação
- Migration `learning_weights` OK; `tsc` OK; jest 74/74 (3 testes novos, estáveis em 3 rodadas);
  EJS compila; smoke ao vivo: evento→pesos→ranking ranqueado certo; BFF OK; UP.
- Como evoluir: `BID_CREATED` já alimenta; próximo passo seria propensão por segmento
  (horário/categoria) e nudge automático ("seu produto em alta") via notifications.
