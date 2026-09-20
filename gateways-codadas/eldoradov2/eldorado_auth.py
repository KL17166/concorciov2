"""
eldorado_auth.py — sessão auto-renovável (item 5 do FLUXO.md).

Replica o "erro" achado no bundle chunk-QSQAANSS.js:
  postAuthRequest -> POST authentication/authenticate
  refreshTokens() -> POST authentication/refreshTokens

O refresh troca o cookie __Host-EldoradoRefreshToken (30d) por um
__Host-EldoradoIdToken novo (30min) via www puro, sem browser e sem
Cloudflare (o www nunca tem challenge). Provado em 13/09: snapshot sem
IdToken -> /health 200 + IdToken len 1234 de volta.

Uso automático:
  from eldorado_auth import load_session, build_session, fp_headers
  from eldorado_auth import ensure_logged_in, authed_request, check_login

  state, meta = load_session()          # respeita ELD_STATE_PATH / ELD_META_PATH
  s = build_session(state, meta)
  ensure_logged_in(s, meta, referer)    # 200 ok; 401 tenta refresh 1x e regrava
  r = authed_request(s, meta, "GET", url, referer)  # retry auto em 401

CLI:
  python3 eldorado_auth.py --check        # users/me (tenta refresh se 401)
  python3 eldorado_auth.py --refresh-now  # força refresh mesmo com 200
  python3 eldorado_auth.py --prove        # replica a prova: remove IdToken só
                                          # em memória, refresha, mostra 200+len
"""
import json
import os
import sys

# Sessão persistente em .sessao/ — REGRA: nunca depender de /tmp.
# Override explícito continua valendo: ELD_STATE_PATH / ELD_META_PATH.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.environ.get("ELD_DATA_DIR", os.path.join(_BASE_DIR, ".sessao"))
STATE_PATH = os.environ.get("ELD_STATE_PATH", os.path.join(_DATA_DIR, "eldorado-state.json"))
META_PATH = os.environ.get("ELD_META_PATH", os.path.join(_DATA_DIR, "eldorado-meta.json"))

BASE_WWW = "https://www.eldorado.gg"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36")
CLIENT_BUILD = "2026-09-10_12:31:42"
REFRESH_URL = f"{BASE_WWW}/api/authentication/refreshTokens"
ME_URL = f"{BASE_WWW}/api/users/me"


def _log(msg):
    print(msg, file=sys.stderr)


def load_session(state_path=None, meta_path=None):
    sp = state_path or os.environ.get("ELD_STATE_PATH", STATE_PATH)
    mp = meta_path or os.environ.get("ELD_META_PATH", META_PATH)
    if not os.path.exists(sp):
        raise FileNotFoundError(f"state não encontrado {sp}, roda o renova primeiro")
    with open(sp) as f:
        state = json.load(f)
    meta = {}
    if os.path.exists(mp):
        with open(mp) as f:
            meta = json.load(f)
    return state, meta


def build_session(state, meta):
    import requests
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
    for c in state.get("cookies", []):
        if "eldorado.gg" not in c.get("domain", ""):
            continue
        s.cookies.set(c["name"], c["value"], domain=c["domain"],
                      path=c.get("path", "/"), secure=c.get("secure", True))
    return s


def fp_headers(s, meta, referer):
    h = {"Referer": referer}
    xsrf = ""
    try:
        xsrf = s.cookies.get("__Host-XSRF-TOKEN", "")
    except Exception:
        pass
    if xsrf:
        h["X-Xsrf-Token"] = xsrf
    if meta.get("ns_dev_id"):
        h["Nsure-Device-Id"] = meta["ns_dev_id"]
    for k, hk in (("x-ga-sessionid", "X-Ga-Sessionid"),
                  ("x-ga-userpseudoid", "X-Ga-Userpseudoid"),
                  ("x-ms-sid", "X-Ms-Sid"),
                  ("x-ms-vid", "X-Ms-Vid"),
                  ("x-sc-ad-id", "X-Sc-Ad-Id"),
                  ("x-reddit-cookie", "X-Reddit-Cookie"),
                  ("x-tiktok-cookie", "X-Tiktok-Cookie"),
                  ("x-meta-pixel-id", "X-Meta-Pixel-Id")):
        if meta.get(k):
            h[hk] = meta[k]
    return h


