# gateways-codadas (privado)

Monorepo privado com as gateways codadas:

- `g2g/` — otimizador por unidade + fluxo PIX/cartão (G2G + Pipwave/Tazapay). Ver `g2g/README.md` e `g2g/FLUXO.md`.
- `eldoradov2/` — PIX automatizado Eldorado.gg via `requests` + API stdlib. Ver `eldoradov2/README.md` e `eldoradov2/FLUXO.md`.

## Regras

- Privado. Não publicar, não forkar público.
- Segredos **só via env** (`.env` local, nunca commitado). Use `.env.example` como base.
- Sessão/cookies/HAR/capturas ficam fora do git (ver `.gitignore` na raiz).
- Cada `initialize` / `buy` gera cobrança real — não rodar à toa.

## Setup rápido

```bash
# g2g
cd g2g && npm install && npm test

# eldoradov2
cp eldoradov2/.env.example eldoradov2/.env  # preencher
ELD_EMAIL="..." ELD_PASS="..." python3 eldoradov2/eldorado_renova_login.py
```
