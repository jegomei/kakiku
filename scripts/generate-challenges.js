const fs = require("fs");
const path = require("path");

const BOARD_SIZE = 5;
const START_DATE = new Date("2026-01-01T00:00:00Z");
const DAY_COUNT = 365;
const OUTPUT_FILE = path.join(__dirname, "..", "challenges-5x5.json");
const DAILY_LAYOUTS = [
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

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function cellKey(row, col) {
  return `${row}-${col}`;
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

function buildChallenge(date, challenge) {
  const random = mulberry32(seedFromDate(`kakiku-${date}`));
  const layout = DAILY_LAYOUTS[Math.floor(random() * DAILY_LAYOUTS.length)];
  const solution = layout.map((piece, index) => {
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
  name: "Kakiku daily 5x5 challenges",
  version: 1,
  startDate: dateKey(START_DATE),
  endDate: challenges[challenges.length - 1].date,
  rules: {
    size: BOARD_SIZE,
    maxGiven: 5,
    oneNumberPerPiece: true,
    fullGridCoverage: true
  },
  challenges
};

fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(database, null, 2)}\n`);
console.log(`Generated ${challenges.length} challenges in ${path.basename(OUTPUT_FILE)}`);
