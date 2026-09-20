#!/usr/bin/env python3
"""
G2G — Capturador semi-automático (Plano A)
Abre Firefox isolado via Playwright, você faz o fluxo na mão,
ele grava o Raw necessário p/ implementar buy-now -> ws -> summary.

Uso:
    python3 capture.py
    # faz login na janela que abrir, navega search -> offer -> buy-now
    # volta no terminal e aperta ENTER pra fechar e salvar

Saída:
    captures/<timestamp>/
      events.jsonl                -> todos requests/responses relevantes
      buy-now_request_raw.txt     -> body EXATO do POST (o ~299B que falta)
      buy-now_request_headers.json
      buy-now_response.json       -> auth_token + checkout_version
      ws_frames.jsonl             -> order_id, pipwave_token, redirect_url
      summary_*.json              -> GET /order/{id}/summary
      flow.har                    -> backup completo (abre no Charles/HAR viewer)

Profile isolado: .pw-profile/ (NÃO é seu Firefox principal, não mexe lá).
Nada é commitado (ver .gitignore).
"""
import json
import sys
import time
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
CAPTURE_ROOT = BASE / "captures"
PROFILE_DIR = BASE / ".pw-profile"

STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
OUTDIR = CAPTURE_ROOT / STAMP
OUTDIR.mkdir(parents=True, exist_ok=True)

EVENTS = OUTDIR / "events.jsonl"
WSFRAMES = OUTDIR / "ws_frames.jsonl"

TARGETS = [
    "authenticate-user",
    "/v3/offer/search",
    "/v3/offer/",
    "product_settings",
    "checkout_histories",
    "/gcart/",  # buy-now, checkout, cart PUT/GET, histories
    "gcart-ws.g2g.com",
    "/order/",
    "summary",
]

def is_target(url: str) -> bool:
    return any(t in url for t in TARGETS)

def mask(s: str, keep: int = 4) -> str:
    if not s or len(s) <= keep * 2:
        return (s or "")[:8] + "..."
    return f"{s[:keep]}...{s[-keep:]} (len={len(s)})"

