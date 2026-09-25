"""eldorado_pix_api.py — API mínima (stdlib) POST cpf -> copia e cola.

POST /pix  {"cpf":"11 dígitos","roblox_user":"171","quantity":3000,
            "auto_seller":true,"max_delivery_min":20,"min_rating":90}
  -> {"ok":true,"pix_code":"000201...","payment_id":"...","voucher_id":"N-...",
      "quantity":1540,"total":54.06,
      "seller":{"sellerName":"...","offerId":"...","offerVersion":31,"position":24,
                "pricePerUnit":0.03165,"deliveryMaxMin":20,"ratingPercent":97.3}}
  Com auto_seller (padrão) vê todos os vendedores, rejeita entrega max >20min
  e compra do melhor (menor total c/ taxa, lógica de Documents/eldorado).
  Passe "auto_seller":false para usar a oferta fixa (CNLTeam/top).
GET /sellers?quantity=3000&max_delivery_min=20 -> ranking sem comprar.
GET /health -> {"ok":true,"users_me":200}
"""
import json
import hmac
import os
import re
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# Base = pasta deste arquivo (não hardcodar caminho de máquina).
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _BASE_DIR)
try:
    import eldorado_auth as _auth
    _HAS_AUTH = True
except Exception:
    _HAS_AUTH = False

HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
_DATA_DIR = os.environ.get("ELD_DATA_DIR", os.path.join(_BASE_DIR, ".sessao"))
SCRIPT = os.environ.get("ELD_COMPRA_SCRIPT", os.path.join(_BASE_DIR, "eldorado_pix_compra.py"))
STATE_PATH = os.environ.get("ELD_STATE_PATH", os.path.join(_DATA_DIR, "eldorado-state.json"))
META_PATH = os.environ.get("ELD_META_PATH", os.path.join(_DATA_DIR, "eldorado-meta.json"))

# Token compartilhado com o server-consorcio (SOMENTE header X-Gateway-Token).
# B9: removido o fallback `?token=` — token em query vaza em access.log,
# histórico do navegador, `tunnel.log` e logs de proxy.
_API_TOKEN = os.environ.get("ELD_API_TOKEN", "")
if not _API_TOKEN:
    sys.stderr.write("[api] AVISO: ELD_API_TOKEN vazio — /pix sem autenticação (só use em localhost).\n")

# B9: CORS restrito — chamadas são server-to-server (fetch do backend), nunca
# de browser de terceiros. Antes `Access-Control-Allow-Origin: *` permitia que
# qualquer site lesse BR Code + payment_id. Mesma origem não precisa de CORS.
_ALLOWED_ORIGIN = os.environ.get("ELD_ALLOWED_ORIGIN", "http://127.0.0.1:3030")


def is_authorized(handler: BaseHTTPRequestHandler) -> bool:
    if not _API_TOKEN:
        return True
    given = handler.headers.get("X-Gateway-Token", "")
    return bool(given) and hmac.compare_digest(given, _API_TOKEN)


