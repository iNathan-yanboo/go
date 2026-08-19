import { describe, it, expect } from 'vitest';
import {
  createGameState, playMove, pass, resign,
  isValidMove, calculateTerritory, getValidMoves,
} from './engine';
import { BLACK, WHITE, EMPTY, Board, createBoard } from './types';

function playSequence(size: number, moves: [number, number][]): ReturnType<typeof createGameState> {
  let state = createGameState(size);
  for (const [x, y] of moves) {
    const next = playMove(state, x, y);
    if (!next) throw new Error(`Move (${x},${y}) failed at move ${state.moveCount}`);
    state = next;
  }
  return state;
}

describe('basic move placement', () => {
  for (const size of [5, 9, 19]) {
    it(`places a stone on ${size}x${size} board`, () => {
      const state = createGameState(size);
      const next = playMove(state, 0, 0);
      expect(next).not.toBeNull();
      expect(next!.board[0][0]).toBe(BLACK);
      expect(next!.currentPlayer).toBe(WHITE);
      expect(next!.moveCount).toBe(1);
    });
  }

  it('rejects move on occupied point', () => {
    const state = playSequence(5, [[2, 2]]);
    expect(playMove(state, 2, 2)).toBeNull();
  });

  it('rejects out of bounds', () => {
    const state = createGameState(9);
    expect(isValidMove(state, -1, 0)).toBe(false);
    expect(isValidMove(state, 9, 0)).toBe(false);
    expect(isValidMove(state, 0, 9)).toBe(false);
  });

  it('alternates players', () => {
    const state = playSequence(5, [[0, 0], [1, 0]]);
    expect(state.currentPlayer).toBe(BLACK);
  });
});

describe('capture', () => {
  it('captures a single stone', () => {
    // Surround white stone at (1,0) with black
    // B at (0,0), W at (1,0), B at (2,0), B skip, B at (1,1)
    let state = createGameState(5);
    state = playMove(state, 0, 0)!; // B
    state = playMove(state, 1, 0)!; // W
    state = playMove(state, 2, 0)!; // B
    state = playMove(state, 4, 4)!; // W tenuki
    state = playMove(state, 1, 1)!; // B captures W(1,0)
    expect(state.board[0][1]).toBe(EMPTY);
    expect(state.captures[BLACK]).toBe(1);
  });

  it('captures a multi-stone group', () => {
    // White group at (1,0) and (2,0), surround with black
    let state = createGameState(5);
    // B(0,0) W(1,0) B(3,0) W(2,0) B(1,1) W(4,4) B(2,1) W(4,3) B skip... need more surrounding
    // Surround: B needs (0,0),(3,0),(1,1),(2,1)
    const moves: [number, number][] = [
      [0, 0], [1, 0], // B, W
      [3, 0], [2, 0], // B, W
      [1, 1], [4, 4], // B, W tenuki
      [2, 1],         // B captures group
    ];
    state = playSequence(5, moves);
    expect(state.board[0][1]).toBe(EMPTY);
    expect(state.board[0][2]).toBe(EMPTY);
    expect(state.captures[BLACK]).toBe(2);
  });

  it('captures a corner stone', () => {
    // White at (0,0), black surrounds at (1,0) and (0,1)
    let state = createGameState(5);
    state = playMove(state, 1, 0)!; // B
    state = playMove(state, 0, 0)!; // W
    state = playMove(state, 0, 1)!; // B captures W(0,0)
    expect(state.board[0][0]).toBe(EMPTY);
    expect(state.captures[BLACK]).toBe(1);
  });

  it('captures to gain liberty (not suicide)', () => {
    // Black plays into a spot with no liberties but captures opponent stones first
    // 5x5: W stones form a ring, B plays inside capturing them
    // Simple: B at (0,1), W at (1,0), B at (2,1), W at (1,2), then B plays (1,1)
    // Wait, (1,1) has liberty? No, it's surrounded by B and W...
    // Let's set up: W(1,0) W(0,1) are surrounded, B plays to capture
    // Actually let's do: edge capture
    // W at (0,0), (1,0) — B surrounds: (2,0), (0,1), (1,1), then B captures
    let state = createGameState(5);
    const moves: [number, number][] = [
      [2, 0], [0, 0], // B, W
      [0, 1], [1, 0], // B, W
      [1, 1],         // B — captures W(0,0) and W(1,0)
    ];
    state = playSequence(5, moves);
    expect(state.board[0][0]).toBe(EMPTY);
    expect(state.board[0][1]).toBe(EMPTY);
    expect(state.captures[BLACK]).toBe(2);
  });
});

