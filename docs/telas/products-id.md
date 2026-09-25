# Detalhe do produto (`/products/:id`)
- **Objetivo:** Exibir galeria, preço, planos, specs e levar ao checkout com produto+plano.
- **O que precisa do servidor:**
  - `GET /api/products` (via `ensureProductsLoaded`) → `id`, `name`, `imageUrl|imageUrls`, `price`, `monthlyPrice`, `maxDuration`, `plans[].{id, durationMonths, monthlyInstallment}`, `specs{}`, `category`, `isFeatured`, `brand` (fallback `DEFAULT_PRODUCTS`)
- **Ações → chamadas:** nenhuma chamada de servidor; "Continuar" grava `selectedProduct/selectedPlan` na store e vai a `/checkout?productId&planId`.
- **Estados:**
  - `isPageLoading` → aguarda catálogo antes de resolver o `:id` (evita falso 404 em refresh/deep-link).
  - Produto `null` após carga → "Nenhum produto selecionado" → volta a `/`.
  - Planos filtrados (`durationMonths ≤ maxDuration`); auto-seleção do plano mais próximo ao preço mensal — tudo local.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
  - Dona do próprio `SCREEN_VIEW(products)`: com `metadata.productId` quando resolve (fora do middleware global p/ não duplicar) — alimenta afinidade.
