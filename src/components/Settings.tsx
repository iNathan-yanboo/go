import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
}

export default function Settings(props: SettingsProps) {
  const [opacity, setOpacity] = useState(0.5);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [stealthMode, setStealthMode] = useState(false);
  const [open, setOpen] = useState(false);

  const handleOpacity = (v: number) => {
    setOpacity(v);
    document.documentElement.style.opacity = String(v);
  };

  useEffect(() => {
    handleOpacity(0.5);
  }, []);

  const handlePin = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    if (isTauri()) {
      await invoke('set_always_on_top', { onTop: next });
    }
  };

  const handleStealth = async () => {
    const next = !stealthMode;
    setStealthMode(next);
    if (next) {
      handleOpacity(0.3);
      setAlwaysOnTop(true);
    } else {
      handleOpacity(0.5);
      setAlwaysOnTop(false);
    }
    if (isTauri()) {
      await invoke('set_stealth_mode', { stealth: next });
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
          onChange={(e) => props.onKomiChange(parseFloat(e.target.value) || 6.5)}
          style={inputStyle}
        />
      </div>

      <div style={rowStyle}>
        <label>模式</label>
        <select
          value={props.gameMode}
          onChange={(e) => props.onGameModeChange(e.target.value as 'local' | 'ai' | 'network')}
          style={inputStyle}
        >
          <option value="local">本地对弈</option>
          <option value="ai">人机对战</option>
          <option value="network">联机</option>
        </select>
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
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 11, width: 40, textAlign: 'right' }}>{props.aiDifficulty}</span>
        </div>
      )}

      <div style={rowStyle}>
        <label>透明度</label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => handleOpacity(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{Math.round(opacity * 100)}%</span>
      </div>

      <div style={rowStyle}>
        <label>置顶</label>
        <button onClick={handlePin} style={{ ...smallBtnStyle, background: alwaysOnTop ? '#dff2df' : '#fff', borderColor: alwaysOnTop ? '#9bc79b' : '#ccc', color: alwaysOnTop ? '#2f6b2f' : '#444' }}>
          {alwaysOnTop ? '开' : '关'}
        </button>
      </div>

      <div style={rowStyle}>
        <label>隐身模式</label>
        <button onClick={handleStealth} style={{ ...smallBtnStyle, background: stealthMode ? '#f7e3d6' : '#fff', borderColor: stealthMode ? '#d8ab8f' : '#ccc', color: stealthMode ? '#9a4f1a' : '#444' }}>
          {stealthMode ? '开' : '关'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={props.onNewGame} style={smallBtnStyle}>新对局</button>
        <button onClick={() => setOpen(false)} style={smallBtnStyle}>关闭</button>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#f8f8f8',
  padding: 10,
  borderRadius: 6,
  border: '1px solid #ddd',
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
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  width: 60,
  background: '#fff',
  border: '1px solid #ccc',
  color: '#333',
  borderRadius: 3,
  padding: '2px 4px',
  fontSize: 12,
};

const smallBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid #ccc',
  borderRadius: 3,
  background: '#fff',
  color: '#444',
  fontSize: 11,
  cursor: 'pointer',
};

const toggleBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  alignSelf: 'flex-start',
  margin: 4,
};
