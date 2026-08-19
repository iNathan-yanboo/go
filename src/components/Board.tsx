import { useRef, useEffect, useCallback, useState } from 'react';
import { GameState, BLACK, EMPTY, Position } from '../game/types';
import { isValidMove } from '../game/engine';

interface BoardProps {
  state: GameState;
  onPlace: (x: number, y: number) => void;
  disabled?: boolean;
}

const BOARD_COLOR = '#E8E0D0';
const LINE_COLOR = '#AAA';
const BLACK_COLOR = '#111';
const WHITE_COLOR = '#f0f0f0';


export default function Board({ state, onPlace, disabled }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Position | null>(null);
  const [canvasSize, setCanvasSize] = useState(500);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize(Math.min(width, height));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const padding = canvasSize * 0.06;
  const cellSize = (canvasSize - padding * 2) / (state.size - 1 || 1);
  const stoneRadius = cellSize * 0.44;

  const posToCoord = useCallback((px: number, py: number): Position | null => {
    const x = Math.round((px - padding) / cellSize);
    const y = Math.round((py - padding) / cellSize);
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return null;
    return { x, y };
  }, [padding, cellSize, state.size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i < state.size; i++) {
      const pos = padding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + (state.size - 1) * cellSize, pos);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + (state.size - 1) * cellSize);
      ctx.stroke();
    }

    const starPoints = getStarPoints(state.size);
    for (const sp of starPoints) {
      ctx.beginPath();
      ctx.arc(padding + sp.x * cellSize, padding + sp.y * cellSize, cellSize * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = LINE_COLOR;
      ctx.fill();
    }

    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const s = state.board[y][x];
        if (s === EMPTY) continue;
        const cx = padding + x * cellSize;
        const cy = padding + y * cellSize;
        ctx.beginPath();
        ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2);
        ctx.fillStyle = s === BLACK ? BLACK_COLOR : WHITE_COLOR;
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    if (state.lastMove) {
      const cx = padding + state.lastMove.x * cellSize;
      const cy = padding + state.lastMove.y * cellSize;
      const markColor = state.board[state.lastMove.y][state.lastMove.x] === BLACK ? WHITE_COLOR : BLACK_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, stoneRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = markColor;
      ctx.fill();
    }

    if (hover && !disabled && isValidMove(state, hover.x, hover.y)) {
      const cx = padding + hover.x * cellSize;
      const cy = padding + hover.y * cellSize;
      ctx.beginPath();
      ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2);
      ctx.fillStyle = state.currentPlayer === BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
  }, [state, canvasSize, hover, disabled, padding, cellSize, stoneRadius]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = posToCoord(e.clientX - rect.left, e.clientY - rect.top);
    if (pos) onPlace(pos.x, pos.y);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    setHover(posToCoord(e.clientX - rect.left, e.clientY - rect.top));
  };

  return (
    <div ref={containerRef} style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, background: '#f8f8f8' }}>
      <canvas
        ref={canvasRef}
        style={{ width: canvasSize, height: canvasSize, cursor: disabled ? 'default' : 'pointer', borderRadius: 4, boxShadow: '0 0 0 1px #ddd' }}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      />
    </div>
  );
}

function getStarPoints(size: number): Position[] {
  if (size < 9) return [];
  const pts: Position[] = [];
  const edge = size >= 13 ? 3 : 2;
  const mid = Math.floor(size / 2);
  const coords = [edge];
  if (size >= 13) coords.push(mid);
  coords.push(size - 1 - edge);

  for (const y of coords) {
    for (const x of coords) {
      pts.push({ x, y });
    }
  }
  return pts;
}