def save_state(s, refresh_json=None, state_path=None, meta_path=None):
    """Regrava o snapshot Playwright a partir do cookie jar vivo.

    Preserva o formato {"cookies": [...], "origins": []} e atualiza
    meta.id_exp com tokenExpiresIn do refresh (quando vier).
    """
    import json as _json
    import os as _os
    sp = state_path or _os.environ.get("ELD_STATE_PATH", STATE_PATH)
    mp = meta_path or _os.environ.get("ELD_META_PATH", META_PATH)
    cookies = [{"name": c.name, "value": c.value, "domain": c.domain,
                "path": c.path, "expires": getattr(c, "expires", None),
                "httpOnly": True, "secure": True, "sameSite": "Strict"}
               for c in s.cookies]
    _json.dump({"cookies": cookies, "origins": []}, open(sp, "w"))
    if refresh_json and isinstance(refresh_json, dict):
        try:
            exp = refresh_json.get("tokenExpiresIn", "")
            if exp and _os.path.exists(mp):
                meta = _json.load(open(mp))
                meta["id_exp"] = exp
                _json.dump(meta, open(mp, "w"), indent=2)
        except Exception as e:
            _log(f"[warn] atualiza meta id_exp {e}")
    return sp


def refresh_tokens(s, meta, referer, timeout=25):
    """Tenta 1x o bypass do item 5. Retorna (ok, detalhe).

    Não precisa de IdToken válido nem de browser: só do cookie
    __Host-EldoradoRefreshToken (30d) + XSRF + Nsure-Device-Id.
    Em 200 o jar já contém o IdToken novo (Set-Cookie aplicado pelo
    requests) — basta regavar o snapshot.
    """
    try:
        rr = s.post(REFRESH_URL, json={},
                    headers=fp_headers(s, meta, referer), timeout=timeout)
    except Exception as e:
        return False, f"refreshTokens exception {e}"[:200]
    if rr.status_code != 200:
        return False, f"refreshTokens {rr.status_code} {rr.text[:200]}"
    try:
        body = rr.json()
    except Exception:
        body = {}
    try:
        save_state(s, body)
    except Exception as e:
        _log(f"[warn] salva state {e}")
    new_len = len(s.cookies.get("__Host-EldoradoIdToken", "") or "")
    _log(f"[auth] refreshTokens 200 -> IdToken novo len={new_len}")
    return True, body


def ensure_logged_in(s, meta, referer, autofix=True):
    """Prova de sessão. 200 segue; 401 tenta refresh 1x e tenta de novo.

    Retorna True se logado. Levanta SystemExit(2/3) com mensagem acionável
    se não há state ou se o refresh falhou (Refresh 30d morto).
    Usado no início do fluxo E antes do initialize (passo sensível).
    """
    try:
        r = s.get(ME_URL, headers=fp_headers(s, meta, referer), timeout=20)
    except Exception as e:
        _fail(f"falha no check de login: {e}")
    if r.status_code == 200:
        _log("[check] users/me 200 - logado")
        return True
    if r.status_code == 401 and autofix:
        ok, detail = refresh_tokens(s, meta, referer)
        if ok:
            try:
                r2 = s.get(ME_URL, headers=fp_headers(s, meta, referer), timeout=20)
            except Exception as e:
                _fail(f"falha no re-check após refresh: {e}")
            if r2.status_code == 200:
                _log("[check] users/me 200 - logado (renovado via refreshTokens)")
                return True
        _fail("sessão inválida users/me=401, IdToken expirado e refresh falhou. "
              "Roda o renova: ELD_EMAIL=... ELD_PASS=... "
              "python3 /home/d/Documents/eldoradov2/eldorado_renova_login.py "
              f"({detail if isinstance(detail, str) else 'ver stderr'})")
    _fail(f"sessão inválida users/me={r.status_code}. {r.text[:200]}")
    return False


