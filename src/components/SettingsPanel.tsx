import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { checkPachiAvailable } from '../game/aiRouter';
import { AppSettings } from '../utils/settingsStorage';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onNewGame: () => void;
  bossKeyTriggerAt?: number | null;
}

function normalizeKey(key: string): string | null {
  switch (key) {
    case '`':
    case '~':
      return 'Backquote';
    case '\\':
      return 'Backslash';
    case '[':
      return 'BracketLeft';
    case ']':
      return 'BracketRight';
    case ',':
      return 'Comma';
    case '.':
      return 'Period';
    case '/':
      return 'Slash';
    case ';':
      return 'Semicolon';
    case "'":
      return 'Quote';
    case '=':
      return 'Equal';
    case '-':
      return 'Minus';
    case ' ':
      return 'Space';
    case 'Escape':
      return 'Escape';
    default:
      return null;
  }
}

function keyEventToShortcut(e: React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const rawKey = e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(rawKey)) {
    const mapped = normalizeKey(rawKey);
    if (mapped) {
      parts.push(mapped);
    } else if (rawKey.length === 1) {
      parts.push(rawKey.toUpperCase());
    } else if (rawKey === 'Escape') {
      parts.push('Escape');
    } else {
      parts.push(rawKey);
    }
  }

  if (parts.length === 0) return '';

  const allowedSingles = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
  if (parts.length === 1 && !allowedSingles.includes(parts[0])) return '';

  return parts.join('+');
}

function isModifierOnlyKey(key: string): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta'].includes(key);
}

function shortcutDisplay(s: string): string {
  return s
    .replace('CommandOrControl', 'Ctrl/Cmd')
    .replace('Escape', 'Esc');
}

