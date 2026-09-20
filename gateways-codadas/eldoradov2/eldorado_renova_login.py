"""
eldorado_renova_login.py
Abre o browser, faz login (ou renova via sessão salva) e exporta tudo
para o script de uso (eldorado_usa_sessao.py) consumir.

Gera:
  .sessao/eldorado-state.json -> cookies + localStorage (formato Playwright storageState)
  .sessao/eldorado-meta.json  -> fingerprint headers (ns_dev_id, xsrf, tracking ids, expirações)

Fluxo fiel ao trace capturado:
  www /api/library + /api/appConstants (bootstrap)
  -> gera PKCE verifier/challenge + state (igual sessionStorage eld-auth-pkce-key / eld-auth-state)
  -> GET login.eldorado.gg/login + /signup _data=root + _data=routes/signup (pega csrf)
  -> POST signup (username/password/confirmPassword/csrf/cognitoAsfData) 204
  -> GET+POST signup/confirm (code do email) 204
  -> GET+POST passkeys/add skip 204
  -> callback /account/auth-callback?code=...&state=...
  -> POST /api/authentication/authenticate {code,codeVerifier,redirectUrl} 200
       + headers X-Xsrf-Token, Nsure-Device-Id (trace #713)
       <- seta __Host-EldoradoIdToken (30min), __Host-EldoradoRefreshToken (30d),
          __Host-DCID, __Host-XSRF-TOKEN
  -> PUT syncLocale, POST metadata, POST users/me, GET users/me (prova)

Para RENOVAR (conta já criada): se já existe state válido (users/me 200),
só reexporta e atualiza expiração. Se 401, tenta refresh silencioso via
reload + authenticate com cookies, se falhar cai pro login UI com email/senha.

Uso:
  ELD_EMAIL="..." ELD_PASS="..." python3 /home/d/Documents/eldoradov2/eldorado_renova_login.py
  # ou manual: python3 ... --manual (abre headed, tu loga na tela, aperta ENTER)
"""
import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
import time
from urllib.parse import urlencode

STATE_PATH = os.environ.get("ELD_STATE_PATH",
                            "/home/d/Documents/eldoradov2/.sessao/eldorado-state.json")
META_PATH = os.environ.get("ELD_META_PATH",
                           "/home/d/Documents/eldoradov2/.sessao/eldorado-meta.json")

