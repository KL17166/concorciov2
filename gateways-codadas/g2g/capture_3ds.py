#!/usr/bin/env python3
"""
G2G — Capturador 3DS / pagamento (Plano 3DS)
Foco: Pix primeiro, depois cartão com 3DS. Captura response do 3DS + css/js/html
para reproduzir o 3D em outra página.

Uso:
    python3 capture_3ds.py
    # faz o fluxo Pix na janela que abrir
    # touch captures/<stamp>/PIX_DONE  (marca fim do Pix)
    # faz o fluxo cartão + 3DS
    # touch captures/<stamp>/DONE  (finaliza)

Saída:
    captures/<stamp>/
      events.jsonl          -> requests/responses relevantes (com flush)
      ws_frames.jsonl       -> frames ws (gcart-ws, sardine)
      bodies/               -> 1 arquivo por response (headers+body cru)
      pix/ + card/          -> cópias separadas por fase (symlink lógico via prefixo)
      flow_full.har         -> HAR completo (mode full, com bodies)
      ws_url.txt
      PIX_DONE / DONE       -> marcadores de fase

Profile isolado: .pw-profile-3ds/ (não trava o .pw-profile/ atual).
HAR mode FULL: bodies vêm no HAR também, dá pra analisar depois que salvar.
"""
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
CAPTURE_ROOT = BASE / "captures"
PROFILE_DIR = BASE / ".pw-profile-3ds"

STAMP = datetime.now().strftime("%Y%m%d_%H%M%S_3ds")
OUTDIR = CAPTURE_ROOT / STAMP
BODIES = OUTDIR / "bodies"
OUTDIR.mkdir(parents=True, exist_ok=True)
BODIES.mkdir(parents=True, exist_ok=True)

EVENTS = OUTDIR / "events.jsonl"
WSFRAMES = OUTDIR / "ws_frames.jsonl"

# Alvos: checkout + pagamento + 3DS + antifraude + fluxo base
TARGETS = [
    # fluxo base (pra amarrar order_id com pagamento)
    "authenticate-user",
    "/gcart/", "gcart-ws.g2g.com", "/order/", "summary", "buy-now",
    "checkout_histories",
    # pipwave (gateway)
    "pipwave.com",
    # airwallex fraud + sardine
    "airwallex.com", "sardine.ai",
    # 3DS / challenge / ACS / card schemes
    "3ds", "3-d", "cardinal", "challenge", "acs", "creq", "cres",
    "secure.checkout.visa.com", "src.mastercard.com", "thm.visa.com",
    "auth.visa.com", "visa.com", "mastercard.com",
    # genéricos pagamento / risco / iframe
    "stripe", "adyen", "forter", "risk", "fingerprint", "iframe",
    "checkout", "secure-payment", "payin", "payment",
]

# tipos que queremos salvar o body cru (html/js/css/json)
SAVE_EXT = (".html", ".htm", ".js", ".css", ".json")
SAVE_MIME = ("html", "javascript", "css", "json", "text")

def is_target(url: str) -> bool:
    u = url.lower()
    return any(t in u for t in TARGETS)

def safe_name(idx: int, method: str, url: str, ctype: str) -> str:
    p = urlparse(url)
    host = p.netloc.replace(":", "_")
    path = (p.path or "/").strip("/").replace("/", "_")[:80] or "root"
    path = re.sub(r"[^a-zA-Z0-9._-]+", "_", path)
    ext = ""
    if "html" in ctype:
        ext = ".html"
    elif "javascript" in ctype:
        ext = ".js"
    elif "css" in ctype:
        ext = ".css"
    elif "json" in ctype:
        ext = ".json"
    else:
        for e in SAVE_EXT:
            if url.lower().split("?")[0].endswith(e):
                ext = e
                break
        if not ext:
            ext = ".bin"
    return f"{idx:04d}_{method}_{host}_{path}{ext}"

