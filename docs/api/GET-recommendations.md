# GET /api/recommendations
- **Ativado por:** `consortiumStore.fetchRecommendations` (após `loadHomeData`) → ordena `bestOffers`/`popularProducts`
  - BFF espelho: `zuvio-web/server/api/recommendations/index.get.ts`
  - Handler: `getRecommendations` → `computeRecommendations` (learningService)
- **Auth / rate-limit:** `authenticate` + `trackingLimiter`
- **Request:** sem params (userId do JWT; catálogo = produtos `active:true`)
- **O que o servidor retorna:**
  - 200 `{ success: true, recommendations: [{ productId, score, reason, explore }] }`
  - 401 → sem auth
- **Efeitos:** somente leitura (produtos + pesos). O app aplica via `recOrder` sem quebrar fallback do admin.
