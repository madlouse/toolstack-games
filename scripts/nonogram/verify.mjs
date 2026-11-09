import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cluesFromRows, countSolutions, solutionRows } from "./solver.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(ROOT, process.argv[2] || "data/nonograms.json");
const NODE_CAP = 20000;

function sameClues(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
  }
  return true;
}

function selfCheck() {
  const ambiguous = countSolutions([[1], [1]], [[1], [1]], 2, NODE_CAP);
  if (ambiguous.capped || ambiguous.count < 2) return "ambiguous 2x2 did not reach 2 solutions";
  if (ambiguous.guesses < 1) return "ambiguous 2x2 did not branch";
  const solid = countSolutions([[3], [3], [3]], [[3], [3], [3]], 2, NODE_CAP);
  if (solid.count !== 1 || !solid.lineSolved) return "solid 3x3 was not a unique line solution";
  const withGap = countSolutions([[3], [], [3]], [[1, 1], [1, 1], [1, 1]], 2, NODE_CAP);
  if (withGap.count !== 1) return "gapped 3x3 was not unique";
  const rows = solutionRows(withGap.solution, 3, 3);
  if (!rows || rows.join("") !== "111000111") return "gapped 3x3 solution mismatch";
  return "";
}

function main() {
  const problems = [];
  const selfError = selfCheck();
  if (selfError) problems.push(selfError);
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const levels = doc.levels || [];
  const seen = new Set();
  const sizes = new Set();
  const diffs = new Set();
  const bySizeDiff = new Map();
  let pass = 0;
  let fail = 0;
  for (const level of levels) {
    const why = [];
    sizes.add(`${level.rows}x${level.cols}`);
    diffs.add(level.difficulty);
    const key = `${level.rows}x${level.cols}|${level.difficulty}`;
    bySizeDiff.set(key, (bySizeDiff.get(key) || 0) + 1);
    const bits = (level.solution || []).join("");
    if (bits.length !== level.rows * level.cols) why.push("solution length");
    if (seen.has(bits)) why.push("duplicate grid");
    else if (bits) seen.add(bits);
    const rowClues = cluesFromRows(level.solution || []);
    const colGrid = [];
    for (let c = 0; c < level.cols; c++) {
      let col = "";
      for (let r = 0; r < level.rows; r++) col += level.solution[r][c];
      colGrid.push(col);
    }
    const colClues = cluesFromRows(colGrid);
    if (!sameClues(rowClues, level.rowClues)) why.push("row clues");
    if (!sameClues(colClues, level.colClues)) why.push("col clues");
    const filled = bits.split("").filter((ch) => ch === "1").length;
    if (filled !== level.filled) why.push("filled");
    const result = countSolutions(level.rowClues, level.colClues, 2, NODE_CAP);
    if (result.count !== 1) why.push(`solutions ${result.count}`);
    else {
      const got = solutionRows(result.solution, level.rows, level.cols);
      if (!got || got.join("") !== bits) why.push("solver grid mismatch");
    }
    if (why.length) {
      fail++;
      problems.push(`${level.id}: ${why.join(", ")}`);
    } else {
      pass++;
    }
  }
  const sizeCount = sizes.size;
  if (levels.length < 300) problems.push(`total ${levels.length} < 300`);
  if (sizeCount < 3) problems.push(`sizes ${sizeCount} < 3`);
  for (const size of [5, 10, 15]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      const n = bySizeDiff.get(`${size}x${size}|${difficulty}`) || 0;
      if (n < 1) problems.push(`missing ${size}x${size} ${difficulty}`);
    }
  }
  const structural = problems.filter((p) => !p.includes(":"));
  fail += structural.length;
  const total = levels.length;
  console.log(`total ${total}`);
  console.log(`pass=${pass}`);
  console.log(`fail=${fail}`);
  if (!selfError) console.log("solverSelfCheck pass");
  for (const size of [5, 10, 15]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      console.log(`${size}x${size} ${difficulty} ${bySizeDiff.get(`${size}x${size}|${difficulty}`) || 0}`);
    }
  }
  if (problems.length) {
    for (const p of problems) console.log(`problem ${p}`);
  }
  if (fail !== 0 || pass !== total || total < 300 || selfError) process.exit(1);
}

main();
