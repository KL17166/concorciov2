# TESTE DE INVASÃO — executado 2026-09-29 (4 frentes paralelas + revisão)
Alvo: backend :3030 + front :3001 (ambiente local, contas seed Carlos/Mariana).
Scripts: `/tmp/opencode/pentest.py`, `pentest2.py`, `pentest3.py`, `pentest4.py`.
Limpeza pós-teste: 3 usuários `pentest*` + 6 eventos de teste removidos do banco.

## Resultado: 0 vulnerabilidades exploráveis (34 testes live)

| Frente | Testes | Resultado |
|---|---|---|
| AuthN (sem token, JWT lixo/none/adulterado) | 401 consistente | PASS |
| Enumeração de login (CPF válido/inválido) | mesma mensagem `Invalid credentials` | PASS |
| BOLA leitura (bids/subscriptions/subscription alheios, token válido) | 403 | PASS |
| BOLA escrita (pix em installment alheio) | bloqueado | PASS |
| Mass assignment (`role: MASTER` no register) | ignorado, `CLIENT` forçado | PASS |
| SQLi (login, product :id) | sem 500, sem token | PASS |
| Traversal (`/kyc/documents/.../etc/passwd`) | bloqueado (`basename` + 403 dono) | PASS |
| XSS armazenado (`<script>` via metadata → dashboard) | escapado (`&lt;`) | PASS |
| Upload SVG com `<script>` (live) | barrado | PASS |
| Rate limit login (100/15min dev) | 429 enforced (travei meu IP 2x) | PASS |
| Bypass via `X-Forwarded-For` falso | sem bypass (spoof leva 429) | PASS |
| CORS `Origin: evil.com` | sem echo | PASS |
| Open redirect server-side | nenhum | PASS |
| Admin POST sem sessão | redirect/403, nunca 500 | PASS |
| TRACE / versionamento / health | bloqueado/limpo | PASS |
| CSRF admin POST | token validado (testado no smoke dos pixels) | PASS |

## Revisão de código (defesas confirmadas)
- Upload: allowlist de extensão (SVG/HTML/PHP bloqueados), MIME cruzado, magic bytes pós-write
  com delete, filename aleatório, fora do webroot, multer ^2.4.0 (CVE-2026-5079 corrigido), teto 5MB.
- KYC serve: auth + dono-ou-admin + `basename` + `nosniff` + `private, no-cache`.
- Valores: lance `positive` + % 0–100; pagamentos/assinaturas sem valor vindo do cliente (tudo do DB).
- Sessão: Redis store, `httpOnly`, `sameSite: strict`, `regenerate` no login, JWT 15min.
- Segredos: nenhum `.env` no git; `.env.example` só placeholders; JWT 36 chars, pepper 63.
- CORS null-origin bloqueado em prod; helmet ativo; `trust proxy` 1.

## Observações (não-vulns) — resolvidas em 2026-09-29
1. Mensagem de rate-limit difere da de credencial — aceito como risco zero: os
   headers `RateLimit-*` já anunciam o limite e o status (401 vs 429) difere
   de qualquer jeito. Sem ação.
2. ~~Stack traces do BFF em erro 400 aparecem em dev~~ CORRIGIDO: nenhuma resposta
   de erro do front carrega `stack` — `server/utils/httpError.ts` (resposta direta
   em vez de `throw`), `server/utils/backendProxy.ts` (mesmo padrão), catch-all
   `server/api/[...slug].ts` p/ 404, mais `server/error.ts` + plugin
   `disable-debug-errors` + `nitro.debug:false` p/ builds de prod. Verificado live
   (400/404/409 sem `stack`, fluxos normais intactos).
3. `/var/lib/docker` em 90% (imagem WAHA 3GB) — risco de disponibilidade, não de invasão.
4. Rate limits de dev são frouxos de propósito (100–2000/15min); em prod caem p/ 5–300.
