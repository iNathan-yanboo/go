import {
  Board, Stone, Position, GameState,
  EMPTY, BLACK, WHITE,
  opponent, createBoard, cloneBoard, boardKey,
} from './types';

function neighbors(x: number, y: number, size: number): Position[] {
  const n: Position[] = [];
  if (x > 0) n.push({ x: x - 1, y });
  if (x < size - 1) n.push({ x: x + 1, y });
  if (y > 0) n.push({ x, y: y - 1 });
  if (y < size - 1) n.push({ x, y: y + 1 });
  return n;
}

function getGroup(board: Board, x: number, y: number): { stones: Position[]; liberties: Set<string> } {
  const size = board.length;
  const color = board[y][x];
  const visited = new Set<string>();
  const stones: Position[] = [];
  const liberties = new Set<string>();
  const stack: Position[] = [{ x, y }];

  while (stack.length) {
    const p = stack.pop()!;
    const key = `${p.x},${p.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    stones.push(p);

    for (const n of neighbors(p.x, p.y, size)) {
      const nk = `${n.x},${n.y}`;
      if (visited.has(nk)) continue;
      const ns = board[n.y][n.x];
      if (ns === EMPTY) liberties.add(nk);
      else if (ns === color) stack.push(n);
    }
  }
  return { stones, liberties };
}

function removeGroup(board: Board, stones: Position[]): number {
  for (const s of stones) board[s.y][s.x] = EMPTY;
  return stones.length;
}

export function createGameState(size: number, komi = 6.5): GameState {
  return {
    size,
    board: createBoard(size),
    currentPlayer: BLACK,
    captures: { [BLACK]: 0, [WHITE]: 0 },
    history: [boardKey(createBoard(size))],
    koPoint: null,
    moveCount: 0,
    consecutivePasses: 0,
    isOver: false,
    winner: null,
    lastMove: null,
    territory: null,
    komi,
  };
}

export function isValidMove(state: GameState, x: number, y: number): boolean {
  if (state.isOver) return false;
  if (x < 0 || y < 0 || x >= state.size || y >= state.size) return false;
  if (state.board[y][x] !== EMPTY) return false;
  if (state.koPoint && state.koPoint.x === x && state.koPoint.y === y) return false;

  const testBoard = cloneBoard(state.board);
  testBoard[y][x] = state.currentPlayer;
  const opp = opponent(state.currentPlayer);

  for (const n of neighbors(x, y, state.size)) {
    if (testBoard[n.y][n.x] === opp) {
      const g = getGroup(testBoard, n.x, n.y);
      if (g.liberties.size === 0) removeGroup(testBoard, g.stones);
    }
  }

  const self = getGroup(testBoard, x, y);
  if (self.liberties.size === 0) return false;

  const key = boardKey(testBoard);
  if (state.history.includes(key)) return false;

  return true;
}

export function playMove(state: GameState, x: number, y: number): GameState | null {
  if (!isValidMove(state, x, y)) return null;

  const board = cloneBoard(state.board);
  const color = state.currentPlayer;
  const opp = opponent(color);
  board[y][x] = color;

  let totalCaptured = 0;
  let capturedStones: Position[] = [];

  for (const n of neighbors(x, y, state.size)) {
    if (board[n.y][n.x] === opp) {
      const g = getGroup(board, n.x, n.y);
      if (g.liberties.size === 0) {
        capturedStones = capturedStones.concat(g.stones);
        totalCaptured += removeGroup(board, g.stones);
      }
    }
  }

  let koPoint: Position | null = null;
  if (totalCaptured === 1 && capturedStones.length === 1) {
    const selfGroup = getGroup(board, x, y);
    if (selfGroup.stones.length === 1 && selfGroup.liberties.size === 1) {
      koPoint = capturedStones[0];
    }
  }

  const key = boardKey(board);
  const captures = { ...state.captures };
  captures[color] += totalCaptured;

  return {
    ...state,
    board,
    currentPlayer: opp,
    captures,
    history: [...state.history, key],
    koPoint,
    moveCount: state.moveCount + 1,
    consecutivePasses: 0,
    lastMove: { x, y },
    territory: null,
  };
}

export function pass(state: GameState): GameState {
  const newPasses = state.consecutivePasses + 1;
  const isOver = newPasses >= 2;
  const newState: GameState = {
    ...state,
    currentPlayer: opponent(state.currentPlayer),
    consecutivePasses: newPasses,
    koPoint: null,
    isOver,
    lastMove: null,
  };

  if (isOver) {
    const t = calculateTerritory(newState.board);
    newState.territory = t;
    const blackScore = t[BLACK] + state.captures[BLACK];
    const whiteScore = t[WHITE] + state.captures[WHITE] + state.komi;
    newState.winner = blackScore > whiteScore ? BLACK : whiteScore > blackScore ? WHITE : EMPTY;
  }
  return newState;
}

export function resign(state: GameState): GameState {
  return {
    ...state,
    isOver: true,
    winner: opponent(state.currentPlayer),
  };
}

function floodFillTerritory(board: Board, startX: number, startY: number, visited: boolean[][]): { points: Position[]; owner: Stone } {
  const size = board.length;
  const points: Position[] = [];
  let touchesBlack = false;
  let touchesWhite = false;
  const stack: Position[] = [{ x: startX, y: startY }];

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p.y][p.x]) continue;
    visited[p.y][p.x] = true;
    points.push(p);

    for (const n of neighbors(p.x, p.y, size)) {
      const s = board[n.y][n.x];
      if (s === BLACK) { touchesBlack = true; continue; }
      if (s === WHITE) { touchesWhite = true; continue; }
      if (visited[n.y][n.x]) continue;
      stack.push(n);
    }
  }

  let owner: Stone = EMPTY;
  if (touchesBlack && !touchesWhite) owner = BLACK;
  if (touchesWhite && !touchesBlack) owner = WHITE;
  return { points, owner };
}

export function calculateTerritory(board: Board): { [BLACK]: number; [WHITE]: number } {
  const size = board.length;
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const result = { [BLACK]: 0, [WHITE]: 0 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (visited[y][x] || board[y][x] !== EMPTY) {
        visited[y][x] = true;
        if (board[y][x] === BLACK) result[BLACK]++;
        else if (board[y][x] === WHITE) result[WHITE]++;
        continue;
      }
      const { points, owner } = floodFillTerritory(board, x, y, visited);
      if (owner === BLACK) result[BLACK] += points.length;
      else if (owner === WHITE) result[WHITE] += points.length;
    }
  }
  return result;
}

export function getValidMoves(state: GameState): Position[] {
  const moves: Position[] = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (isValidMove(state, x, y)) moves.push({ x, y });
    }
  }
  return moves;
}
