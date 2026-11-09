import { join } from "node:path";

const DIFFS = ["easy", "medium", "hard"];
const MOTIF_LABEL = {
  bars: "bars",
  rects: "blocks",
  runs: "runs",
  steps: "steps",
  bands: "bands",
  speckle: "speckles",
};

function seqOf(level) {
  return level.id.slice(level.id.lastIndexOf("-") + 1);
}

function sizeLabel(level) {
  return `${level.rows}×${level.cols}`;
}

function levelPath(level) {
  return `/nonogram/${level.rows}x${level.cols}/${level.difficulty}/${seqOf(level)}/`;
}

function sizePath(rows, cols) {
  return `/nonogram/${rows}x${cols}/`;
}

function diffPath(rows, cols, difficulty) {
  return `/nonogram/${rows}x${cols}/${difficulty}/`;
}

function motifLabel(motif) {
  return MOTIF_LABEL[motif] || motif;
}

function article(word) {
  return "aeiou".includes(word[0]) ? "an" : "a";
}

function clueText(clues) {
  return clues && clues.length ? clues.join(" ") : "0";
}

function filledRange(list) {
  let min = Infinity;
  let max = -Infinity;
  for (const level of list) {
    if (level.filled < min) min = level.filled;
    if (level.filled > max) max = level.filled;
  }
  return { min, max };
}

function levelTitle(level) {
  return `Nonogram ${sizeLabel(level)} ${level.difficulty} ${seqOf(level)}, ${level.filled} filled | Toolstack Lab`;
}

function levelDescription(level) {
  const cells = level.rows * level.cols;
  return `Play nonogram ${sizeLabel(level)} ${level.difficulty} ${seqOf(level)} in the page. ${level.filled} of ${cells} cells are filled. First row clue ${clueText(level.rowClues[0])}. First column clue ${clueText(level.colClues[0])}. One solution.`;
}

function howToHtml() {
  return `<section class="ng-howto" aria-labelledby="howto-h">
    <h2 id="howto-h">How to play</h2>
    <p>Numbers beside each row and above each column list filled blocks from left to right or top to bottom. A block is that many filled cells in a line, and two blocks in one line have at least one empty cell between them. A zero means the whole line is empty. Tap a cell to fill it, and tap the same cell again to clear it. The level is complete when the grid matches the one solution.</p>
  </section>`;
}

function statsHtml(level, esc) {
  const empty = level.rows * level.cols - level.filled;
  return `<dl class="ng-stats">
    <div><dt>Size</dt><dd>${esc(sizeLabel(level))}</dd></div>
    <div><dt>Filled cells</dt><dd>${level.filled}</dd></div>
    <div><dt>Empty cells</dt><dd>${empty}</dd></div>
    <div><dt>Difficulty</dt><dd>${esc(level.difficulty)}</dd></div>
  </dl>`;
}

function boardHtml(level) {
  const rows = level.rows;
  const cols = level.cols;
  let colHtml = "";
  for (let c = 0; c < cols; c++) {
    const clues = level.colClues[c];
    const bits = clues.length ? clues.map((n) => `<span>${n}</span>`).join("") : "<span>0</span>";
    colHtml += `<div class="ng-cc">${bits}</div>`;
  }
  let rowHtml = "";
  for (let r = 0; r < rows; r++) {
    const clues = level.rowClues[r];
    const bits = clues.length ? clues.map((n) => `<span>${n}</span>`).join("") : "<span>0</span>";
    rowHtml += `<div class="ng-rc">${bits}</div>`;
  }
  let cells = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const edgeR = (c + 1) % 5 === 0 && c !== cols - 1 ? " ng-edge-r" : "";
      const edgeB = (r + 1) % 5 === 0 && r !== rows - 1 ? " ng-edge-b" : "";
      cells += `<button type="button" class="ng-cell${edgeR}${edgeB}" aria-label="Row ${r + 1} column ${c + 1}" aria-pressed="false"></button>`;
    }
  }
  const solution = level.solution.join("");
  return `<div class="ng-table ng-s${rows}" id="ng-board" data-solution="${solution}" data-rows="${rows}" data-cols="${cols}" data-difficulty="${level.difficulty}">
    <div class="ng-corner"></div>
    <div class="ng-colclues">${colHtml}</div>
    <div class="ng-rowclues">${rowHtml}</div>
    <div class="ng-grid">${cells}</div>
  </div>
  <p class="ng-win" id="ng-win" hidden data-win="0">Solved. This is the one solution for this nonogram.</p>
  <p class="ng-actions"><button type="button" class="btn btn-secondary" id="ng-clear">Clear grid</button></p>`;
}

