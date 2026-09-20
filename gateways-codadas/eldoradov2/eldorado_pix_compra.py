"""
eldorado_pix_compra.py
Replica em requests puro o fluxo capturado até o PIX copia e cola aparecer.
No final imprime SÓ o copia e cola (para colar no app do banco).

Cadeia fiel ao trace:
  feesForOffer -> delivery-details -> clientToken -> client-session(stripe)
  -> initializeWithOffer 201 (id d070...) -> offerDetails PUT (Pix)
  -> Primer configuration -> payment-instruments -> client-session/actions DLOCAL_PIX
  -> Primer payments -> redirectUrl dlocal N-... + resume-token PENDING
  -> GET voucher dlocal -> regex 000201... -> print

Entradas (não hardcodeia single-use nem PII):
   env ELD_CPF            -> CPF só números (exigido pelo DLOCAL_PIX)
   env ELD_ROBLOX_USER    -> RobloxUsername (no trace foi 171)
   .sessao/eldorado-state.json -> cookies __Host-* (gerado pelo renova)
   .sessao/eldorado-meta.json  -> ns_dev_id, xsrf, tracking

Uso:
  ELD_CPF="..." ELD_ROBLOX_USER="171" python3 /home/d/Documents/eldoradov2/eldorado_pix_compra.py
  # saída final: linha única com o 000201...
"""
import json
import os
import re
import sys
import time
import requests

# Auth auto-renovável (item 5): refreshTokens via www, sem browser/Cloudflare.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _BASE_DIR)
try:
    from eldorado_auth import (
        build_session as _auth_build_session,
        fp_headers as _auth_fp_headers,
        ensure_logged_in as _auth_ensure_logged_in,
        authed_request as _auth_request,
        load_session as _auth_load_session,
    )
    _HAS_AUTH = True
except Exception:
    _HAS_AUTH = False

_DATA_DIR = os.environ.get("ELD_DATA_DIR", os.path.join(_BASE_DIR, ".sessao"))
STATE_PATH = os.environ.get("ELD_STATE_PATH", os.path.join(_DATA_DIR, "eldorado-state.json"))
META_PATH = os.environ.get("ELD_META_PATH", os.path.join(_DATA_DIR, "eldorado-meta.json"))

BASE_WWW = "https://www.eldorado.gg"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
CLIENT_BUILD = "2026-09-10_12:31:42"

# oferta: padrão CNLTeam (top 1); auto-seletor injeta via env (ELD_OFFER_ID etc.)
OFFER_ID = os.environ.get("ELD_OFFER_ID", "65733a36-630b-4e4e-b4a0-0ccf29115cff")
OFFER_VERSION = int(os.environ.get("ELD_OFFER_VERSION", "6836"))  # ponto de partida; discover avança sozinho
QUANTITY = int(os.environ.get("ELD_QUANTITY", "3000"))
OFFER_POSITION = os.environ.get("ELD_OFFER_POSITION", "1")
GAME_ID = "70"
CATEGORY = "Currency"
EXPECTED_PRICE = 117.85  # atualizado pelo feesForOffer fresco
EXPECTED_FX = float(os.environ.get("ELD_FX", "5.27516148"))
PRICE_PER_UNIT = 0.03587  # recalculado pelo fees fresco


def discover_offer_version(s, headers):
    # a oferta muda com frequência (preço/estoque). O backend responde 400
    # "The offer has recently been modified" quando a versão está velha.
    # Varre a partir da versão capturada até achar a atual e devolve
    # (version, price_per_unit, expected_price) frescos.
    for v in range(OFFER_VERSION, OFFER_VERSION + 50):
        u = (f"{BASE_WWW}/api/fees/me/feesForOffer/{OFFER_ID}"
             f"?offerVersion={v}&quantity={QUANTITY}"
             f"&isWithWarranty=false&paymentType=BalanceTopUpPrimer&category={CATEGORY}")
        r = s.get(u, headers=headers, timeout=20)
        if r.status_code == 200:
            j = r.json()
            subtotal = float((j.get("orderPriceAfterDiscount") or {}).get("amount", 0))
            total = float((j.get("needToPay") or {}).get("amount", 0))
            ppu = round(subtotal / QUANTITY, 6) if subtotal else PRICE_PER_UNIT
            print(f"[fees] version={v} subtotal={subtotal} fees={(j.get('fees') or {}).get('amount')} total={total}",
                  file=sys.stderr)
            return v, ppu, total, j
    fail("não achei versão atual da oferta (fees 400 em 50 tentativas)")