def log_event(obj: dict):
    obj["ts"] = datetime.now().isoformat()
    with open(EVENTS, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        f.flush()

def log_ws(obj: dict):
    obj["ts"] = datetime.now().isoformat()
    with open(WSFRAMES, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        f.flush()

def main():
    from playwright.sync_api import sync_playwright

    print(f"""
===============================================================================
G2G CAPTURADOR 3DS — Pix depois Cartão
--------------------------------------------------------------------------------
Saída: {OUTDIR}
Bodies crus: {BODIES}/
Profile isolado: {PROFILE_DIR}
HAR: FULL (com bodies — dá pra analisar o HAR que você salvar depois)

ROTEIRO NA JANELA QUE VAI ABRIR:
  1. Fluxo PIX primeiro (até onde der: QR / copia-e-cola / redirect)
     depois no terminal:  touch {OUTDIR}/PIX_DONE
  2. Fluxo CARTÃO depois (vai até o 3DS/challenge, NÃO precisa aprovar
     se não quiser — só abrir o iframe do 3DS já basta)
  3. Finaliza:  touch {OUTDIR}/DONE   (ou fecha a janela)

O script salva sozinho p/ cada response alvo:
  bodies/NNNN_METODO_host_path.ext  +  bodies/NNNN_....meta.json
  (request url/headers + response headers + body cru)
  3DS catcher: qualquer url com 3ds/cardinal/challenge/acs/creq/cres
  é logada com destaque [3DS!!!].
===============================================================================
""")

    with sync_playwright() as p:
        ctx = p.firefox.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            viewport={"width": 1366, "height": 900},
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            record_har_path=str(OUTDIR / "flow_full.har"),
            record_har_mode="full",
        )

        counter = {"n": 0}
        phase = {"name": "pix"}  # vira "card" após PIX_DONE

        def on_request(req):
            try:
                url = req.url
                if not is_target(url):
                    return
                entry = {"kind": "request", "phase": phase["name"],
                         "method": req.method, "url": url,
                         "headers": dict(req.headers)}
                if req.method in ("POST", "PUT") and any(
                        k in url for k in ("/gcart/", "pipwave", "sardine",
                                          "airwallex", "3ds", "cardinal",
                                          "checkout", "payment", "acs",
                                          "challenge")):
                    try:
                        entry["post_data_len"] = len(req.post_data or "")
                    except Exception:
                        pass
                log_event(entry)
                tag = " [3DS!!!]" if re.search(
                    r"3ds|cardinal|challenge|/acs|creq|cres", url, re.I) else ""
                print(f"[REQ][{phase['name']}]{tag} {req.method} {url[:150]}")
            except Exception as e:
                print(f"[REQ-ERR] {e}", file=sys.stderr)

        def on_response(resp):
            try:
                url = resp.url
                if not is_target(url):
                    return
                req = resp.request
                ctype = (resp.headers.get("content-type") or "").lower()
                entry = {"kind": "response", "phase": phase["name"],
                         "method": req.method, "url": url, "status": resp.status,
                         "content_type": ctype,
                         "headers": dict(resp.headers)}
                log_event(entry)
                tag = " [3DS!!!]" if re.search(
                    r"3ds|cardinal|challenge|/acs|creq|cres", url, re.I) else ""
                print(f"[RES][{phase['name']}]{tag} {resp.status} {req.method} {url[:150]} [{ctype[:40]}]")
                # salva body cru (best-effort, 2 tentativas — quirk Firefox)
                body = None
                for attempt in (0, 1):
                    try:
                        body = resp.text()
                        break
                    except Exception as e:
                        if attempt == 0:
                            time.sleep(0.3)
                            continue
                        print(f"      [body-skip] {e}")
                        return
                if body is None:
                    return
                counter["n"] += 1
                fname = safe_name(counter["n"], req.method, url, ctype)
                # prefixo de fase pra separar pix/ de card/
                fname = f"{phase['name']}_{fname}"
                (BODIES / fname).write_text(body, encoding="utf-8", errors="replace")
                (BODIES / (fname + ".meta.json")).write_text(
                    json.dumps({"phase": phase["name"], "method": req.method,
                                "url": url, "status": resp.status,
                                "req_headers": dict(req.headers),
                                "res_headers": dict(resp.headers),
                                "len": len(body)}, indent=2, ensure_ascii=False),
                    encoding="utf-8")
                print(f"      body salvo: bodies/{fname} ({len(body)}B)")
                # destaque p/ frames 3DS
                if re.search(r"3ds|cardinal|challenge|/acs|creq|cres", url, re.I):
                    print(f"      ^^^ 3DS CAPTURADO em bodies/{fname}")
                # order_id / pipwave / creq rápidos no log
                if any(k in body[:4000] for k in ("order_id", "pipwave", "creq", "PaReq", "threeDS")):
                    print(f"      ^^^ contém order_id/pipwave/3ds — ver bodies/{fname}")
            except Exception as e:
                print(f"[RES-ERR] {e}", file=sys.stderr)

        def on_page(page):
            def on_ws(ws):
                print(f"\n[WS-OPEN][{phase['name']}] {ws.url}")
                log_ws({"kind": "ws-open", "phase": phase["name"], "url": ws.url})
                with open(OUTDIR / "ws_url.txt", "a", encoding="utf-8") as f:
                    f.write(f"[{phase['name']}] " + ws.url + "\n")
                ws.on("framesent", lambda payload: (
                    log_ws({"kind": "ws-sent", "phase": phase["name"],
                            "url": ws.url, "payload": str(payload)[:8000]}),
                    print(f"[WS-SENT] {str(payload)[:200]}")
                ))
                ws.on("framereceived", lambda payload: (
                    log_ws({"kind": "ws-recv", "phase": phase["name"],
                            "url": ws.url, "payload": str(payload)[:8000]}),
                    print(f"[WS-RECV] {str(payload)[:300]}")
                ))
            page.on("websocket", on_ws)
            # dump do HTML final da página de pagamento/3DS ao fechar fase
            try:
                page.on("close", lambda *a: None)
            except Exception:
                pass

        ctx.on("request", on_request)
        ctx.on("response", on_response)
        ctx.on("page", on_page)
        for pg in ctx.pages:
            on_page(pg)

        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto("https://www.g2g.com/", timeout=30000)
        except Exception as e:
            print(f"[WARN] goto inicial falhou: {e}")

        print("\n>>> JANELA ABERTA. Faça o PIX primeiro, depois o CARTÃO+3DS. <<<")
        print(f">>> touch {OUTDIR}/PIX_DONE  (fim do Pix, troca fase p/ card) <<<")
        print(f">>> touch {OUTDIR}/DONE  (fim de tudo) <<<\n")

        deadline = time.time() + 40 * 60
        pix_marked = False
        try:
            while time.time() < deadline:
                if (OUTDIR / "PIX_DONE").exists() and not pix_marked:
                    pix_marked = True
                    phase["name"] = "card"
                    log_event({"kind": "marker", "phase": "card",
                               "msg": "PIX_DONE detectado, fase=card"})
                    print("\n[FASE] Pix marcado, agora é CARTÃO+3DS...\n")
                    # snapshot HTML das páginas abertas na virada
                    for i, pg in enumerate(ctx.pages):
                        try:
                            html = pg.content()
                            (BODIES / f"phase_pix_page{i}.html").write_text(
                                html, encoding="utf-8", errors="replace")
                            print(f"  snapshot pix page{i}: {len(html)}B")
                        except Exception as e:
                            print(f"  [snapshot-skip] {e}")
                if (OUTDIR / "DONE").exists():
                    print("\n[DONE] finalizando...")
                    break
                try:
                    if len(ctx.pages) == 0:
                        print("\n[DONE] janelas fechadas, finalizando...")
                        break
                except Exception:
                    break
                time.sleep(2)
            else:
                print("\n[TIMEOUT] 40min, finalizando sozinho...")
        except KeyboardInterrupt:
            pass

        # snapshot final (pega o HTML do 3DS aberto)
        for i, pg in enumerate(ctx.pages):
            try:
                html = pg.content()
                (BODIES / f"phase_{phase['name']}_final_page{i}.html").write_text(
                    html, encoding="utf-8", errors="replace")
                print(f"  snapshot final page{i}: {len(html)}B url={pg.url[:120]}")
            except Exception as e:
                print(f"  [snapshot-skip] {e}")

        print("\nFechando e salvando HAR full...")
        try:
            ctx.close()
        except Exception as e:
            print(f"[WARN] close: {e}")

    print(f"""
===============================================================================
CAPTURA 3DS FINALIZADA: {OUTDIR}
--------------------------------------------------------------------------------""")
    for f in sorted(OUTDIR.iterdir()):
        try:
            if f.is_dir():
                n = len(list(f.iterdir()))
                print(f"  {f.name:38s} {n:8d} arquivos")
            else:
                print(f"  {f.name:38s} {f.stat().st_size:8d}B")
        except Exception:
            print(f"  {f.name}")
    print("""
PRÓXIMO PASSO (me manda ou fala 'captura 3ds pronta'):
  1. bodies/*3ds* / *challenge* / *acs* / *cardinal* (o response do 3DS)
  2. bodies/*.html do iframe do 3DS + os .js/.css dele
  3. flow_full.har (o HAR full que você salvar)
  Daí eu monto o espelho do 3D na outra página.
===============================================================================
""")

if __name__ == "__main__":
    main()
