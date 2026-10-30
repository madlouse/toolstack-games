#!/workspace/.venv-pw/bin/python
"""Round-5 reproducing checks + light/dark screenshots (sequential, one browser).
Usage: CHROME_PATH=... /workspace/.venv-pw/bin/python r5_check.py <base-url> <out-dir> [--no-shots]
Writes ONLY into <out-dir>, which must be under game-hub-evidence/polish/(audit-round-5|live-round-5b)/.
Checks (names used in ROUND-5.md):
  R5-title-60          every page <title> is 10..60 chars
  R5-home-play-fold    home at 1280x800 (light+dark): a Play button is fully inside the first screen
  R5-actions-row-390   detail pages at 390: Play, Copy link and Open-in-new-tab share one row, nothing overflows
  R5-meta-align-1280   detail at 1280: visits/updated line sits in the title column (left edge == h1 left)
  R5-footer-bottom     at 1280x800 and 1920x1080 the footer ends at the bottom of the viewport or document (no mid-screen float)
  R5-instant-play      detail (390 + 1280): iframe src is set in the same task as the Play click (<=50 ms after click)
  R5-dock-motion       after Play: dock animations are transform/opacity only and 240..320 ms; 2px loading line shown, removed on load;
                       status goes Ready -> Loading… -> Docked · <game>
  R5-reduced-motion    prefers-reduced-motion: no running animation > 1 ms after Play, status set instantly
  R5-copy-feedback     Copy link -> visible "Copied ✓" + polite live region, label restored after ~1.5 s
  R5-pressed           mouse-down on the Copy link button (Play is disabled once docked; same .btn:active rule) scales it (<=0.98) within 120 ms
  R5-h1-2lines-390, R5-touch-44, R5-console-clean (no console errors / CSP violations on any page)
"""
import json, os, re, sys, time
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip("/")
out = os.path.abspath(sys.argv[2])
shots = "--no-shots" not in sys.argv
assert re.search(r"game-hub-evidence/polish/(audit-round-5|live-round-5b)(/|$)", out), "refusing to write outside a round-5 evidence dir"
os.makedirs(out, exist_ok=True)
PAGES = {"home": "/", "spud": "/games/spud-fling/", "pip": "/games/pips-bloom-isle/", "popular": "/popular/",
         "about": "/about/", "content-policy": "/content-policy/", "404": "/this-page-does-not-exist-r5/"}
VIEW = {390: 844, 768: 1024, 1280: 800, 1920: 1080}
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
R = {"base": base, "when": time.strftime("%Y-%m-%d %H:%M %Z"), "checks": {}, "fails": []}
def fail(n, m): R["fails"].append(f"{n}: {m}")
def put(k, sub, v): R["checks"].setdefault(k, {})[sub] = v

INIT = """window.__csp=[]; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective+' '+e.blockedURI));"""
TOUCH_JS = """() => { const r=[]; for (const el of document.querySelectorAll('a[href], button, [role=button], summary')) {
  const cs=getComputedStyle(el); if (cs.visibility==='hidden'||cs.display==='none') continue;
  if (el.closest('[hidden]')||el.closest('.visually-hidden')||el.classList.contains('skip-link')) continue;
  const b=el.getBoundingClientRect(); if (!b.width||!b.height) continue;
  r.push({t:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,40), w:Math.round(b.width), h:Math.round(b.height)}); } return r; }"""
H1_JS = """() => { const h=document.querySelector('main h1'); if(!h) return null; const cs=getComputedStyle(h);
 const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2; return {text:h.innerText, lines:Math.round(h.getBoundingClientRect().height/lh)}; }"""