def ensure_logged_in(s, meta, referer):
    # Automático via eldorado_auth (item 5): 200 segue; 401 tenta 1x
    # POST refreshTokens (Refresh 30d, sem browser/Cloudflare) e regrava.
    if _HAS_AUTH:
        return _auth_ensure_logged_in(s, meta, referer)
    # fallback legado (sem módulo): mesma lógica inline
    import os as _os, json as _json
    try:
        r = s.get(f"{BASE_WWW}/api/users/me",
                  headers=fp_headers(s, meta, referer), timeout=20)
        if r.status_code == 200:
            print("[check] users/me 200 - logado", file=sys.stderr)
            return True
        if r.status_code == 401:
            try:
                rr = s.post(f"{BASE_WWW}/api/authentication/refreshTokens",
                            json={}, headers=fp_headers(s, meta, referer), timeout=25)
                if rr.status_code == 200:
                    try:
                        sp = _os.environ.get("ELD_STATE_PATH", STATE_PATH)
                        cookies = [{"name": c.name, "value": c.value, "domain": c.domain,
                                    "path": c.path, "expires": getattr(c, "expires", None),
                                    "httpOnly": True, "secure": True, "sameSite": "Strict"}
                                   for c in s.cookies]
                        _json.dump({"cookies": cookies, "origins": []}, open(sp, "w"))
                    except Exception as e:
                        print(f"[warn] salva state {e}", file=sys.stderr)
                    r = s.get(f"{BASE_WWW}/api/users/me",
                              headers=fp_headers(s, meta, referer), timeout=20)
                    if r.status_code == 200:
                        print("[check] users/me 200 - logado (renovado via refreshTokens)",
                              file=sys.stderr)
                        return True
            except Exception as e:
                print(f"[warn] refreshTokens {e}", file=sys.stderr)
            fail("sessão inválida users/me=401, IdToken expirado. Roda o renova: ELD_EMAIL=... ELD_PASS=... python3 /home/d/Documents/eldoradov2/eldorado_renova_login.py")
        fail(f"sessão inválida users/me={r.status_code}. {r.text[:200]}")
    except SystemExit:
        raise
    except Exception as e:
        fail(f"falha no check de login: {e}")
    return False


def fail(msg, code=2):
    print(f"ERROR - pix | {msg}", file=sys.stderr)
    sys.exit(code)


def _req(s, meta, method, url, referer, **kw):
    # Wrapper automático: qualquer 401 no meio do fluxo tenta refresh 1x
    # e repete (replica o SDK do site). Sem o módulo, request direto.
    kw.setdefault("timeout", 20)
    if _HAS_AUTH:
        return _auth_request(s, meta, method, url, referer, **kw)
    if "headers" not in kw or kw["headers"] is None:
        kw["headers"] = fp_headers(s, meta, referer)
    return s.request(method, url, **kw)


def load_session():
    if _HAS_AUTH:
        state, meta = _auth_load_session()
    else:
        sp, mp = STATE_PATH, META_PATH
        if not os.path.exists(sp):
            fail(f"state não encontrado {STATE_PATH}, roda o renova primeiro")
        with open(sp) as f:
            state = json.load(f)
        meta = {}
        if os.path.exists(mp):
            with open(mp) as f:
                meta = json.load(f)
    cpf = re.sub(r"\D", "", os.environ.get("ELD_CPF", ""))
    roblox_user = os.environ.get("ELD_ROBLOX_USER", "171").strip()
    if len(cpf) != 11:
        fail("ELD_CPF inválido: exporta ELD_CPF com 11 dígitos (só números)")
    if not roblox_user:
        fail("ELD_ROBLOX_USER vazio")
    return state, meta, cpf, roblox_user


def build_session(state, meta):
    if _HAS_AUTH:
        return _auth_build_session(state, meta)
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
        s.cookies.set(c["name"], c["value"], domain=c["domain"], path=c.get("path", "/"), secure=c.get("secure", True))
    return s


