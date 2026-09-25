# mcp-moto-catalog

MCP server que extrai lineups de motos dos sites das montadoras e sincroniza o catálogo do consórcio (`MOTO.json` + Postgres).

## Por que navegador real?

Honda/Yamaha/Kawasaki/BMW bloqueiam fetch direto (`curl`, `Invoke-WebRequest`,
fetchers de IA) com **403 anti-bot**. O que funciona:

1. **Navegador de verdade** — `playwright-core` pilotando o Edge/Chrome já
   instalado na máquina (sem baixar Chromium). Com UA comum + viewport normal,
   o WAF deixa passar (200) e a página renderiza.
2. **Scroll completo** — as listagens usam lazy-load; sem rolar até o fim, os
   cards/imagens não existem no DOM.
3. **Âncora no preço** — em vez de adivinhar classes CSS (mudam sempre), o
   extrator ancora nos textos de preço (`R$ ...`) e sobe no DOM até achar o
   card com `img` + link. Preço, nome, URL e foto saem juntos.
4. **Download via navegação** — o CDN também barra `fetch`/HEAD direto. Mas
   `page.goto(urlDaImagem)` (navegação real) retorna 200 + bytes: é assim que
   as 33 fotos fundo branco do `/modelos` foram baixadas.
5. **Detalhe por modelo** — cada URL de modelo rende título, preços, `og:image`,
   JSON-LD, galeria same-origin e tabelas de ficha técnica.

## Tools

| Tool | O que faz |
|---|---|
| `list_models(brand)` | Modelos do lineup: `honda`, `yamaha`, `kawasaki`, `bmw`. Retorna slug, url, preço (quando o card exibe) e foto |
| `get_model(url)` | Detalhe de qualquer URL: preços, galeria, specs, og:image, JSON-LD |
| `download_images(items, outDir, urlPrefix?)` | Baixa imagens via navegação; retorna manifesto |
| `sync_moto_catalog(motoJson?, imgBaseUrl?, syncDb?, serverDir?)` | Pipeline Honda: aplica fotos+preços no `MOTO.json` (1ª foto = `/modelos`) e opcionalmente o Postgres |

## Adicionar outra marca

Acrescente um preset em `BRANDS` no `index.js`:

```js
suzuki: {
  base: 'https://...',
  listing: 'https://.../modelos',   // página que lista todos os modelos
  linkRe: '^/(caminho/modelo[^/]*)/?$', // regex do link de cada modelo
  priceCard: '.classe-do-preco',     // ou null (preço sai da detail)
  imgFull: u => u.split('?')[0]      // normaliza p/ imagem grande
}
```

E descubra os padrões com o navegador: abra a listagem, liste os `a[href]`,
filtre pelos que parecem modelo, abra 1 detail e veja onde estão preço,
galeria e tabela de specs.

## Rodar / testar

```bash
npm install
npm start            # stdio (via opencode)
node smoke.cjs       # teste: handshake + list_models(yamaha)
```

## Registrar no opencode (`~/.config/opencode/opencode.jsonc`)

```jsonc
{
  "mcp": {
    "moto-catalog": {
      "type": "local",
      "command": ["node", "C:\\Users\\kl\\Documents\\concorciov2\\mcp-moto-catalog\\index.js"],
      "enabled": true
    }
  }
}
```

Reinicie o opencode após registrar. Env opcionais: `MOTO_EDGE_PATH`
(caminho do navegador), `MOTO_HEADLESS=false` (ver a janela).