def authed_request(s, meta, method, url, referer, auto_refresh=True, timeout=20, **kw):
    """requests com auto-cura: em 401 tenta refresh 1x e repete 1x.

    Replica o comportamento do SDK do site (que chama refreshTokens
    sozinho) para qualquer passo do fluxo: fees, sellers, clientToken,
    initialize, offerDetails, etc.
    """
    kw.setdefault("timeout", timeout)
    if "headers" not in kw or kw["headers"] is None:
        kw["headers"] = fp_headers(s, meta, referer)
    r = s.request(method, url, **kw)
    if r.status_code == 401 and auto_refresh:
        ok, _ = refresh_tokens(s, meta, referer)
        if ok:
            kw["headers"] = fp_headers(s, meta, referer)
            r = s.request(method, url, **kw)
    return r


def check_login(state_path=None, meta_path=None):
    """Para GET /health da API. Retorna (code, detail)."""
    try:
        state, meta = load_session(state_path, meta_path)
    except Exception as e:
        return 0, f"state/meta ausente: {e}"
    try:
        s = build_session(state, meta)
        r = s.get(ME_URL, headers=fp_headers(s, meta, f"{BASE_WWW}/"),
                  timeout=20)
        if r.status_code == 401:
            ok, detail = refresh_tokens(s, meta, f"{BASE_WWW}/")
            if ok:
                r = s.get(ME_URL, headers=fp_headers(s, meta, f"{BASE_WWW}/"),
                          timeout=20)
                if r.status_code == 200:
                    return 200, "renovado via refreshTokens"
        return r.status_code, r.text[:200]
    except Exception as e:
        return 0, str(e)[:200]


def _fail(msg, code=2):
    print(f"ERROR - auth | {msg}", file=sys.stderr)
    raise SystemExit(code)


def _cli():
    import argparse
    ap = argparse.ArgumentParser(description="auth auto-renovável eldorado (item 5)")
    ap.add_argument("--check", action="store_true", help="users/me (tenta refresh se 401)")
    ap.add_argument("--refresh-now", action="store_true", help="força refresh mesmo com 200")
    ap.add_argument("--prove", action="store_true", help="replica a prova: IdToken fora (só memória) -> refresh -> 200")
    a = ap.parse_args()
    if not (a.check or a.refresh_now or a.prove):
        ap.print_help()
        return 2
    try:
        state, meta = load_session()
    except Exception as e:
        print(f"ERROR - auth | {e}", file=sys.stderr)
        return 2
    s = build_session(state, meta)
    if a.refresh_now:
        ok, detail = refresh_tokens(s, meta, f"{BASE_WWW}/")
        print(f"refresh-now: ok={ok} detail={str(detail)[:300]}")
        if ok:
            r = s.get(ME_URL, headers=fp_headers(s, meta, f"{BASE_WWW}/"), timeout=20)
            print(f"users/me: {r.status_code} IdToken len={len(s.cookies.get('__Host-EldoradoIdToken','') or '')}")
        return 0 if ok else 3
    if a.prove:
        # prova sem destruir o arquivo: tira o IdToken só do jar em memória
        s.cookies.clear(domain="www.eldorado.gg", path="/", name="__Host-EldoradoIdToken")
        print(f"IdToken removido (memória). len agora={len(s.cookies.get('__Host-EldoradoIdToken','') or '')}")
        r0 = s.get(ME_URL, headers=fp_headers(s, meta, f"{BASE_WWW}/"), timeout=20)
        print(f"users/me sem IdToken: {r0.status_code}")
        ok, detail = refresh_tokens(s, meta, f"{BASE_WWW}/")
        print(f"refresh: ok={ok}")
        r1 = s.get(ME_URL, headers=fp_headers(s, meta, f"{BASE_WWW}/"), timeout=20)
        print(f"users/me pós-refresh: {r1.status_code} IdToken len={len(s.cookies.get('__Host-EldoradoIdToken','') or '')}")
        return 0 if (ok and r1.status_code == 200) else 3
    # --check
    try:
        ensure_logged_in(s, meta, f"{BASE_WWW}/")
        print("APPROVED - auth | users/me 200 | HTTP 200")
        return 0
    except SystemExit as e:
        return e.code


if __name__ == "__main__":
    sys.exit(_cli())
