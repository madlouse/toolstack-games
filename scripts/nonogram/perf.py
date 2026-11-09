import json
import socket
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

DIST = Path(sys.argv[1] if len(sys.argv) > 1 else "dist").resolve()
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "perf-out").resolve()
OUT.mkdir(parents=True, exist_ok=True)

INIT = """
window.__perf = { lcp: 0, cls: 0, tbt: 0, longTasks: [] };
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
} catch (error) {}
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value;
  }).observe({ type: "layout-shift", buffered: true });
} catch (error) {}
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__perf.longTasks.push(entry.duration);
      window.__perf.tbt += Math.max(0, entry.duration - 50);
    }
  }).observe({ type: "longtask", buffered: true });
} catch (error) {}
"""


def free_port():
    for port in range(41751, 41770):
        sock = socket.socket()
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        finally:
            sock.close()
        return port
    raise RuntimeError("no free port")


def main():
    targets = [
        sorted(DIST.glob("nonogram/5x5/easy/*/index.html"))[0],
        sorted(DIST.glob("nonogram/15x15/hard/*/index.html"))[0],
    ]
    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=DIST,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    report = {
        "method": "Playwright Chromium CDP. CPU throttle rate 4. Viewport 390x844, deviceScaleFactor 2, mobile. Network emulation latency 150ms, download 1.6Mbps, upload 750Kbps.",
        "tbtEquivalent": "Sum of (long task duration - 50ms) from navigation until about 2.5s after load. This is not Lighthouse TTI-bounded TBT.",
        "pages": [],
    }
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path="/opt/google/chrome/chrome", headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            )
            for html in targets:
                rel = html.relative_to(DIST).as_posix()
                url = f"http://127.0.0.1:{port}/{rel[:-len('index.html')]}"
                page = context.new_page()
                page.add_init_script(INIT)
                client = context.new_cdp_session(page)
                client.send("Network.enable")
                client.send(
                    "Network.emulateNetworkConditions",
                    {
                        "offline": False,
                        "latency": 150,
                        "downloadThroughput": 1.6 * 1024 * 1024 / 8,
                        "uploadThroughput": 750 * 1024 / 8,
                    },
                )
                client.send("Emulation.setCPUThrottlingRate", {"rate": 4})
                page.goto(url, wait_until="load")
                page.wait_for_timeout(2500)
                metrics = page.evaluate(
                    """() => {
                      const paint = performance.getEntriesByType("paint");
                      const fcpEntry = paint.find((entry) => entry.name === "first-contentful-paint");
                      const nav = performance.getEntriesByType("navigation")[0];
                      return {
                        fcpMs: fcpEntry ? fcpEntry.startTime : null,
                        lcpMs: window.__perf.lcp || null,
                        cls: window.__perf.cls,
                        tbtEquivalentMs: window.__perf.tbt,
                        longTasks: window.__perf.longTasks,
                        domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : null,
                        loadMs: nav ? nav.loadEventEnd : null
                      };
                    }"""
                )
                report["pages"].append({"file": rel, "url": url, **metrics})
                page.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    (OUT / "results.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report["pages"], indent=2))


if __name__ == "__main__":
    main()
