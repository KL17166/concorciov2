# Admin — Products (catálogo)

Fontes: `server-consorcio/src/routes/admin/productRoutes.ts` (10 rotas: 3× `router.get` + 7× `router.post`, linhas 7–16),
`server-consorcio/src/controllers/admin/adminProductController.ts`,
`server-consorcio/src/views/pages/products/index.ejs`, `server-consorcio/src/views/pages/products/form.ejs`.
Prefixo de montagem: `/admin`. Gate global `isAdmin` (`src/middlewares/adminAuthMiddleware.ts:37` — sessão `MASTER|MANAGER|SUPPORT`, senão redirect `/admin/login` ou 403 JSON) + `requireCapability` (`:83` — sem capability → flash `error_msg` + redirect `Referer`).

## Rotas (10/10 — conferidas uma a uma contra `productRoutes.ts:7-16`)

### `GET /admin/products`
- **Gate:** `isAdmin` + `requireCapability('catalog.view')` (`productRoutes.ts:7`)
- **Ativado por (tela):** `pages/products/index.ejs` — sidebar (`path: '/products'`); filtro por tipo via links `GET /admin/products?type=MOTO|CARRO|CARTA_CREDITO|ELETRONICO|IMOVEL|SERVICO` (`index.ejs:127-133`); link "Todos" (`:127`)
- **Request:** query `type?: string` — uppercased no controller (`adminProductController.ts:22-23`, `where = { type }` ou `{}`); paginação via `paginate(req)` → `page/limit/skip` (`:24`)
- **Resposta do servidor:** `render('pages/products/index', { path:'/products', products, typeFilter, pagination, nextDisplayOrder, buildPageUrl })` (`:54-61`). `products` = `findMany({ where, include:{plans:true}, orderBy:[{displayOrder:'asc'},{name:'asc'}], skip, take })` enriquecido com `price:number` (`toNumber`), `specs` (`safeParseSpecs`), `imageList` (`safeParseImageUrls`), `displayOrder ?? 0`, `estimatedMonthly = price*(1+(adminFeeRate+2)/100)/maxDuration` (`:8-12,:38-50`); `nextDisplayOrder = max(displayOrder)+10` (`:59`); `buildPageUrl(p)` → `/admin/products?...&page=p` (`:60`)
- **Efeitos:** somente leitura (`product.findMany` + `product.count` + `product.aggregate({_max:{displayOrder}})` em `Promise.all`, `:26-36`). Nenhum write, e-mail ou alerta
- **Erros:** `catch` → `res.status(500).send('Erro ao carregar produtos')` (`:63-64`); capability negada → deny padrão do middleware

### `GET /admin/products/new`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:8`)
- **Ativado por (tela):** `index.ejs:28` — `<a href="/admin/products/new">` botão "Novo Produto"; estados vazios `:307` e `:415` — `<a href="/admin/products/new">` "Adicionar Primeiro Produto"
- **Request:** nenhum (sem params/query/body)
- **Resposta do servidor:** `render('pages/products/form', { path:'/products', editing:false, nextDisplayOrder, product:{ active:true, type:'MOTO', displayOrder:nextDisplayOrder, stockQuantity:null } })` (`adminProductController.ts:69-77`); `nextDisplayOrder = max+10` (`:70-74`)
- **Efeitos:** somente leitura (`product.aggregate`, `:70`). Nenhum write
- **Erros:** nenhum handler próprio (sem try/catch); falha no aggregate propaga p/ error-handler Express

