import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateTerritory } from '../game/engine';
import { GameState, BLACK, WHITE, EMPTY, Position } from '../game/types';

interface GameInfoProps {
  state: GameState;
  onPass: () => void;
  onResign: () => void;
  disabled?: boolean;
}

export default function GameInfo({ state, onPass, onResign, disabled }: GameInfoProps) {
  const [subtitle, setSubtitle] = useState('规则字幕：落子后会提示天元、提子、打劫等');
  const prevRef = useRef<GameState>(state);
  const colorName = (c: number) => (c === BLACK ? '黑棋' : c === WHITE ? '白棋' : '平局');
  const territoryNow = useMemo(() => calculateTerritory(state.board), [state.board]);
  const blackScoreNow = territoryNow[BLACK] + state.captures[BLACK];
  const whiteScoreNow = territoryNow[WHITE] + state.captures[WHITE] + state.komi;
  const scoreLeadText = blackScoreNow === whiteScoreNow
    ? '局势接近'
    : blackScoreNow > whiteScoreNow
      ? `黑棋约领先 ${Math.round((blackScoreNow - whiteScoreNow) * 10) / 10} 目`
      : `白棋约领先 ${Math.round((whiteScoreNow - blackScoreNow) * 10) / 10} 目`;

  useEffect(() => {
    const prev = prevRef.current;
    if (state === prev) return;

    const captureDiffBlack = state.captures[BLACK] - prev.captures[BLACK];
    const captureDiffWhite = state.captures[WHITE] - prev.captures[WHITE];
    const captureDiff = Math.max(captureDiffBlack, captureDiffWhite, 0);
    const moveText = state.lastMove ? describePoint(state.lastMove, state.size) : '';

    if (state.isOver && !prev.isOver) {
      if (state.territory) {
        const blackFinal = state.territory[BLACK] + state.captures[BLACK];
        const whiteFinal = state.territory[WHITE] + state.captures[WHITE] + state.komi;
        const winnerStone = state.winner ?? EMPTY;
        const winnerText = winnerStone === EMPTY ? '双方平局' : `${colorName(winnerStone)}获胜`;
        setSubtitle(`终局数目完成：黑 ${blackFinal}，白 ${whiteFinal}，${winnerText}`);
      } else {
        setSubtitle(`认输结束：${colorName(state.winner ?? EMPTY)}获胜`);
      }
      prevRef.current = state;
      return;
    }

    if (state.consecutivePasses > prev.consecutivePasses) {
      setSubtitle(state.consecutivePasses === 1 ? '本手停一手：通常是官子收束或试探应对' : '双方连续停一手：进入终局数目');
      prevRef.current = state;
      return;
    }

    if (state.lastMove && state.moveCount > prev.moveCount) {
      const parts = [`落子${moveText}`];
      const shape = describeShapeTerm(prev, state.lastMove);
      if (shape) parts.push(`，${shape}`);
      const special = describeSpecialPoint(state.lastMove, state.size);
      if (special) parts.push(`，${special}`);
      if (captureDiff > 0) parts.push(`，提子 ${captureDiff} 子`);
      if (state.koPoint) parts.push('，形成打劫');
      setSubtitle(parts.join(''));
    }

    prevRef.current = state;
  }, [state]);

  return (
    <div style={containerStyle}>
      <div style={row1Style}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flex: '0 1 auto' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: state.currentPlayer === BLACK ? '#111' : '#f0f0f0', border: '1px solid #666', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap' }}>{state.isOver ? '对局结束' : `${colorName(state.currentPlayer)}走`}</span>
          <span style={{ fontSize: 11, color: '#777', whiteSpace: 'nowrap' }}>第 {state.moveCount} 手</span>
        </div>
        <div style={subtitleStyle} title={subtitle}>{subtitle}</div>
      </div>
      <div style={row2Style}>
        <span>黑提: {state.captures[BLACK]}</span>
        <span>白提: {state.captures[WHITE]}</span>
        <span>贴目: {state.komi}</span>
        <span>盘面: 黑 {blackScoreNow} / 白 {Math.round(whiteScoreNow * 10) / 10}</span>
        <span>{scoreLeadText}</span>
      </div>
      <div style={row3Style}>
        {state.isOver && state.territory ? (
          <div style={{ fontSize: 11, color: '#4f7a4f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            B: {state.territory[BLACK] + state.captures[BLACK]} | W: {state.territory[WHITE] + state.captures[WHITE] + state.komi}
            {' -> '}{state.winner === EMPTY ? '平局' : `${colorName(state.winner!)}胜`}
          </div>
        ) : state.isOver ? (
          <div style={{ fontSize: 11, color: '#4f7a4f' }}>{colorName(state.winner ?? EMPTY)}胜</div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onPass} disabled={disabled} style={btnStyle}>停一手</button>
            <button onClick={onResign} disabled={disabled} style={btnStyle}>认输</button>
          </div>
        )}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: '#f8f8f8',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#333',
  flexShrink: 0,
  minHeight: 74,
};

const row1Style: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  minHeight: 20,
  overflow: 'hidden',
};

const row2Style: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  fontSize: 11,
  color: '#666',
  minHeight: 16,
};

