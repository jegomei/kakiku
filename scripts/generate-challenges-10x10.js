const fs = require("fs");
const path = require("path");

const BOARD_SIZE = 10;
const START_DATE = new Date("2026-01-01T00:00:00Z");
const DAY_COUNT = 365;
const OUTPUT_FILE = path.join(__dirname, "..", "challenges-10x10.json");

function dateKey(date) {
  return date.toISOString().slice(0, 10);
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

function createLayout(random) {
  const pending = [{ row: 0, col: 0, height: BOARD_SIZE, width: BOARD_SIZE }];
  const pieces = [];

  while (pending.length > 0) {
    const rect = pending.pop();
    const area = rect.height * rect.width;
    if (area <= BOARD_SIZE) {
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

function buildChallenge(date, challenge) {
  const random = mulberry32(seedFromDate(`kakiku-${BOARD_SIZE}x${BOARD_SIZE}-${date}`));
  const solution = createLayout(random).map((piece, index) => {
    const numberCell = pickNumberCell(piece, random);
    return {
      id: `piece-${index}`,
      row: piece.row,
      col: piece.col,
      height: piece.height,
      width: piece.width,
      area: piece.height * piece.width,
      numberRow: numberCell.row,
      numberCol: numberCell.col
    };
  });
  const givens = solution.map((piece) => ({
    row: piece.numberRow,
    col: piece.numberCol,
    value: piece.area
  }));

  return { date, challenge, size: BOARD_SIZE, givens, solution };
}

const challenges = Array.from({ length: DAY_COUNT }, (_, index) => {
  const date = new Date(START_DATE);
  date.setUTCDate(date.getUTCDate() + index);
  return buildChallenge(dateKey(date), index + 1);
});

const database = {
  name: "Kakiku daily 10x10 challenges",
  version: 1,
  startDate: dateKey(START_DATE),
  endDate: challenges[challenges.length - 1].date,
  rules: {
    size: BOARD_SIZE,
    maxGiven: BOARD_SIZE,
    oneNumberPerPiece: true,
    fullGridCoverage: true
  },
  challenges
};

fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(database, null, 2)}\n`);
console.log(`Generated ${challenges.length} challenges in ${path.basename(OUTPUT_FILE)}`);