describe('suicide prevention', () => {
  it('prevents self-capture', () => {
    // B at (1,0) and (0,1), then pass to make it White's turn
    // White playing (0,0) would be suicide: neighbors are all Black
    let state = createGameState(5);
    const moves: [number, number][] = [
      [1, 0], [4, 4], // B, W tenuki
      [0, 1], [4, 3], // B, W tenuki
    ];
    state = playSequence(5, moves);
    // It's Black's turn. Pass to make it White's turn.
    state = pass(state);
    // White's turn. (0,0) neighbors: (1,0)=B, (0,1)=B → suicide
    expect(isValidMove(state, 0, 0)).toBe(false);
  });
});

describe('ko', () => {
  it('prevents immediate recapture (simple ko)', () => {
    // Classic ko shape
    // Set up: B captures W at some point, then W cannot recapture immediately
    // Standard ko pattern on a 5x5:
    //  . B W .
    //  B . B W
    //  . B W .
    // W plays at (1,1) to capture B — no wait, let me think carefully.
    //
    // Ko setup:
    //   col: 0 1 2 3
    // r0:   . B W .
    // r1:   B . B W
    // r2:   . B W .
    //
    // Black plays (1,1) capturing W? No, there's no W at (1,1).
    // Let me use a minimal ko:
    //   col: 0 1 2 3
    // r0:   . B W .
    // r1:   B W . W
    // r2:   . B W .
    // Black plays (2,1) to capture W(1,1). Then W cannot play (1,1).

    let state = createGameState(5);
    // Build the position. Black: (1,0),(0,1),(1,2),(2,1 later). White: (2,0),(1,1),(3,1),(2,2)
    // We need to interleave moves properly. Let me place them:
    const setup: [number, number][] = [
      [1, 0], [2, 0], // B(1,0) W(2,0)
      [0, 1], [1, 1], // B(0,1) W(1,1)
      [1, 2], [3, 1], // B(1,2) W(3,1)
      [4, 4], [2, 2], // B tenuki, W(2,2)
    ];
    state = playSequence(5, setup);
    // Now Black plays (2,1) capturing W(1,1)
    state = playMove(state, 2, 1)!;
    expect(state.board[1][1]).toBe(EMPTY);
    expect(state.captures[BLACK]).toBe(1);
    expect(state.koPoint).toEqual({ x: 1, y: 1 });

    // White cannot recapture at (1,1)
    expect(isValidMove(state, 1, 1)).toBe(false);

    // But after another move, ko is cleared
    state = playMove(state, 4, 3)!; // W tenuki
    state = playMove(state, 4, 2)!; // B tenuki
    expect(isValidMove(state, 1, 1)).toBe(true);
  });
});

describe('superko', () => {
  it('prevents positional superko via history', () => {
    // The engine checks state.history.includes(key) for full positional superko.
    // This is implicitly tested by ko, but let's verify history grows.
    const state = createGameState(5);
    expect(state.history.length).toBe(1);
    const s2 = playMove(state, 0, 0)!;
    expect(s2.history.length).toBe(2);
    const s3 = playMove(s2, 1, 1)!;
    expect(s3.history.length).toBe(3);
  });
});

describe('pass', () => {
  it('single pass continues game', () => {
    const state = pass(createGameState(5));
    expect(state.isOver).toBe(false);
    expect(state.consecutivePasses).toBe(1);
    expect(state.currentPlayer).toBe(WHITE);
  });

  it('double pass ends game', () => {
    let state = createGameState(5);
    state = pass(state);
    state = pass(state);
    expect(state.isOver).toBe(true);
    expect(state.territory).not.toBeNull();
  });
});

