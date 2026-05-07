const fs = require("fs");
const path = require("path");

const INPUT_FILES = [
  path.join(__dirname, "..", "challenges-5x5.json"),
  path.join(__dirname, "..", "challenges-10x10.json")
];

function cellKey(row, col) {
  return `${row}-${col}`;
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

function fail(errors, challenge, message) {
  errors.push(`${challenge.date} (#${challenge.challenge}): ${message}`);
}

function verifyChallenge(challenge) {
  const errors = [];
  const size = challenge.size;
  const expectedCells = size * size;
  const givensByCell = new Map();

  if (!Number.isInteger(size) || size < 2) {
    fail(errors, challenge, `size must be a valid integer, got ${size}`);
  }

  challenge.givens.forEach((given) => {
    const key = cellKey(given.row, given.col);
    if (givensByCell.has(key)) fail(errors, challenge, `duplicate given at ${key}`);
    givensByCell.set(key, given.value);
    if (given.value < 1 || given.value > size) {
      fail(errors, challenge, `given ${given.value} at ${key} is outside 1..${size}`);
    }
  });

  const covered = new Set();
  const solutionGivenCells = new Set();

  challenge.solution.forEach((piece) => {
    if (piece.area !== piece.height * piece.width) {
      fail(errors, challenge, `${piece.id} area mismatch`);
    }
    if (piece.area < 1 || piece.area > size) {
      fail(errors, challenge, `${piece.id} area ${piece.area} is outside 1..${size}`);
    }
    if (piece.row < 0 || piece.col < 0 || piece.row + piece.height > size || piece.col + piece.width > size) {
      fail(errors, challenge, `${piece.id} is out of bounds`);
    }

    const cells = rectCells(piece);
    cells.forEach((key) => {
      if (covered.has(key)) fail(errors, challenge, `${piece.id} overlaps at ${key}`);
      covered.add(key);
    });

    const numbers = cells.filter((key) => givensByCell.has(key));
    if (numbers.length !== 1) {
      fail(errors, challenge, `${piece.id} contains ${numbers.length} givens`);
      return;
    }

    const givenKey = numbers[0];
    const givenValue = givensByCell.get(givenKey);
    if (givenValue !== piece.area) {
      fail(errors, challenge, `${piece.id} has area ${piece.area} but given ${givenValue}`);
    }
    if (givenKey !== cellKey(piece.numberRow, piece.numberCol)) {
      fail(errors, challenge, `${piece.id} number coordinates do not match givens`);
    }
    solutionGivenCells.add(givenKey);
  });

  if (covered.size !== expectedCells) {
    fail(errors, challenge, `solution covers ${covered.size}/${expectedCells} cells`);
  }
  if (solutionGivenCells.size !== challenge.givens.length) {
    fail(errors, challenge, `solution uses ${solutionGivenCells.size}/${challenge.givens.length} givens`);
  }

  return errors;
}

const databases = INPUT_FILES.map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
const errors = databases.flatMap((database) => database.challenges.flatMap(verifyChallenge));

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

databases.forEach((database) => {
  console.log(`Verified ${database.challenges.length} Kakiku ${database.rules.size}x${database.rules.size} challenges`);
});