ARM_JS = """() => { const f=document.getElementById('game-frame'), st=document.getElementById('bay-status'); window.__r5={status:[st?st.textContent:null]};
  document.addEventListener('click', e => { if (e.target.closest('#bay-play,#play-embed') && window.__r5.click==null) window.__r5.click=performance.now(); }, true);
  new MutationObserver(() => { if (f.getAttribute('src') && window.__r5.src==null) window.__r5.src=performance.now(); }).observe(f,{attributes:true,attributeFilter:['src']});
  if (st) new MutationObserver(() => window.__r5.status.push(st.textContent)).observe(st,{childList:true,characterData:true,subtree:true});
  f.addEventListener('load', () => { window.__r5.load=performance.now(); const p=document.querySelector('.bay-progress'); window.__r5.progressAtLoad = p ? getComputedStyle(p).opacity : null; });
}"""
ANIM_JS = """() => document.getAnimations().map(a => { const k=a.effect&&a.effect.getKeyframes?a.effect.getKeyframes():[]; const t=a.effect.getTiming();
  const props=[...new Set(k.flatMap(x=>Object.keys(x).filter(p=>!['offset','easing','composite','computedOffset'].includes(p))))];
  return {name:a.animationName||a.transitionProperty||'anim', target:(a.effect.target&&(a.effect.target.id||a.effect.target.className))||'', pseudo:a.effect.pseudoElement||'', dur:t.duration, iter:t.iterations, props}; })"""

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=ARGS)
    def ctx_for(w, scheme="light", motion="no-preference"):
        m = w == 390
        c = br.new_context(viewport={"width": w, "height": VIEW[w]}, color_scheme=scheme, reduced_motion=motion,
                           has_touch=m, is_mobile=m, device_scale_factor=1)
        c.add_init_script(INIT); return c
    # ---- per page × width × scheme: screenshots + layout checks
    for scheme in ["light", "dark"]:
        for w in VIEW:
            ctx = ctx_for(w, scheme); pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            for name, path in PAGES.items():
                errs.clear(); pg.goto(base + path, wait_until="load"); pg.wait_for_timeout(350)
                if shots:
                    pg.screenshot(path=f"{out}/{name}-{w}-{scheme}-fold.png")
                    pg.screenshot(path=f"{out}/{name}-{w}-{scheme}-full.png", full_page=True)
                csp = pg.evaluate("window.__csp")
                bad = [e for e in errs if not (name == "404" and "404" in e)]
                if bad or csp:
                    put("console", f"{name}@{w}-{scheme}", {"errors": bad, "csp": csp}); fail("R5-console-clean", f"{name}@{w}-{scheme} {bad[:2]} {csp[:2]}")
                if w == 1280 and name == "home":
                    r = pg.evaluate("""() => [...document.querySelectorAll('.btn-play')].map(b=>{const x=b.getBoundingClientRect(); return {t:b.innerText.trim(), top:Math.round(x.top), bottom:Math.round(x.bottom), vis:x.width>0}})""")
                    ok = [b for b in r if b["vis"] and b["top"] >= 0 and b["bottom"] <= VIEW[w]]
                    put("home_play_fold", scheme, {"buttons": r, "inFold": len(ok)})
                    if not ok: fail("R5-home-play-fold", f"{scheme}: no Play inside 1280x800 first screen {r}")
                if w in (1280, 1920):
                    f = pg.evaluate("""() => { const f=document.querySelector('.site-footer').getBoundingClientRect(); const H=innerHeight, D=document.documentElement.scrollHeight;
                      return {footerBottomAbs: Math.round(f.bottom+scrollY), docH:D, vh:H, gapBelow: Math.round(Math.max(H, D) - (f.bottom+scrollY))}; }""")
                    put("footer", f"{name}@{w}-{scheme}", f)
                    if f["gapBelow"] > 1: fail("R5-footer-bottom", f"{name}@{w}-{scheme}: {f['gapBelow']}px empty below footer")
                if scheme != "light":
                    continue
                if name not in ("404",):
                    t = pg.title(); put("titles", name, {"title": t, "len": len(t)})
                    if not (10 <= len(t) <= 60): fail("R5-title-60", f"{name}: {len(t)} {t!r}")
                if w == 390:
                    h = pg.evaluate(H1_JS); put("h1_390", name, h)
                    if h and h["lines"] > 2: fail("R5-h1-2lines-390", f"{name}: {h}")
                    small = [x for x in pg.evaluate(TOUCH_JS) if x["h"] < 44 or x["w"] < 24]
                    put("touch_small", name, small)
                    for x in small: fail("R5-touch-44", f"{name}: {x}")
                if name in ("spud", "pip") and w == 390:
                    r = pg.evaluate("""() => { const q=s=>document.querySelector(s); const els=[q('#play-embed'), q('.detail-cta [data-share-url]'), q('.detail-cta .btn-newtab, .detail-cta .btn-link')];
                      return els.map(e=>{ if(!e) return null; const b=e.getBoundingClientRect(); return {t:e.innerText.trim(), top:Math.round(b.top), cy:Math.round(b.top+b.height/2), right:Math.round(b.right)}; }); }""")
                    put("actions_390", name, r)
                    if None in r or max(x["cy"] for x in r) - min(x["cy"] for x in r) > 4 or max(x["right"] for x in r) > 390:
                        fail("R5-actions-row-390", f"{name}: {r}")
                if name in ("spud", "pip") and w == 1280:
                    r = pg.evaluate("""() => { const h=document.querySelector('.detail-meta h1').getBoundingClientRect(), s=document.querySelector('.score-hint').getBoundingClientRect();
                      return {h1Left:Math.round(h.left), hintLeft:Math.round(s.left)}; }""")
                    put("meta_align_1280", name, r)
                    if abs(r["h1Left"] - r["hintLeft"]) > 2: fail("R5-meta-align-1280", f"{name}: {r}")
            ctx.close()
    # ---- play / motion / reduced motion / copy / pressed
    for slug in ("spud-fling", "pips-bloom-isle"):
        for w in (390, 1280):
            for motion in ("no-preference", "reduce"):
                ctx = ctx_for(w, "dark", motion)
                try: ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
                except Exception: pass
                pg = ctx.new_page(); errs = []
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                pg.goto(f"{base}/games/{slug}/", wait_until="load"); pg.wait_for_timeout(300)
                pg.evaluate(ARM_JS)
                pg.click("#bay-play")
                pg.wait_for_timeout(40)
                early = pg.evaluate("""() => { const p=document.querySelector('.bay-progress'); const s=document.getElementById('bay-status');
                  return {progressVisible: !!p && !p.hidden && getComputedStyle(p).display!=='none', progressH: p?Math.round(p.getBoundingClientRect().height):null, statusOpacityTransition: s?getComputedStyle(s).transitionProperty+' '+getComputedStyle(s).transitionDuration:null}; }""")
                anims = pg.evaluate(ANIM_JS)
                wait_err = None; deadline = time.time() + int(os.environ.get("R5_LOAD_TIMEOUT", "20000")) / 1000
                while time.time() < deadline:  # plain polling: wait_for_function's rAF polling can error while a same-site game saturates the renderer
                    try:
                        if pg.evaluate("window.__r5.load!=null"): break
                    except Exception as e: wait_err = repr(e)[:200]
                    pg.wait_for_timeout(250)
                pg.wait_for_timeout(400)
                r5 = pg.evaluate("window.__r5")
                prog_after = pg.evaluate("""() => { const p=document.querySelector('.bay-progress'); return p ? {hidden:p.hidden, opacity:getComputedStyle(p).opacity} : null; }""")
                ms = (r5.get("src") or 1e9) - (r5.get("click") or 0)
                key = f"{slug}@{w}-{motion}"
                rec = {"click_to_src_ms": round(ms, 1), "loaded_ms_after_click": round((r5.get("load") or 0) - (r5.get("click") or 0)),
                       "status_seq": r5.get("status"), "early": early, "anims_at_40ms": anims, "progress_after_load": prog_after,
                       "console_errors": [e for e in errs], "wait_err": wait_err}
                if ms > 50: fail("R5-instant-play", f"{key}: {ms} ms")
                seq = [s for s in (r5.get("status") or []) if s]
                if not (any(s.startswith("Ready") for s in seq) and any(s.startswith("Loading") for s in seq) and seq[-1].startswith("Docked")):
                    fail("R5-dock-motion", f"{key}: status seq {seq}")
                if motion == "no-preference":
                    dock = [a for a in anims if a["iter"] != float("inf") and a["iter"] is not None and a["dur"] and a["dur"] > 50 and a["name"] not in ("shimmer", "bay-progress")]
                    rec["dock_anims"] = dock
                    if not dock: fail("R5-dock-motion", f"{key}: no dock animation running at 40 ms")
                    for a in dock:
                        lo, hi = (100, 160) if a["target"] == "bay-status" else (240, 320)  # status crossfade is specified at 150ms
                        if not (lo <= a["dur"] <= hi): fail("R5-dock-motion", f"{key}: {a['name']} on {a['target']} {a['dur']}ms")
                        if any(pp not in ("transform", "opacity") for pp in a["props"]): fail("R5-dock-motion", f"{key}: {a['name']} animates {a['props']}")
                    if not early["progressVisible"] or early["progressH"] != 2: fail("R5-dock-motion", f"{key}: loading line {early}")
                    if prog_after and not (prog_after["hidden"] or prog_after["opacity"] == "0"): fail("R5-dock-motion", f"{key}: loading line not removed {prog_after}")
                else:
                    long = [a for a in anims if a["dur"] and a["dur"] > 1]
                    rec["long_anims_reduced"] = long
                    if long: fail("R5-reduced-motion", f"{key}: {long}")
                    if len(seq) > 1 and not seq[1].startswith("Loading"): fail("R5-reduced-motion", f"{key}: {seq}")
                if shots: pg.screenshot(path=f"{out}/play-{slug}-{w}-{motion}.png")
                # copy feedback + pressed (once per slug/width, motion on)
                if motion == "no-preference":
                    # fresh tab (no WebGL game running) so the measurement is about the hub UI, not GPU starvation
                    pg.close(); pg = ctx.new_page()
                    pg.goto(f"{base}/games/{slug}/", wait_until="load"); pg.wait_for_timeout(300)
                    btn = pg.locator(".detail-cta [data-share-url]")
                    pg.evaluate("() => { try { Object.defineProperty(navigator,'share',{value:undefined,configurable:true}); } catch(e){} }")
                    btn.click(); pg.wait_for_timeout(250)
                    c1 = pg.evaluate("""() => { const b=document.querySelector('.detail-cta [data-share-url]'); const live=document.querySelector('[data-copy-live]');
                      const done=b.querySelector('.lbl-done'); return {state:b.getAttribute('data-state'), doneVisible: done?getComputedStyle(done).opacity:null, doneText: done?done.textContent:null, live: live?live.textContent:null, liveAttr: live?live.getAttribute('aria-live'):null}; }""")
                    if shots: btn.screenshot(path=f"{out}/copied-{slug}-{w}.png")
                    pg.wait_for_timeout(1700)
                    c2 = pg.evaluate("() => document.querySelector('.detail-cta [data-share-url]').getAttribute('data-state')")
                    rec["copy"] = {"after_250ms": c1, "after_1950ms_state": c2}
                    if not (c1["state"] == "copied" and c1["doneText"] and "Copied" in c1["doneText"] and float(c1["doneVisible"] or 0) > 0.9 and c1["live"] and c1["liveAttr"] == "polite" and c2 != "copied"):
                        fail("R5-copy-feedback", f"{key}: {rec['copy']}")
                    if w == 1280:
                        b = pg.locator(".detail-cta [data-share-url]").bounding_box()
                        pg.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2); pg.mouse.down(); pg.wait_for_timeout(120)
                        tf = pg.evaluate("getComputedStyle(document.querySelector('.detail-cta [data-share-url]')).transform"); pg.mouse.up()
                        m = re.match(r"matrix\(([-\d.e]+)", tf or ""); sc = float(m.group(1)) if m else 1.0
                        rec["pressed_transform"] = tf
                        if sc > 0.98: fail("R5-pressed", f"{key}: {tf}")
                put("play", key, rec); ctx.close()
    br.close()
R["pass"] = not R["fails"]
json.dump(R, open(f"{out}/r5_check.json", "w"), indent=1, default=str)
print("PASS" if R["pass"] else "FAIL", len(R["fails"]))
for f in R["fails"]: print(" -", f)