def check_login():
    # Automático via eldorado_auth (item 5): 200 segue; 401 tenta refresh 1x.
    if _HAS_AUTH:
        return _auth.check_login(STATE_PATH, META_PATH)
    import requests
    try:
        st = json.load(open(STATE_PATH))
        meta = json.load(open(META_PATH))
    except Exception as e:
        return 0, f"state/meta ausente: {e}"
    s = requests.Session()
    s.headers.update({"User-Agent": meta.get("user_agent", "")})
    for c in st.get("cookies", []):
        if "eldorado.gg" in c.get("domain", ""):
            try:
                s.cookies.set(c["name"], c["value"], domain=c["domain"], path=c.get("path", "/"))
            except Exception:
                pass
    h = {"X-Xsrf-Token": s.cookies.get("__Host-XSRF-TOKEN", ""),
         "Nsure-Device-Id": meta.get("ns_dev_id", ""),
         "Referer": "https://www.eldorado.gg/"}
    try:
        r = s.get("https://www.eldorado.gg/api/users/me", headers=h, timeout=20)
        if r.status_code == 401:
            # IdToken de 30min expirou: renova via RefreshToken (30d), sem browser/Cloudflare
            rr = s.post("https://www.eldorado.gg/api/authentication/refreshTokens",
                        json={}, headers=h, timeout=25)
            if rr.status_code == 200:
                cookies = [{"name": c.name, "value": c.value, "domain": c.domain,
                            "path": c.path, "expires": c.expires,
                            "httpOnly": True, "secure": True, "sameSite": "Strict"}
                           for c in s.cookies]
                json.dump({"cookies": cookies, "origins": []}, open(STATE_PATH, "w"))
                r = s.get("https://www.eldorado.gg/api/users/me", headers=h, timeout=20)
                if r.status_code == 200:
                    return 200, "renovado via refreshTokens"
        return r.status_code, r.text[:200]
    except Exception as e:
        return 0, str(e)[:200]


def seller_session():
    import requests
    import sys
    sys.path.insert(0, _BASE_DIR)
    if _HAS_AUTH:
        st, meta = _auth.load_session(STATE_PATH, META_PATH)
        s = _auth.build_session(st, meta)
        h = _auth.fp_headers(s, meta, "https://www.eldorado.gg/buy-robux/g/70-0-0")
        return s, h
    st = json.load(open(STATE_PATH))
    meta = json.load(open(META_PATH))
    s = requests.Session()
    s.headers.update({"User-Agent": meta.get("user_agent", "")})
    for c in st.get("cookies", []):
        if "eldorado.gg" in c.get("domain", ""):
            try:
                s.cookies.set(c["name"], c["value"], domain=c["domain"], path=c.get("path", "/"))
            except Exception:
                pass
    h = {"Referer": "https://www.eldorado.gg/buy-robux/g/70-0-0",
         "X-Xsrf-Token": s.cookies.get("__Host-XSRF-TOKEN", ""),
         "Nsure-Device-Id": meta.get("ns_dev_id", "")}
    return s, h


def pick_seller(quantity=None, budget=None, max_delivery_min=20.0, min_rating=90.0):
    # vê todos, filtra tempo>limite, valida os top 5 no fees real e devolve o melhor.
    # quantity: compra exata; budget: calcula unidades por vendedor (modo valor).
    import sys
    sys.path.insert(0, _BASE_DIR)
    from eldorado_sellers import (fetch_all_sellers, select_best,
                                  select_best_for_budget)
    s, h = seller_session()
    raw = fetch_all_sellers(s, h)
    if budget is not None:
        best, ranked, rejected = select_best_for_budget(raw, budget, max_delivery_min, min_rating)
        qty_of = lambda c: c["units"]
    else:
        best, ranked, rejected = select_best(raw, quantity, max_delivery_min, min_rating)
        qty_of = lambda c: quantity
    if not ranked:
        return None, {"sellers_seen": len(raw), "eligible": 0,
                      "rejected_sample": rejected[:8]}
    for cand in ranked[:5]:
        q = qty_of(cand)
        u = (f"https://www.eldorado.gg/api/fees/me/feesForOffer/{cand['offerId']}"
             f"?offerVersion={cand['offerVersion']}&quantity={q}"
             f"&isWithWarranty=false&paymentType=BalanceTopUpPrimer&category=Currency")
        try:
            r = s.get(u, headers=h, timeout=20)
        except Exception:
            continue
        if r.status_code == 200:
            j = r.json()
            sub = float((j.get("orderPriceAfterDiscount") or {}).get("amount", 0))
            tot = float((j.get("needToPay") or {}).get("amount", 0))
            cand = dict(cand)
            cand["quantity"] = q
            cand["fees_subtotal"] = sub
            cand["fees_total"] = tot
            return cand, {"sellers_seen": len(raw), "eligible": len(ranked)}
    return None, {"sellers_seen": len(raw), "eligible": len(ranked),
                  "error": "top 5 falharam no fees real"}


