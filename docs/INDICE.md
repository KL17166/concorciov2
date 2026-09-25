# ÍNDICE — docs do concorciov2
Regra: `CONVENCAO-DOC.md` (todo comportamento novo/mudado atualiza o `.md` no mesmo commit).

## Funções (`docs/funcoes/` — 23)
Lógica de negócio em `server-consorcio/src/application/**`: o que ativa, entradas, saídas, efeitos.
- **Lances:** generateBidPix · createBid · cancelBid · listUserBids · notifyBidPaymentCheck · bidExternalId · parseBidExternalId
- **KYC:** submitKyc · reviewKyc
- **Pagamentos:** generatePayment · listSubscriptionPayments · notifyPaymentCheck · processPaymentWebhook · processBidPaymentWebhook · settlePayment
- **Contratos:** createSubscription · getUserSubscriptions · getSubscriptionDetails · cancelSubscription · contemplateSubscription
- **Suporte:** createTicket · listUserTickets
- **Pixel:** recordTrackingEvent
- **Aprendizado:** learnFromEvent · getRecommendations (algoritmo)

## Endpoints cliente (`docs/api/` — 37)
`MÉTODO-path`: quem ativa, auth/limiter, request, o que o servidor retorna, efeitos.
- **Auth:** POST-auth-register · POST-auth-login · POST-auth-logout · GET-auth-profile · PUT-auth-profile · PUT-auth-password · POST-auth-upload · PATCH-profile
- **Catálogo:** GET-products · GET-products-id
- **Lances:** POST-bids · GET-bids-userId · POST-bids-id-cancel · POST-bids-id-pix · POST-bids-id-payment-check
- **KYC:** POST-kyc-submit · GET-kyc-status · GET-kyc-documents-userId-fileName
- **Pagamentos:** GET-payments-subscriptionId · POST-payments-installmentId-pay · POST-payments-installmentId-pix · POST-payments-installmentId-boleto
- **Contratos:** POST-subscriptions · GET-subscriptions-userId · GET-subscription-subscriptionId · POST-subscriptions-subscriptionId-cancel · POST-subscription-subscriptionId-payment-check
- **Tickets:** GET-tickets · POST-tickets
- **Pixel/notificações:** POST-track · GET-notifications · PATCH-notifications-id-read
- **Recomendação:** GET-recommendations (ranking aprendido)
- **Infra (server-to-server):** POST-webhooks-pixgo · POST-webhooks-sigilopay · GET-health · GET-livez · GET-readyz

## Telas (`docs/telas/` — 15)
Cada tela: o que precisa do servidor, ação → chamada, estados.
- index · welcome · auth-login · auth-register
- checkout-index · checkout-contract · checkout-payment
- consortium-adhesion · consortium-bids · consortium-contracts · consortium-payments · consortium-statement
- products-id · profile-index · profile-kyc

## Relatórios de auditoria/fixes (raiz)
- `AUDITORIA_PRE_PRODUCAO_2026-09-21.md` · `FIXES_APLICADOS_2026-09-21.md` · `TRACKING_PIXEL_2026-09-21.md` · `ALGORITMO_APRENDIZADO_2026-09-21.md`

## Plano de rastreamento (`docs/PLANO-TRACKING.md`)
F1 UTM/ads → F3 outcomes no loop → F5 nudges → F2 pixel anônimo → F6 export/LGPD → F4 segmentos → F7 A/B.

## Sentinela (`.opencode/agents/sentinela.md` — invoque com `@sentinela`)
Guardião do projeto em 5 modos (1ª palavra do pedido): `AUDITAR-BACKEND` (requests
indevidas) · `AUDITAR-FRONT` (XSS/sessão/BFF) · `DOCS` (mantém esta docs/ fiel) ·
`VALIDAR` (veredito VERDE/VERMELHO, nunca conserta) · `FUNIL` (tracking → decisão).

## Painel admin (`docs/admin/` — 16 módulos)
Cada módulo: endpoints (gate + action + efeitos) + telas EJS (vars + forms).
- auth · dashboard · people · clients · users · contracts · payments · bids
- products · reports · security · gateways · kyc · tickets · profile · tracking