def fp_headers(s, meta, referer):
    if _HAS_AUTH:
        return _auth_fp_headers(s, meta, referer)
    h = {"Referer": referer}
    xsrf = s.cookies.get("__Host-XSRF-TOKEN", "")
    if xsrf:
        h["X-Xsrf-Token"] = xsrf
    if meta.get("ns_dev_id"):
        h["Nsure-Device-Id"] = meta["ns_dev_id"]
    h["X-Ga-Sessionid"] = meta.get("x-ga-sessionid", "1789280445")
    if meta.get("x-ga-userpseudoid"):
        h["X-Ga-Userpseudoid"] = meta["x-ga-userpseudoid"]
    if meta.get("x-ms-sid"):
        h["X-Ms-Sid"] = meta["x-ms-sid"]
    if meta.get("x-ms-vid"):
        h["X-Ms-Vid"] = meta["x-ms-vid"]
    if meta.get("x-sc-ad-id"):
        h["X-Sc-Ad-Id"] = meta["x-sc-ad-id"]
    if meta.get("x-reddit-cookie"):
        h["X-Reddit-Cookie"] = meta["x-reddit-cookie"]
    if meta.get("x-tiktok-cookie"):
        h["X-Tiktok-Cookie"] = meta["x-tiktok-cookie"]
    if meta.get("x-meta-pixel-id"):
        h["X-Meta-Pixel-Id"] = meta["x-meta-pixel-id"]
    return h


def extract_primer_inner(outer_token: str) -> str:
    # O /clientToken devolve um JWT outer cujo payload tem o accessToken interno.
    # O SDK usa esse inner como header primer-client-token (não Authorization Basic).
    # Prova: SHORT==INNER byte a byte na captura 07:26 UTC.
    import base64
    try:
        parts = outer_token.split(".")
        pad = "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + pad).decode())
        inner = payload.get("accessToken", "")
        if inner:
            return inner
    except Exception:
        pass
    return ""


def primer_headers(inner_token: str, checkout_session_id: str, referer: str):
    import uuid
    return {
        "primer-client-token": inner_token,
        "primer-sdk-client": "WEB",
        "primer-sdk-checkout-session-id": checkout_session_id,
        "primer-sdk-version": "primer-js-1.7.0_sdk-core-0.15.0",
        "x-api-version": "2.4",
        "Content-Type": "application/json",
        "Referer": referer,
        "x-request-id": str(uuid.uuid4()),
    }


def primer_via_browser(primer_client_token, order_url, pix_config_id):
    # Mantido por compatibilidade, mas o fluxo atual usa Primer via requests
    # com os headers corretos do SDK (primer-client-token). Ver primer_via_requests.
    return {}
    # O Primer bloqueia o JA3 do requests (403 SecurityPolicyBlock) mas libera o do
    # Chrome real no mesmo IP. Roda só esse trecho dentro do browser com o mesmo
    # perfil/sessão e devolve o JSON do /payments (com redirectUrl N-...).
    import shutil
    import tempfile
    from playwright.sync_api import sync_playwright
    src = "/home/d/.cache/ms-playwright-mcp/mcp-chrome-53389b0"
    tmp = tempfile.mkdtemp(prefix="eldoprimer")
    # copia o perfil pra não brigar com lock (só cookies importam aqui)
    try:
        shutil.copytree(src, tmp + "/prof", ignore=shutil.ignore_patterns("Singleton*", "lockfile", "LOCK"))
        udir = tmp + "/prof"
    except Exception:
        udir = src
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(user_data_dir=udir, headless=True,
            user_agent=UA)
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        pg.goto(order_url, timeout=45000)
        pg.wait_for_timeout(2000)
        out = pg.evaluate("""async ({tok, pixId}) => {
          const H = {"Authorization": "Basic "+tok, "Content-Type": "application/json"};
          const cfg = await (await fetch("https://api.primer.io/client-sdk/configuration", {headers: H})).json();
          const pix = (cfg.paymentMethods||[]).find(m=>m.type==="DLOCAL_PIX")||{};
          const pid = pix.id || pixId;
          const inst = await (await fetch("https://sdk.api.primer.io/payment-instruments", {
            method: "POST", headers: H,
            body: JSON.stringify({paymentInstrument:{type:"OFF_SESSION_PAYMENT", paymentMethodType:"DLOCAL_PIX",
              paymentMethodConfigId: pid,
              sessionInfo:{locale:"en-GB", platform:"WEB",
                browserInfo:{javaEnabled:false, language:"en-US", colorDepth:24, screenHeight:1152,
                  screenWidth:2048, timezoneOffset:240, userAgent:navigator.userAgent},
                merchantRedirectUrl: location.href, redirectMode:"POPUP"}}})})).json();
          const pmt = inst.paymentMethodToken || inst.id || "";
          await fetch("https://sdk.api.primer.io/client-session/actions", {
            method:"POST", headers:H,
            body: JSON.stringify({actions:[{type:"SELECT_PAYMENT_METHOD",params:{paymentMethodType:"DLOCAL_PIX"}}]})});
          const pay = await (await fetch("https://sdk.api.primer.io/payments", {
            method:"POST", headers:H, body: JSON.stringify({paymentMethodToken: pmt})})).json();
          return {pay, pmtLen: (pmt||"").length};
        }""", {"tok": primer_client_token, "pixId": pix_config_id})
        ctx.close()
    try:
        shutil.rmtree(tmp, ignore_errors=True)
    except Exception:
        pass
    return out.get("pay", {})


