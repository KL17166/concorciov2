# getRecommendations (algoritmo)
- **Arquivo:** server-consorcio/src/services/learningService.ts
- **O que faz:** Ranking personalizado de produtos: `score = 2.0*afinidade + 1.0*ln(1+popularidade) + 0.5*propensão − índice*0.001`
- **O que ativa ela:** `getRecommendations` (recommendationsController) — GET /api/recommendations
- **Entradas:** `userId` (nullable), `productIds[]` (produtos ativos)
- **Saídas:** `[{ productId, score, reason, explore }]` ordenado; reason ∈ {baseado no seu interesse, em alta, sugestão}
- **Regras/efeitos:**
  - Sem histórico → popularidade global; sem nada → ordem de entrada (admin)
  - Exploração epsilon-greedy 15% (`EXPLORE_RATE`): embaralha top-8 com `explore:true` para descobrir gostos novos
  - Somente leitura (`learningWeight.findMany`); falha → fallback ordem de entrada