BASE_WWW = "https://www.eldorado.gg"
BASE_LOGIN = "https://login.eldorado.gg"
CLIENT_ID = "3a4hal6jgl8gf5hnnjo06k05s5"
REDIRECT_URI = "https://www.eldorado.gg/account/auth-callback"
SCOPE = "email openid profile aws.cognito.signin.user.admin"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manual", action="store_true", help="abre headed e espera tu logar na tela")
    ap.add_argument("--headless", action="store_true", default=True, help="roda headless (default)")
    ap.add_argument("--no-headless", dest="headless", action="store_false")
    args = ap.parse_args()

    # .env (CAPMONSTER_API_KEY, ELD_*), só o persistente — REGRA: nunca /tmp.
    for env_path in ("/home/d/Documents/eldoradov2/.env",):
        try:
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except FileNotFoundError:
            pass

    email = os.environ.get("ELD_EMAIL", "")
    password = os.environ.get("ELD_PASS", "")
    # 0. Bypass automático do item 5: tenta refresh silencioso via www
    # (sem browser, sem Cloudflare) antes de abrir qualquer browser.
    # Se o RefreshToken 30d ainda vive, nem encosta no login.eldorado.gg.
    if os.path.exists(STATE_PATH):
        try:
            sys.path.insert(0, "/home/d/Documents/eldoradov2")
            import eldorado_auth as _auth
            st0, meta0 = _auth.load_session(STATE_PATH, META_PATH)
            s0 = _auth.build_session(st0, meta0)
            try:
                _auth.ensure_logged_in(s0, meta0, "https://www.eldorado.gg/")
                print("APPROVED - renova | sessão válida/renovada via refreshTokens, sem browser | HTTP 200")
                return
            except SystemExit:
                print("[renova] refresh silencioso falhou, caindo pro login via browser...")
                pass
        except Exception as e:
            print(f"[renova] auto-refresh indisponível ({e}), caindo pro browser...")
    if not args.manual and (not email or not password):
        print("Falta ELD_EMAIL / ELD_PASS. Ou roda com --manual.")
        print('Ex: ELD_EMAIL="a@b.com" ELD_PASS="..." python3 /home/d/Documents/eldoradov2/eldorado_renova_login.py')
        sys.exit(2)

    from playwright.sync_api import sync_playwright

    verifier = b64url(secrets.token_bytes(96))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    state = "".join(secrets.choice(alphabet) for _ in range(32))
    print(f"[pkce] verifier {len(verifier)} challenge {challenge[:12]}... state {state}")

    login_params = {
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "client_id": CLIENT_ID,
        "scope": SCOPE,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "lang": "en",
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless,
                                    args=["--no-sandbox", "--disable-dev-shm-usage"])
        # tenta reusar state antigo pra renovar sem login full
        if os.path.exists(STATE_PATH):
            ctx = browser.new_context(user_agent=UA, storage_state=STATE_PATH)
            print(f"[load] state antigo carregado: {STATE_PATH}")
        else:
            ctx = browser.new_context(user_agent=UA)
            print("[load] sem state, sessão limpa")

        page = ctx.new_page()
        # tracing total igual fizemos no MCP
        ctx.tracing.start(screenshots=True, snapshots=True, sources=True)

        # 1. bootstrap www (fixa __Host-XSRF-TOKEN, _eld_uid, x-session-id, forter)
        page.goto(f"{BASE_WWW}/api/library?locale=en-US")
        page.goto(f"{BASE_WWW}/api/appConstants")
        page.goto(BASE_WWW + "/")
        print(f"[bootstrap] {page.url} title={page.title()[:40]}")

        # 2. checa se já tá logado reaproveitando IdToken
        try:
            me = page.evaluate("""async () => {
              const r = await fetch('/api/users/me', {headers:{'Accept':'application/json'}});
              return {status: r.status, body: (await r.text()).slice(0,300)};
            }""")
            print(f"[check] users/me status={me['status']} {me['body'][:120]}")
            if me["status"] == 200:
                print("[check] sessão ainda válida, só reexportando")
                save_all(ctx, page, verifier, state)
                ctx.tracing.stop(path="/home/d/Documents/eldoradov2/.sessao/eldorado-renova-trace.zip")
                browser.close()
                print("APPROVED - renova | sessão válida, cookies reexportados | HTTP 200")
                return
        except Exception as e:
            print(f"[check] falhou, vai pro login: {e}")

        if args.manual:
            # deixa tu logar na tela (conta já criada no temp-mail)
            page.goto(f"{BASE_LOGIN}/login?{urlencode(login_params)}")
            print(f"[manual] abre: {page.url}")
            print("[manual] FAZ LOGIN NA TELA (email -> Next -> senha -> confirm code se pedir, pula passkey).")
            input("Aperta ENTER aqui quando já estiver logado e de volta no www.eldorado.gg/ ...")
        else:
            # login automatizado conta existente (não signup): email -> Next -> password.
            # Se o Cloudflare segurar (challenge-platform / Just a moment), resolve
            # via CapMonster (.env CAPMONSTER_API_KEY) antes de digitar.
            import sys
            sys.path.insert(0, "/home/d/Documents/eldoradov2")
            try:
                from cloudflare_solver import is_cf_challenge_page, solve_page
                has_solver = True
            except Exception as e:
                print(f"[cf] solver indisponível ({e}), segue sem")
                has_solver = False
            page.goto(f"{BASE_LOGIN}/login?{urlencode(login_params)}")
            print(f"[login] {page.url}")
            if has_solver and is_cf_challenge_page(page):
                print("[login] Cloudflare challenge detectado, chamando CapMonster...")
                if not solve_page(page):
                    print("[login] challenge NÃO resolvido (sem chave? ver .env). Abortando antes de digitar senha.")
                    raise SystemExit(5)
            # campo Email address + Next (refs vistas no snapshot f37e61/f37e65)
            page.get_by_placeholder("name@host.com").fill(email)
            page.get_by_role("button", name="Next").click()
            page.wait_for_timeout(2500)
            print(f"[login] pós-email: {page.url}")
            # tela de senha varia: input type=password + botão Sign in / Confirm
            try:
                page.locator('input[type="password"]').first.fill(password)
                page.get_by_role("button", name=re_compile("Sign in|Confirm|Next|Continue")).first.click()
            except Exception as e:
                print(f"[login] senha: tenta seletor genérico ({e})")
                page.evaluate(f"""() => {{ document.querySelector('input[type=password]').value = {json.dumps(password)}; }}""")
                page.keyboard.press("Enter")
            page.wait_for_timeout(5000)
            print(f"[login] pós-senha: {page.url}")
            # se cair em /signup/confirm (conta nova pedindo code), pausa pra digitar
            if "signup/confirm" in page.url:
                code = input("Código de confirmação do email (6 dígitos): ").strip()
                page.locator('input').first.fill(code)
                page.keyboard.press("Enter")
                page.wait_for_timeout(4000)
            # se cair em passkeys/add, clica pular
            if "passkeys/add" in page.url:
                try:
                    page.get_by_role("button", name=re_compile("Skip|Pular|Not now|Continuar")).first.click(timeout=5000)
                except Exception:
                    pass
                page.wait_for_timeout(3000)
            # espera callback com ?code=
            try:
                page.wait_for_url("**/account/auth-callback?code=*", timeout=30000)
            except Exception as e:
                print(f"[login] não vi callback com code: {e} url atual {page.url}")
            print(f"[callback] {page.url[:160]}")

        # 3. garante que o authenticate rodou e cookies __Host- existem
        page.goto(BASE_WWW + "/")
        page.wait_for_timeout(3000)
        cookies = ctx.cookies()
        names = [c["name"] for c in cookies]
        print(f"[cookies] total={len(cookies)} tem Id={ '__Host-EldoradoIdToken' in names} "
              f"Refresh={'__Host-EldoradoRefreshToken' in names} DCID={'__Host-DCID' in names}")
        if "__Host-EldoradoIdToken" not in names:
            print("ERROR - renova | sem __Host-EldoradoIdToken após login, ver trace | HTTP 401")
            ctx.tracing.stop(path="/home/d/Documents/eldoradov2/.sessao/eldorado-renova-trace.zip")
            browser.close()
            sys.exit(3)

        save_all(ctx, page, verifier, state)
        ctx.tracing.stop(path="/home/d/Documents/eldoradov2/.sessao/eldorado-renova-trace.zip")
        browser.close()
        print("APPROVED - renova | login ok, state+meta exportados | HTTP 200")


