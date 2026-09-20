"""
eldorado_usa_sessao.py
Usa APENAS os dados já capturados (sem fazer login).
Carrega storage_state + cookies exportados pelo renovador e faz calls autenticadas.
Ponto de entrada para o fluxo de compra no PIX que tu vai mandar.

Arquivos esperados (gerados pelo eldorado_renova_login.py):
  .sessao/eldorado-state.json  -> storageState do Playwright (cookies + localStorage)
  .sessao/eldorado-meta.json   -> headers fingerprint (ns_device, xsrf, ua, ids)

Uso:
  python3 /home/d/Documents/eldoradov2/eldorado_usa_sessao.py
"""
import json
import os
import sys
import time
import requests

sys.path.insert(0, "/home/d/Documents/eldoradov2")
try:
    import eldorado_auth as _auth
    _HAS_AUTH = True
except Exception:
    _HAS_AUTH = False

STATE_PATH = os.environ.get("ELD_STATE_PATH",
                            "/home/d/Documents/eldoradov2/.sessao/eldorado-state.json")
META_PATH = os.environ.get("ELD_META_PATH",
                           "/home/d/Documents/eldoradov2/.sessao/eldorado-meta.json")

BASE_WWW = "https://www.eldorado.gg"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"

# headers fixos observados no trace #713 (authenticate) e nos GETs pós-auth
CLIENT_BUILD = "2026-09-10_12:31:42"


def load_state():
    if not os.path.exists(STATE_PATH):
        print(f"ERRO - state não encontrado: {STATE_PATH}")
        print("Roda primeiro o eldorado_renova_login.py para gerar a sessão.")
        sys.exit(2)
    with open(STATE_PATH, "r") as f:
        state = json.load(f)
    meta = {}
    if os.path.exists(META_PATH):
        with open(META_PATH, "r") as f:
            meta = json.load(f)
    return state, meta


def build_session(state, meta):
    s = requests.Session()
    s.headers.update({
        "User-Agent": meta.get("user_agent", UA),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": '"Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Linux"',
        "X-Client-Build-Time": CLIENT_BUILD,
    })
    # cookies do storageState -> Session
    # storageState formato Playwright: {"cookies":[...], "origins":[...]}
    cookies = state.get("cookies", [])
    for c in cookies:
        # só injeta o que é do eldorado, ignora tracker de terceiro pra não sujar
        dom = c.get("domain", "")
        if "eldorado.gg" not in dom and "nsureapi.com" not in dom:
            continue
        # requests aceita domain com ponto inicial, path, secure
        s.cookies.set(
            c["name"], c["value"],
            domain=dom, path=c.get("path", "/"),
            secure=c.get("secure", True),
        )
    # localStorage útil vai no meta, não no cookie jar
    # origins do storageState tem localStorage por origin
    return s


def get_fingerprint_headers(s, meta):
    # __Host-XSRF-TOKEN precisa ir como header X-Xsrf-Token (trace #713)
    xsrf = s.cookies.get("__Host-XSRF-TOKEN", "")
    ns_device = meta.get("ns_dev_id", "")
    # fallbacks vindos do meta exportado no renovador
    headers = {}
    if xsrf:
        headers["X-Xsrf-Token"] = xsrf
    if ns_device:
        headers["Nsure-Device-Id"] = ns_device
    # ids de tracking que o front manda junto e o antifraude confere
    for k in ["x-ga-sessionid", "x-ga-userpseudoid", "x-ms-sid", "x-ms-vid",
              "x-sc-ad-id", "x-reddit-cookie", "x-tiktok-cookie", "x-meta-pixel-id"]:
        if k in meta:
            # converte x-ga-sessionid -> X-Ga-Sessionid etc, requests é case-insensitive
            headers[k] = meta[k]
    return headers


def check_auth(s, extra_headers):
    # prova de sessão: endpoints que no trace retornaram 200/201/204 logado
    # GET /api/users/me -> 200 logado, 401 deslogado
    try:
        r = s.get(f"{BASE_WWW}/api/users/me", headers=extra_headers, timeout=20)
        print(f"[check] GET /api/users/me -> {r.status_code} {r.text[:300]}")
        return r.status_code
    except Exception as e:
        print(f"[check] erro users/me: {e}")
        return 0


def main():
    if _HAS_AUTH:
        # Caminho automático (item 5): check + refresh silencioso se 401.
        try:
            state, meta = _auth.load_session(STATE_PATH, META_PATH)
        except Exception as e:
            print(f"ERRO - state não encontrado: {e}")
            print("Roda primeiro o eldorado_renova_login.py para gerar a sessão.")
            sys.exit(2)
        s = _auth.build_session(state, meta)
        fp = _auth.fp_headers(s, meta, f"{BASE_WWW}/")
        print(f"[info] cookies carregados: {len(list(s.cookies))}")
        for c in s.cookies:
            if c.name in ("__Host-EldoradoIdToken", "__Host-EldoradoRefreshToken", "__Host-DCID", "__Host-XSRF-TOKEN"):
                print(f"  {c.name} len={len(c.value)} domain={c.domain}")
        try:
            _auth.ensure_logged_in(s, meta, f"{BASE_WWW}/")
            print("APPROVED - sessao_atual | users/me 200, sessão válida | HTTP 200")
        except SystemExit as e:
            sys.exit(e.code)
        print("[info] sessão pronta pro fluxo PIX. Manda os endpoints do checkout que eu plugo aqui.")
        return
    state, meta = load_state()
    s = build_session(state, meta)
    fp = get_fingerprint_headers(s, meta)

    print(f"[info] cookies carregados: {len(list(s.cookies))}")
    for c in s.cookies:
        if c.name in ("__Host-EldoradoIdToken", "__Host-EldoradoRefreshToken", "__Host-DCID", "__Host-XSRF-TOKEN"):
            print(f"  {c.name} len={len(c.value)} domain={c.domain}")

    print(f"[info] meta: ns_dev_id={meta.get('ns_dev_id','?')[:8]}... xsrf={s.cookies.get('__Host-XSRF-TOKEN','')[:10]}...")
    print(f"[info] id exp: {meta.get('id_exp','?')} refresh exp: {meta.get('refresh_exp','?')}")

    code = check_auth(s, fp)
    if code == 200:
        print("APPROVED - sessao_atual | users/me 200, sessão válida | HTTP 200")
    elif code == 401:
        print("ERROR - sessao_atual | 401, IdToken expirado ou DCID/forger divergiu, roda o renovador | HTTP 401")
        sys.exit(3)
    else:
        print(f"ERROR - sessao_atual | users/me retornou {code}, ver trace | HTTP {code}")
        sys.exit(4)

    # ===== PONTO DE ENTRADA DO FLUXO PIX =====
    # Cola aqui os passos que tu vai mandar (ex: criar oferta, checkout, gerar QR).
    # Exemplo do padrão que vamos usar pra cada passo:
    #
    # r = s.post(f"{BASE_WWW}/api/ Pix /...", json={...}, headers=fp, timeout=20)
    # print(r.status_code, r.text[:1000])
    #
    # Regras que o trace mostrou que valem pra compra também:
    # - sempre manda fp (X-Xsrf-Token + Nsure-Device-Id) junto
    # - Referer tem que ser a página do checkout, não vazio
    # - SameSite=strict: faz um GET top-level antes do POST pra fixar contexto
    # - não reusa idempotency/code, gera novo a cada tentativa
    print("[info] sessão pronta pro fluxo PIX. Manda os endpoints do checkout que eu plugo aqui.")

if __name__ == "__main__":
    main()
