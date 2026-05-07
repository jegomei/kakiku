const DEFAULT_BOARD_SIZE = 5;
const ONE_DAY = 24 * 60 * 60 * 1000;
const START_DATE = new Date("2026-01-01T00:00:00");
const FIVE_BY_FIVE_LAYOUTS = [
  [
    { row: 0, col: 0, height: 2, width: 1 },
    { row: 0, col: 1, height: 1, width: 3 },
    { row: 0, col: 4, height: 3, width: 1 },
    { row: 1, col: 1, height: 2, width: 2 },
    { row: 1, col: 3, height: 4, width: 1 },
    { row: 2, col: 0, height: 3, width: 1 },
    { row: 3, col: 1, height: 1, width: 2 },
    { row: 3, col: 4, height: 2, width: 1 },
    { row: 4, col: 1, height: 1, width: 2 }
  ],
  [
    { row: 0, col: 0, height: 1, width: 2 },
    { row: 0, col: 2, height: 2, width: 1 },
    { row: 0, col: 3, height: 1, width: 2 },
    { row: 1, col: 0, height: 2, width: 2 },
    { row: 1, col: 3, height: 3, width: 1 },
    { row: 1, col: 4, height: 4, width: 1 },
    { row: 2, col: 2, height: 3, width: 1 },
    { row: 3, col: 0, height: 2, width: 2 },
    { row: 4, col: 3, height: 1, width: 1 }
  ],
  [
    { row: 0, col: 0, height: 3, width: 1 },
    { row: 0, col: 1, height: 1, width: 4 },
    { row: 1, col: 1, height: 2, width: 1 },
    { row: 1, col: 2, height: 1, width: 2 },
    { row: 1, col: 4, height: 3, width: 1 },
    { row: 2, col: 2, height: 3, width: 1 },
    { row: 2, col: 3, height: 2, width: 1 },
    { row: 3, col: 0, height: 2, width: 2 },
    { row: 4, col: 3, height: 1, width: 2 }
  ]
];
const NUMBER_COLORS = {
  1: { ink: "#b99100", fill: "#fff2a8" },
  2: { ink: "#168a45", fill: "#dff6e8" },
  3: { ink: "#fb7b00", fill: "#ffe8d0" },
  4: { ink: "#4c29cc", fill: "#e8e3ff" },
  5: { ink: "#d83a76", fill: "#ffe1ee" },
  6: { ink: "#047b91", fill: "#d9f4f8" },
  7: { ink: "#7b4f00", fill: "#f8e5c0" },
  8: { ink: "#5b45a8", fill: "#ece7ff" },
  9: { ink: "#c23a2b", fill: "#ffe1dc" },
  10: { ink: "#18705f", fill: "#dcf2ed" }
};

const boardEl = document.querySelector("#board");
const timerEl = document.querySelector("#timer");
const challengeLabel = document.querySelector("#challengeLabel");
const pauseDialog = document.querySelector("#pauseDialog");
const winDialog = document.querySelector("#winDialog");
const winStats = document.querySelector("#winStats");
const copyResultButton = document.querySelector("#copyResultButton");
const mode5Button = document.querySelector("#mode5Button");
const mode10Button = document.querySelector("#mode10Button");

let puzzle = null;
let currentBoardSize = DEFAULT_BOARD_SIZE;
let challengeDatabases = {};
let selections = [];
let activeStart = null;
let previewRect = null;
let elapsed = 0;
let timerId = null;
let paused = false;
let completed = false;
let lastTick = Date.now();

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function challengeNumber() {
  const start = new Date(START_DATE);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((now - start) / ONE_DAY) + 1);
}

function seedFromDate(key) {
  return [...key].reduce((seed, char) => ((seed << 5) - seed + char.charCodeAt(0)) >>> 0, 2166136261);
}

