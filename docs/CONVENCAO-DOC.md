# CONVENÇÃO DE DOCUMENTAÇÃO — regra permanente do projeto

> **Regra:** toda função de negócio, todo endpoint cliente e toda tela do app
> TÊM um `.md` próprio em `docs/`. Criou ou mudou comportamento? Atualizou o `.md`
> no mesmo commit. Sem `.md` atualizado, a task não está pronta.

## Onde fica
- `docs/funcoes/<nomeDaFuncao>.md` — funções em `server-consorcio/src/application/**`
  (a lógica de negócio: o que ativa ela, entradas, saídas, regras, erros).
- `docs/api/<METODO>-<slug-do-path>.md` — cada endpoint cliente
  (`server-consorcio/src/routes/**` + BFF `zuvio-web/server/api/**` quando existir).
- `docs/telas/<slug-da-rota>.md` — cada tela em `zuvio-web/app/pages/**`:
  o que ela precisa que o servidor retorne, ação → chamada, estados.
- `docs/admin/<modulo>.md` — **painel admin por módulo** (auth, dashboard, people,
  clients, users, contracts, payments, bids, products, reports, security, gateways,
  kyc, tickets, profile, tracking): CADA endpoint em seção `### MÉTODO /admin/path`
  com Gate, **Ativado por (tela .ejs + botão/form/linha)**, Request (campos),
  Resposta (vars do render / redirect+flash / JSON), Efeitos e Erros.
  Verificação: nº de `###` == nº de `router.*` no arquivo de rotas do módulo.
- `docs/INDICE.md` — mapa navegável de tudo.

## Template — função (`docs/funcoes/`)
```md
# nomeDaFuncao
- **Arquivo:** caminho:linha
- **O que faz:** 1-2 linhas
- **O que ativa ela:** controller/rota/job que chama (com path:método)
- **Entradas:** params + validações
- **Saídas:** retorno sucesso + erros (statusCode)
- **Regras/efeitos:** transações, tabelas tocadas, side-effects
```

## Template — endpoint (`docs/api/`)
```md
# MÉTODO /path
- **Ativado por:** tela/função que chama
- **Auth / rate-limit:** middlewares reais
- **Request:** body/params (schema)
- **O que o servidor retorna:** 200 (shape) + erros (código → quando)
- **Efeitos:** o que muda no banco/fila/alerta
```

## Template — tela (`docs/telas/`)
```md
# Nome da tela (`/rota`)
- **Objetivo:** 1 linha
- **O que precisa do servidor:** endpoint → campos usados da resposta
- **Ações → chamadas:** botão/evento → endpoint
- **Estados:** o que cada status do servidor muda na UI
```

## Verificação
`ls docs/funcoes | wc -l` deve cobrir cada `export function` de `src/application/**`;
`docs/api` deve cobrir cada rota cliente de `src/routes/api/**`, `authRoutes`,
`productRoutes`; `docs/telas` deve cobrir cada `.vue` de `app/pages/**`.
Qualquer auditoria futura começa conferindo essa cobertura.
