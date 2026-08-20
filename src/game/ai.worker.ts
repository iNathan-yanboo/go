import { GameState, Position, EMPTY } from './types';
import { playMove, pass, getValidMoves } from './engine';

interface MCTSNode {
  state: GameState;
  move: Position | null;
  parent: MCTSNode | null;
  children: MCTSNode[];
  wins: number;
  visits: number;
  untriedMoves: Position[];
}

function createNode(state: GameState, move: Position | null, parent: MCTSNode | null): MCTSNode {
  return {
    state,
    move,
    parent,
    children: [],
    wins: 0,
    visits: 0,
    untriedMoves: getValidMoves(state),
  };
}

function ucb1(node: MCTSNode, parentVisits: number): number {
  if (node.visits === 0) return Infinity;
  return node.wins / node.visits + 1.414 * Math.sqrt(Math.log(parentVisits) / node.visits);
}

function selectChild(node: MCTSNode): MCTSNode {
  let best = node.children[0];
  let bestScore = -1;
  for (const c of node.children) {
    const score = ucb1(c, node.visits);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function randomPlayout(state: GameState): number {
  let s = state;
  let moves = 0;
  const maxMoves = Math.min(state.size * state.size * 2, 40 + state.size * 3);

  while (!s.isOver && moves < maxMoves) {
    const valid = getValidMoves(s);
    if (valid.length === 0) {
      s = pass(s);
    } else {
      const pick = valid[Math.floor(Math.random() * valid.length)];
      const next = playMove(s, pick.x, pick.y);
      if (next) s = next;
      else s = pass(s);
    }
    moves++;
  }

  if (!s.isOver) s = pass(pass(s));
  return s.winner ?? EMPTY;
}

function mcts(rootState: GameState, iterations: number): Position | null {
  const root = createNode(rootState, null, null);
  const myColor = rootState.currentPlayer;

  for (let i = 0; i < iterations; i++) {
    let node = root;

    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node);
    }

    if (node.untriedMoves.length > 0) {
      const idx = Math.floor(Math.random() * node.untriedMoves.length);
      const move = node.untriedMoves.splice(idx, 1)[0];
      const newState = playMove(node.state, move.x, move.y);
      if (newState) {
        const child = createNode(newState, move, node);
        node.children.push(child);
        node = child;
      }
    }

    const winner = randomPlayout(node.state);

    while (node) {
      node.visits++;
      if (winner === myColor) node.wins++;
      node = node.parent!;
    }
  }

  if (root.children.length === 0) return null;

  let bestChild = root.children[0];
  for (const c of root.children) {
    if (c.visits > bestChild.visits) bestChild = c;
  }
  return bestChild.move;
}

self.onmessage = (e: MessageEvent<{ state: GameState; iterations: number }>) => {
  const { state, iterations } = e.data;
  const move = mcts(state, iterations);
  self.postMessage({ move });
};