function mulberry32(seed) {
  return function next() {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickNumberCell(piece, random) {
  return {
    row: piece.row + Math.floor(random() * piece.height),
    col: piece.col + Math.floor(random() * piece.width)
  };
}

function createPuzzle(key, size = currentBoardSize) {
  const databaseChallenge = challengeDatabases[size]?.challenges?.find((challenge) => challenge.date === key);
  if (databaseChallenge) return puzzleFromDatabaseChallenge(databaseChallenge);

  const seedKey = size === 5 ? `kakiku-${key}` : `kakiku-${size}x${size}-${key}`;
  const random = mulberry32(seedFromDate(seedKey));
  const layouts = size === 5 ? FIVE_BY_FIVE_LAYOUTS : [createTenByTenLayout(random)];
  const pieces = layouts[Math.floor(random() * layouts.length)].map((piece, index) => {
    const numberCell = pickNumberCell(piece, random);
    return {
      ...piece,
      id: `piece-${index}`,
      area: piece.height * piece.width,
      numberRow: numberCell.row,
      numberCol: numberCell.col
    };
  });

  const numbers = new Map();
  pieces.forEach((piece) => {
    numbers.set(cellKey(piece.numberRow, piece.numberCol), piece.area);
  });

  return { key, size, pieces, numbers };
}

function createTenByTenLayout(random) {
  const pending = [{ row: 0, col: 0, height: 10, width: 10 }];
  const pieces = [];

  while (pending.length > 0) {
    const rect = pending.pop();
    const area = rect.height * rect.width;
    if (area <= 10) {
      pieces.push(rect);
      continue;
    }

    const splitVertical = rect.width > 1 && (rect.width >= rect.height || rect.height === 1);
    if (splitVertical) {
      const split = 1 + Math.floor(random() * (rect.width - 1));
      pending.push({ row: rect.row, col: rect.col, height: rect.height, width: split });
      pending.push({ row: rect.row, col: rect.col + split, height: rect.height, width: rect.width - split });
    } else {
      const split = 1 + Math.floor(random() * (rect.height - 1));
      pending.push({ row: rect.row, col: rect.col, height: split, width: rect.width });
      pending.push({ row: rect.row + split, col: rect.col, height: rect.height - split, width: rect.width });
    }
  }

  return pieces.sort((a, b) => a.row - b.row || a.col - b.col);
}

function puzzleFromDatabaseChallenge(challenge) {
  const numbers = new Map();
  challenge.givens.forEach((given) => {
    numbers.set(cellKey(given.row, given.col), given.value);
  });

  return {
    key: challenge.date,
    size: challenge.size,
    pieces: challenge.solution,
    numbers
  };
}

async function loadChallengeDatabase(size) {
  try {
    const response = await fetch(`challenges-${size}x${size}.json`, { cache: "no-store" });
    if (!response.ok) return;
    challengeDatabases[size] = await response.json();
  } catch {
    challengeDatabases[size] = null;
  }
}

function storageKey() {
  return `kakiku-${puzzle.size}x${puzzle.size}-${puzzle.key}`;
}

function saveState() {
  localStorage.setItem(storageKey(), JSON.stringify({
    selections,
    elapsed,
    completed
  }));
}

function loadState() {
  const saved = localStorage.getItem(storageKey());
  if (!saved) {
    selections = defaultSelections();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    selections = Array.isArray(parsed.selections) ? parsed.selections.filter(isValidRect) : [];
    ensureDefaultSelections();
    elapsed = Number(parsed.elapsed) || 0;
    completed = Boolean(parsed.completed);
  } catch {
    localStorage.removeItem(storageKey());
    selections = defaultSelections();
  }
}

function cellKey(row, col) {
  return `${row}-${col}`;
}

function isValidRect(rect) {
  return rect
    && Number.isInteger(rect.row)
    && Number.isInteger(rect.col)
    && Number.isInteger(rect.height)
    && Number.isInteger(rect.width)
    && rect.row >= 0
    && rect.col >= 0
    && rect.height > 0
    && rect.width > 0
    && rect.row + rect.height <= puzzle.size
    && rect.col + rect.width <= puzzle.size;
}

function rectFromCells(start, end) {
  const row = Math.min(start.row, end.row);
  const col = Math.min(start.col, end.col);
  return {
    row,
    col,
    height: Math.abs(start.row - end.row) + 1,
    width: Math.abs(start.col - end.col) + 1
  };
}

function rectCells(rect) {
  const cells = [];
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    for (let col = rect.col; col < rect.col + rect.width; col += 1) {
      cells.push(cellKey(row, col));
    }
  }
  return cells;
}

function rectArea(rect) {
  return rect.height * rect.width;
}

function sameRect(a, b) {
  return a.row === b.row && a.col === b.col && a.height === b.height && a.width === b.width;
}

function overlaps(a, b) {
  return a.row < b.row + b.height
    && a.row + a.height > b.row
    && a.col < b.col + b.width
    && a.col + a.width > b.col;
}

function numbersInside(rect) {
  return rectCells(rect)
    .map((key) => puzzle.numbers.has(key) ? puzzle.numbers.get(key) : null)
    .filter((value) => value !== null);
}

function numberForRect(rect) {
  const numbers = numbersInside(rect);
  return numbers.length === 1 ? numbers[0] : null;
}

function colorForNumber(value) {
  return NUMBER_COLORS[value] || { ink: "#4c29cc", fill: "#e8e3ff" };
}

function defaultSelections() {
  return puzzle.pieces
    .filter((piece) => piece.area === 1)
    .map((piece) => ({
      row: piece.row,
      col: piece.col,
      height: piece.height,
      width: piece.width
    }));
}

function ensureDefaultSelections() {
  defaultSelections().forEach((rect) => {
    if (!selections.some((selection) => sameRect(selection, rect))) {
      selections.push(rect);
    }
  });
}

function validateRect(rect) {
  const numbers = numbersInside(rect);
  if (numbers.length !== 1) return false;
  if (numbers[0] !== rectArea(rect)) return false;
  return true;
}

function removeOverlappingSelections(rect) {
  selections = selections.filter((selection) => {
    if (sameRect(selection, rect)) return false;
    return !overlaps(selection, rect);
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--board-size", puzzle.size);
  boardEl.classList.toggle("size-5", puzzle.size === 5);
  boardEl.classList.toggle("size-10", puzzle.size === 10);

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const button = document.createElement("button");
      const key = cellKey(row, col);
      const value = puzzle.numbers.get(key);

      button.type = "button";
      button.className = "tile";
      button.dataset.row = row;
      button.dataset.col = col;
      if (value) {
        const color = colorForNumber(value);
        button.style.setProperty("--number-color", color.ink);
        button.style.setProperty("--piece-color", color.ink);
        button.style.setProperty("--piece-fill", color.fill);
        button.classList.add("numbered");
      }
      button.textContent = value || "";
      button.setAttribute("aria-label", value ? `Celda ${row + 1}, ${col + 1}, numero ${value}` : `Celda ${row + 1}, ${col + 1}`);
      button.addEventListener("pointerdown", startSelection);
      button.addEventListener("pointermove", moveSelection);
      button.addEventListener("pointerenter", extendSelection);
      button.addEventListener("pointerup", finishSelection);
      boardEl.append(button);
    }
  }

  paintBoard();
}

function renderStatus() {
  timerEl.textContent = formatTime(elapsed);
}

function paintBoard() {
  const selectedCells = new Set(selections.flatMap(rectCells));
  const previewCells = previewRect ? new Set(rectCells(previewRect)) : new Set();

  boardEl.querySelectorAll(".tile").forEach((tile) => {
    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);
    const key = cellKey(row, col);
    tile.classList.toggle("selected", selectedCells.has(key));
    tile.classList.toggle("preview", previewCells.has(key));
    tile.classList.remove("top-edge", "right-edge", "bottom-edge", "left-edge");
    tile.style.removeProperty("--piece-color");
    tile.style.removeProperty("--piece-fill");

    const owningRect = selections.find((rect) => rectCells(rect).includes(key));
    if (!owningRect) return;

    const color = colorForNumber(numberForRect(owningRect));
    tile.style.setProperty("--piece-color", color.ink);
    tile.style.setProperty("--piece-fill", color.fill);

    if (row === owningRect.row) tile.classList.add("top-edge");
    if (row === owningRect.row + owningRect.height - 1) tile.classList.add("bottom-edge");
    if (col === owningRect.col) tile.classList.add("left-edge");
    if (col === owningRect.col + owningRect.width - 1) tile.classList.add("right-edge");
  });
}