def re_compile(pat):
    import re
    return re.compile(pat)


def save_all(ctx, page, verifier, state):
    # storageState (cookies + localStorage) pro script de uso
    ctx.storage_state(path=STATE_PATH)
    print(f"[save] state -> {STATE_PATH}")

    data = page.evaluate("""() => ({
      url: location.href,
      ns_dev: localStorage.getItem('ns_dev_id'),
      forter: localStorage.getItem('forterToken'),
      id_meta: localStorage.getItem('eld-auth-id-token-metadata'),
      ref_meta: localStorage.getItem('eld-auth-refresh-token-metadata'),
      cart_keys: Object.keys(localStorage).filter(k=>k.startsWith('eld-cart')),
      doc_cookie: document.cookie.slice(0,500)
    })""")
    cookies = {c["name"]: c["value"] for c in ctx.cookies()}

    meta = {
        "user_agent": UA,
        "ns_dev_id": data.get("ns_dev") or "",
        "forterToken": data.get("forter") or "",
        "id_exp": (json.loads(data["id_meta"]).get("tokenExpiresIn") if data.get("id_meta") else ""),
        "refresh_exp": (json.loads(data["ref_meta"]).get("tokenExpiresIn") if data.get("ref_meta") else ""),
        "code_verifier_usado": verifier,
        "state_usado": state,
        # tracking ids que o front manda no authenticate (trace #713)
        "x-ga-sessionid": "1789280445",
        "x-ga-userpseudoid": "",
        "x-ms-sid": "",
        "x-ms-vid": "",
        "x-sc-ad-id": "",
        "x-reddit-cookie": "",
        "x-tiktok-cookie": "",
        "x-meta-pixel-id": "",
    }
    # tenta preencher tracking do document.cookie quando visível
    try:
        import re
        dc = data.get("doc_cookie", "")
        for k in ["_ga", "_fbp", "_scid", "_ttp"]:
            m = re.search(k + r"=([^;]+)", dc)
            if m:
                meta[k] = m.group(1)
    except Exception:
        pass

    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"[save] meta -> {META_PATH} ns_dev={meta['ns_dev_id'][:8] if meta['ns_dev_id'] else '?'}... id_exp={meta['id_exp']}")


if __name__ == "__main__":
    main()
