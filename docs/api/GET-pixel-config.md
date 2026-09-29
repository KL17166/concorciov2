# GET /api/pixel-config
- **Ativado por:** plugin `analytics.client.ts` do front (via BFF `server/api/pixel-config.get.ts`)
  - Handler: `getPixelConfig` (`controllers/api/trackingController.ts`) — sem auth
- **Auth / rate-limit:** público (só IDs, sem tokens); `generalLimiter` do app
- **Resposta:** `200 { ga4Id, metaPixelId, tiktokPixelId }` — só pixels `enabled` com ID preenchido (painel `/admin/tracking`, só mestre); resto vem `""`. Falha interna → JSON com strings vazias (front usa fallback do env).
- **Efeitos:** leitura pura (`pixelConfig.findMany`). Sem escrita.