function cellFromEvent(event) {
  const target = event.target.closest(".tile");
  if (!target) return null;
  return {
    row: Number(target.dataset.row),
    col: Number(target.dataset.col)
  };
}

function cellAtPoint(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tile");
  if (!target || !boardEl.contains(target)) return null;
  return {
    row: Number(target.dataset.row),
    col: Number(target.dataset.col)
  };
}

function startSelection(event) {
  if (paused || completed || event.button > 0) return;
  event.preventDefault();
  activeStart = cellFromEvent(event);
  previewRect = rectFromCells(activeStart, activeStart);
  event.target.setPointerCapture(event.pointerId);
  paintBoard();
}

function moveSelection(event) {
  if (!activeStart || paused || completed) return;
  const cell = cellAtPoint(event);
  if (!cell) return;
  previewRect = rectFromCells(activeStart, cell);
  paintBoard();
}

function extendSelection(event) {
  if (!activeStart || paused || completed) return;
  const cell = cellFromEvent(event);
  if (!cell) return;
  previewRect = rectFromCells(activeStart, cell);
  paintBoard();
}

function finishSelection(event) {
  if (!activeStart || paused || completed) return;
  const cell = cellAtPoint(event) || cellFromEvent(event) || activeStart;
  const rect = rectFromCells(activeStart, cell);
  activeStart = null;
  previewRect = null;
  commitSelection(rect);
}

