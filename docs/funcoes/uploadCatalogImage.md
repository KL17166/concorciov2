# uploadCatalogImage
- **Arquivo:** `server-consorcio/src/controllers/admin/adminProductController.ts` (fim)
- **O que faz:** Recebe 1 foto (JPG/PNG/WebP, 5MB) e salva em `zuvio-web/public/img/catalogo/<tipo>/`, devolvendo o path `/img/...` servido pelo backend.
- **O que ativa ela:** botão de envio por linha da galeria em `products/form.ejs` → `POST /admin/products/upload` (multipart `photo` + `tipo` + `slug`, CSRF via header `csrf-token`)
- **Entradas:** `photo` (obrigatório), `tipo` (MOTO|CARRO|CARTA_CREDITO|ELETRONICO|IMOVEL|SERVICO → pasta), `slug` (nome base do arquivo)
- **Saídas:** 200 `{ ok:true, path }`; 400 sem arquivo/extensão/MIME/magic-bytes; CSRF via `catalogUpload.single` com erro tratado em JSON (não 500)
- **Regras/efeitos:** `catalogUpload` (multer disk tmp + allowlist ext/MIME + mesmos tetos anti-DoS); magic bytes validado após salvar (apaga se inválido); nome `slug-timestamp-rand.ext`; log com admin
