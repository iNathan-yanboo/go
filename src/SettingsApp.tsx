import { useCallback, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import TitleBar from './components/TitleBar';
import SettingsPanel from './components/SettingsPanel';
import { AppSettings, getInitialSettings, saveSettings } from './utils/settingsStorage';
import { startWindowDrag } from './utils/windowDrag';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

async function emitSettings(settings: AppSettings) {
  if (!isTauri()) return;
  const { emit } = await import('@tauri-apps/api/event');
  await emit('gg-settings-updated', settings);
}

async function emitNewGame() {
  if (!isTauri()) return;
  const { emit } = await import('@tauri-apps/api/event');
  await emit('gg-new-game');
}

export default function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings>(() => getInitialSettings());

  const handleChange = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      emitSettings(next);
      return next;
    });
  }, []);

  const handleClose = () => {
    if (isTauri()) {
      getCurrentWindow().close();
    } else {
      window.close();
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', padding: 2, background: 'transparent' }}>
      <div
        onMouseDown={startWindowDrag}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          overflow: 'hidden',
          borderRadius: 12,
          color: '#333',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        <TitleBar title="设置" />
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <SettingsPanel
            settings={settings}
            onChange={handleChange}
            onNewGame={() => { emitNewGame(); }}
          />
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #eee', flexShrink: 0 }}>
          <button onClick={handleClose} style={closeBtnStyle}>关闭</button>
        </div>
      </div>
    </div>
  );
}

const closeBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #e3e3e3',
  borderRadius: 8,
  background: '#fbfbfb',
  color: '#333',
  fontSize: 12,
  cursor: 'pointer',
};
