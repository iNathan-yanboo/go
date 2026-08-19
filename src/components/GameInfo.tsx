import { GameState, BLACK, WHITE, EMPTY } from '../game/types';

interface GameInfoProps {
  state: GameState;
  onPass: () => void;
  onResign: () => void;
  disabled?: boolean;
}

export default function GameInfo({ state, onPass, onResign, disabled }: GameInfoProps) {
  const colorName = (c: number) => (c === BLACK ? '黑棋' : c === WHITE ? '白棋' : '平局');

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: state.currentPlayer === BLACK ? '#111' : '#f0f0f0', border: '1px solid #666' }} />
        <span>{state.isOver ? '对局结束' : `${colorName(state.currentPlayer)}走`}</span>
        <span style={{ fontSize: 11, color: '#777' }}>第 {state.moveCount} 手</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666' }}>
        <span>黑提: {state.captures[BLACK]}</span>
        <span>白提: {state.captures[WHITE]}</span>
        <span>贴目: {state.komi}</span>
      </div>
      {state.isOver && state.territory && (
        <div style={{ fontSize: 11, color: '#4f7a4f' }}>
          B: {state.territory[BLACK] + state.captures[BLACK]} | W: {state.territory[WHITE] + state.captures[WHITE] + state.komi}
          {' -> '}{state.winner === EMPTY ? '平局' : `${colorName(state.winner!)}胜`}
        </div>
      )}
      {!state.isOver && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onPass} disabled={disabled} style={btnStyle}>停一手</button>
          <button onClick={onResign} disabled={disabled} style={btnStyle}>认输</button>
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: '#f8f8f8',
  borderTop: '1px solid #e5e5e5',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#333',
  flexShrink: 0,
};

const btnStyle: React.CSSProperties = {
  padding: '2px 10px',
  border: '1px solid #d0d0d0',
  borderRadius: 3,
  background: '#fff',
  color: '#444',
  fontSize: 11,
  cursor: 'pointer',
};
