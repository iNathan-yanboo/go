import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { checkPachiAvailable } from '../game/aiRouter';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

interface SettingsProps {
  boardSize: number;
  onBoardSizeChange: (size: number) => void;
  komi: number;
  onKomiChange: (komi: number) => void;
  gameMode: 'local' | 'ai' | 'network';
  onGameModeChange: (mode: 'local' | 'ai' | 'network') => void;
  aiDifficulty: number;
  onAiDifficultyChange: (d: number) => void;
  onNewGame: () => void;
  boardColor: string;
  onBoardColorChange: (color: string) => void;
  boardTransparent: boolean;
  onBoardTransparentChange: (v: boolean) => void;
  bossKey: string;
  onBossKeyChange: (key: string) => void;
  bossKeyTriggerAt: number | null;
  opacity: number;
  onOpacityChange: (v: number) => void;
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (v: boolean) => void;
  stealthMode: boolean;
  onStealthModeChange: (v: boolean) => void;
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

  // 单独的键（比如没有修饰键的字母）不注册，避免抢占系统快捷键
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

export default function Settings(props: SettingsProps) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bossKeyError, setBossKeyError] = useState<string | null>(null);
  const [pachiAvailable, setPachiAvailable] = useState<boolean | null>(null);
  const keyInputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || props.gameMode !== 'ai') return;
    checkPachiAvailable().then(setPachiAvailable);
  }, [open, props.gameMode, props.boardSize]);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isModifierOnlyKey(e.key)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const shortcut = keyEventToShortcut(e as any);
      if (shortcut) {
        props.onBossKeyChange(shortcut);
        setBossKeyError(null);
        setRecording(false);
      } else {
        setBossKeyError('不支持的快捷键：需要带 Ctrl/Cmd 或 Alt/Shift，再加一个字母/数字键');
        setRecording(false);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [recording, props]);

  const handlePin = async () => {
    const next = !props.alwaysOnTop;
    props.onAlwaysOnTopChange(next);
    if (isTauri()) {
      await invoke('set_always_on_top', { onTop: next });
    }
  };

  const handleStealth = async () => {
    const next = !props.stealthMode;
    props.onStealthModeChange(next);
    if (next) {
      props.onOpacityChange(0.3);
      props.onAlwaysOnTopChange(true);
    } else {
      props.onOpacityChange(0.5);
      props.onAlwaysOnTopChange(false);
    }
    if (isTauri()) {
      await invoke('set_stealth_mode', { stealth: next });
      if (next) {
        await invoke('set_always_on_top', { onTop: true });
      } else {
        await invoke('set_always_on_top', { onTop: false });
      }
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={toggleBtnStyle}>
        设置
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={rowStyle}>
            <label>棋盘大小</label>
            <input
              type="number"
              min={5}
              max={25}
              value={props.boardSize}
              onChange={(e) => props.onBoardSizeChange(parseInt(e.target.value) || 9)}
              style={inputStyle}
            />
          </div>
          <div style={rowStyle}>
            <label>贴目</label>
            <input
              type="number"
              step={0.5}
              value={props.komi}
              onChange={(e) => props.onKomiChange(parseFloat(e.target.value) || 7.5)}
              style={inputStyle}
            />
          </div>
          <div style={rowStyle}>
            <label>模式</label>
            <select
              value={props.gameMode}
              onChange={(e) => props.onGameModeChange(e.target.value as 'local' | 'ai' | 'network')}
              style={{ ...inputStyle, width: 120 }}
            >
              <option value="local">本地对弈</option>
              <option value="ai">人机对战</option>
              <option value="network">联机</option>
            </select>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={rowStyle}>
            <label>置顶</label>
            <button onClick={handlePin} style={{ ...smallBtnStyle, background: props.alwaysOnTop ? '#dff2df' : '#fff', borderColor: props.alwaysOnTop ? '#9bc79b' : '#ccc', color: props.alwaysOnTop ? '#2f6b2f' : '#444' }}>
              {props.alwaysOnTop ? '开' : '关'}
            </button>
            <label style={{ marginLeft: 8 }}>隐身模式</label>
            <button onClick={handleStealth} style={{ ...smallBtnStyle, background: props.stealthMode ? '#f7e3d6' : '#fff', borderColor: props.stealthMode ? '#d8ab8f' : '#ccc', color: props.stealthMode ? '#9a4f1a' : '#444' }}>
              {props.stealthMode ? '开' : '关'}
            </button>
          </div>
          <div style={rowStyle}>
            <label>棋盘颜色</label>
            <input
              type="color"
              value={props.boardColor}
              onChange={(e) => props.onBoardColorChange(e.target.value)}
              disabled={props.boardTransparent}
              style={{ width: 28, height: 24, border: '1px solid #e3e3e3', borderRadius: 8, padding: 0, cursor: 'pointer' }}
            />
            <button
              onClick={() => props.onBoardTransparentChange(!props.boardTransparent)}
              style={{ ...smallBtnStyle, background: props.boardTransparent ? '#dff2df' : '#fff', borderColor: props.boardTransparent ? '#9bc79b' : '#ccc', color: props.boardTransparent ? '#2f6b2f' : '#444' }}
            >
              {props.boardTransparent ? '透明' : '不透明'}
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
          <div style={rowStyle}>
            <label>透明度</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={props.opacity}
              onChange={(e) => props.onOpacityChange(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 140 }}
            />
            <span style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{Math.round(props.opacity * 100)}%</span>
          </div>
          {props.gameMode === 'ai' && (
            <div style={rowStyle}>
              <label>AI 模拟次数</label>
              <input
                type="range"
                min={500}
                max={5000}
                step={500}
                value={props.aiDifficulty}
                onChange={(e) => props.onAiDifficultyChange(parseInt(e.target.value))}
                style={{ flex: 1, minWidth: 140 }}
              />
              <span style={{ fontSize: 11, width: 40, textAlign: 'right' }}>{props.aiDifficulty}</span>
            </div>
          )}
          {props.gameMode === 'ai' && (
            <div style={aiHintStyle}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>AI 引擎说明</div>
              <div>9 路：内置 Moka（无需安装）</div>
              {props.boardSize === 9 ? (
                <div style={{ color: '#666' }}>其他路数需安装 Pachi</div>
              ) : pachiAvailable ? (
                <div style={{ color: '#2f6b2f' }}>{props.boardSize} 路：Pachi 已就绪</div>
              ) : (
                <>
                  <div style={{ color: '#9a4f1a' }}>
                    {props.boardSize} 路：未检测到 Pachi，当前将使用较慢的 MCTS
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
          )}
        </div>

        <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
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
              {recording ? '按下快捷键...' : shortcutDisplay(props.bossKey)}
            </button>
            {props.bossKey !== 'CommandOrControl+Shift+H' && (
              <button onClick={() => props.onBossKeyChange('CommandOrControl+Shift+H')} style={smallBtnStyle}>
                默认
              </button>
            )}
            <span style={{ fontSize: 11, color: '#999' }}>
              {props.bossKeyTriggerAt ? `已触发: ${new Date(props.bossKeyTriggerAt).toLocaleTimeString()}` : ''}
            </span>
          </div>
          {bossKeyError && (
            <div style={{ fontSize: 11, color: '#c0392b', marginTop: 2 }}>
              {bossKeyError}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <button onClick={props.onNewGame} style={{ ...smallBtnStyle, flex: '1 1 120px' }}>新对局</button>
        <button onClick={() => setOpen(false)} style={{ ...smallBtnStyle, flex: '1 1 120px' }}>关闭</button>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#ffffff',
  padding: 12,
  borderRadius: 12,
  border: '1px solid #e8e8e8',
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12,
  color: '#333',
  flexShrink: 0,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  padding: '4px 0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 10,
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

const toggleBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  alignSelf: 'flex-start',
  marginTop: 6,
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
