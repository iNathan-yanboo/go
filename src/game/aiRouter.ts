import { invoke } from '@tauri-apps/api/core';
import { GameState, Position, BLACK, WHITE } from './types';
import { getMokaMove, isMokaAvailable, terminateMoka } from './mokaAi';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

function scaledMctsIterations(size: number, difficulty: number): number {
  const base = size <= 9 ? 600 : size <= 15 ? 900 : 1200;
  return Math.round(base * (difficulty / 2000));
}

function toAiBoardState(state: GameState, difficulty: number) {
  return {
    size: state.size,
    komi: state.komi,
    board: state.board.map((row) =>
      row.map((stone) => stone),
    ),
    current_player: state.currentPlayer,
    difficulty,
  };
}

async function getPachiMove(state: GameState, difficulty: number): Promise<Position | null> {
  const result = await invoke<{ x: number; y: number; pass: boolean; engine: string }>('pachi_genmove', {
    req: toAiBoardState(state, difficulty),
  });
  if (result.pass) return null;
  return { x: result.x, y: result.y };
}

async function getMctsMove(state: GameState, difficulty: number): Promise<Position | null> {
  const { getAIMove } = await import('./ai');
  return getAIMove(state, scaledMctsIterations(state.size, difficulty));
}

export type AiEngineKind = 'moka' | 'pachi' | 'mcts';

export async function getBestAIMove(
  state: GameState,
  difficulty: number,
): Promise<{ move: Position | null; engine: AiEngineKind }> {
  if (state.size === 9 && await isMokaAvailable()) {
    try {
      const move = await getMokaMove(state);
      if (move !== undefined) {
        return { move, engine: 'moka' };
      }
    } catch (e) {
      console.warn('[ai] moka failed, fallback:', e);
    }
  }

  if (isTauri()) {
    try {
      const available = await invoke<boolean>('pachi_available');
      if (available) {
        const move = await getPachiMove(state, difficulty);
        return { move, engine: 'pachi' };
      }
    } catch (e) {
      console.warn('[ai] pachi failed, fallback:', e);
    }
  }

  const move = await getMctsMove(state, difficulty);
  return { move, engine: 'mcts' };
}

export async function terminateAI() {
  terminateMoka();
  const { terminateAI: terminateMcts } = await import('./ai');
  terminateMcts();
  if (isTauri()) {
    try {
      await invoke('pachi_shutdown');
    } catch {}
  }
}

export function aiEngineLabel(engine: AiEngineKind): string {
  switch (engine) {
    case 'moka': return 'Moka';
    case 'pachi': return 'Pachi';
    default: return 'MCTS';
  }
}

export async function checkPachiAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>('pachi_available');
  } catch {
    return false;
  }
}
