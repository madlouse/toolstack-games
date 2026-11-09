import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cluesFromRows, countSolutions, placementCount, solutionRows } from "./solver.mjs";

const SEED = 20261109;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LIMITS = { 5: 120, 10: 108, 15: 90 };
const GEN_NODE_CAP = 80;
const MIN_FILL = 0.2;
const MAX_FILL = 0.8;

function makeRng(seed) {
  let x = seed >>> 0;
  if (x === 0) x = 0x6d2b79f5;
  return {
    next() {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return x;
    },
    int(n) {
      return this.next() % n;
    },
  };
}

function blank(rows, cols) {
  const g = [];
  for (let r = 0; r < rows; r++) g.push(new Uint8Array(cols));
  return g;
}

function paintBars(rng, rows, cols) {
  const g = blank(rows, cols);
  for (let r = 0; r < rows; r++) {
    if (rng.int(6) === 0) continue;
    const len = 1 + rng.int(cols);
    const start = rng.int(cols - len + 1);
    for (let c = start; c < start + len; c++) g[r][c] = 1;
  }
  return g;
}

function paintRects(rng, rows, cols) {
  const g = blank(rows, cols);
  const n = 2 + rng.int(5);
  for (let i = 0; i < n; i++) {
    const h = 1 + rng.int(Math.max(1, Math.ceil(rows / 2)));
    const w = 1 + rng.int(Math.max(1, Math.ceil(cols / 2)));
    const r0 = rng.int(rows - h + 1);
    const c0 = rng.int(cols - w + 1);
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) g[r][c] = 1;
    }
  }
  return g;
}

function paintRuns(rng, rows, cols) {
  const g = blank(rows, cols);
  const maxBlocks = Math.max(1, Math.min(4, Math.floor((cols + 1) / 2)));
  for (let r = 0; r < rows; r++) {
    if (rng.int(7) === 0) continue;
    const blocks = 1 + rng.int(maxBlocks);
    let c = 0;
    for (let b = 0; b < blocks; b++) {
      const gapBase = b === 0 ? Math.max(1, Math.floor(cols / 2)) : Math.max(1, Math.floor(cols / 4));
      c += b === 0 ? rng.int(gapBase) : 1 + rng.int(gapBase);
      if (c >= cols) break;
      const room = cols - c;
      const cap = Math.max(1, Math.min(room, Math.max(1, Math.ceil(cols / 3))));
      const len = 1 + rng.int(cap);
      const end = Math.min(cols, c + len);
      for (; c < end; c++) g[r][c] = 1;
    }
  }
  return g;
}

function paintSteps(rng, rows, cols) {
  const g = blank(rows, cols);
  let w = 1 + rng.int(cols);
  const fromRight = rng.int(2) === 1;
  for (let r = 0; r < rows; r++) {
    const width = Math.max(1, Math.min(cols, w));
    if (fromRight) {
      for (let c = cols - width; c < cols; c++) g[r][c] = 1;
    } else {
      for (let c = 0; c < width; c++) g[r][c] = 1;
    }
    w += rng.int(3) - 1;
    if (w < 1) w = 1;
    if (w > cols) w = cols;
  }
  return g;
}

function paintBands(rng, rows, cols) {
  const g = blank(rows, cols);
  let r = 0;
  while (r < rows) {
    const h = 1 + rng.int(Math.max(1, Math.ceil(rows / 4)));
    const on = rng.int(4) !== 0;
    const insetMax = Math.max(1, Math.floor(cols / 3) + 1);
    if (on) {
      for (let i = 0; i < h && r + i < rows; i++) {
        const insetL = rng.int(insetMax);
        const insetR = rng.int(insetMax);
        const start = Math.min(insetL, cols - 1);
        const end = Math.max(start + 1, cols - insetR);
        for (let c = start; c < Math.min(cols, end); c++) g[r + i][c] = 1;
      }
    }
    r += h;
  }
  return g;
}

function paintSpeckle(rng, rows, cols) {
  const g = blank(rows, cols);
  const numer = 3 + rng.int(3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (rng.int(10) < numer) g[r][c] = 1;
  }
  return g;
}

function paintersFor(size) {
  if (size >= 15) return [
    ["bars", paintBars],
    ["rects", paintRects],
    ["runs", paintRuns],
    ["steps", paintSteps],
    ["bands", paintBands],
  ];
  return [
    ["bars", paintBars],
    ["rects", paintRects],
    ["runs", paintRuns],
    ["steps", paintSteps],
    ["bands", paintBands],
    ["speckle", paintSpeckle],
  ];
}

function bitsOf(g) {
  let s = "";
  for (let r = 0; r < g.length; r++) {
    const row = g[r];
    for (let c = 0; c < row.length; c++) s += row[c] ? "1" : "0";
  }
  return s;
}

function filledOf(bits) {
  let n = 0;
  for (let i = 0; i < bits.length; i++) if (bits.charCodeAt(i) === 49) n++;
  return n;
}