def main():
    state, meta, cpf, roblox_user = load_session()
    s = build_session(state, meta)
    order_url = (f"{BASE_WWW}/order-summary/{OFFER_ID}"
                 f"?quantity={QUANTITY}&category={CATEGORY}&offerPosition={OFFER_POSITION}&gameId={GAME_ID}")

    # 1. prova de sessão (check obrigatório antes de cada fluxo)
    ensure_logged_in(s, meta, order_url)

    # 2. fees (confere preço / taxa / total) com autodescoberta de versão
    version, price_per_unit, expected_price, fees_json = discover_offer_version(
        s, fp_headers(s, meta, order_url))

    # 3. delivery details (RobloxUsername)
    dd = (f"{BASE_WWW}/api/v2/orders/me/delivery-details?gameId={GAME_ID}&deliveryDetailTypes=RobloxUsername")
    _req(s, meta, "GET", dd, order_url)

    # 4. Primer clientToken (balanceTopUpPrimer)
    r = _req(s, meta, "POST",
             f"{BASE_WWW}/api/userpayment/me/payments/balanceTopUpPrimer/clientToken",
             order_url,
             json={"offerId": OFFER_ID, "category": CATEGORY,
                   "pricePerUnit": {"amount": price_per_unit, "currency": "BRL"},
                   "quantity": QUANTITY, "gameTitle": "Roblox"})
    if r.status_code != 200:
        fail(f"clientToken {r.status_code} {r.text[:300]}")
    primer_client_token = r.json().get("clientToken", "")
    if not primer_client_token:
        fail("clientToken vazio")

    # 5. stripe client-session (fidelidade ao fluxo, não bloqueia o Pix se falhar)
    try:
        _req(s, meta, "POST",
             f"{BASE_WWW}/api/v1/user-payment/me/payments/balance-top-up-stripe/client-session",
             order_url, json={})
    except Exception:
        pass

    # 6. initializeWithOffer (cria payment initiated)
    # re-check de login antes do passo sensível (exigido antes de cada fluxo)
    ensure_logged_in(s, meta, order_url)
    # metadataToken é fingerprint Nsure/Forter e expira em minutos.
    # O renova exporta o fresco; se estiver ausente usa string vazia e o backend recalcula parte.
    metadata_token = meta.get("metadata_token", "")
    metadata_h = meta.get("metadata_token_h", "")
    init_body = {
        "offerId": OFFER_ID,
        "purchaseQuantity": QUANTITY,
        "deliveryOptions": [{"name": "RobloxUsername", "value": roblox_user}],
        "version": version,
        "discountCode": None,
        "expectedPrice": {"amount": expected_price, "currency": "BRL"},
        "isWithWarranty": False,
        "offerPosition": OFFER_POSITION,
        "category": CATEGORY,
        "expectedCurrencyExchangeRate": {"currency": "BRL", "exchangeRate": EXPECTED_FX},
        "aiDescriptionDisplayedAB": False,
        "metadataToken": {"metadataToken": metadata_token, "metadataTokenH": metadata_h} if metadata_token else {"metadataToken": "", "metadataTokenH": ""},
        "clientToken": primer_client_token,
        "paymentMethod": "Pix",
        "offerTitle": "Robux",
        "forterToken": meta.get("forterToken", ""),
    }
    r = _req(s, meta, "POST",
             f"{BASE_WWW}/api/userpayment/me/payments/balanceTopUpPrimer/initializeWithOffer",
             order_url, json=init_body, timeout=30)
    if r.status_code not in (200, 201):
        fail(f"initializeWithOffer {r.status_code} {r.text[:500]}")
    init = r.json()
    payment_id = init.get("id", "")
    total = (init.get("totalAmount") or {}).get("amount", expected_price)
    if not payment_id:
        fail("initialize sem id")
    # print de progresso no stderr para não sujar o copia e cola no stdout
    print(f"[init] payment={payment_id} total={total} state={init.get('paymentState')}", file=sys.stderr)

    # 7. offerDetails PUT (trava Pix + delivery)
    try:
        _req(s, meta, "PUT",
             f"{BASE_WWW}/api/userpayment/me/payments/balanceTopUpPrimer/{payment_id}/offerDetails",
             order_url,
             json={"offerId": OFFER_ID, "purchaseQuantity": QUANTITY,
                    "deliveryOptions": [{"name": "RobloxUsername", "value": roblox_user}],
                    "version": version, "discountCode": None,
                    "expectedPrice": {"amount": expected_price, "currency": "BRL"},
                    "isWithWarranty": False, "offerPosition": OFFER_POSITION,
                    "category": CATEGORY,
                    "expectedCurrencyExchangeRate": {"currency": "BRL", "exchangeRate": EXPECTED_FX},
                    "aiDescriptionDisplayedAB": False,
                    "metadataToken": {"metadataToken": metadata_token, "metadataTokenH": metadata_h} if metadata_token else {"metadataToken": "", "metadataTokenH": ""},
                    "clientToken": primer_client_token, "paymentMethod": "Pix",
                    "offerTitle": "Robux", "forterToken": meta.get("forterToken", "")})
    except Exception as e:
        print(f"[warn] offerDetails {e}", file=sys.stderr)

    # 8. Primer via requests com headers exatos do SDK (captura 07:26 UTC).
    # O outer do /clientToken contém o inner accessToken; o SDK usa inner como
    # header primer-client-token (nunca Authorization Basic — era isso que dava 403).
    import uuid
    inner_token = extract_primer_inner(primer_client_token)
    if not inner_token:
        fail("clientToken outer sem accessToken interno")
    checkout_session_id = str(uuid.uuid4())
    # PUT clientToken com CPF (fluxo 560/572): amarra nationalDocumentId ao clientSession
    try:
        _req(s, meta, "PUT",
             f"{BASE_WWW}/api/userpayment/me/payments/balanceTopUpPrimer/clientToken",
             order_url,
             json={"clientSessionToken": primer_client_token, "nationalDocumentId": cpf})
    except Exception as e:
        print(f"[warn] PUT clientToken+CPF {e}", file=sys.stderr)
    # configuration
    try:
        pr = requests.get("https://api.primer.io/client-sdk/configuration",
                          headers=primer_headers(inner_token, checkout_session_id, f"{BASE_WWW}/"),
                          timeout=20)
        if pr.status_code == 403 and "SecurityPolicyBlock" in pr.text:
            fail(f"Primer 403 mesmo com headers SDK. payment={payment_id} total={total}. Aguarde cooldown sem criar intents.")
        cfg = pr.json()
        pix_cfg = next((m for m in cfg.get("paymentMethods", []) if m.get("type") == "DLOCAL_PIX"), {})
        pix_id = pix_cfg.get("id", "3c2274a1-2183-4699-87f4-4b713e765f6b")
        print(f"[primer] configuration 200 pix_id={pix_id}", file=sys.stderr)
    except SystemExit:
        raise
    except Exception as e:
        fail(f"primer configuration {e}")
    # actions SELECT_PAYMENT_METHOD (ordem fiel da captura: actions antes de instruments)
    try:
        requests.post("https://sdk.api.primer.io/client-session/actions",
                      json={"actions": [{"type": "SELECT_PAYMENT_METHOD", "params": {"paymentMethodType": "DLOCAL_PIX"}}]},
                      headers=primer_headers(inner_token, checkout_session_id, "https://sdk.primer.io/"),
                      timeout=20)
    except Exception as e:
        print(f"[warn] actions {e}", file=sys.stderr)
    # payment-instruments OFF_SESSION DLOCAL_PIX -> devolve token SINGLE_USE (campo token)
    try:
        rr = requests.post("https://sdk.api.primer.io/payment-instruments",
                           json={"paymentInstrument": {"type": "OFF_SESSION_PAYMENT", "paymentMethodType": "DLOCAL_PIX",
                                  "paymentMethodConfigId": pix_id,
                                  "sessionInfo": {"locale": "en-GB", "platform": "WEB",
                                      "browserInfo": {"javaEnabled": False, "language": "en-US", "colorDepth": 24,
                                          "screenHeight": 1152, "screenWidth": 2048, "timezoneOffset": 240, "userAgent": UA},
                                      "merchantRedirectUrl": order_url, "redirectMode": "POPUP"}}},
                           headers=primer_headers(inner_token, checkout_session_id, "https://sdk.primer.io/"),
                           timeout=20)
        if rr.status_code == 403:
            fail(f"Primer instruments 403. payment={payment_id}. {rr.text[:200]}")
        jj = rr.json()
        payment_method_token = jj.get("token") or jj.get("paymentMethodToken") or jj.get("id") or ""
        if not payment_method_token:
            fail(f"payment-instruments sem token: {rr.text[:300]}")
        print(f"[primer] instruments 200 token={payment_method_token[:10]}...", file=sys.stderr)
    except SystemExit:
        raise
    except Exception as e:
        fail(f"primer instruments {e}")
    # payments + idempotency-key -> redirectUrl N-... + resume-token
    try:
        idem = str(uuid.uuid4())
        hpay = primer_headers(inner_token, checkout_session_id, "https://sdk.primer.io/")
        hpay["x-idempotency-key"] = idem
        rpay = requests.post("https://sdk.api.primer.io/payments",
                             json={"paymentMethodToken": payment_method_token},
                             headers=hpay, timeout=30)
        if rpay.status_code != 200:
            fail(f"primer payments {rpay.status_code} {rpay.text[:400]}")
        pay = rpay.json()
    except SystemExit:
        raise
    except Exception as e:
        fail(f"primer payments {e}")
    redirect_url = ((pay.get("requiredAction") or {}).get("redirectUrl")
                    or pay.get("redirectUrl", ""))
    resume_url = ((pay.get("requiredAction") or {}).get("statusUrl", ""))
    if not redirect_url and (pay.get("requiredAction") or {}).get("name") == "USE_PRIMER_SDK":
        # Caminho fiel do SDK: o redirect vem dentro do JWT outer2 (intent DLOCAL_PIX_REDIRECTION).
        import base64
        try:
            outer2 = (pay.get("requiredAction") or {}).get("clientToken", "")
            seg = outer2.split(".")[1]
            seg += "=" * (-len(seg) % 4)
            dec = json.loads(base64.urlsafe_b64decode(seg).decode())
            redirect_url = dec.get("redirectUrl", "")
            resume_url = dec.get("statusUrl", "") or resume_url
            print(f"[primer] USE_PRIMER_SDK intent={dec.get('intent')} exp={dec.get('exp')}", file=sys.stderr)
        except Exception as e:
            print(f"[warn] decode outer2 {e}", file=sys.stderr)
    if not redirect_url:
        # fallback: monta voucher N- a partir do orderId
        fail(f"payments sem redirectUrl: {json.dumps(pay)[:500]}")
    print(f"[primer] redirect={redirect_url[:90]}...", file=sys.stderr)

    # extrai N-... do redirect
    m = re.search(r"N-[0-9a-f-]{36}", redirect_url)
    if not m:
        fail(f"N- não achado no redirect: {redirect_url[:200]}")
    voucher_id = m.group(0)
    voucher_url = f"https://pay.dlocal.com/apm-frontend/voucher/{voucher_id}"

    # 9. voucher dlocal -> extrai o 000201... exato.
    # Ordem: 1) __NEXT_DATA__.voucherData.scanCodeData (JSON exato),
    # 2) regex amplo até o CRC (6304XXXX). O dLocal mascara o txid como
    # 62070503***, então * faz parte do código. Valida CRC16-CCITT antes
    # de aceitar: regex parcial quebrava 1 char e o banco recusava.
    def crc16_ok(code):
        crc = 0xFFFF
        for ch in code[:-4]:
            crc ^= ord(ch) << 8
            for _ in range(8):
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
        return format(crc, "04X") == code[-4:].upper()

    pix_code, vencimento = "", ""
    try:
        hr = requests.get(voucher_url, headers={"User-Agent": UA}, timeout=30)
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', hr.text, re.S)
        if m:
            try:
                dd = json.loads(m.group(1))
                stack = [dd]
                while stack:
                    o = stack.pop()
                    if isinstance(o, dict):
                        if isinstance(o.get("scanCodeData"), str) and o["scanCodeData"].startswith("000201"):
                            pix_code = o["scanCodeData"].strip()
                            break
                        stack.extend(o.values())
                    elif isinstance(o, list):
                        stack.extend(o)
            except Exception as e:
                print(f"[warn] NEXT_DATA parse {e}", file=sys.stderr)
        mv = re.search(r"Vencimento:?\s*([0-9/]{10},?\s*[0-9:]{5})", hr.text)
        if mv:
            vencimento = mv.group(1)
            print(f"[voucher] vencimento exibido: {vencimento}", file=sys.stderr)
    except Exception as e:
        print(f"[warn] voucher fetch {e}", file=sys.stderr)
    if pix_code and not crc16_ok(pix_code):
        print(f"[warn] scanCodeData CRC inválido (len={len(pix_code)}), tentando regex", file=sys.stderr)
        pix_code = ""
    if not pix_code:
        for url in [voucher_url, redirect_url]:
            try:
                hr = requests.get(url, headers={"User-Agent": UA}, timeout=30)
                # amplo até o CRC final (cobre +,=,_ etc); inclui * do txid mascarado
                found = re.findall(r"000201[\s\S]{30,600}?6304[0-9A-Fa-f]{4}", hr.text)
                if found:
                    # limpa espaços/quebras e tags, pega o maior
                    found = [re.sub(r"\s+|<[^>]+>", "", f) for f in found]
                    found = [f for f in found if f.startswith("000201")]
                    if found:
                        pix_code = max(found, key=len)
                        if not crc16_ok(pix_code):
                            print(f"[warn] regex CRC inválido (len={len(pix_code)}), descartando", file=sys.stderr)
                            pix_code = ""
                        elif len(pix_code) >= 100:
                            break
            except Exception as e:
                print(f"[warn] voucher fetch {e}", file=sys.stderr)

    if not pix_code or len(pix_code) < 50:
        # tenta o endpoint de pagamento gmf-apm que retorna JSON
        try:
            gmf = f"https://pay.dlocal.com/gmf-apm/payments/{voucher_id}"
            hr = requests.get(gmf, headers={"User-Agent": UA, "Accept": "application/json"}, timeout=20)
            found = re.findall(r"000201[\s\S]{30,600}?6304[0-9A-Fa-f]{4}", hr.text)
            found = [re.sub(r"\s+|<[^>]+>", "", f) for f in found]
            found = [f for f in found if f.startswith("000201") and crc16_ok(f)]
            if found:
                pix_code = max(found, key=len)
        except Exception:
            pass

    if not pix_code:
        fail("copia e cola não encontrado no voucher (sessão pode ter expirado, gera outro pagamento)")
    if not crc16_ok(pix_code):
        fail(f"copia e cola com CRC inválido (len={len(pix_code)}), não retornando. Gera outro pagamento.")
    if vencimento:
        print(f"[voucher] paga antes de {vencimento} (janela curta do dLocal)", file=sys.stderr)

    # SAÍDA FINAL: só o copia e cola no stdout
    print(pix_code)


if __name__ == "__main__":
    main()
