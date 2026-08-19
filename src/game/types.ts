export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Stone = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Board = Stone[][];
export type Position = { x: number; y: number };

export interface GameState {
  size: number;
  board: Board;
  currentPlayer: typeof BLACK | typeof WHITE;
  captures: { [BLACK]: number; [WHITE]: number };
  history: string[];
  koPoint: Position | null;
  moveCount: number;
  consecutivePasses: number;
  isOver: boolean;
  winner: Stone | null;
  lastMove: Position | null;
  territory: { [BLACK]: number; [WHITE]: number } | null;
  komi: number;
}

export function opponent(s: typeof BLACK | typeof WHITE) {
  return s === BLACK ? WHITE : BLACK;
}

export function createBoard(size: number): Board {
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}

export function cloneBoard(b: Board): Board {
  return b.map(r => [...r]);
}

export function boardKey(b: Board): string {
  return b.map(r => r.join('')).join('|');
}