function looseness(rowClues, colClues, rows, cols) {
  let n = 0;
  for (let i = 0; i < rowClues.length; i++) n += placementCount(cols, rowClues[i]);
  for (let i = 0; i < colClues.length; i++) n += placementCount(rows, colClues[i]);
  return n;
}

function assignDifficulty(items) {
  const sorted = items.slice().sort((a, b) => a.score - b.score || (a.bits < b.bits ? -1 : a.bits > b.bits ? 1 : 0));
  const n = sorted.length;
  const cut1 = Math.floor(n / 3);
  const cut2 = Math.floor((2 * n) / 3);
  const buckets = { easy: [], medium: [], hard: [] };
  for (let i = 0; i < n; i++) {
    const name = i < cut1 ? "easy" : i < cut2 ? "medium" : "hard";
    buckets[name].push(sorted[i]);
  }
  for (const name of ["easy", "medium", "hard"]) {
    buckets[name].sort((a, b) => a.born - b.born);
  }
  return buckets;
}

function parseArgs(argv) {
  const limits = { ...DEFAULT_LIMITS };
  let out = resolve(ROOT, "data/nonograms.json");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = resolve(argv[++i]);
    else if (argv[i] === "--limit") {
      for (const part of argv[++i].split(",")) {
        const [s, n] = part.split("=");
        limits[Number(s)] = Number(n);
      }
    } else {
      throw new Error(`unknown arg ${argv[i]}`);
    }
  }
  return { limits, out };
}

function generateSize(size, target, rng) {
  const painters = paintersFor(size);
  const seen = new Set();
  const kept = [];
  const maxAttempts = Math.max(500, target * 250);
  let attempts = 0;
  const t0 = Date.now();
  while (kept.length < target && attempts < maxAttempts) {
    const born = attempts;
    attempts++;
    const [motif, paint] = painters[born % painters.length];
    const g = paint(rng, size, size);
    const bits = bitsOf(g);
    const filled = filledOf(bits);
    const cells = size * size;
    if (filled < Math.ceil(cells * MIN_FILL) || filled > Math.floor(cells * MAX_FILL)) continue;
    if (seen.has(bits)) continue;
    const rowClues = cluesFromRows(g.map((row) => Array.from(row)));
    const colGrid = [];
    for (let c = 0; c < size; c++) {
      const col = [];
      for (let r = 0; r < size; r++) col.push(g[r][c]);
      colGrid.push(col);
    }
    const colClues = cluesFromRows(colGrid);
    const result = countSolutions(rowClues, colClues, 2, GEN_NODE_CAP);
    if (result.count !== 1 || !result.solution) continue;
    const solved = solutionRows(result.solution, size, size).join("");
    if (solved !== bits) continue;
    seen.add(bits);
    const score =
      (result.guesses > 0 ? 1000000 : 0) +
      result.guesses * 1000 +
      result.rootIters * 100 +
      looseness(rowClues, colClues, size, size);
    kept.push({
      born,
      motif,
      bits,
      filled,
      score,
      guesses: result.guesses,
      rootIters: result.rootIters,
      rowClues,
      colClues,
    });
    if (kept.length % 25 === 0) {
      console.error(`size ${size}: ${kept.length}/${target} kept after ${attempts} attempts (${Date.now() - t0} ms)`);
    }
  }
  if (kept.length < target) {
    throw new Error(`size ${size}: kept ${kept.length}/${target} after ${attempts} attempts`);
  }
  console.error(`size ${size}: kept ${kept.length} in ${attempts} attempts (${Date.now() - t0} ms)`);
  return kept;
}

function toLevel(size, difficulty, seq, item) {
  const solution = [];
  for (let r = 0; r < size; r++) solution.push(item.bits.slice(r * size, r * size + size));
  const id = `${size}x${size}-${difficulty}-${String(seq).padStart(3, "0")}`;
  return {
    id,
    rows: size,
    cols: size,
    difficulty,
    motif: item.motif,
    filled: item.filled,
    score: item.score,
    guesses: item.guesses,
    rootIters: item.rootIters,
    rowClues: item.rowClues,
    colClues: item.colClues,
    solution,
  };
}

function main() {
  const { limits, out } = parseArgs(process.argv.slice(2));
  const rng = makeRng(SEED);
  const sizes = Object.keys(limits)
    .map(Number)
    .sort((a, b) => a - b);
  const levels = [];
  for (const size of sizes) {
    const kept = generateSize(size, limits[size], rng);
    const buckets = assignDifficulty(kept);
    for (const difficulty of ["easy", "medium", "hard"]) {
      buckets[difficulty].forEach((item, i) => {
        levels.push(toLevel(size, difficulty, i + 1, item));
      });
    }
  }
  const doc = { seed: SEED, levels };
  const raw = `${JSON.stringify(doc, null, 2)}\n`;
  writeFileSync(out, raw);
  const hash = createHash("sha256").update(raw).digest("hex");
  console.log(`levels ${levels.length}`);
  console.log(`sha256 ${hash}`);
  console.log(`out ${out}`);
}

main();
