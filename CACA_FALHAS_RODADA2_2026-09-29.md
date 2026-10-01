# CAÇA-FALHAS RODADA 2 — ferramentas reais (nmap, sqlmap, nikto, ffuf, redis-cli, psql)
Executado 2026-09-29 contra backend :3030, front :3001, gateways :8765/:8766,
postgres :5434, redis :6379. Sem exfiltração de PII (só metadados/contagens).

## ACHADOS (ordenados por impacto)

### 1. Redis SEM SENHA e exposto na rede — CRÍTICO (B2 ao vivo)
- `redis-cli -p 6379 ping` → `PONG` sem auth; porta em `0.0.0.0`.
- 437 chaves `consorcio:sess:*` (sessões admin) **legíveis**; escrita provada
  (SET/DEL de chave própria).
- Impacto: ler sessões de admin, apagar blacklist de JWT (reativa token revogado),
  derrubar rate-limits, envenenar pesos do algoritmo, logout em massa.
- Fix: `requirepass` + `REDIS_URL=redis://:senha@127.0.0.1:6379`, bind 127.0.0.1,
  `appendonly yes` (hoje restart apaga tudo).

### 2. Postgres com senha `099` acessível na rede — ALTO (B2 ao vivo)
- `psql -h localhost -p 5434 -U postgres` com `099` conectou; bind `0.0.0.0`.
- Schema inteiro listado (`users`, `gateway_configs` com API keys, `pixel_configs`...).
  Não extraí linhas (PII) — o acesso prova takeover total do banco.
- Fix: senha 32+ aleatória, bind 127.0.0.1, `chmod 600 .env`.

### 3. `/admin/token` entrega JWT MASTER + desliga defesas — MÉDIO-ALTO (A10 ao vivo)
- Qualquer sessão (até SUPPORT) recebe JWT 2h; `header.ejs` injeta como
  `X-Admin-Token` em toda request; token pula WAF/security/payload-obfuscation
  e **sobrevive ao logout** (sem revogação/blacklist).
- Cadeia: XSS no painel ou sessão esquecida → 2h sem defesas.
- Fix: deletar `/admin/token` + interceptor do header; painel usa só cookie
  HttpOnly de sessão (já existe).

### 4. ETag vaza inode — BAIXO
- Nikto: `Server leaks inodes via ETags`. Fingerprinting menor.
- Fix: `etag: false` no Express ou `X-... ` (uma linha em `app.set`).

## LIMPOS (com prova)
- **sqlmap** (`--level=3`, login cpf): *not injectable*.
- **nmap --script vuln** (:3030/:3001): nada.
- **Gateways**: 401 sem token; CORS restrito a `127.0.0.1:3030`; `?token=` removido
  (Eldorado e G2G, header-only confirmado no código).
- **ffuf**: só achou o esperado (`admin/*`, `health`, `readyz`); `/admin/reports`
  exige sessão + `reports.view`.
- **Nikto cookie**: falso positivo — `sessionId` tem `HttpOnly; SameSite=Strict`
  (verificado no header ao vivo).
- **Threat-scoring funciona**: meu scan foi classificado `SCANNER` (score 120) e
  banido; desbani via `blocked_devices` (2 bans locais removidos). Efeito colateral:
  front ficou 403 durante o ban (BFF chama de localhost) — normalizado após unban.

## Não mexido (precisa do operador)
- B1 parcial: chaves de PROVEDOR (PixGo `pk_dd0…`, SigiloPay `artemis…`, sessão
  Eldorado) — rotação nos dashboards deles, só o operador tem acesso.
- B8 parcial: step-up de saque (quando reativar, implementar senha+2FA fresh,
  teto e dupla aprovação).

## RODADA 4 — B1/B8 executados (2026-09-29, repo privado: filter-repo dispensado)
- **B8**: saque SigiloPay congelado (`503 WITHDRAW_DISABLED`, flag
  `SIGILOPAY_WITHDRAW_ENABLED` p/ reativar após step-up). Verificado ao vivo.
- **B1 parcial**: `.env.example` já estava sanitizado (valores ≠ reais, provado);
  HMAC hardcoded eliminado dos 3 arquivos do front (agora `NUXT_HMAC_SECRET`
  server-only) + morto `shared/utils/security.ts` (vazava o segredo no bundle).
- **Rotacionados**: `JWT_SECRET`, `SESSION_SECRET`, `PASSWORD_PEPPER`,
  `REQUEST_SIGNING_SECRET`/`NUXT_HMAC_SECRET`, `G2G_API_TOKEN`, `ELDORADO_API_TOKEN`
  (tokens locais, ambos os lados + restarts). Re-hash dos 3 usuários; logins
  MASTER + 2 CLIENTs verificados; token novo aceito pela G2G, errado rejeitado.
- `filter-repo` NÃO executado: repo privado só do operador — risco aceito e
  documentado (revisitar se o repo for compartilhado/publicado).

## RODADA 3 — correções aplicadas + mais ferramentas (2026-09-29)
**Corrigido e verificado ao vivo:**
1. **Redis**: `requirepass` (32 hex) + bind `127.0.0.1` + `appendonly yes` —
   anônimo agora recebe `NOAUTH`; externo `connection refused`; persistência
   provada (chave sobreviveu a restart); backend reconectou sozinho.
2. **Postgres**: senha `099` → 32 hex (`ALTER USER`), bind `127.0.0.1` —
   `099` agora dá `password authentication failed`.
3. **`/admin/token` deletado** (rota + interceptor `header.ejs` que injetava
   `X-Admin-Token` em tudo + `_adminToken` nos forms); bypass do
   `securityMiddleware` agora é só sessão HttpOnly válida (JWT de API não pula).
   Painel testado sem token: tracking 200.
4. **ETag desligado** (`app.set('etag', false)`).
- `docker-compose.yml` versionado (sem segredos — só `${...}` + binds);
  senhas só no `.env` gitignored. `chmod 600` impossível aqui (NTFS do /mnt/win
  ignora chmod — documentado como limitação).
- `tsc` limpo, jest 91/91, backend restartado e saudável.

**Novas ferramentas rodadas:**
- **nuclei 3.11.1** (221 templates misconfig/exposure, 6171 reqs em :3030+:3001):
  **0 matches**.
- **nmap vuln+auth** (:3000/:5434/:6379/:8765/:8766): nada explorável.
- **sqlmap 2º parâmetro** (`/api/products?type=`): *not injectable*.
- **nikto front**: só falsos positivos de PHP antigo; 2 notas reais menores:
  front sem `X-Frame-Options` e ETag do Nuxt (estático) — backend já tem ambos.
