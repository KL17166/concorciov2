# Home (`/`)
- **Objetivo:** Dashboard do consorciado: contratos ativos, melhores ofertas e catálogo com busca.
- **O que precisa do servidor:**
  - `GET /api/products` (via `consortiumStore.loadHomeData`) → `id`, `name`, `imageUrl`, `price`, `plans[].monthlyInstallment`, `isFeatured`, `isPopular`, `brand`, `displayOrder`, `category`, `type`
  - `GET /api/subscriptions/:userId` (via `loadHomeData`) → `ActiveContract[]`: `id`, `status`, `isAdesaoPaid`, `product.{name,imageUrl}`, `currentInstallment`, `totalInstallments`, `progressPercentage`, `nextPaymentAmount`, `dueDate`, `groupNumber`, `quotaNumber`
  - `GET /api/bids/:userId` (via `bidStore.fetchUserBids`) → `Bid[]`: `subscriptionId`, `status` (usa `APPROVED` p/ badge "!" e `ApprovedBidModal`)
- **Ações → chamadas:** nenhuma chamada direta; só navegação local (`/products/:id`, `/consortium/payments|statement|bids`, `/consortium/adhesion`).
- **Estados:**
  - Com contratos (`hasActiveContracts`) → carrossel de contratos; sem → banner promocional.
  - `isAdesaoPaid=false` → box "Adesão Pendente" + ações com cadeado (toast de aviso ao clicar).
  - Lance `APPROVED` no contrato → badge "!" em "Ofertar Lance" + modal `ApprovedBidModal`.
  - Não autenticado → middleware `auth` redireciona a `/welcome`.
  - Falha no fetch → fallback silencioso (`DEFAULT_PRODUCTS`, lista vazia).

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
