/**
 * Deferred hub helpers: recently-played (localStorage only) + lazy iframe play.
 * No network calls. No cookies. No third-party.
 */
(function () {
  var KEY = "tsl-hub-recent-v1";
  var MAX = 8;

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
      /* private mode / quota — ignore */
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

  function wirePlay() {
    var btn = document.getElementById("play-embed");
    if (!btn) return;
    var wrap = document.getElementById("play-frame-wrap");
    var frame = document.getElementById("game-frame");
    var placeholder = document.getElementById("play-placeholder");
    var url = btn.getAttribute("data-game-url");
    var slug = btn.getAttribute("data-game-slug");
    var title = btn.getAttribute("data-game-title");
    if (!url || !frame) return;

    function load() {
      if (frame.getAttribute("src")) return;
      frame.src = url;
      frame.hidden = false;
      if (placeholder) placeholder.hidden = true;
      pushRecent(slug, title);
      btn.textContent = "Playing…";
      btn.disabled = true;
    }

    btn.addEventListener("click", load);
    var alt = document.getElementById("play-embed-alt");
    if (alt) alt.addEventListener("click", load);
  }

  function wireCardPlay() {
    document.querySelectorAll("[data-recent-slug]").forEach(function (el) {
      el.addEventListener("click", function () {
        pushRecent(el.getAttribute("data-recent-slug"), el.getAttribute("data-recent-title"));
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      renderRecent();
      wirePlay();
      wireCardPlay();
    });
  } else {
    renderRecent();
    wirePlay();
    wireCardPlay();
  }
})();
