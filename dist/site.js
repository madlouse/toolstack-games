/**
 * Hub helpers: recent plays, lazy iframe + skeleton, search/filter,
 * keyboard shortcuts, toast, count-up, share. No network. No cookies. No third-party.
 */
(function () {
  var KEY = "tsl-hub-recent-v1";
  var MAX = 8;
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readRecent() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeRecent(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch (e) {
      /* private mode / quota */
    }
  }

  function pushRecent(slug, title) {
    if (!slug) return;
    var list = readRecent().filter(function (x) {
      return x && x.slug !== slug;
    });
    list.unshift({ slug: slug, title: title || slug, at: Date.now() });
    writeRecent(list);
  }

  function renderRecent() {
    var el = document.getElementById("recent-played");
    if (!el) return;
    var list = readRecent();
    if (!list.length) {
      el.hidden = true;
      return;
    }
    var ul = el.querySelector("ul");
    if (!ul) return;
    ul.innerHTML = "";
    list.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "/games/" + encodeURIComponent(item.slug) + "/";
      a.textContent = item.title || item.slug;
      li.appendChild(a);
      ul.appendChild(li);
    });
    el.hidden = false;
  }

  /* ---- Toast (no modal) ---- */
  function ensureToastHost() {
    var host = document.getElementById("toast-host");
    if (host) return host;
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
    return host;
  }

  function toast(msg) {
    var host = ensureToastHost();
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add("show");
    });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 280);
    }, 2200);
  }

  /* ---- Count-up (transform/opacity-safe via text; reduced-motion = static) ---- */
  function animateCount(el) {
    if (!el) return;
    var target = Number(el.getAttribute("data-count-to") || "0");
    if (!isFinite(target)) return;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }
    var start = 0;
    var dur = 500;
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(start + (target - start) * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function wireCounts() {
    document.querySelectorAll("[data-count-to]").forEach(animateCount);
  }

  /* ---- Play bay + skeleton ---- */
  function wirePlay() {
    var btn = document.getElementById("play-embed");
    if (!btn) return;
    var frame = document.getElementById("game-frame");
    var placeholder = document.getElementById("play-placeholder");
    var skeleton = document.getElementById("play-skeleton");
    var url = btn.getAttribute("data-game-url");
    var slug = btn.getAttribute("data-game-slug");
    var title = btn.getAttribute("data-game-title");
    if (!url || !frame) return;

    function load() {
      if (frame.getAttribute("src")) return;
      if (skeleton) skeleton.hidden = false;
      if (placeholder) placeholder.hidden = true;
      frame.hidden = false;
      /* Dock-in: decorative only, runs in parallel with iframe load */
      var wrap = document.getElementById("play-frame-wrap");
      var panel = wrap && wrap.closest ? wrap.closest(".play-panel") : null;
      if (panel) {
        panel.classList.add("docked");
        if (!reduceMotion) panel.classList.add("docking-glow");
        /* Land the bay below the sticky header (scroll-margin-top); instant, never delays load */
        if (panel.scrollIntoView) panel.scrollIntoView({ block: "start", behavior: "auto" });
      }
      if (wrap && !reduceMotion) wrap.classList.add("docking");
      var status = document.getElementById("bay-status");
      if (status) status.textContent = "Docked · " + (title || "cartridge");
      frame.addEventListener(
        "load",
        function () {
          if (skeleton) skeleton.hidden = true;
        },
        { once: true }
      );
      frame.src = url;
      pushRecent(slug, title);
      btn.textContent = "Playing…";
      btn.disabled = true;
      /* Keep hash honest without a second click */
      if (location.hash !== "#play") {
        try {
          history.replaceState(null, "", "#play");
        } catch (e) {}
      }
    }

    btn.addEventListener("click", load);
    var bayPlay = document.getElementById("bay-play");
    if (bayPlay) bayPlay.addEventListener("click", load);

    /* Home card / featured Play → /games/x/#play auto-docks (iframe stays lazy until intent) */
    function maybeAutoDock() {
      if (location.hash === "#play") load();
    }
    maybeAutoDock();
    window.addEventListener("hashchange", maybeAutoDock);
  }

  function wireCardPlay() {
    document.querySelectorAll("[data-recent-slug]").forEach(function (el) {
      el.addEventListener("click", function () {
        pushRecent(
          el.getAttribute("data-recent-slug"),
          el.getAttribute("data-recent-title")
        );
      });
    });
  }

  /* ---- Share / copy link ---- */
  function wireShare() {
    document.querySelectorAll("[data-share-url]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = btn.getAttribute("data-share-url") || location.href;
        var title = btn.getAttribute("data-share-title") || document.title;
        if (navigator.share) {
          navigator
            .share({ title: title, url: url })
            .then(function () {
              toast("Shared");
            })
            .catch(function () {
              copyUrl(url);
            });
        } else {
          copyUrl(url);
        }
      });
    });
  }

  function copyUrl(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () {
          toast("Link copied");
        },
        function () {
          fallbackCopy(url);
        }
      );
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(url) {
    try {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.className = "sr-clip";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Link copied");
    } catch (e) {
      toast("Copy failed — select the address bar");
    }
  }

  /* ---- Search + tag filter ---- */
  function wireFilter() {
    var grid = document.getElementById("games-grid");
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".card[data-tags]"));
    var input = document.getElementById("game-search");
    var empty = document.getElementById("filter-empty");
    var activeTag = "all";

    function apply() {
      var q = (input && input.value ? input.value : "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var tags = (card.getAttribute("data-tags") || "").toLowerCase();
        var hay = (
          (card.getAttribute("data-search") || "") +
          " " +
          tags
        ).toLowerCase();
        var tagOk = activeTag === "all" || tags.split(/\s+/).indexOf(activeTag) !== -1;
        var qOk = !q || hay.indexOf(q) !== -1;
        var ok = tagOk && qOk;
        card.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }

    if (input) {
      input.addEventListener("input", apply);
    }

    document.querySelectorAll("[data-filter-tag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTag = btn.getAttribute("data-filter-tag") || "all";
        document.querySelectorAll("[data-filter-tag]").forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        apply();
      });
    });
  }

  /* ---- Keyboard: / search, Enter on focused card ---- */
  function wireKeys() {
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      var typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target && e.target.isContentEditable);

      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var input = document.getElementById("game-search");
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }

      if (e.key === "Enter" && !typing) {
        var active = document.activeElement;
        if (!active) return;
        if (active.tagName === "A" || active.tagName === "BUTTON") return;
        var card = active.closest
          ? active.closest(".card, .featured[data-play-href]")
          : null;
        if (!card) return;
        var play = card.querySelector(
          "a.btn[href*='#play'], a.btn[href], button.btn#play-embed"
        );
        if (play) {
          e.preventDefault();
          play.click();
        }
      }
    });

    /* Make cards keyboard-focusable as a unit when tabbing thumb/title */
    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        if (e.target !== card) return;
        var play = card.querySelector("a.btn[href]");
        if (play) {
          e.preventDefault();
          play.click();
        }
      });
    });

    /* Featured hot cartridge: same Enter-to-play path */
    document.querySelectorAll(".featured[data-play-href]").forEach(function (feat) {
      feat.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        if (e.target !== feat) return;
        var play = feat.querySelector("a.btn[href*='#play']");
        if (play) {
          e.preventDefault();
          play.click();
          return;
        }
        var href = feat.getAttribute("data-play-href");
        if (href) location.href = href;
      });
    });
  }

  function init() {
    renderRecent();
    wirePlay();
    wireCardPlay();
    wireShare();
    wireFilter();
    wireKeys();
    wireCounts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