### `POST /admin/products/new`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:9`)
- **Ativado por (tela):** `pages/products/form.ejs:37-39` — `<form id="productForm" action="/admin/products/new" method="POST">` (ramo `editing=false`); submit "Salvar Produto" (`:280-282`); `_csrf` hidden (`:40`)
- **Request:** body (urlencoded, todos string do form): `name: string` (obrigatório, `required` no `form.ejs:54`), `price: string→float` (obrigatório, `required`, `:60`), `type: 'MOTO'|'CARRO'|'CARTA_CREDITO'|'ELETRONICO'|'IMOVEL'|'SERVICO'` (default `'MOTO'`, select `:97-104`), `category: string` (default `'geral'`; select populado via JS a partir de `categoryHiddenInputValue`, `:106-112`), `displayOrder: string→int` (obrigatório, `required`, `:115`; `parseDisplayOrder(raw, max+10)`, controller `:14-17,:102`), `imageUrls: string(JSON array)` (opcional; serializado pelo JS no submit `:414-419`; `JSON.parse` com try/catch vazio `:90`), `imageUrl: string` (opcional, fallback se lista vazia `:93-95`), `description: string` (opcional, `:79`), `brand|model: string|null` (opcionais, `:67-70`), `year: string→int|null` (opcional, `:73`), `specs: string(JSON object)` (opcional; serializado pelo JS `:415-416`; try/catch `:99`), `active|isFeatured|isPopular: 'on'|undefined` (checkboxes `:120,:126,:271`; `==='on'`, `:117-119`), `minDuration: string→int` (default 12, `:84`), `maxDuration: string→int` (default 60, `:85`), `adminFeeRate: string→float` (default 15.0, `:86`)
- **Resposta do servidor:** `redirect('/admin/products')` + flash `success_msg='Produto e planos criados com sucesso!'` (`:146-147`)
- **Efeitos:** `prisma.product.create` (`:104-125`; `imageUrl=[0]`, `imageUrls=JSON`, `specs=JSON|null`); auto-gera plans `consortiumPlan.createMany` com durações `{min, max, min..max step 12}` (`:128-144`, `fundRate:2.0`, `active:true`, nome `"${d} Meses"`)
- **Erros:** `catch` → flash `error_msg='Erro ao criar produto.'` + `redirect('/admin/products/new')` (`:149-152`, log `:149`); `price` inválido → `NaN` pode falhar no Prisma e cair no catch; JSON malformado de `imageUrls/specs` é engolido (try/catch vazio) e vira `[]`/`{}`

### `POST /admin/products/reorder`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:10`)
- **Ativado por (tela):** `index.ejs:25-27` — botão `#btnSaveOrder` "Salvar ordem" `onclick="saveOrder()"`; `saveOrder()` faz `fetch('/admin/products/reorder', {method:'POST', headers:{'Content-Type':'application/json','csrf-token':CSRF}, body:JSON.stringify({orders}) })` onde `orders=[...document.querySelectorAll('.order-input')].map({id, displayOrder})` (`:729-742`); inputs `.order-input[data-id]` (`:206-211`)
- **Request:** body JSON **ou** form: (a) `{ orders: [{ id:string, displayOrder:number }] }` (filtrado `o.id`, `parseDisplayOrder`, `:298-301`); (b) `{ order: { [id:string]: displayOrder } }` (`Object.entries`, `:302-304`). `Content-Type: application/json` no fetch do EJS
- **Resposta do servidor:** JSON `{ ok:true, updated:N }` se `req.accepts('json') && !accepts('html')` (`:313`) ou `req.xhr || content-type JSON` (`:315-317` — caso do `fetch` do EJS, que recebe JSON); senão `redirect('/admin/products')` + flash `success_msg='Ordem do catálogo salva (N produtos)!'` (`:318-319`)
- **Efeitos:** `prisma.$transaction(orders.map(product.update({where:{id}, data:{displayOrder}})))` (`:310-312`). Um update por produto, atômico
- **Erros:** `orders` vazio → se `req.accepts('json')` → `400 JSON { ok:false, message:'Nenhuma ordem enviada.' }` (`:306`); senão flash `error_msg='Nenhuma ordem enviada.'` + `redirect('/admin/products')` (`:307-308`); `catch` → se XHR/JSON `500 JSON { ok:false, message:'Erro ao salvar ordem.' }` (`:322-324`, log `:321`), senão flash `error_msg='Erro ao salvar ordem.'` + redirect (`:325-326`)

