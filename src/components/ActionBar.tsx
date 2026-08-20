import { invoke } from '@tauri-apps/api/core';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

interface ActionBarProps {
  onNewGame: () => void;
}

export default function ActionBar({ onNewGame }: ActionBarProps) {
  const openSettings = async () => {
    if (isTauri()) {
      await invoke('open_settings');
      return;
    }
    window.open('/settings.html', 'gg-settings', 'width=400,height=560');
  };

  return (
    <div style={barStyle}>
      <button onClick={openSettings} style={btnStyle}>设置</button>
      <button onClick={onNewGame} style={btnStyle}>新对局</button>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '6px 8px 0',
  flexShrink: 0,
};

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e3e3e3',
  borderRadius: 8,
  background: '#fbfbfb',
  color: '#333',
  fontSize: 12,
  cursor: 'pointer',
};
