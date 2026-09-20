#!/usr/bin/env python3 -u
"""
G2G — Janela Chromium + extensão Request Inspector Pro (tetsee), modo leve.

Aprendido após 3 quedas do driver (ERR_STRING_TOO_LONG): listeners globais
de request/response no Playwright inundam o pipe driver<->browser e o Node
estoura. Então aqui o Playwright NÃO escuta rede nenhuma — ele só:
  1. abre a janela Chromium com a extensão carregada,
  2. espera os marcadores PIX_DONE / DONE,
  3. tira snapshots do HTML das abas nos marcadores,
  4. fecha. Com watchdog: se o browser/driver cair, reabre sozinho.

100% da captura de rede fica com a extensão (webRequest em todas as
abas/iframes + hooks fetch/XHR dentro do iframe do 3DS), que já provou
aguentar (auto-save ~15s no servidor :7331 -> tetsee/captures/).

Uso:
    python3 capture_3ds_chrome.py
    # faz o PIX na janela que abrir, depois:
    # touch captures/<stamp>/PIX_DONE
    # faz o CARTÃO + 3DS (só abrir o challenge já basta), depois:
    # touch captures/<stamp>/DONE   (ou clique EXPORT_HAR no popup da extensão)
"""
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
EXT_DIR = Path("/media/d/26D8C461D8C4313B/Users/kl/Meus Documentos/tetsee")
PROFILE_DIR = BASE / ".pw-profile-3ds-chrome"

STAMP = datetime.now().strftime("%Y%m%d_%H%M%S_3dschrome")
OUTDIR = BASE / "captures" / STAMP
SNAPS = OUTDIR / "snapshots"
OUTDIR.mkdir(parents=True, exist_ok=True)
SNAPS.mkdir(parents=True, exist_ok=True)

MAX_RUNS = 10          # watchdog: reabre até 10x se cair sozinho
TOTAL_BUDGET_S = 40 * 60


def snapshot_pages(ctx, tag):
    for i, pg in enumerate(ctx.pages):
        try:
            html = pg.content()
            (SNAPS / f"{tag}_page{i}.html").write_text(
                html, encoding="utf-8", errors="replace")
            print(f"  [snap] {tag} page{i}: {len(html)}B {pg.url[:110]}",
                  flush=True)
        except Exception as e:
            print(f"  [snap-skip] {e}", flush=True)


def run_once(p, run_no):
    print(f"\n--- run {run_no}: abrindo Chromium ---", flush=True)
    ctx = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=False,
        locale="pt-BR",
        timezone_id="America/Sao_Paulo",
        viewport={"width": 1366, "height": 900},
        args=[
            f"--disable-extensions-except={EXT_DIR}",
            f"--load-extension={EXT_DIR}",
            "--no-first-run",
        ],
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    try:
        page.goto("https://www.g2g.com/", timeout=30000)
    except Exception as e:
        print(f"[WARN] goto inicial: {e}", flush=True)
    print(">>> CHROMIUM ABERTO (extensão no toolbar). PIX -> PIX_DONE -> "
          "CARTÃO+3DS -> DONE <<<\n", flush=True)
    return ctx


def main():
    from playwright.sync_api import sync_playwright

    if not EXT_DIR.exists():
        print(f"[ERRO] extensão sumiu: {EXT_DIR}", file=sys.stderr)
        sys.exit(1)

    print(f"""
===============================================================================
G2G 3DS — janela Chromium (modo leve, com watchdog)
  Pasta desta sessão: {OUTDIR}
  PIX_DONE: {OUTDIR}/PIX_DONE
  DONE    : {OUTDIR}/DONE
===============================================================================
""", flush=True)

    t_end = time.time() + TOTAL_BUDGET_S
    pix_marked = (OUTDIR / "PIX_DONE").exists()
    phase = "card" if pix_marked else "pix"

    with sync_playwright() as p:
        run_no = 0
        while time.time() < t_end and run_no < MAX_RUNS:
            if (OUTDIR / "DONE").exists():
                print("[DONE] marcador presente, encerrando.", flush=True)
                return
            run_no += 1
            try:
                ctx = run_once(p, run_no)
            except Exception:
                print("[ERRO] falhou ao abrir, retry em 5s", flush=True)
                traceback.print_exc()
                time.sleep(5)
                continue
            try:
                while time.time() < t_end:
                    if (OUTDIR / "DONE").exists():
                        print("\n[DONE] finalizando...", flush=True)
                        snapshot_pages(ctx, "final")
                        ctx.close()
                        return
                    if (OUTDIR / "PIX_DONE").exists() and phase == "pix":
                        phase = "card"
                        print("\n[FASE] PIX marcado -> agora CARTÃO+3DS",
                              flush=True)
                        snapshot_pages(ctx, "pix")
                    try:
                        n = len(ctx.pages)
                    except Exception:
                        print("[WATCHDOG] contexto perdeu contato, reabrindo...",
                              flush=True)
                        break
                    if n == 0:
                        print("[WATCHDOG] janela fechada, reabrindo em 3s...",
                              flush=True)
                        time.sleep(3)
                        break
                    time.sleep(2)
            except Exception:
                print("[WATCHDOG] exceção, reabrindo...", flush=True)
                traceback.print_exc()
            finally:
                try:
                    ctx.close()
                except Exception:
                    pass
        print("[FIM] orçamento esgotado ou DONE.", flush=True)


if __name__ == "__main__":
    main()
