import { GameState, BLACK, WHITE, Position } from './types';
import { GoModelWorkerClient } from './moka/client';
import {
  GO_BOARD_SIZE,
  GO_NO_KO_MOVE,
  GO_PASS_MOVE,
} from './moka/constants';
import {
  createGameState as createMokaState,
  encodeStudentFeatures,
  selectHighestLegalMove,
} from './moka/game';

type GoGameState = {
  board: Int8Array;
  consecutivePassCount: number;
  koMove: number;
  moveCount: number;
  moveHistory: number[];
  nextColor: number;
};

let worker: Worker | null = null;
let client: GoModelWorkerClient | null = null;
let initPromise: Promise<boolean> | null = null;

function getClient(): GoModelWorkerClient {
  if (!client) {
    worker = new Worker(new URL('./moka.worker.ts', import.meta.url), { type: 'module' });
    client = new GoModelWorkerClient(worker);
  }
  return client;
}

async function ensureMokaReady(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await getClient().initialize({
          manifestUrl: '/moka/go-model.json',
          weightsUrl: '/moka/go-model.bin',
        });
        return true;
      } catch (e) {
        console.warn('[moka] init failed:', e);
        initPromise = null;
        return false;
      }
    })();
  }
  return initPromise;
}

function toMokaState(state: GameState): GoGameState | null {
  if (state.size !== GO_BOARD_SIZE) return null;

  const moka = createMokaState() as GoGameState;
  for (let y = 0; y < GO_BOARD_SIZE; y++) {
    for (let x = 0; x < GO_BOARD_SIZE; x++) {
      const stone = state.board[y][x];
      const idx = y * GO_BOARD_SIZE + x;
      if (stone === BLACK) moka.board[idx] = 1;
      else if (stone === WHITE) moka.board[idx] = -1;
    }
  }

  moka.nextColor = state.currentPlayer === BLACK ? 1 : -1;
  moka.moveCount = state.moveCount;
  moka.koMove = state.koPoint
    ? state.koPoint.y * GO_BOARD_SIZE + state.koPoint.x
    : GO_NO_KO_MOVE;

  return moka;
}

function fromMokaMove(move: number): Position | null {
  if (move === GO_PASS_MOVE) return null;
  return {
    x: move % GO_BOARD_SIZE,
    y: Math.floor(move / GO_BOARD_SIZE),
  };
}

export async function isMokaAvailable(): Promise<boolean> {
  return ensureMokaReady();
}

export async function getMokaMove(state: GameState): Promise<Position | null> {
  const ready = await ensureMokaReady();
  if (!ready) return null;

  const mokaState = toMokaState(state);
  if (!mokaState) return null;

  const features = encodeStudentFeatures(mokaState);
  const result = await getClient().infer(features);
  const move = selectHighestLegalMove(mokaState, result.policyLogits);
  return fromMokaMove(move);
}

export function terminateMoka() {
  if (client) {
    client.dispose();
    client = null;
  }
  worker = null;
  initPromise = null;
}