export default function SettingsPanel({ settings, onChange, onNewGame, bossKeyTriggerAt }: SettingsPanelProps) {
  const [recording, setRecording] = useState(false);
  const [bossKeyError, setBossKeyError] = useState<string | null>(null);
  const [pachiAvailable, setPachiAvailable] = useState<boolean | null>(null);
  const keyInputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (settings.gameMode !== 'ai') return;
    checkPachiAvailable().then(setPachiAvailable);
  }, [settings.gameMode, settings.boardSize]);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isModifierOnlyKey(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      const shortcut = keyEventToShortcut(e as any);
      if (shortcut) {
        onChange({ bossKey: shortcut });
        setBossKeyError(null);
        setRecording(false);
      } else {
        setBossKeyError('不支持的快捷键：需要带 Ctrl/Cmd 或 Alt/Shift，再加一个字母/数字键');
        setRecording(false);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, onChange]);

  const handlePin = async () => {
    const next = !settings.alwaysOnTop;
    onChange({ alwaysOnTop: next });
    if (isTauri()) {
      await invoke('set_always_on_top', { onTop: next });
    }
  };

  const handleStealth = async () => {
    const next = !settings.stealthMode;
    if (next) {
      onChange({ stealthMode: true, opacity: 0.3, alwaysOnTop: true });
    } else {
      onChange({ stealthMode: false, opacity: 0.5, alwaysOnTop: false });
    }
    if (isTauri()) {
      await invoke('set_stealth_mode', { stealth: next });
      await invoke('set_always_on_top', { onTop: next });
    }
  };

  return (
    <div style={panelStyle}>
      <section style={cardStyle}>
        <div style={sectionTitle}>对局</div>
        <div style={rowStyle}>
          <label>棋盘大小</label>
          <input
            type="number"
            min={5}
            max={25}
            value={settings.boardSize}
            onChange={(e) => onChange({ boardSize: parseInt(e.target.value) || 9 })}
            style={inputStyle}
          />
        </div>
        <div style={rowStyle}>
          <label>贴目</label>
          <input
            type="number"
            step={0.5}
            value={settings.komi}
            onChange={(e) => onChange({ komi: parseFloat(e.target.value) || 7.5 })}
            style={inputStyle}
          />
        </div>
        <div style={rowStyle}>
          <label>模式</label>
          <select
            value={settings.gameMode}
            onChange={(e) => onChange({ gameMode: e.target.value as AppSettings['gameMode'] })}
            style={{ ...inputStyle, width: 120 }}
          >
            <option value="local">本地对弈</option>
            <option value="ai">人机对战</option>
            <option value="network">联机</option>
          </select>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionTitle}>外观</div>
        <div style={rowStyle}>
          <label>置顶</label>
          <button onClick={handlePin} style={{ ...smallBtnStyle, background: settings.alwaysOnTop ? '#dff2df' : '#fff', borderColor: settings.alwaysOnTop ? '#9bc79b' : '#ccc', color: settings.alwaysOnTop ? '#2f6b2f' : '#444' }}>
            {settings.alwaysOnTop ? '开' : '关'}
          </button>
          <label>隐身模式</label>
          <button onClick={handleStealth} style={{ ...smallBtnStyle, background: settings.stealthMode ? '#f7e3d6' : '#fff', borderColor: settings.stealthMode ? '#d8ab8f' : '#ccc', color: settings.stealthMode ? '#9a4f1a' : '#444' }}>
            {settings.stealthMode ? '开' : '关'}
          </button>
        </div>
        <div style={rowStyle}>
          <label>棋盘颜色</label>
          <input
            type="color"
            value={settings.boardColor}
            onChange={(e) => onChange({ boardColor: e.target.value })}
            disabled={settings.boardTransparent}
            style={{ width: 28, height: 24, border: '1px solid #e3e3e3', borderRadius: 8, padding: 0, cursor: 'pointer' }}
          />
          <button
            onClick={() => onChange({ boardTransparent: !settings.boardTransparent })}
            style={{ ...smallBtnStyle, background: settings.boardTransparent ? '#dff2df' : '#fff', borderColor: settings.boardTransparent ? '#9bc79b' : '#ccc', color: settings.boardTransparent ? '#2f6b2f' : '#444' }}
          >
            {settings.boardTransparent ? '透明' : '不透明'}
          </button>
        </div>
        <div style={rowStyle}>
          <label>透明度</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={settings.opacity}
            onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
            style={{ flex: 1, minWidth: 120 }}
          />
          <span style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{Math.round(settings.opacity * 100)}%</span>
        </div>
      </section>

      {settings.gameMode === 'ai' && (
        <section style={cardStyle}>
          <div style={sectionTitle}>人机</div>
          <div style={rowStyle}>
            <label>AI 模拟次数</label>
            <input
              type="range"
              min={500}
              max={5000}
              step={500}
              value={settings.aiDifficulty}
              onChange={(e) => onChange({ aiDifficulty: parseInt(e.target.value) })}
              style={{ flex: 1, minWidth: 120 }}
            />
            <span style={{ fontSize: 11, width: 40, textAlign: 'right' }}>{settings.aiDifficulty}</span>
          </div>
          <div style={aiHintStyle}>
            <div>9 路：内置 Moka（无需安装）</div>
            {settings.boardSize === 9 ? (
              <div style={{ color: '#666' }}>其他路数需安装 Pachi</div>
            ) : pachiAvailable ? (
              <div style={{ color: '#2f6b2f' }}>{settings.boardSize} 路：Pachi 已就绪</div>
            ) : (
              <>
                <div style={{ color: '#9a4f1a' }}>
                  {settings.boardSize} 路：未检测到 Pachi，当前将使用较慢的 MCTS
                </div>
                <div style={{ marginTop: 6, lineHeight: 1.5 }}>
                  安装步骤：
                  <br />1. 打开「终端」
                  <br />2. 执行 <code style={codeStyle}>brew install pachi</code>
                  <br />3. 重启本应用
                </div>
                <div style={{ marginTop: 4, color: '#888' }}>
                  需先安装 Homebrew：<a href="https://brew.sh" target="_blank" rel="noreferrer" style={{ color: '#4d6275' }}>brew.sh</a>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <div style={sectionTitle}>快捷键</div>
        <div style={rowStyle}>
          <label>老板键</label>
          <button
            ref={keyInputRef}
            onClick={() => setRecording(true)}
            style={{
              ...smallBtnStyle,
              minWidth: 120,
              textAlign: 'center',
              background: recording ? '#fff3cd' : '#fff',
              borderColor: recording ? '#ffc107' : '#ccc',
            }}
          >
            {recording ? '按下快捷键...' : shortcutDisplay(settings.bossKey)}
          </button>
          {settings.bossKey !== 'CommandOrControl+Shift+H' && (
            <button onClick={() => onChange({ bossKey: 'CommandOrControl+Shift+H' })} style={smallBtnStyle}>
              默认
            </button>
          )}
        </div>
        {bossKeyTriggerAt ? (
          <div style={{ fontSize: 11, color: '#999' }}>已触发: {new Date(bossKeyTriggerAt).toLocaleTimeString()}</div>
        ) : null}
        {bossKeyError && (
          <div style={{ fontSize: 11, color: '#c0392b', marginTop: 2 }}>{bossKeyError}</div>
        )}
      </section>

      <button onClick={onNewGame} style={{ ...smallBtnStyle, width: '100%' }}>新对局</button>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  fontSize: 12,
  color: '#333',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#666',
  marginBottom: 4,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  padding: '4px 0',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #eeeeee',
  borderRadius: 10,
  padding: 10,
  background: '#fcfcfc',
};

const inputStyle: React.CSSProperties = {
  width: 78,
  background: '#ffffff',
  border: '1px solid #e3e3e3',
  color: '#333',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 12,
};

const smallBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e3e3e3',
  borderRadius: 8,
  background: '#fbfbfb',
  color: '#333',
  fontSize: 12,
  cursor: 'pointer',
};

const aiHintStyle: React.CSSProperties = {
  marginTop: 6,
  padding: '8px 10px',
  borderRadius: 8,
  background: '#f7f9fb',
  border: '1px solid #e3eaf0',
  fontSize: 11,
  lineHeight: 1.45,
  color: '#444',
};

const codeStyle: React.CSSProperties = {
  padding: '1px 5px',
  borderRadius: 4,
  background: '#eef2f5',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 10,
};