function commitSelection(rect) {
  const existingIndex = selections.findIndex((selection) => sameRect(selection, rect));
  if (existingIndex >= 0) {
    if (numberForRect(selections[existingIndex]) === 1) return;
    selections.splice(existingIndex, 1);
    paintBoard();
    renderStatus();
    saveState();
    return;
  }

  if (validateRect(rect)) {
    removeOverlappingSelections(rect);
    selections.push(rect);
    paintBoard();
    renderStatus();
    if (isSolved()) completeGame();
    else saveState();
    return;
  }

  flashRect(rect);
  renderStatus();
  saveState();
}

function flashRect(rect) {
  const cells = new Set(rectCells(rect));
  boardEl.querySelectorAll(".tile").forEach((tile) => {
    if (!cells.has(cellKey(Number(tile.dataset.row), Number(tile.dataset.col)))) return;
    tile.classList.add("wrong", "pulse");
    window.setTimeout(() => tile.classList.remove("wrong", "pulse"), 280);
  });
}

function isSolved() {
  if (selections.length !== puzzle.pieces.length) return false;
  const covered = new Set(selections.flatMap(rectCells));
  return covered.size === puzzle.size * puzzle.size;
}

function resetDay() {
  selections = defaultSelections();
  activeStart = null;
  previewRect = null;
  elapsed = 0;
  completed = false;
  paused = false;
  lastTick = Date.now();
  localStorage.removeItem(storageKey());
  winDialog.close();
  pauseDialog.close();
  paintBoard();
  renderStatus();
  startTimer();
}

function tick() {
  const now = Date.now();
  if (!paused && !completed) {
    const diff = Math.floor((now - lastTick) / 1000);
    if (diff > 0) {
      elapsed += diff;
      lastTick += diff * 1000;
      renderStatus();
      saveState();
    }
  } else {
    lastTick = now;
  }
}

function startTimer() {
  stopTimer();
  lastTick = Date.now();
  timerId = window.setInterval(tick, 500);
}

function stopTimer() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function openPause() {
  if (completed) return;
  tick();
  paused = true;
  stopTimer();
  pauseDialog.showModal();
}

function closePause() {
  if (completed) return;
  paused = false;
  if (pauseDialog.open) pauseDialog.close();
  startTimer();
}

function completeGame() {
  tick();
  completed = true;
  paused = false;
  stopTimer();
  winStats.textContent = formatTime(elapsed);
  saveState();
  winDialog.showModal();
}

async function copyResult() {
  const text = `He terminado el Kakiku ${puzzle.size}x${puzzle.size} de hoy en ${formatTime(elapsed)}`;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }

  copyResultButton.textContent = "Copiado";
  window.setTimeout(() => {
    copyResultButton.textContent = "Copiar resultado";
  }, 1400);
}

function preventBrowserZoom() {
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("gesturechange", (event) => event.preventDefault());
  document.addEventListener("gestureend", (event) => event.preventDefault());
  document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
}

function initModeSwitch() {
  mode5Button.addEventListener("click", () => switchMode(5));
  mode10Button.addEventListener("click", () => switchMode(10));
}

async function switchMode(size) {
  if (size === currentBoardSize && puzzle) return;

  tick();
  stopTimer();
  currentBoardSize = size;
  activeStart = null;
  previewRect = null;
  paused = false;
  if (pauseDialog.open) pauseDialog.close();
  if (winDialog.open) winDialog.close();

  mode5Button.classList.toggle("active", size === 5);
  mode5Button.setAttribute("aria-pressed", String(size === 5));
  mode10Button.classList.toggle("active", size === 10);
  mode10Button.setAttribute("aria-pressed", String(size === 10));

  await loadChallengeDatabase(size);
  puzzle = createPuzzle(todayKey(), size);
  selections = [];
  elapsed = 0;
  completed = false;
  loadState();
  renderBoard();
  renderStatus();
  if (!completed) startTimer();
}

async function init() {
  initModeSwitch();
  challengeLabel.textContent = `Reto ${challengeNumber()}`;
  await switchMode(DEFAULT_BOARD_SIZE);

  document.querySelector("#pauseButtonBottom").addEventListener("click", openPause);
  document.querySelector("#continueButton").addEventListener("click", closePause);
  document.querySelector("#resetButton").addEventListener("click", resetDay);
  copyResultButton.addEventListener("click", copyResult);
  document.querySelector("#restartFromPause").addEventListener("click", resetDay);

  pauseDialog.addEventListener("close", () => {
    if (!completed && paused) closePause();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      tick();
      stopTimer();
    } else if (!completed && !paused) {
      startTimer();
    }
  });

  preventBrowserZoom();
}

init();