def run_pix(cpf, roblox_user, quantity, offer=None):
    env = dict(os.environ)
    env["ELD_CPF"] = cpf
    env["ELD_ROBLOX_USER"] = roblox_user
    env["ELD_QUANTITY"] = str(quantity)
    if offer:
        env["ELD_OFFER_ID"] = offer["offerId"]
        env["ELD_OFFER_VERSION"] = str(offer["offerVersion"])
        env["ELD_OFFER_POSITION"] = str(offer["position"])
        if offer.get("fx"):
            env["ELD_FX"] = str(offer["fx"])
    try:
        p = subprocess.run([sys.executable, "-u", SCRIPT],
                           capture_output=True, text=True, timeout=120, env=env)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout após 120s", "stage": "subprocess"}
    pix_code = (p.stdout or "").strip()
    err = p.stderr or ""
    m_pay = re.search(r"payment=([0-9a-f-]{36})", err)
    m_n = re.search(r"(N-[0-9a-f-]{36})", err)
    m_tot = re.search(r"\stotal=([\d.]+)", err)
    m_exp = re.search(r"vencimento exibido:\s*(.+)", err)
    if p.returncode == 0 and pix_code.startswith("000201"):
        out = {"ok": True, "pix_code": pix_code,
               "payment_id": m_pay.group(1) if m_pay else "",
               "voucher_id": m_n.group(1) if m_n else "",
               "quantity": quantity,
               "expires_at": m_exp.group(1).strip() if m_exp else "",
               "total": float(m_tot.group(1)) if m_tot else None}
        return out
    detail = err.strip().splitlines()[-1] if err.strip() else f"exit={p.returncode}"
    stage = "primer"
    if "users/me=401" in err or "sessão inválida" in err:
        stage = "login"
    elif "feesForOffer" in err or "offer" in err.lower() and "min" in err.lower():
        stage = "fees"
    elif "initializeWithOffer" in err:
        stage = "initialize"
    return {"ok": False, "error": detail[:500], "stage": stage, "stderr_tail": err[-1500:]}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        sys.stderr.write(f"[api] {a[0] % a[1:]}\n")

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", _ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Gateway-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", _ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Gateway-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/index"):
            html_path = os.environ.get("ELD_HTML", os.path.join(_BASE_DIR, "eldorado_pix.html"))
            try:
                body = open(html_path, "rb").read()
            except Exception as e:
                return self._json(502, {"ok": False, "error": f"html ausente: {e}"})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/health":
            st, detail = check_login()
            self._json(200 if st == 200 else 503,
                       {"ok": st == 200, "users_me": st, "detail": detail[:200]})
        elif self.path.startswith("/sellers"):
            if not is_authorized(self):
                return self._json(401, {"ok": False, "error": "token inválido (X-Gateway-Token)"})
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            budget = None
            for k in ("budget", "value", "valor"):
                if q.get(k):
                    try:
                        budget = float(q[k][0])
                    except Exception:
                        return self._json(400, {"ok": False, "error": "budget inválido"})
                    break
            quantity = None
            if budget is None:
                try:
                    quantity = int((q.get("quantity") or ["3000"])[0])
                except Exception:
                    return self._json(400, {"ok": False, "error": "quantity inválido"})
            maxd = float((q.get("max_delivery_min") or ["20"])[0])
            minr = float((q.get("min_rating") or ["90"])[0])
            import sys
            sys.path.insert(0, _BASE_DIR)
            from eldorado_sellers import (fetch_all_sellers, select_best,
                                          select_best_for_budget)
            try:
                s, h = seller_session()
                raw = fetch_all_sellers(s, h)
                if budget is not None:
                    best, ranked, rejected = select_best_for_budget(raw, budget, maxd, minr)
                else:
                    best, ranked, rejected = select_best(raw, quantity, maxd, minr)
            except Exception as e:
                return self._json(502, {"ok": False, "error": str(e)[:300]})
            keys = ("sellerName", "position", "pricePerUnit", "minQty", "stock",
                    "deliveryMaxMin", "deliveryMedianMin", "ratingPercent",
                    "reviewCount", "total", "offerVersion", "units", "difference")
            slim = [{k: o[k] for k in keys if k in o} for o in ranked[:10]]
            self._json(200, {"ok": True, "budget": budget, "quantity": quantity,
                             "sellers_seen": len(raw), "eligible": len(ranked),
                             "best": slim[0] if slim else None,
                             "ranking": slim, "rejected": len(rejected)})
        else:
            self._json(404, {"ok": False, "error": "use POST /pix, GET /sellers ou GET /health"})

    def do_POST(self):
        if self.path != "/pix":
            return self._json(404, {"ok": False, "error": "use POST /pix"})
        if not is_authorized(self):
            return self._json(401, {"ok": False, "error": "token inválido (X-Gateway-Token)", "stage": "auth"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n).decode() or "{}")
        except Exception:
            return self._json(400, {"ok": False, "error": "JSON inválido"})
        cpf = re.sub(r"\D", "", str(data.get("cpf", "")))
        roblox_user = str(data.get("roblox_user", "171")).strip()
        budget = None
        for k in ("budget", "value", "valor"):
            if data.get(k) not in (None, ""):
                try:
                    budget = float(data[k])
                except Exception:
                    return self._json(400, {"ok": False, "error": "budget inválido"})
                break
        quantity = None
        if budget is None:
            try:
                quantity = int(data.get("quantity", 3000))
            except Exception:
                return self._json(400, {"ok": False, "error": "quantity inválido"})
        else:
            if budget <= 0 or budget > 100000:
                return self._json(400, {"ok": False, "error": "budget fora de 0..100000"})
        if len(cpf) != 11:
            return self._json(400, {"ok": False, "error": "cpf precisa ter 11 dígitos"})
        if not roblox_user:
            return self._json(400, {"ok": False, "error": "roblox_user vazio"})
        if budget is None:
            if quantity is None or quantity <= 0 or quantity > 100000:
                return self._json(400, {"ok": False, "error": "quantity fora de 1..100000"})
        auto_seller = bool(data.get("auto_seller", True))
        try:
            max_delivery_min = float(data.get("max_delivery_min", 20))
            min_rating = float(data.get("min_rating", 90))
        except Exception:
            return self._json(400, {"ok": False, "error": "max_delivery_min/min_rating inválidos"})
        st, _ = check_login()
        if st != 200:
            return self._json(401, {"ok": False, "error": "sessão expirada, rode o renova", "stage": "login"})
        offer, seller_info = None, None
        if auto_seller:
            offer, info = pick_seller(quantity, budget, max_delivery_min, min_rating)
            if not offer:
                return self._json(502, {"ok": False, "error": "nenhum vendedor elegível",
                                        "stage": "sellers", "detail": info})
            if budget is not None:
                quantity = offer["quantity"]
            seller_info = {k: offer[k] for k in ("sellerName", "offerId", "offerVersion", "position",
                                                 "pricePerUnit", "minQty", "stock", "deliveryMaxMin",
                                                 "deliveryMedianMin", "ratingPercent", "reviewCount",
                                                 "fees_subtotal", "fees_total", "quantity", "units",
                                                 "difference") if k in offer}
            seller_info["budget"] = budget
        elif quantity is None:
            return self._json(400, {"ok": False, "error": "sem auto_seller informe quantity"})
        res = run_pix(cpf, roblox_user, quantity, offer)
        if seller_info:
            res["seller"] = seller_info
        self._json(200 if res["ok"] else 502, res)


if __name__ == "__main__":
    print(f"[api] ouvindo em {HOST}:{PORT} (POST /pix, GET /health)", flush=True)
    HTTPServer((HOST, PORT), Handler).serve_forever()