function relatedHtml(level, levels, esc) {
  const group = levels.filter((item) => item.rows === level.rows && item.cols === level.cols && item.difficulty === level.difficulty);
  const index = group.findIndex((item) => item.id === level.id);
  const prev = group[(index - 1 + group.length) % group.length];
  const next = group[(index + 1) % group.length];
  const same = levels.filter((item) => item.rows === level.rows && item.cols === level.cols && item.id !== level.id);
  const step = Math.max(1, Math.floor(same.length / 6));
  const picks = [];
  for (let i = 0; i < same.length && picks.length < 6; i += step) picks.push(same[i]);
  const siblings = picks
    .map((item) => `<li><a href="${levelPath(item)}">${esc(sizeLabel(item))} ${esc(item.difficulty)} ${esc(seqOf(item))}</a></li>`)
    .join("");
  return `<nav class="ng-related" aria-label="Related levels">
    <p class="ng-prevnext"><a href="${levelPath(prev)}">Previous level</a><a href="${levelPath(next)}">Next level</a></p>
    <h2>Same size</h2>
    <p><a href="${sizePath(level.rows, level.cols)}">Same size: all ${esc(sizeLabel(level))} nonograms</a></p>
    <ul class="ng-level-list">${siblings}</ul>
    <h2>Index</h2>
    <p><a href="/nonogram/">All nonogram levels</a> <a href="${diffPath(level.rows, level.cols, level.difficulty)}">${esc(sizeLabel(level))} ${esc(level.difficulty)} index</a></p>
  </nav>`;
}

function levelBody(level, levels, esc) {
  const cells = level.rows * level.cols;
  return `<main id="main" class="ng-page">
  <div class="wrap">
    <p class="crumb"><a href="/">Home</a> · <a href="/nonogram/">Nonograms</a> · <a href="${sizePath(level.rows, level.cols)}">${esc(sizeLabel(level))}</a> · <a href="${diffPath(level.rows, level.cols, level.difficulty)}">${esc(level.difficulty)}</a> · ${esc(seqOf(level))}</p>
    <h1>Nonogram ${esc(sizeLabel(level))} ${esc(level.difficulty)} ${esc(seqOf(level))}</h1>
    <p>Level ${esc(seqOf(level))} is ${article(level.difficulty)} ${esc(level.difficulty)} ${esc(sizeLabel(level))} picture logic puzzle with ${level.filled} filled cells and ${cells - level.filled} empty cells. Motif: ${esc(motifLabel(level.motif))}. There is one solution.</p>
    ${statsHtml(level, esc)}
    ${boardHtml(level)}
    ${howToHtml()}
    ${relatedHtml(level, levels, esc)}
  </div>
</main>`;
}

function listHtml(items) {
  return `<ul class="ng-level-list">${items
    .map((level) => `<li><a href="${levelPath(level)}">${sizeLabel(level)} ${level.difficulty} ${seqOf(level)} · ${level.filled} filled</a></li>`)
    .join("")}</ul>`;
}

function page(layout, scriptSrc, spec) {
  return layout({
    title: spec.title,
    description: spec.description,
    canonicalPath: spec.path,
    ogImage: "/og.jpg",
    ogAlt: "Nonogram picture logic puzzle on Toolstack Lab Games",
    body: spec.body,
    navActive: "",
    scripts: scriptSrc && spec.play ? [scriptSrc] : [],
  });
}

