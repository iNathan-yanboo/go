export interface AppSettings {
  boardSize: number;
  komi: number;
  gameMode: 'local' | 'ai' | 'network';
  aiDifficulty: number;
  boardColor: string;
  boardTransparent: boolean;
  bossKey: string;
  opacity: number;
  alwaysOnTop: boolean;
  stealthMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardSize: 9,
  komi: 7.5,
  gameMode: 'local',
  aiDifficulty: 2000,
  boardColor: '#E8E0D0',
  boardTransparent: true,
  bossKey: 'CommandOrControl+Shift+H',
  opacity: 0.5,
  alwaysOnTop: false,
  stealthMode: false,
};

const STORAGE_KEY = 'gg-settings';

export function loadSettings(): Partial<AppSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return {};
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getInitialSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...loadSettings() };
}