### `GET /admin/products/:id/preview`
- **Gate:** `isAdmin` + `requireCapability('catalog.view')` (`productRoutes.ts:11`)
- **Ativado por (tela):** `index.ejs` botões olho `onclick="openProductPreview('<%= product.id %>')"` (`:282` tabela, `:392` cards); `openProductPreview` faz `fetch('/admin/products/'+id+'/preview', {headers:{Accept:'application/json'}})` (`:806-811`) e preenche modal `#productPreviewModal` (`:473-557`)
- **Request:** params `id: string` (obrigatório, `req.params.id`, controller `:389`)
- **Resposta do servidor:** JSON `{ ok:true, product:{ ...product, price:number, imageUrls:string[], specs:object, plans:[{...plan, monthlyInstallment:number}], minMonthly:number, displayOrder:number } }` (`:404-415`); `monthlyInstallment = price*(1+(adminFee+fund)/100)/durationMonths` (`:399-402`); `plans` só `active:true` ordenados `durationMonths asc` (`:392`)
- **Efeitos:** somente leitura (`product.findUnique({include:{plans}})`). Nenhum write
- **Erros:** inexistente → `404 JSON { ok:false, message:'Produto não encontrado.' }` (`:394`); `catch` → `500 JSON { ok:false, message:'Erro ao carregar pré-visualização.' }` (`:417-418`, log `:417`); o JS do modal mostra "Erro ao carregar pré-visualização." (`index.ejs:847`)

### `GET /admin/products/:id/edit`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:12`)
- **Ativado por (tela):** `index.ejs:285` (tabela) e `:395` (cards) — `<a href="/admin/products/<%= product.id %>/edit">` botão lápis "Editar"; modal preview `#pvEditLink` (`:553`, href setado em `:843`)
- **Request:** params `id: string` (obrigatório, `:158`)
- **Resposta do servidor:** `render('pages/products/form', { path:'/products', editing:true, nextDisplayOrder, product })` (`:163-168`); `product` cru do `findUnique` (sem parse — o EJS faz `JSON.stringify(product.specs|imageUrls)` e o JS faz parse, `form.ejs:336-340`)
- **Efeitos:** somente leitura (`findUnique` + `aggregate max`, `:159,:162`)
- **Erros:** `!product` → `redirect('/admin/products')` **sem flash** (`:160`); `catch` → `redirect('/admin/products')` **sem flash** (`:169-171`)

### `POST /admin/products/:id/edit`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:13`)
- **Ativado por (tela):** `form.ejs:37-38` — mesmo `#productForm`, ramo `action="/admin/products/<%= product.id %>/edit"` quando `editing=true`; submit "Salvar Produto" (`:280-282`)
- **Request:** params `id: string`; body idêntico ao create (`:178` — mesmos campos/tipos/defaults `min 12/max 60/fee 15`, parse JSON `imageUrls/specs` com fallback `imageUrl`, `:185-195`); diferença: `displayOrder` — se `req.body.displayOrder` presente e não-vazio usa `parseDisplayOrder`, senão **preserva** `current.displayOrder` (`:197-200`, com `findUnique` prévio `:197`)
- **Resposta do servidor:** `redirect('/admin/products')` + flash `success_msg='Produto atualizado e planos ajustados!'` (`:254-255`)
- **Efeitos:** `prisma.product.update({where:{id}, data:{...}})` (`:202-224`); gera só plans **faltantes**: durações `{min,max,step12}` menos `existingDurations`, `createMany` se `>0` (`:227-252`)
- **Erros:** `catch` (ex.: `id` inexistente → `P2025` no update) → flash `error_msg='Erro ao atualizar produto.'` + `redirect('/admin/products/${id}/edit')` (`:256-259`)