const row3Style: React.CSSProperties = {
  minHeight: 26,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
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

const subtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#4d6275',
  flex: '1 1 0',
  minWidth: 0,
  textAlign: 'right',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
};

function describePoint(pos: Position, size: number): string {
  return `在 (${pos.x + 1}, ${size - pos.y})`;
}

function describeSpecialPoint(pos: Position, size: number): string | null {
  const mid = Math.floor(size / 2);
  if (size % 2 === 1 && pos.x === mid && pos.y === mid) return '落在天元';

  const edge = size >= 13 ? 3 : 2;
  const points = [edge, size - 1 - edge];
  if (size >= 13) points.push(mid);
  if (points.includes(pos.x) && points.includes(pos.y)) return '落在星位';
  return null;
}

function describeShapeTerm(prev: GameState, move: Position): string | null {
  const color = prev.currentPlayer;
  const anchor = findNearestOwnStone(prev, move, color);
  const opp = color === BLACK ? WHITE : BLACK;

  const cut = isCutMove(prev, move, opp);
  if (cut) return '棋形：断';

  const ponnuki = isAtariBlockStyle(prev, move, color, opp);
  if (ponnuki) return '棋形：扳';

  const tiger = isTigerMouthLike(prev, move, color);
  if (tiger) return '棋形：虎';

  if (!anchor) return null;

  const dx = Math.abs(move.x - anchor.x);
  const dy = Math.abs(move.y - anchor.y);
  const a = Math.max(dx, dy);
  const b = Math.min(dx, dy);

  if (a === 1 && b === 0) return '棋形：立';
  if (a === 1 && b === 1) return '棋形：尖';
  if (a === 2 && b === 0) return '棋形：关（跳）';
  if (a === 3 && b === 0) return '棋形：大跳';
  if (a === 2 && b === 1) return '棋形：小飞';
  if (a === 3 && b === 1) return '棋形：大飞';
  return null;
}

function findNearestOwnStone(
  prev: GameState,
  move: Position,
  color: typeof BLACK | typeof WHITE
): Position | null {
  let best: Position | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let y = 0; y < prev.size; y++) {
    for (let x = 0; x < prev.size; x++) {
      if (prev.board[y][x] !== color) continue;
      const dx = x - move.x;
      const dy = y - move.y;
      const d = dx * dx + dy * dy;
      if (d === 0) continue;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function isTigerMouthLike(prev: GameState, move: Position, color: typeof BLACK | typeof WHITE): boolean {
  const neighbors = orthNeighbors(move, prev.size)
    .filter((p) => prev.board[p.y][p.x] === color);
  if (neighbors.length < 2) return false;
  for (let i = 0; i < neighbors.length; i++) {
    for (let j = i + 1; j < neighbors.length; j++) {
      const a = neighbors[i];
      const b = neighbors[j];
      if (a.x !== b.x && a.y !== b.y) return true;
    }
  }
  return false;
}

function isAtariBlockStyle(
  prev: GameState,
  move: Position,
  color: typeof BLACK | typeof WHITE,
  opp: typeof BLACK | typeof WHITE
): boolean {
  const own = orthNeighbors(move, prev.size).filter((p) => prev.board[p.y][p.x] === color);
  const enemy = orthNeighbors(move, prev.size).filter((p) => prev.board[p.y][p.x] === opp);
  if (own.length === 0 || enemy.length === 0) return false;
  return own.some((o) => enemy.some((e) => o.x !== e.x && o.y !== e.y));
}

function isCutMove(prev: GameState, move: Position, opp: typeof BLACK | typeof WHITE): boolean {
  const enemies = orthNeighbors(move, prev.size).filter((p) => prev.board[p.y][p.x] === opp);
  if (enemies.length < 2) return false;
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      if (!isConnected(prev, enemies[i], enemies[j], opp, move)) {
        return true;
      }
    }
  }
  return false;
}

function isConnected(
  prev: GameState,
  a: Position,
  b: Position,
  color: typeof BLACK | typeof WHITE,
  blocked: Position
): boolean {
  const key = (p: Position) => `${p.x},${p.y}`;
  const seen = new Set<string>();
  const stack: Position[] = [a];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const k = key(cur);
    if (seen.has(k)) continue;
    seen.add(k);
    if (cur.x === b.x && cur.y === b.y) return true;
    for (const n of orthNeighbors(cur, prev.size)) {
      if (n.x === blocked.x && n.y === blocked.y) continue;
      if (prev.board[n.y][n.x] !== color) continue;
      stack.push(n);
    }
  }
  return false;
}

function orthNeighbors(pos: Position, size: number): Position[] {
  const out: Position[] = [];
  if (pos.x > 0) out.push({ x: pos.x - 1, y: pos.y });
  if (pos.x < size - 1) out.push({ x: pos.x + 1, y: pos.y });
  if (pos.y > 0) out.push({ x: pos.x, y: pos.y - 1 });
  if (pos.y < size - 1) out.push({ x: pos.x, y: pos.y + 1 });
  return out;
}
