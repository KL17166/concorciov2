# 🎯 G2G - Otimizador por Unidade (projeto separado do Eldorado)

Reaproveita o motor de cálculo do Eldorado (`pricePerUnit / inStock / minQty -> unitsToBuy`),
mas buscando ofertas direto na API `sls.g2g.com` — sem browser.

Produto padrão (melhor escolha validada): **WOW Gold por unidade**
- `Silvermoon [EU]`: `0.213922 BRL/un`, stock em milhões, `min 200`
- `3500 / 0.213922 = 16361 un = 3499.98`

## Setup

```bash
cd /home/d/Documents/g2g
npm install
# exporte os cookies da G2G (DevTools -> Application -> Cookies) para ./cookies.json
# mesmo formato de lista [{name, value, domain...}] usado no outro projeto
npm test
npm run api
```

## Uso

```bash
curl -X POST http://localhost:3001/api/optimize-g2g \
  -H 'Content-Type: application/json' \
  -d '{"budget":3500,"seoTerm":"wow-gold"}'

# Fluxo completo até o pedido (CRIA PEDIDO REAL to_pay — sem pagamento):
curl -X POST http://localhost:3001/api/buy-g2g \
  -H 'Content-Type: application/json' \
  -d '{"budget":3500,"seoTerm":"wow-gold","characterName":"SEU_PERSONAGEM"}'
# cada chamada = 1 pedido novo to_pay (expira ~2h sozinho, por design)
```

## Pagamento Pix (ramo 8b–11, ver `FLUXO.md` §1 e `fluxo.html` passos 8b–11)

Após o pedido: `/secure/payment?order_id=...` → `get-config` (cardápio) →
clicar **PIX id 856 `tazapay.PIX-QR`** → `submit-payment` → `302 load/checkout`
→ tela `checkout.tazapay.com` → CPF → **Pix copia-e-cola** (passo 11, em captura).

## Visual + capturas

- `fluxo.html`: fluxo 1–11 + ao vivo (cotação só-leitura; botão **PIX** ativo,
  **Cartão** cinza até fechar o passo 11; Comprar exige PIX + personagem + confirm).
- `python3 capture.py`: cotação/buy-now (Firefox, `.pw-profile/`).
- `python3 capture_3ds_chrome.py`: janela Chromium + extensão Request Inspector
  Pro (servidor `node server.js` na pasta da extensão → `:7331`, auto-save ~15s).
  Modo leve com watchdog — sem listeners de rede no Playwright (derrubam o
  driver com `ERR_STRING_TOO_LONG`).

Detalhes do fluxo em `FLUXO.md`.