def log_event(obj: dict):
    obj["ts"] = datetime.now().isoformat()
    with open(EVENTS, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        f.flush()  # sem flush o tail mente (buffer); ver FLUXO.md §4.5

def log_ws(obj: dict):
    obj["ts"] = datetime.now().isoformat()
    with open(WSFRAMES, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")
        f.flush()

def main():
    from playwright.sync_api import sync_playwright

    print(f"""
================================================================================
G2G CAPTURADOR — Plano A
--------------------------------------------------------------------------------
Saída: {OUTDIR}
Profile isolado: {PROFILE_DIR} (separado do seu Firefox principal)

PASSO A PASSO NA JANELA QUE VAI ABRIR:
 1. Faça login na G2G (só na primeira vez, depois o profile lembra)
 2. Navegue: busca wow-gold -> abre 1 oferta barata (ex Silvermoon)
 3. Vai até o buy-now / checkout (NÃO precisa pagar, só chegar no
    POST buy-now + abrir o ws + cair no summary/redirect pipwave)
 4. Volte aqui no terminal e aperte ENTER para fechar e salvar

O script captura sozinho:
 [1] POST /api/authenticate-user (accessToken+userId)
 [3] GET /v3/offer/search (converted_unit_price)
 [4] GET /v3/offer/{{id}} (relation_id, estoque fresco)
 [5] GET checkout_histories
 [6] POST /gcart/buy-now  <-- o Raw ~299B que falta no FLUXO.md §4.5
 [7] WSS gcart-ws (order_id, pipwave_token)
 [8] GET /order/{{id}}/summary (total REAL)
================================================================================
""")

    with sync_playwright() as p:
        ctx = p.firefox.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            viewport={"width": 1366, "height": 900},
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            record_har_path=str(OUTDIR / "flow.har"),
            record_har_mode="minimal",
        )

        # --- listeners de request/response ---
        def on_request(req):
            try:
                url = req.url
                if not is_target(url):
                    return
                entry = {"kind": "request", "method": req.method, "url": url,
                         "headers": dict(req.headers)}
                # body cru do buy-now / cart PUT / checkout é o mais importante
                if req.method in ("POST", "PUT") and "/gcart/" in url:
                    raw = req.post_data or ""
                    tag = "buy-now" if "buy-now" in url else (
                        "gcart-checkout" if "checkout" in url and "histories" not in url else "gcart-put")
                    (OUTDIR / f"{tag}_request_raw.txt").write_text(raw, encoding="utf-8")
                    (OUTDIR / f"{tag}_request_headers.json").write_text(
                        json.dumps(dict(req.headers), indent=2, ensure_ascii=False), encoding="utf-8")
                    entry["post_data_len"] = len(raw)
                    print(f"\n[CAPTURE] {req.method} {tag} {len(raw)}B url={url}")
                    print(f"          raw salvo em {tag}_request_raw.txt")
                log_event(entry)
                print(f"[REQ] {req.method} {url[:140]}")
            except Exception as e:
                print(f"[REQ-ERR] {e}", file=sys.stderr)

        def on_response(resp):
            try:
                url = resp.url
                if not is_target(url):
                    return
                req = resp.request
                entry = {"kind": "response", "method": req.method,
                         "url": url, "status": resp.status,
                         "headers": dict(resp.headers)}
                log_event(entry)
                print(f"[RES] {resp.status} {req.method} {url[:140]}")
                # salva corpos importantes (best-effort, sem travar fluxo)
                # Firefox+Playwright às vezes nega getResponseBody
                # (NS_ERROR_FAILURE); tenta 1x de novo após 300ms.
                body = None
                for attempt in (0, 1):
                    try:
                        ctype = (resp.headers.get("content-type") or "").lower()
                        if "json" in ctype or is_target(url):
                            body = resp.text()
                        break
                    except Exception as e:
                        if attempt == 0:
                            import time as _t
                            _t.sleep(0.3)
                            continue
                        print(f"          [body-skip] {e}")
                try:
                    if body is not None:
                        if "buy-now" in url:
                            (OUTDIR / "buy-now_response.json").write_text(body, encoding="utf-8")
                            try:
                                j = json.loads(body)
                                # tenta achar auth_token em qualquer nível
                                s = json.dumps(j)
                                print(f"          buy-now response salva ({len(body)}B)")
                                # mostra mascarado se achar token 32hex
                                import re
                                m = re.search(r"[0-9a-f]{32}", s)
                                if m:
                                    print(f"          auth_token? {mask(m.group(0))}")
                            except Exception:
                                pass
                        elif "summary" in url:
                            oid = url.split("/order/")[-1].split("/")[0][:24]
                            (OUTDIR / f"summary_{oid}.json").write_text(body, encoding="utf-8")
                            print(f"          summary salvo: summary_{oid}.json ({len(body)}B)")
                        elif "gcart/checkout" in url:
                            (OUTDIR / "gcart_checkout_response.json").write_text(body, encoding="utf-8")
                            print(f"          gcart checkout salvo ({len(body)}B)")
                        elif "/gcart/" in url and req.method == "PUT":
                            (OUTDIR / "gcart_put_response.json").write_text(body, encoding="utf-8")
                            print(f"          gcart PUT salvo ({len(body)}B)")
                        elif "/gcart/" in url and req.method == "GET":
                            (OUTDIR / "gcart_get_response.json").write_text(body[:50000], encoding="utf-8")
                        elif "authenticate-user" in url:
                            (OUTDIR / "authenticate-user_response.json").write_text(body[:20000], encoding="utf-8")
                        elif "/v3/offer/search" in url:
                            (OUTDIR / "search_response.json").write_text(body[:200000], encoding="utf-8")
                        elif "/v3/offer/" in url and "search" not in url:
                            (OUTDIR / "offer_detail_response.json").write_text(body[:200000], encoding="utf-8")
                except Exception as e:
                    print(f"          [body-skip] {e}")
            except Exception as e:
                print(f"[RES-ERR] {e}", file=sys.stderr)

        def on_page(page):
            def on_ws(ws):
                print(f"\n[WS-OPEN] {ws.url}")
                log_ws({"kind": "ws-open", "url": ws.url})
                # salva URL do ws (contém ?token=)
                with open(OUTDIR / "ws_url.txt", "a", encoding="utf-8") as f:
                    f.write(ws.url + "\n")
                ws.on("framesent", lambda payload: (
                    log_ws({"kind": "ws-sent", "url": ws.url, "payload": str(payload)[:8000]}),
                    print(f"[WS-SENT] {str(payload)[:200]}")
                ))
                ws.on("framereceived", lambda payload: (
                    log_ws({"kind": "ws-recv", "url": ws.url, "payload": str(payload)[:8000]}),
                    print(f"[WS-RECV] {str(payload)[:300]}"),
                    _save_ws_payload(str(payload))
                ))
                ws.on("close", lambda *a: print(f"[WS-CLOSE] {ws.url}"))
            page.on("websocket", on_ws)

        def _save_ws_payload(payload: str):
            try:
                # tenta extrair order_id / pipwave_token
                (OUTDIR / "ws_last_frame.txt").write_text(payload, encoding="utf-8")
                if "order_id" in payload or "pipwave" in payload or "2000" in payload:
                    print(f"          ^^ frame interessante salvo em ws_last_frame.txt")
            except Exception:
                pass

        ctx.on("request", on_request)
        ctx.on("response", on_response)
        ctx.on("page", on_page)
        # páginas já abertas antes do listener
        for pg in ctx.pages:
            on_page(pg)

        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto("https://www.g2g.com/", timeout=30000)
        except Exception as e:
            print(f"[WARN] goto inicial falhou (rede?): {e}")

        print("\n>>> JANELA ABERTA. Faça o fluxo na mão. <<<")
        print(">>> Para finalizar: FECHE a janela do Firefox OU crie o arquivo DONE <<<\n")
        print(f">>> touch {OUTDIR}/DONE  (quando terminar o buy-now/ws/summary) <<<\n")
        # Espera sem precisar de stdin interativo (funciona rodando em background).
        # Termina quando: browser fechado, todas páginas fechadas, ou arquivo DONE.
        import time as _time
        deadline = _time.time() + 20 * 60  # 20 min max
        try:
            while _time.time() < deadline:
                if (OUTDIR / "DONE").exists():
                    print("\n[DONE] arquivo DONE detectado, finalizando...")
                    break
                try:
                    if len(ctx.pages) == 0:
                        print("\n[DONE] todas as páginas fechadas, finalizando...")
                        break
                except Exception:
                    break
                _time.sleep(2)
            else:
                print("\n[TIMEOUT] 20min, finalizando sozinho...")
        except KeyboardInterrupt:
            pass

        print("\nFechando e salvando HAR...")
        try:
            ctx.close()
        except Exception as e:
            print(f"[WARN] close: {e}")

    # --- resumo final ---
    print(f"""
================================================================================
CAPTURA FINALIZADA: {OUTDIR}
--------------------------------------------------------------------------------""")
    for f in sorted(OUTDIR.iterdir()):
        try:
            print(f"  {f.name:38s} {f.stat().st_size:8d}B")
        except Exception:
            print(f"  {f.name}")
    print("""
PRÓXIMO PASSO (me manda):
 1. buy-now_request_raw.txt (o ~299B)
 2. buy-now_response.json (auth_token)
 3. ws_frames.jsonl (order_id)
 4. summary_*.json (total REAL)

Ou só me fala "captura pronta" que eu leio os arquivos daqui.
================================================================================
""")

if __name__ == "__main__":
    main()
