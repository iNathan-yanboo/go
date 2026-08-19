import { GameState, Position } from './types';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function getAIMove(state: GameState, iterations = 2000): Promise<Position | null> {
  return new Promise((resolve) => {
    const w = getWorker();
    w.onmessage = (e: MessageEvent<{ move: Position | null }>) => {
      resolve(e.data.move);
    };
    w.postMessage({ state, iterations });
  });
}

export function terminateAI() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
