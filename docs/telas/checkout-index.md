# Contratação — dados (`/checkout`)
- **Objetivo:** Wizard em 3 passos (pessoal → endereço → documentos) antes da revisão do contrato.
- **O que precisa do servidor:**
  - `GET /api/products` (via `ensureProductsLoaded`) → `id`, `plans[].id` (resolve `?productId/?planId`; fallback `DEFAULT_PRODUCTS`)
  - `GET https://viacep.com.br/ws/{cep}/json/` (único `$fetch` direto, ao completar 8 dígitos) → `logradouro`, `bairro`, `localidade`, `uf` (+ flag `erro`)
- **Ações → chamadas:** nenhum POST próprio; CONTINUAR só grava na store local e avança; no passo 2 → `router.push('/checkout/contract')`.
- **Estados:**
  - `?productId` inexistente → `productNotFound` → card "Produto não encontrado" + volta a `/`.
  - ViaCep `erro`/exceção → `formError` + expande endereço em modo manual.
  - Validação por passo → banner `formError` (telefone DDD, CEP 8 dígitos, número obrigatório, 3 fotos).
  - Nome/CPF são readonly (vêm de `authStore.user`); só telefone é editável.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