### `POST /admin/products/:id/move`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:14`)
- **Ativado por (tela):** `index.ejs:199-204` — botões chevron `onclick="moveProductRow('<%= product.id %>', 'up'|'down')"`; `moveProductRow` faz `fetch('/admin/products/'+id+'/move', {method:'POST', headers:{'Content-Type':'application/json','csrf-token':CSRF}, body:JSON.stringify({direction, typeFilter:'<%= typeFilter %>'}) })` e `location.reload()` se `ok` (`:711-727`)
- **Request:** params `id: string`; body **ou** query `direction: 'up'|'down'` (lowercased, default `''`→down, `:334`); body `typeFilter` **ou** query `type: string` (opcional; escopo da ordenação, `:335-336`)
- **Resposta do servidor:** sempre JSON: `{ ok:true, moved:true }` (`:357`); `{ ok:true, moved:false }` se já no extremo (`swapIdx` fora do array, `:345`)
- **Efeitos:** `findMany({where:{type?}, orderBy:[displayOrder,name], select:{id,displayOrder}})` (`:337-341`); troca `displayOrder` com vizinho via `$transaction([update,update])` (`:348-351`); se empate (`a.displayOrder===b.displayOrder`) renormaliza **todos** para `(i+1)*10` (`:353-356`)
- **Erros:** `idx<0` → `404 JSON { ok:false, message:'Produto não encontrado.' }` (`:343`); `catch` → `500 JSON { ok:false, message:'Erro ao mover produto.' }` (`:359-360`, log `:359`); `direction` inválida cai no ramo `down` (sem validação)

### `POST /admin/products/:id/toggle`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:15`)
- **Ativado por (tela):** `index.ejs:272-277` — botões `onclick="toggleFlag('<%= product.id %>', 'isFeatured'|…)"` (Destaque/Popular); `toggleFlag` faz `fetch('/admin/products/'+id+'/toggle', {method:'POST', headers JSON+csrf-token, body:JSON.stringify({field}) })` + reload se `ok` (`:758-774`)
- **Request:** params `id: string`; body **ou** query `field: 'active'|'isFeatured'|'isPopular'` (obrigatório, `String(...)`, `:368`)
- **Resposta do servidor:** JSON `{ ok:true, product:{ id, active, isFeatured, isPopular } }` (`:374-379`)
- **Efeitos:** `findUnique` + `product.update({data:{[field]: !current[field]}})` — inversão atômica de um flag (`:372-378`)
- **Erros:** `field` fora da lista → `400 JSON { ok:false, message:'Campo inválido.' }` (`:369-371`); inexistente → `404 JSON { ok:false, message:'Produto não encontrado.' }` (`:373`); `catch` → `500 JSON { ok:false, message:'Erro ao alternar status.' }` (`:381-382`, log `:381`)

### `POST /admin/products/:id/delete`
- **Gate:** `isAdmin` + `requireCapability('catalog.manage')` (`productRoutes.ts:16`)
- **Ativado por (tela):** `index.ejs:288-291` (tabela) e `:398-401` (cards) — botão trash `onclick="deleteProduct('<%= product.id %>', ...)"`; `deleteProduct()` seta `#deleteForm.action='/admin/products/'+id+'/delete'` e abre `#deleteModal` (`:681-686`); form `method="POST"` + `_csrf` (`:596-597`), submit "Sim, excluir" (`:607`); aviso "planos vinculados também serão excluídos" (`:600-603`)
- **Request:** params `id: string` (único campo; sem body além de `_csrf`)
- **Resposta do servidor:** `redirect('/admin/products')` + flash `success_msg='Produto e planos removidos com sucesso!'` (`:284-285`)
- **Efeitos:** trava de integridade `subscription.count({where:{plan:{productId:id}, status:{in:['ACTIVE','PENDING','CONTEMPLATED']}}})` (`:268-273`); se zero → `consortiumPlan.deleteMany({where:{productId:id}})` + `product.delete({where:{id}})` (`:281-282`)
- **Erros:** `activeSubscriptions>0` → flash `error_msg='Não é possível excluir: existem ${n} contrato(s) ativo(s) para este produto.'` + `redirect('/admin/products')`, **sem deletar** (`:275-278`); `catch` (ex.: `id` inexistente) → flash `error_msg='Erro ao excluir produto.'` + redirect (`:286-290`, log `:287`)
