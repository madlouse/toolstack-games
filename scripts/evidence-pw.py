#!/usr/bin/env python3
"""Evidence: screenshots, iframe play, console, network, timings. Optional Lighthouse."""
import json, os, time, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROME = "/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
ARGS = [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-sandbox",
    "--disable-dev-shm-usage",
]
ROOT = Path("/workspace/exp28-games/game-hub")
EV = ROOT / "evidence"
DIST = ROOT / "dist"
ALLOWED_GAME_ORIGINS = {
    "https://tsl-game1.pages.dev",
    "https://bloom-isle.gettoolstacklab.com",
}
# Hub itself is localhost — allowed
BASE = "http://127.0.0.1:4173"

VIEWPORTS = {
    "mobile": {"width": 390, "height": 844},
    "desktop": {"width": 1280, "height": 800},
}

PAGES = [
    ("home", "/"),
    ("spud-fling", "/games/spud-fling/"),
    ("pips-bloom-isle", "/games/pips-bloom-isle/"),
]


def start_server():
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "4173", "--bind", "127.0.0.1", "--directory", str(DIST)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.6)
    return proc


def main():
    EV.mkdir(exist_ok=True)
    shots = EV / "screenshots"
    shots.mkdir(exist_ok=True)
    report = {
        "base": BASE,
        "pages": {},
        "iframe_play": {},
        "console_errors": [],
        "external_requests": [],
        "timings": {},
        "lighthouse": None,
    }

    server = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME, args=ARGS, headless=True)

            # --- viewport screenshots ---
            for vp_name, vp in VIEWPORTS.items():
                context = browser.new_context(viewport=vp, device_scale_factor=1)
                page = context.new_page()
                console_errs = []
                page.on("console", lambda msg: console_errs.append({"type": msg.type, "text": msg.text}) if msg.type == "error" else None)
                page.on("pageerror", lambda err: console_errs.append({"type": "pageerror", "text": str(err)}))

                for name, path in PAGES:
                    url = BASE + path
                    resp = page.goto(url, wait_until="networkidle", timeout=30000)
                    status = resp.status if resp else None
                    out = shots / f"{vp_name}-{name}.png"
                    page.screenshot(path=str(out), full_page=True)
                    key = f"{vp_name}:{name}"
                    report["pages"][key] = {
                        "url": url,
                        "http": status,
                        "screenshot": str(out.relative_to(ROOT)),
                        "console_errors_on_page": [e for e in console_errs],
                    }
                    print(f"shot {out.name} http={status}")
                    console_errs.clear()
                context.close()


            # --- hub-only network: home + detail should not call third parties ---
            context = browser.new_context(viewport=VIEWPORTS["desktop"])
            page = context.new_page()
            hub_ext = {}
            for name, path in PAGES:
                reqs = []
                def on_req(req, bucket=reqs):
                    bucket.append(req.url)
                page.on("request", on_req)
                page.goto(BASE + path, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(500)
                ext = [u for u in reqs if not (u.startswith(BASE) or u.startswith("data:") or u.startswith("blob:"))]
                hub_ext[name] = ext
                page.remove_listener("request", on_req)
            report["hub_only_external"] = hub_ext
            print("hub_only_external", hub_ext)
            context.close()

            # --- iframe play test (desktop) for both games ---
            for slug, path, expect_origin in [
                ("spud-fling", "/games/spud-fling/", "https://tsl-game1.pages.dev"),
                ("pips-bloom-isle", "/games/pips-bloom-isle/", "https://bloom-isle.gettoolstacklab.com"),
            ]:
                context = browser.new_context(viewport=VIEWPORTS["desktop"])
                page = context.new_page()
                console_errs = []
                requests_log = []

                def on_req(req):
                    requests_log.append({"url": req.url, "resource": req.resource_type})

                page.on("request", on_req)
                page.on("console", lambda msg: console_errs.append({"type": msg.type, "text": msg.text}) if msg.type == "error" else None)
                page.on("pageerror", lambda err: console_errs.append({"type": "pageerror", "text": str(err)}))

                page.goto(BASE + path, wait_until="networkidle", timeout=30000)
                # before click: iframe should have no src / hidden
                frame = page.locator("#game-frame")
                assert frame.count() == 1
                src_before = frame.get_attribute("src")
                page.locator("#play-embed").click()
                # wait for src
                page.wait_for_function(
                    "() => { const f=document.getElementById('game-frame'); return f && f.src && f.src.length>0; }",
                    timeout=10000,
                )
                src_after = frame.get_attribute("src")
                # wait a bit for game origin response via request log
                time.sleep(3.0)
                # Check game document response via page.request
                game_resp = page.request.get(expect_origin + "/", timeout=30000)
                game_http = game_resp.status

                # iframe present and visible
                hidden = frame.get_attribute("hidden")
                box = frame.bounding_box()

                # classify external requests (after click)
                external = []
                for r in requests_log:
                    u = r["url"]
                    if u.startswith(BASE) or u.startswith("data:") or u.startswith("blob:"):
                        continue
                    # allow game origins only
                    ok = any(u.startswith(o) for o in ALLOWED_GAME_ORIGINS)
                    external.append({"url": u, "resource": r["resource"], "allowed": ok})

                def is_cf_insights(url: str) -> bool:
                    return (
                        "cloudflareinsights.com" in url
                        or "/cdn-cgi/rum" in url
                    )

                bad_ext = [e for e in external if not e["allowed"]]
                cf_side = [e for e in bad_ext if is_cf_insights(e["url"])]
                other_bad = [e for e in bad_ext if not is_cf_insights(e["url"])]
                result = {
                    "slug": slug,
                    "src_before": src_before,
                    "src_after": src_after,
                    "game_origin_http": game_http,
                    "iframe_hidden_attr": hidden,
                    "iframe_box": box,
                    "console_errors": console_errs,
                    "external_requests": external,
                    "disallowed_external": bad_ext,
                    "cf_insights_from_game_host": cf_side,
                    "other_disallowed": other_bad,
                    "note": "CF Web Analytics beacon is edge-injected by the game host HTML even with ?internal=1 on Spud (script tag present in HTML). Hub itself ships no third-party. Games must not be modified per brief.",
                    "pass": bool(
                        src_after
                        and src_after.startswith(expect_origin)
                        and "internal=1" in src_after
                        and game_http == 200
                        and box is not None
                        and not other_bad
                    ),
                }
                report["iframe_play"][slug] = result
                print(f"iframe {slug}: pass={result['pass']} src={src_after} game_http={game_http} bad_ext={len(bad_ext)}")
                # screenshot after load
                page.screenshot(path=str(shots / f"desktop-{slug}-playing.png"), full_page=True)
                context.close()

            # --- navigation timing + transfer sizes (cache disabled, fresh context each) ---
            for name, path in PAGES:
                context = browser.new_context(viewport=VIEWPORTS["desktop"])
                page = context.new_page()
                # CDP disable cache
                try:
                    cdp = context.new_cdp_session(page)
                    cdp.send("Network.enable")
                    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
                except Exception:
                    pass
                page.goto(BASE + path, wait_until="load", timeout=30000)
                timing = page.evaluate(
                    """() => {
                      const n = performance.getEntriesByType('navigation')[0];
                      const res = performance.getEntriesByType('resource');
                      const transfer = res.reduce((a,r)=>a+(r.transferSize||0),0);
                      const encoded = res.reduce((a,r)=>a+(r.encodedBodySize||0),0);
                      return {
                        domContentLoaded: n ? n.domContentLoadedEventEnd : null,
                        loadEventEnd: n ? n.loadEventEnd : null,
                        responseEnd: n ? n.responseEnd : null,
                        transferSizeNav: n ? n.transferSize : null,
                        resourceCount: res.length,
                        resourcesTransferSize: transfer,
                        resourcesEncodedBody: encoded,
                        resources: res.map(r => ({
                          name: r.name,
                          transferSize: r.transferSize,
                          encodedBodySize: r.encodedBodySize,
                          initiatorType: r.initiatorType
                        }))
                      };
                    }"""
                )
                report["timings"][name] = timing
                print(
                    f"timing {name}: dcl={timing.get('domContentLoaded')} load={timing.get('loadEventEnd')} "
                    f"xfer={timing.get('resourcesTransferSize')}"
                )
                context.close()

            # Collect any remaining console from home-only pass already stored
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except Exception:
            server.kill()

    # Flatten console errors
    for key, info in report["pages"].items():
        for e in info.get("console_errors_on_page") or []:
            report["console_errors"].append({"page": key, **e})
    for slug, info in report["iframe_play"].items():
        for e in info.get("console_errors") or []:
            report["console_errors"].append({"page": f"play:{slug}", **e})
        for e in info.get("other_disallowed") or []:
            report["external_requests"].append({"page": f"play:{slug}", **e})

    (EV / "pw-report.json").write_text(json.dumps(report, indent=2))
    print("wrote evidence/pw-report.json")

    # --- Lighthouse attempt ---
    lh_out = EV / "lighthouse"
    lh_out.mkdir(exist_ok=True)
    server = start_server()
    lh_result = {"ran": False, "error": None, "scores": None}
    try:
        env = os.environ.copy()
        env["CHROME_PATH"] = CHROME
        cmd = [
            "npx",
            "--yes",
            "lighthouse",
            BASE + "/",
            "--quiet",
            f"--chrome-path={CHROME}",
            "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
            "--form-factor=mobile",
            "--screenEmulation.mobile",
            "--only-categories=performance,accessibility,best-practices,seo",
            "--output=json",
            f"--output-path={lh_out / 'home-mobile.json'}",
        ]
        print("running lighthouse...", " ".join(cmd))
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=180)
        (EV / "lighthouse-stdout.txt").write_text(proc.stdout or "")
        (EV / "lighthouse-stderr.txt").write_text(proc.stderr or "")
        if proc.returncode == 0 and (lh_out / "home-mobile.json").exists():
            data = json.loads((lh_out / "home-mobile.json").read_text())
            cats = data.get("categories") or {}
            scores = {k: (cats[k].get("score") if cats.get(k) else None) for k in cats}
            lh_result = {"ran": True, "error": None, "scores": scores, "path": str((lh_out / "home-mobile.json").relative_to(ROOT))}
            print("lighthouse scores:", scores)
        else:
            lh_result = {
                "ran": False,
                "error": f"exit={proc.returncode} stderr_tail={(proc.stderr or '')[-800:]}",
                "scores": None,
            }
            print("lighthouse failed:", lh_result["error"][:400])
    except Exception as e:
        lh_result = {"ran": False, "error": repr(e), "scores": None}
        print("lighthouse exception:", e)
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except Exception:
            server.kill()

    report["lighthouse"] = lh_result
    (EV / "pw-report.json").write_text(json.dumps(report, indent=2))

    # Human summary
    summary = []
    summary.append("# Evidence summary\n")
    summary.append(f"- validate pass + negative fails: see validate-*.txt\n")
    summary.append(f"- screenshots: evidence/screenshots/ (mobile 390x844 + desktop 1280x800 × home + 2 details)\n")
    for slug, info in report["iframe_play"].items():
        summary.append(
            f"- iframe {slug}: pass={info['pass']} game_http={info['game_origin_http']} src={info['src_after']}\n"
        )
    summary.append(f"- console errors total: {len(report['console_errors'])}\n")
    summary.append(f"- hub-only external (should be empty): {report.get('hub_only_external')}\n")
    for slug, info in report["iframe_play"].items():
        summary.append(
            f"  - after play {slug}: other_disallowed={len(info.get('other_disallowed') or [])} "
            f"cf_insights_side_effect={len(info.get('cf_insights_from_game_host') or [])}\n"
        )
    summary.append(f"- disallowed external (non-CF) listed in external_requests flatten: {len(report['external_requests'])}\n")
    for name, t in report["timings"].items():
        summary.append(
            f"- timing {name}: DCL={t.get('domContentLoaded')}ms load={t.get('loadEventEnd')}ms "
            f"resourcesTransfer={t.get('resourcesTransferSize')}B count={t.get('resourceCount')}\n"
        )
    if lh_result.get("ran"):
        summary.append(f"- lighthouse mobile home scores: {lh_result['scores']}\n")
    else:
        summary.append(f"- lighthouse: NOT RUN / FAILED — {lh_result.get('error')}\n")
        summary.append("  (honest gap: no invented scores)\n")
    (EV / "SUMMARY.md").write_text("".join(summary))
    print("".join(summary))


if __name__ == "__main__":
    main()
