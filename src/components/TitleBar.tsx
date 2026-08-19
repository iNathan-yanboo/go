import { getCurrentWindow } from '@tauri-apps/api/window';

function getWin() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export default function TitleBar() {
  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    getWin()?.startDragging();
  };

  return (
    <div
      onMouseDown={handleDrag}
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        background: '#f8f8f8',
        borderBottom: '1px solid #ddd',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 12, color: '#555', pointerEvents: 'none' }}>Memo</span>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 6 }}
      >
        <TitleBtn label="-" onClick={(e) => { e.stopPropagation(); getWin()?.minimize(); }} />
        <TitleBtn label="v" onClick={(e) => { e.stopPropagation(); getWin()?.hide(); }} title="隐藏到托盘" />
        <TitleBtn label="x" onClick={(e) => { e.stopPropagation(); getWin()?.close(); }} title="关闭" />
      </div>
    </div>
  );
}

function TitleBtn({ label, onClick, title }: { label: string; onClick: (e: React.MouseEvent) => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 24,
        height: 24,
        border: '1px solid #ddd',
        background: '#fff',
        color: '#555',
        fontSize: 14,
        cursor: 'pointer',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
    >
      {label}
    </button>
  );
}
