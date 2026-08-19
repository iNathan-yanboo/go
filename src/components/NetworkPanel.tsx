import { useState } from 'react';
import { ConnectionStatus } from '../hooks/useNetwork';
import { BLACK, WHITE } from '../game/types';

interface NetworkPanelProps {
  status: ConnectionStatus;
  myColor: typeof BLACK | typeof WHITE | null;
  errorMsg: string;
  onHost: (port: number, roomId: string) => void;
  onJoin: (address: string, roomId: string) => void;
  onDisconnect: () => void;
}

export default function NetworkPanel({ status, myColor, errorMsg, onHost, onJoin, onDisconnect }: NetworkPanelProps) {
  const [roomId, setRoomId] = useState('room1');
  const [address, setAddress] = useState('');
  const [port, setPort] = useState(9876);

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: statusColor(status) }}>
          {status === 'connected' ? `已连接 - 你是: ${myColor === BLACK ? '黑棋' : '白棋'}` :
           status === 'connecting' ? '连接中...' :
           status === 'error' ? `错误: ${errorMsg}` : '未连接'}
        </span>
      </div>

      {!connected && !connecting && (
        <>
          <div style={rowStyle}>
            <label>房间</label>
            <input value={roomId} onChange={e => setRoomId(e.target.value)} style={inputStyle} placeholder="room1" />
          </div>

          <div style={rowStyle}>
            <label>端口</label>
            <input type="number" value={port} onChange={e => setPort(+e.target.value || 9876)} style={{ ...inputStyle, width: 55 }} />
            <button style={btnStyle} onClick={() => onHost(port, roomId)}>创建房间</button>
          </div>

          <div style={rowStyle}>
            <label>IP:Port</label>
            <input value={address} onChange={e => setAddress(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="192.168.1.2:9876" />
            <button style={btnStyle} onClick={() => onJoin(address || `127.0.0.1:${port}`, roomId)}>加入</button>
          </div>
        </>
      )}

      {(connected || connecting) && (
        <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#999' }}>{connecting ? '正在建立连接' : '对局进行中'}</span>
          <button style={disconnectBtnStyle} onClick={onDisconnect}>断开</button>
        </div>
      )}
    </div>
  );
}

function statusColor(s: ConnectionStatus) {
  switch (s) {
    case 'connected': return '#4CAF50';
    case 'connecting': return '#FFA726';
    case 'error': return '#EF5350';
    default: return '#888';
  }
}

const panelStyle: React.CSSProperties = {
  background: '#f8f8f8',
  padding: 8,
  borderRadius: 6,
  border: '1px solid #ddd',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: 12,
  color: '#333',
  flexShrink: 0,
};

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };

const inputStyle: React.CSSProperties = {
  width: 60, background: '#fff', border: '1px solid #ccc', color: '#333',
  borderRadius: 3, padding: '2px 4px', fontSize: 12,
};

const btnStyle: React.CSSProperties = {
  padding: '3px 8px', border: '1px solid #ccc', borderRadius: 3,
  background: '#fff', color: '#444', fontSize: 11, cursor: 'pointer',
};

const disconnectBtnStyle: React.CSSProperties = {
  padding: '1px 6px',
  border: '1px solid #ddd',
  borderRadius: 4,
  background: '#fafafa',
  color: '#888',
  fontSize: 10,
  cursor: 'pointer',
  lineHeight: 1.4,
};
