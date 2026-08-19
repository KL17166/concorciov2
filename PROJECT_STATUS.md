# 🚀 KATARI CONSÓRCIOS — Status do Projeto & Guia de Continuidade

> **Data de Atualização:** 18 de Agosto de 2026  
> **Tecnologia:** Nuxt 4 (Vue 3, Vite, Pinia, TypeScript, Nitro)  
> **Status:** ~95% Concluído — 100% das telas migradas do Flutter com build passando com 0 erros.

---

## 📌 1. Visão Geral
Este projeto é a migração completa do aplicativo mobile em **Flutter** (`App-android-web`) para uma aplicação web moderna, responsiva e de alta fidelidade em **Nuxt 4 / Vue 3** (`zuvio-web`).

O projeto conta com:
- Design system premium com identidade visual Katari (laranja `#FF6D00`, azul escuro `#263238`, cinza neutro).
- 100% de compatibilidade visual e funcional com as regras de negócio do consórcio.
- Ferramenta global de desenvolvimento (`DevFloatingTool`) para simulação de cenários com 1 clique.
- Fallback mock offline e suporte a API REST.

---

## 🗺️ 2. Mapa Completo de Rotas e Páginas

| Rota | Arquivo Fonte | Descrição & Funcionalidades |
| :--- | :--- | :--- |
| `/` | `app/pages/index.vue` | **Home Principal**: Hero banner, card de contrato ativo ou adesão pendente (com pills travadas quando pendente), catálogo interativo de motos e carros, FAQ expansível e footer institucional. |
| `/auth/login` | `app/pages/auth/login.vue` | **Login**: Autenticação com CPF e senha, máscara dinâmica, integração com a ferramenta Dev (`Preencher` e `Entrar direto`). |
| `/auth/register` | `app/pages/auth/register.vue` | **Cadastro**: Criação de conta em passos orientados com validações de dados. |
| `/products/[id]` | `app/pages/products/[id].vue` | **Detalhes do Veículo**: Galeria de fotos, ficha técnica, seletor de planos (36, 50 e 80 meses), comparativo de taxas e botão de contratação. |
| `/checkout` | `app/pages/checkout/index.vue` | **Checkout / KYC**: Dados pessoais, busca de CEP automática com expansão suave dos campos de endereço (Rua, Número, Bairro, Cidade, UF, Complemento), upload de RG/CNH e selfie com preview. |
| `/checkout/contract` | `app/pages/checkout/contract.vue` | **Contrato Legal & Assinatura**: 962 linhas de cláusulas contratuais fiéis, prévia dos dados do consorciado, carimbo digital com hash SHA-256 e canvas de assinatura à mão livre com botões de limpar e confirmar. |
| `/checkout/payment` | `app/pages/checkout/payment.vue` | **Pagamento da Adesão (Checkout)**: PIX com QR Code SVG dinâmico, timer regressivo de 30 min, botão Copia e Cola, Boleto Bancário e simulação imediata de aprovação. |
| `/consortium/adhesion` | `app/pages/consortium/adhesion.vue` | **Tela Dedicada de Adesão**: Resumo da cota contratada, abas PIX/Boleto, instruções passo a passo, botão `[⚡ JÁ REALIZEI O PAGAMENTO]` e modal de celebração com ativação imediata do contrato. |
| `/consortium/payments` | `app/pages/consortium/payments.vue` | **Gestão de Parcelas**: Histórico e parcelas futuras agrupadas por ano com acordeão sanfonado, antecipação de parcelas com desconto de 0.5%/mês e modal de pagamento. |
| `/consortium/bids` | `app/pages/consortium/bids.vue` | **Oferta de Lances**: Modalidades *Livre*, *Fixo 25%* e *Embutido 25%*, slider interativo, card unificado de médias históricas do grupo + termômetro de competitividade dinâmica, e escolha de amortização (prazo vs parcela). |
| `/consortium/statement` | `app/pages/consortium/statement.vue` | **Extrato Financeiro**: Gráfico de evolução percentual paga, saldo devedor, parcelas quitadas e extrato detalhado. |
| `/profile` | `app/pages/profile/index.vue` | **Perfil**: Dados cadastrais do consorciado, status da conta e atalhos. |
| `/profile/kyc` | `app/pages/profile/kyc.vue` | **Reenvio de KYC**: Upload e reanálise de documentos pendentes. |

