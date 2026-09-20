"""cloudflare_solver.py — Cloudflare (Turnstile / Challenge) via CapMonster Cloud.

Fluxo (docs.capmonster.cloud/getting-start):
  1. POST https://api.capmonster.cloud/createTask {clientKey, task:{...}} -> taskId
  2. polling POST .../getTaskResult {clientKey, taskId} até status=ready (5-30s)
  3. Turnstile -> solution.token (injeta no form / callback)
     Challenge   -> solution.cf_clearance (seta cookie e recarrega)

No login.eldorado.gg vimos: GET /oauth2/authorize -> 403 + challenge-platform
(Cloudflare Managed Challenge). Com cf_clearance válido o authorize passa e o
fluxo PKCE segue normal.
"""
import os
import re
import time

import requests

API = "https://api.capmonster.cloud"


def load_env(path="/home/d/Documents/eldoradov2/.env"):
    vals = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    vals[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    for k, v in vals.items():
        os.environ.setdefault(k, v)
    return vals


def get_balance(client_key):
    r = requests.post(f"{API}/getBalance", json={"clientKey": client_key}, timeout=20)
    return r.json()


def create_task(client_key, task):
    r = requests.post(f"{API}/createTask",
                      json={"clientKey": client_key, "task": task}, timeout=30)
    d = r.json()
    if d.get("errorId") != 0:
        raise RuntimeError(f"createTask: {d.get('errorCode')} {d}")
    return d["taskId"]


def wait_result(client_key, task_id, timeout=90, poll=5):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = requests.post(f"{API}/getTaskResult",
                          json={"clientKey": client_key, "taskId": task_id}, timeout=30)
        d = r.json()
        if d.get("errorId") != 0:
            raise RuntimeError(f"getTaskResult: {d.get('errorCode')} {d}")
        if d.get("status") == "ready":
            return d.get("solution", {})
        time.sleep(poll)
    raise TimeoutError("capmonster sem ready em 90s")


def extract_sitekey(html):
    # iframe challenges.cloudflare.com/turnstile/...k=<SITEKEY> ou data-sitekey
    m = re.search(r"challenges\.cloudflare\.com/turnstile/[^\"']*[?&]k=([0-9a-zA-Z_-]+)", html)
    if m:
        return m.group(1)
    m = re.search(r'data-sitekey="([^"]+)"', html)
    return m.group(1) if m else ""


def is_cf_challenge_page(page):
    try:
        title = (page.title() or "").lower()
        html = page.content()
    except Exception:
        return False
    return ("just a moment" in title or "challenge-platform" in html
            or "challenges.cloudflare.com" in html or "cf-turnstile" in html)


def solve_page(page, client_key=None, proxy=None):
    """Detecta e resolve Turnstile/Challenge na página atual. Retorna True se resolveu."""
    load_env()
    client_key = client_key or os.environ.get("CAPMONSTER_API_KEY", "")
    if not client_key:
        print("[cf] sem CAPMONSTER_API_KEY no .env — pulando solver")
        return False
    html = page.content()
    url = page.url
    sitekey = extract_sitekey(html)
    if not sitekey:
        print("[cf] challenge sem sitekey extraível — tenta recarregar após 5s")
        page.wait_for_timeout(5000)
        return is_cf_challenge_page(page) is False
    ua = page.evaluate("() => navigator.userAgent")
    task = {"type": "TurnstileTask", "websiteURL": url.split("?")[0],
            "websiteKey": sitekey, "userAgent": ua}
    if proxy:
        task.update(proxy)
    print(f"[cf] Turnstile sitekey={sitekey[:8]}... criando task...")
    task_id = create_task(client_key, task)
    sol = wait_result(client_key, task_id)
    token = sol.get("token", "")
    if sol.get("cf_clearance"):
        ctx = page.context()
        ctx.add_cookies([{"name": "cf_clearance", "value": sol["cf_clearance"],
                          "domain": "login.eldorado.gg", "path": "/"}])
        print("[cf] cf_clearance aplicado, recarregando...")
        page.reload(wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3000)
        return not is_cf_challenge_page(page)
    if not token:
        print("[cf] sem token na solução")
        return False
    # injeta token no Turnstile (textarea cf-turnstile-response + callback)
    page.evaluate("""(tok) => {
      let ta = document.querySelector('textarea[name="cf-turnstile-response"]');
      if (!ta) { ta = document.createElement('textarea'); ta.name = 'cf-turnstile-response';
                 ta.style.display = 'none'; document.body.appendChild(ta); }
      ta.value = tok;
      if (window.turnstile && turnstile.getResponse === undefined) {}
      const ifr = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
      if (ifr) { try { ifr.contentWindow.postMessage({event: 'token', token: tok}, '*'); } catch(e){} }
    }""", token)
    page.wait_for_timeout(3000)
    # se o challenge auto-submete, espera sair da página de challenge
    try:
        page.wait_for_function("() => !document.title.toLowerCase().includes('just a moment')",
                               timeout=15000)
    except Exception:
        pass
    ok = not is_cf_challenge_page(page)
    print(f"[cf] turnstile {'OK' if ok else 'ainda em challenge'}")
    return ok
