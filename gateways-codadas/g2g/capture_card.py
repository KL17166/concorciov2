#!/usr/bin/env python3
"""
G2G — Capturador 3DS com PROVA VISUAL em tempo real.
Mostra contador ao vivo de requests capturadas por domínio.
Monitora TODAS as abas, incluindo popups e iframes.
"""
import json, re, sys, time, threading
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S_card")
OUTDIR = BASE / "captures" / STAMP
BODIES = OUTDIR / "bodies"
OUTDIR.mkdir(parents=True, exist_ok=True)
BODIES.mkdir(parents=True, exist_ok=True)

EVENTS  = OUTDIR / "events.jsonl"
WSFILE  = OUTDIR / "ws_frames.jsonl"
COUNTER = {"total": 0, "pages": 0, "card": 0, "pix": 0, "3ds": 0, "pipwave": 0, "airwallex": 0}
LOCK    = threading.Lock()

TARGETS = [
    "authenticate-user", "gcart", "buy-now", "order", "summary",
    "pipwave", "airwallex", "sardine", "tazapay",
    "3ds", "cardinal", "challenge", "acs", "creq", "cres",
    "mastercard.com", "visa.com", "secure.checkout",
    "payment", "checkout", "payin", "confirm", "intent",
    "staging-checkout", "api.pipwave", "pci.airwallex",
]

def is_target(url):
    u = url.lower()
    return any(t in u for t in TARGETS)

def tag_url(url):
    u = url.lower()
    tags = []
    if any(x in u for x in ["3ds","cardinal","challenge","acs","creq","cres"]): tags.append("3DS")
    if "airwallex" in u: tags.append("AIRWALLEX")
    if "pipwave" in u: tags.append("PIPWAVE")
    if "tazapay" in u: tags.append("TAZAPAY")
    if "mastercard" in u: tags.append("MASTERCARD")
    if "visa.com" in u: tags.append("VISA")
    if "authenticate" in u: tags.append("AUTH")
    if "buy-now" in u or "gcart" in u: tags.append("ORDER")
    if "payment" in u or "checkout" in u or "intent" in u: tags.append("PAY")
    return tags

def log_event(obj):
    with LOCK:
        obj["ts"] = datetime.now().isoformat()
        with open(EVENTS, "a", encoding="utf-8") as f:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
            f.flush()

def banner():
    """Atualiza o contador na mesma linha a cada 1s"""
    while True:
        with LOCK:
            t = COUNTER["total"]
            pg = COUNTER["pages"]
            aw = COUNTER["airwallex"]
            pw = COUNTER["pipwave"]
            ds = COUNTER["3ds"]
        bar = (
            f"\r📡 GRAVANDO | "
            f"requests: {t:4d} | "
            f"abas monitoradas: {pg:2d} | "
            f"airwallex: {aw:3d} | "
            f"pipwave: {pw:3d} | "
            f"3ds: {ds:3d}   "
        )
        sys.stdout.write(bar)
        sys.stdout.flush()
        time.sleep(1)

def attach_page(page, ctx_ref):
    """Conecta listeners de request/response/ws a UMA página."""
    with LOCK:
        COUNTER["pages"] += 1
    pnum = COUNTER["pages"]
    url = "???"
    try: url = page.url[:80]
    except: pass
    print(f"\n  [+] ABA {pnum} conectada: {url}")

    def on_req(req):
        try:
            url = req.url
            if not is_target(url): return
            with LOCK: COUNTER["total"] += 1
            tags = tag_url(url)
            for t in tags:
                key = t.lower()
                if key in COUNTER: COUNTER[key] += 1
            entry = {"kind":"request","page":pnum,"method":req.method,"url":url,"headers":dict(req.headers)}
            if req.method in ("POST","PUT","PATCH"):
                try: entry["post_data"] = req.post_data or ""
                except: pass
            log_event(entry)
            tag_str = " ".join(f"[{t}]" for t in tags)
            if tags:
                print(f"\n  {tag_str} {req.method} {url[:100]}")
        except Exception as e:
            print(f"\n  [REQ-ERR] {e}")

    def on_res(res):
        try:
            url = res.url
            if not is_target(url): return
            req = res.request
            method = req.method
            status = res.status
            ctype = (res.headers.get("content-type") or "").lower()
            tags = tag_url(url)

            # Salva body
            body = None
            if any(m in ctype for m in ("html","json","javascript","text","css")):
                for attempt in range(2):
                    try:
                        body = res.text()
                        break
                    except:
                        if attempt == 0: time.sleep(0.3)
                        continue

            entry = {"kind":"response","page":pnum,"method":method,"url":url,
                     "status":status,"content_type":ctype,"headers":dict(res.headers)}
            if body:
                entry["body_len"] = len(body)
                # guarda snippet no events.jsonl
                entry["body_preview"] = body[:2000]
                # salva body completo em arquivo
                n = COUNTER["total"]
                ext = ".json" if "json" in ctype else ".html" if "html" in ctype else ".js" if "javascript" in ctype else ".txt"
                p = urlparse(url)
                fname = f"{n:04d}_{method}_{p.netloc}_{p.path.strip('/').replace('/','_')[:60]}{ext}"
                fname = re.sub(r"[^a-zA-Z0-9._-]","_", fname)
                (BODIES / fname).write_text(body, encoding="utf-8", errors="replace")
                print(f"\n  💾 BODY SALVO ({len(body)}B): {fname}")

            log_event(entry)
        except Exception as e:
            print(f"\n  [RES-ERR] {e}")

    def on_ws(ws):
        print(f"\n  [WS] {ws.url[:100]}")
        log_event({"kind":"ws-open","page":pnum,"url":ws.url})
        with open(OUTDIR/"ws_url.txt","a") as f: f.write(ws.url+"\n")
        ws.on("framesent",   lambda p: log_event({"kind":"ws-sent","url":ws.url,"data":str(p)[:4000]}))
        ws.on("framereceived", lambda p: log_event({"kind":"ws-recv","url":ws.url,"data":str(p)[:4000]}))

    page.on("request",   on_req)
    page.on("response",  on_res)
    page.on("websocket", on_ws)

    # reconnect p/ popups que essa página abrir
    page.on("popup", lambda popup: attach_page(popup, ctx_ref))

