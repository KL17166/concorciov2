# eldoradov2 — PIX automatizado (Eldorado.gg)

Gera PIX copia e cola via `requests` puro + auto-escolha do melhor vendedor.
REGRA: nada depende de `/tmp` — sessão e logs vivem em `.sessao/`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `eldorado_pix_compra.py` | Fluxo completo até o copia e cola (stdout = só o código) |
| `eldorado_pix_api.py` | API stdlib `POST /pix`, `GET /sellers`, `GET /health`, página em `/` |
| `eldorado_sellers.py` | Seletor de vendedores (lógica de `Documents/eldorado`) |
| `eldorado_pix.html` | Página servida pela API |
| `eldorado_renova_login.py` | Renova login, exporta sessão (tenta refresh silencioso antes do browser; com solver Cloudflare) |
| `eldorado_usa_sessao.py` | Valida sessão salva (auto-refresh se 401) |
| `eldorado_auth.py` | **Auth auto-renovável (item 5)**: `refreshTokens` via www sem browser/Cloudflare; `ensure_logged_in`, `authed_request`, `check_login` |
| `cloudflare_solver.py` | Turnstile/Challenge via CapMonster (`.env`) |
| `FLUXO.md` | **O fluxo ponta a ponta + todas as pegadinhas e como cada uma foi vencida** |

## Uso rápido

```bash
# 1. sessão (renova quando /health der 401)
ELD_EMAIL="..." ELD_PASS="..." python3 /home/d/Documents/eldoradov2/eldorado_renova_login.py
# ou manual: python3 /home/d/Documents/eldoradov2/eldorado_renova_login.py --manual --no-headless

# 2. compra direta (oferta fixa)
ELD_CPF="..." ELD_ROBLOX_USER="171" ELD_QUANTITY="3000" python3 /home/d/Documents/eldoradov2/eldorado_pix_compra.py

# 3. API (auto-escolha de vendedor por padrão)
python3 /home/d/Documents/eldoradov2/eldorado_pix_api.py 8765
# página: http://127.0.0.1:8765/
curl -X POST 127.0.0.1:8765/pix -H 'Content-Type: application/json' \
  -d '{"cpf":"...","roblox_user":"171","quantity":1540}'
curl '127.0.0.1:8765/sellers?quantity=3000'
```

Env: `ELD_ROBLOX_USER`, `ELD_QUANTITY`,
`ELD_OFFER_ID`, `ELD_OFFER_VERSION`, `ELD_OFFER_POSITION`, `ELD_FX`.
O CPF vai no corpo do POST (`/pix`) ou via `ELD_CPF=` só no uso direto
do script — não fica no `.env`.
Tudo também pode ir no `.env` (copie de `.env.example`). O renova lê o
`.env` sozinho; a `CAPMONSTER_API_KEY` (capmonster.cloud) destrava o
Cloudflare do login (ver `cloudflare_solver.py`).

## Segurança

- CPF/senha **só via env**, nunca no código.
- `eldorado-state.json` / `eldorado-meta.json` (sessão viva) ficam em
  `.sessao/` (persistente, sobrevive reboot) e **nunca** entram em
  commit/repo (ver `.gitignore`). REGRA: nada usa `/tmp`.
- Cada `initialize` + voucher é real (gera cobrança PENDING que expira em
  ~10min). Não gera à toa.