export function writeNonogramPages(doc, { dist, layout, write, esc, scriptSrc }) {
  const levels = doc.levels;
  const urls = [];
  const sizes = [...new Set(levels.map((level) => level.rows))].sort((a, b) => a - b);
  const total = levels.length;
  const sizeBits = sizes
    .map((size) => {
      const count = levels.filter((level) => level.rows === size).length;
      return `<li><a href="${sizePath(size, size)}">${size}×${size} nonograms (${count})</a></li>`;
    })
    .join("");
  const diffBits = sizes
    .map((size) => {
      const links = DIFFS.map((difficulty) => {
        const count = levels.filter((level) => level.rows === size && level.difficulty === difficulty).length;
        return `<a href="${diffPath(size, size, difficulty)}">${size}×${size} ${difficulty} (${count})</a>`;
      }).join(" ");
      return `<p>${links}</p>`;
    })
    .join("");
  const mainPath = "/nonogram/";
  const mainBody = `<main id="main" class="ng-page">
  <div class="wrap">
    <p class="crumb"><a href="/">Home</a> · Nonograms</p>
    <h1>Nonogram picture logic puzzles</h1>
    <p>This section has ${total} nonogram levels. Each page is one grid with one solution. Choose a size, then an easy, medium or hard set, and paint the cells in the page.</p>
    ${howToHtml()}
    <h2>Sizes</h2>
    <ul class="ng-level-list">${sizeBits}</ul>
    <h2>Size and difficulty</h2>
    ${diffBits}
  </div>
</main>`;
  write(
    join(dist, "nonogram/index.html"),
    page(layout, scriptSrc, {
      title: "Nonogram picture logic puzzles | Toolstack Lab",
      description: `Browse ${total} nonogram picture logic puzzles. Each level has one solution. Play 5×5, 10×10 and 15×15 grids in easy, medium and hard sets.`,
      path: mainPath,
      body: mainBody,
    })
  );
  urls.push(mainPath);

  for (const size of sizes) {
    const inSize = levels.filter((level) => level.rows === size && level.cols === size);
    const counts = Object.fromEntries(DIFFS.map((difficulty) => [difficulty, inSize.filter((level) => level.difficulty === difficulty).length]));
    const range = filledRange(inSize);
    const path = sizePath(size, size);
    const groups = DIFFS.map((difficulty) => {
      const items = inSize.filter((level) => level.difficulty === difficulty);
      return `<section>
        <h2><a href="${diffPath(size, size, difficulty)}">${size}×${size} ${difficulty}</a></h2>
        ${listHtml(items)}
      </section>`;
    }).join("");
    const body = `<main id="main" class="ng-page">
  <div class="wrap">
    <p class="crumb"><a href="/">Home</a> · <a href="/nonogram/">Nonograms</a> · ${size}×${size}</p>
    <h1>${size}×${size} nonogram puzzles</h1>
    <p>${inSize.length} nonogram levels on a ${size}×${size} grid: ${counts.easy} easy, ${counts.medium} medium and ${counts.hard} hard. Filled cells run from ${range.min} to ${range.max}. Each level has one solution.</p>
    ${howToHtml()}
    <p><a href="/nonogram/">All nonogram levels</a></p>
    ${groups}
  </div>
</main>`;
    write(
      join(dist, `nonogram/${size}x${size}/index.html`),
      page(layout, scriptSrc, {
        title: `${size}×${size} nonogram puzzles | Toolstack Lab`,
        description: `All ${inSize.length} nonogram ${size}×${size} levels: ${counts.easy} easy, ${counts.medium} medium and ${counts.hard} hard. Filled cells range from ${range.min} to ${range.max}. Play in the page.`,
        path,
        body,
      })
    );
    urls.push(path);

    for (const difficulty of DIFFS) {
      const items = inSize.filter((level) => level.difficulty === difficulty);
      const span = filledRange(items);
      const dPath = diffPath(size, size, difficulty);
      const bodyDiff = `<main id="main" class="ng-page">
  <div class="wrap">
    <p class="crumb"><a href="/">Home</a> · <a href="/nonogram/">Nonograms</a> · <a href="${path}">${size}×${size}</a> · ${difficulty}</p>
    <h1>${size}×${size} ${difficulty} nonograms</h1>
    <p>${items.length} ${difficulty} nonogram levels on a ${size}×${size} grid. Filled cells run from ${span.min} to ${span.max}. Open a level and paint the single solution in the page.</p>
    ${howToHtml()}
    <p><a href="${path}">Same size: all ${size}×${size} nonograms</a> <a href="/nonogram/">All nonogram levels</a></p>
    ${listHtml(items)}
  </div>
</main>`;
      write(
        join(dist, `nonogram/${size}x${size}/${difficulty}/index.html`),
        page(layout, scriptSrc, {
          title: `${size}×${size} ${difficulty} nonogram puzzles | Toolstack Lab`,
          description: `${items.length} ${size}×${size} ${difficulty} nonogram levels. Filled cells range from ${span.min} to ${span.max}. Open one and paint the single solution.`,
          path: dPath,
          body: bodyDiff,
        })
      );
      urls.push(dPath);
    }
  }

  for (const level of levels) {
    const path = levelPath(level);
    write(
      join(dist, path.slice(1), "index.html"),
      page(layout, scriptSrc, {
        title: levelTitle(level),
        description: levelDescription(level),
        path,
        body: levelBody(level, levels, esc),
        play: true,
      })
    );
    urls.push(path);
  }
  return urls;
}