def main():
    from playwright.sync_api import sync_playwright

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  G2G CAPTURADOR CARTÃO — com PROVA VISUAL em tempo real     ║
╠══════════════════════════════════════════════════════════════╣
║  Saída: {str(OUTDIR):<53}║
║  Você vai VER o contador subir em tempo real na tela        ║
║  Toda aba nova é conectada automaticamente                  ║
╚══════════════════════════════════════════════════════════════╝

ROTEIRO:
  1. Vá para o carrinho com o item de R$5
  2. Clique em pagar → escolha Mastercard
  3. Preencha os dados → Pagar
  4. Quando terminar: touch {OUTDIR}/DONE
     ou simplesmente feche a janela

""")

    with sync_playwright() as p:
        ctx = p.firefox.launch_persistent_context(
            user_data_dir=str(BASE / ".pw-profile-3ds"),
            headless=False,
            viewport={"width": 1366, "height": 900},
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            record_har_path=str(OUTDIR / "flow.har"),
            record_har_mode="full",
            record_har_url_filter="**",   # captura TUDO no HAR
        )

        # Conecta a todas as páginas já abertas
        for pg in ctx.pages:
            attach_page(pg, ctx)

        # Conecta automaticamente a qualquer nova página/popup
        ctx.on("page", lambda pg: attach_page(pg, ctx))

        # Navega para G2G
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto("https://www.g2g.com/", timeout=30000)
        except Exception as e:
            print(f"[WARN] goto: {e}")

        # Inicia banner ao vivo numa thread separada
        t = threading.Thread(target=banner, daemon=True)
        t.start()

        print(">>> JANELA ABERTA. Faça o checkout com cartão agora. <<<\n")

        deadline = time.time() + 40 * 60
        try:
            while time.time() < deadline:
                if (OUTDIR / "DONE").exists():
                    print("\n\n[DONE] sinal recebido, finalizando...")
                    break
                try:
                    if len(ctx.pages) == 0:
                        print("\n\n[DONE] janelas fechadas.")
                        break
                except:
                    break
                time.sleep(1)
            else:
                print("\n\n[TIMEOUT] 40min.")
        except KeyboardInterrupt:
            print("\n\n[CTRL+C] interrompido.")

        # Snapshot final de cada aba
        print("\nSalvando snapshots finais...")
        for i, pg in enumerate(ctx.pages):
            try:
                html = pg.content()
                f = BODIES / f"final_page{i}_{urlparse(pg.url).netloc}.html"
                f.write_text(html, encoding="utf-8", errors="replace")
                print(f"  snapshot page{i}: {len(html)}B — {pg.url[:80]}")
            except Exception as e:
                print(f"  [skip] {e}")

        print("Fechando e salvando HAR...")
        try:
            ctx.close()
        except Exception as e:
            print(f"[WARN] close: {e}")

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  CAPTURA FINALIZADA                                         ║
╠══════════════════════════════════════════════════════════════╣
║  Total requests: {COUNTER['total']:<43d}║
║  Airwallex: {COUNTER['airwallex']:<49d}║
║  Pipwave: {COUNTER['pipwave']:<51d}║
║  3DS: {COUNTER['3ds']:<55d}║
╚══════════════════════════════════════════════════════════════╝
Arquivos em: {OUTDIR}
""")
    for f in sorted(OUTDIR.iterdir()):
        try:
            if f.is_dir():
                n = len(list(f.iterdir()))
                print(f"  {f.name:<40} {n:6d} arquivos")
            else:
                print(f"  {f.name:<40} {f.stat().st_size:10d} B")
        except:
            pass

if __name__ == "__main__":
    main()