---

## 🛠️ 3. Ferramenta de Desenvolvimento (`DevFloatingTool.vue`)

Montada globalmente no arquivo raiz `app/app.vue`, estando acessível em **100% das páginas**:
- **Presetes de Login (com `Preencher` e `⚡ Entrar`)**:
  - 👤 **Carlos Alberto** (`111.444.777-35` / `123456`) -> *Contrato Ativo (12 parcelas pagas)*
  - 👩 **Mariana Oliveira** (`222.333.444-05` / `123456`) -> *Adesão Pendente (R$ 289,90)*
  - 🛡️ **Admin Master** (`529.982.247-25` / `123456`) -> *Perfil Master*
- **Simulador de Cenários em Tempo Real**:
  - ⏳ `pending_adhesion`: Transforma o contrato atual em Adesão Pendente (bloqueia lances/extrato com toast de aviso e exibe banner amarelo na Home).
  - ✅ `active_12`: Transforma em Contrato Ativo regular com 12 parcelas já quitadas.
  - 📦 `multiple`: Adiciona múltiplos contratos para testar alternância de cotas.
  - 🆕 `empty`: Deixa o usuário zerado sem contratos para testar contratação do zero.
- **Navegação Rápida**: Links diretos para qualquer rota da aplicação.

---

## 💾 4. Estrutura de Gerenciamento de Estado (Pinia)

- `app/stores/auth.ts`: Sessão do usuário, token JWT mock/real, perfil e status KYC.
- `app/stores/consortium.ts`: Contratos do consórcio, parcelas (pagas, pendentes e futuras), cálculo de lances, antecipação e semeadura de cenários dev.
- `app/stores/checkout.ts`: Funil de checkout, dados preenchidos, veículo selecionado e plano.
- `app/stores/toast.ts`: Fila de notificações Toast globais (`success`, `warning`, `error`, `info`).

---

## 🔄 5. O que foi feito recentemente (Última Sessão):

1. **Restauração do Design Favorito da Tela de Adesão** (`/consortium/adhesion`):
   - Card de resumo do produto com thumbnail, plano e valor.
   - Alternância fluida entre PIX e Boleto.
   - SVG de QR Code de alta qualidade com logo Katari e botão de copiar código.
   - Timer regressivo e botão de simulação imediata com modal comemorativo.
2. **Unificação dos Cards na Tela de Lances** (`/consortium/bids`):
   - Eliminada a duplicação entre a média do grupo e o card de competitividade.
   - Criado o componente integrado `bid-unified-stats-card` exibindo média histórica + badge dinâmico de probabilidade.
3. **Correção de Ícones no Checkout** (`/checkout`):
   - Adicionados os ícones `<MapPin>` no campo `Estado (UF)` e `<Home>` no campo `Complemento`.
4. **Centralização do Dev Bypass**:
   - Removido componente obsoleto duplicado e centralizado no `DevFloatingTool.vue` montado no `app.vue`.
   - Adicionados botões duplos (`Preencher` para ver os dados no form e `⚡ Entrar` para login direto).
6. **Conexão com Backend & Configuração de Portas**:
   - Criado `.env` do `zuvio-web` configurado para rodar na porta `3001` e consumir a API do backend na porta `3000` (`NUXT_PUBLIC_API_BASE=http://localhost:3000`).
   - Removido mock de autenticação do Nitro (`server/api/auth/login.post.ts`) para direcionamento direto ao backend real.
   - Atualizado CORS em `server-consorcio/.env` para permitir a origem `http://localhost:3001`.
7. **PWA & Suporte Mobile**:
   - Instalado e configurado `@vite-pwa/nuxt` com manifest standalone, cores Katari e ícones.
8. **Verificação de Build**:
   - `npm run build` executado e aprovado com **0 erros**.

---

## 🎯 6. Próximos Passos:

1. **Testes de Integração de Ponta a Ponta**:
   - Subir `server-consorcio` e `zuvio-web` simultaneamente e validar fluxos reais de login, contratação, PIX e lances.
2. **Refinamentos Finais**:
   - Testes visuais em telas mobile reais / emulador.
