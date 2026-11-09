const FILL = 1;
const EMPTY = 2;

function blocksOf(clues) {
  if (!clues || clues.length === 0) return [];
  for (let i = 0; i < clues.length; i++) {
    if (clues[i] === 0) return clues.length === 1 ? [] : null;
    if (clues[i] < 0) return null;
  }
  return clues;
}

export function settleLine(known, clues) {
  const n = known.length;
  const blocks = blocksOf(clues);
  if (blocks === null) return { count: 0, known };
  if (blocks.length === 0) {
    for (let i = 0; i < n; i++) if (known[i] === FILL) return { count: 0, known };
    const next = new Uint8Array(n);
    next.fill(EMPTY);
    return { count: 1, known: next };
  }
  let need = 0;
  for (let i = 0; i < blocks.length; i++) need += blocks[i];
  need += blocks.length - 1;
  if (need > n) return { count: 0, known };
  const fillCount = new Uint32Array(n);
  const paint = new Uint8Array(n);
  let count = 0;
  function rec(bi, pos) {
    if (bi === blocks.length) {
      for (let i = pos; i < n; i++) if (known[i] === FILL) return;
      count++;
      for (let i = 0; i < n; i++) if (paint[i] === FILL) fillCount[i]++;
      return;
    }
    const len = blocks[bi];
    let rest = 0;
    for (let j = bi; j < blocks.length; j++) rest += blocks[j];
    rest += blocks.length - bi - 1;
    const maxStart = n - rest;
    for (let s = pos; s <= maxStart; s++) {
      let gapFill = false;
      for (let i = pos; i < s; i++) {
        if (known[i] === FILL) {
          gapFill = true;
          break;
        }
      }
      if (gapFill) break;
      let blocked = false;
      for (let i = s; i < s + len; i++) {
        if (known[i] === EMPTY) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const sep = s + len;
      if (bi + 1 < blocks.length && (sep >= n || known[sep] === FILL)) continue;
      for (let i = pos; i < s; i++) paint[i] = EMPTY;
      for (let i = s; i < sep; i++) paint[i] = FILL;
      if (bi + 1 < blocks.length) {
        paint[sep] = EMPTY;
        rec(bi + 1, sep + 1);
        paint[sep] = 0;
      } else {
        rec(bi + 1, sep);
      }
      for (let i = pos; i < sep; i++) paint[i] = 0;
    }
  }
  rec(0, 0);
  if (count === 0) return { count: 0, known };
  const next = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (fillCount[i] === count) next[i] = FILL;
    else if (fillCount[i] === 0) next[i] = EMPTY;
    else next[i] = 0;
  }
  return { count, known: next };
}

export function placementCount(length, clues) {
  return settleLine(new Uint8Array(length), clues).count;
}

function propagate(grid, rowClues, colClues) {
  const rows = rowClues.length;
  const cols = colClues.length;
  const limit = rows * cols + 2;
  let iter = 0;
  while (iter < limit) {
    iter++;
    let changed = false;
    for (let r = 0; r < rows; r++) {
      const known = grid.subarray(r * cols, r * cols + cols);
      const res = settleLine(known, rowClues[r]);
      if (res.count === 0) return { bad: true, iter };
      for (let c = 0; c < cols; c++) {
        const v = res.known[c];
        if (v !== 0 && grid[r * cols + c] !== v) {
          grid[r * cols + c] = v;
          changed = true;
        }
      }
    }
    for (let c = 0; c < cols; c++) {
      const known = new Uint8Array(rows);
      for (let r = 0; r < rows; r++) known[r] = grid[r * cols + c];
      const res = settleLine(known, colClues[c]);
      if (res.count === 0) return { bad: true, iter };
      for (let r = 0; r < rows; r++) {
        const v = res.known[r];
        if (v !== 0 && grid[r * cols + c] !== v) {
          grid[r * cols + c] = v;
          changed = true;
        }
      }
    }
    if (!changed) return { bad: false, iter };
  }
  return { bad: false, iter, stalled: true };
}

function unknownIndex(grid) {
  for (let i = 0; i < grid.length; i++) if (grid[i] === 0) return i;
  return -1;
}

function pickCell(grid, rowClues, colClues) {
  const rows = rowClues.length;
  const cols = colClues.length;
  let best = -1;
  let bestOpts = Infinity;
  for (let r = 0; r < rows; r++) {
    let idx = -1;
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] === 0) {
        idx = r * cols + c;
        break;
      }
    }
    if (idx < 0) continue;
    const res = settleLine(grid.subarray(r * cols, r * cols + cols), rowClues[r]);
    if (res.count < bestOpts) {
      bestOpts = res.count;
      best = idx;
      if (bestOpts <= 2) return best;
    }
  }
  for (let c = 0; c < cols; c++) {
    let idx = -1;
    for (let r = 0; r < rows; r++) {
      if (grid[r * cols + c] === 0) {
        idx = r * cols + c;
        break;
      }
    }
    if (idx < 0) continue;
    const known = new Uint8Array(rows);
    for (let r = 0; r < rows; r++) known[r] = grid[r * cols + c];
    const res = settleLine(known, colClues[c]);
    if (res.count < bestOpts) {
      bestOpts = res.count;
      best = idx;
      if (bestOpts <= 2) return best;
    }
  }
  return best >= 0 ? best : unknownIndex(grid);
}

export function countSolutions(rowClues, colClues, limit = 2, nodeCap = 20000) {
  const rows = rowClues.length;
  const cols = colClues.length;
  const grid = new Uint8Array(rows * cols);
  let nodes = 0;
  let guesses = 0;
  let capped = false;
  let rootIters = 0;
  let solution = null;
  function search(g, depth) {
    nodes++;
    if (nodes > nodeCap) {
      capped = true;
      return 0;
    }
    const prop = propagate(g, rowClues, colClues);
    if (depth === 0) rootIters = prop.iter;
    if (prop.bad) return 0;
    if (unknownIndex(g) < 0) {
      if (!solution) solution = g.slice();
      return 1;
    }
    const idx = pickCell(g, rowClues, colClues);
    if (idx < 0) return 0;
    guesses++;
    let total = 0;
    for (const val of [FILL, EMPTY]) {
      const child = g.slice();
      child[idx] = val;
      total += search(child, depth + 1);
      if (capped || total >= limit) break;
    }
    return total;
  }
  const found = search(grid, 0);
  const solved = !capped && found === 1 && solution;
  return {
    count: capped ? -1 : found,
    solution: solved ? solution : found === 1 ? solution : null,
    nodes,
    guesses,
    rootIters,
    capped,
    lineSolved: !capped && found === 1 && guesses === 0,
  };
}

export function cluesFromRows(rows) {
  return rows.map((row) => {
    const cells = typeof row === "string" ? row : row;
    const clues = [];
    let run = 0;
    const n = cells.length;
    for (let i = 0; i < n; i++) {
      const v = typeof cells === "string" ? cells.charCodeAt(i) === 49 : cells[i] === 1;
      if (v) run++;
      else if (run) {
        clues.push(run);
        run = 0;
      }
    }
    if (run) clues.push(run);
    return clues;
  });
}

export function solutionRows(solution, rows, cols) {
  if (!solution) return null;
  const out = [];
  for (let r = 0; r < rows; r++) {
    let s = "";
    for (let c = 0; c < cols; c++) s += solution[r * cols + c] === FILL ? "1" : "0";
    out.push(s);
  }
  return out;
}