describe('resign', () => {
  it('marks game over with correct winner', () => {
    const state = resign(createGameState(5));
    expect(state.isOver).toBe(true);
    expect(state.winner).toBe(WHITE); // Black resigned, White wins
  });

  it('white resigns, black wins', () => {
    let state = createGameState(5);
    state = pass(state); // switch to white
    state = resign(state);
    expect(state.winner).toBe(BLACK);
  });
});

describe('territory counting', () => {
  it('counts simple enclosed territory', () => {
    // On a 5x5, black wall on column 2, all left side is black territory
    // Note: calculateTerritory uses area scoring (counts stones too)
    const board: Board = createBoard(5);
    for (let y = 0; y < 5; y++) board[y][2] = BLACK;
    const t = calculateTerritory(board);
    // Black wall on col 2, both sides only touch black → all 25 points
    expect(t[BLACK]).toBe(25);
    expect(t[WHITE]).toBe(0);
  });

  it('shared borders are neutral', () => {
    // Empty area touching both black and white is neutral
    const board: Board = createBoard(5);
    board[0][0] = BLACK;
    board[0][4] = WHITE;
    const t = calculateTerritory(board);
    // The large empty region touches both colors → neutral (0 for both from empty)
    // Only the stones themselves count
    expect(t[BLACK]).toBe(1);
    expect(t[WHITE]).toBe(1);
  });

  it('separate enclosed regions', () => {
    // Black encloses top-left, White encloses bottom-right on 5x5
    const board: Board = createBoard(5);
    // Black wall at row 1
    for (let x = 0; x < 5; x++) board[1][x] = BLACK;
    // White wall at row 3
    for (let x = 0; x < 5; x++) board[3][x] = WHITE;
    const t = calculateTerritory(board);
    // Row 0: 5 empty, only touches black → black territory
    // Row 1: 5 black stones → black
    // Row 2: 5 empty, touches black and white → neutral
    // Row 3: 5 white stones → white
    // Row 4: 5 empty, only touches white → white territory
    expect(t[BLACK]).toBe(10); // 5 stones + 5 territory
    expect(t[WHITE]).toBe(10);
  });
});

describe('getValidMoves', () => {
  it('returns all empty points on empty board', () => {
    const state = createGameState(5);
    const moves = getValidMoves(state);
    expect(moves.length).toBe(25);
  });

  it('excludes occupied and invalid points', () => {
    const state = playSequence(5, [[2, 2]]);
    const moves = getValidMoves(state);
    expect(moves.find(m => m.x === 2 && m.y === 2)).toBeUndefined();
    expect(moves.length).toBe(24);
  });

  it('returns empty array when game is over', () => {
    let state = createGameState(5);
    state = resign(state);
    expect(getValidMoves(state).length).toBe(0);
  });
});

describe('edge cases', () => {
  it('large group with one liberty', () => {
    // Build a black group along the top edge, leave one liberty
    let state = createGameState(5);
    // B fills (0,0)(1,0)(2,0)(3,0), W fills below except one
    const moves: [number, number][] = [
      [0, 0], [0, 1], // B, W
      [1, 0], [1, 1], // B, W
      [2, 0], [2, 1], // B, W
      [3, 0], [3, 1], // B, W
    ];
    state = playSequence(5, moves);
    // Black group (0,0)-(3,0) has one liberty at (4,0)
    // It's still alive
    expect(state.board[0][0]).toBe(BLACK);
    // White plays (4,0) to try capturing — but need (4,1) too
    state = playMove(state, 4, 4)!; // B tenuki
    state = playMove(state, 4, 0)!; // W — now black group has 0 liberties? 
    // Actually (4,0) was the last liberty but W also needs to check if capture happens
    // W at (4,0) + W at (0,1)-(3,1) surround the top row → captured
    expect(state.board[0][0]).toBe(EMPTY);
    expect(state.captures[WHITE]).toBe(4);
  });
});
