import { useState, useCallback, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Board from './components/Board';
import GameInfo from './components/GameInfo';
import Settings from './components/Settings';
import NetworkPanel from './components/NetworkPanel';
import { GameState, BLACK } from './game/types';
import { createGameState, playMove, pass, resign } from './game/engine';
import { getAIMove, terminateAI } from './game/ai';
import { useNetwork } from './hooks/useNetwork';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

export default function App() {
  const [boardSize, setBoardSize] = useState(9);
  const [komi, setKomi] = useState(6.5);
  const [gameMode, setGameMode] = useState<'local' | 'ai' | 'network'>('local');
  const [aiDifficulty, setAiDifficulty] = useState(2000);
  const [state, setState] = useState<GameState>(() => createGameState(9, 6.5));
  const [thinking, setThinking] = useState(false);

  const net = useNetwork(state, setState);

  useEffect(() => {
    if (!isTauri()) return;

    let unregister: (() => void) | undefined;

    import('@tauri-apps/plugin-global-shortcut').then(({ register, unregister: unreg }) => {
      register('Escape', () => {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('toggle_visible');
        });
      }).then(() => {
        unregister = () => { unreg('Escape').catch(() => {}); };
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      unregister?.();
    };
  }, []);

  const newGame = useCallback(() => {
    terminateAI();
    setState(createGameState(boardSize, komi));
    setThinking(false);
  }, [boardSize, komi]);

  const handlePlace = useCallback(async (x: number, y: number) => {
    if (thinking) return;

    if (gameMode === 'network') {
      if (!net.myColor || state.currentPlayer !== net.myColor) return;
      const next = playMove(state, x, y);
      if (!next) return;
      setState(next);
      net.sendMove(x, y);
      return;
    }

    const next = playMove(state, x, y);
    if (!next) return;
    setState(next);

    if (gameMode === 'ai' && !next.isOver) {
      setThinking(true);
      const move = await getAIMove(next, aiDifficulty);
      if (move) {
        const aiNext = playMove(next, move.x, move.y);
        if (aiNext) setState(aiNext);
      }
      setThinking(false);
    }
  }, [state, gameMode, aiDifficulty, thinking, net]);

  const handlePass = useCallback(() => {
    if (thinking) return;

    if (gameMode === 'network') {
      if (!net.myColor || state.currentPlayer !== net.myColor) return;
      setState(pass(state));
      net.sendPass();
      return;
    }

    const next = pass(state);
    setState(next);

    if (gameMode === 'ai' && !next.isOver) {
      setThinking(true);
      getAIMove(next, aiDifficulty).then((move) => {
        if (move) {
          const aiNext = playMove(next, move.x, move.y);
          if (aiNext) setState(aiNext);
          else setState(pass(next));
        } else {
          setState(pass(next));
        }
        setThinking(false);
      });
    }
  }, [state, gameMode, aiDifficulty, thinking, net]);

  const handleResign = useCallback(() => {
    if (thinking) return;

    if (gameMode === 'network') {
      if (!net.myColor || state.currentPlayer !== net.myColor) return;
      setState(resign(state));
      net.sendResign();
      return;
    }

    setState(resign(state));
  }, [state, thinking, gameMode, net]);

  const isMyTurn = gameMode === 'network'
    ? net.myColor !== null && state.currentPlayer === net.myColor
    : gameMode !== 'ai' || state.currentPlayer === BLACK;

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      overflow: 'hidden',
      borderRadius: 8,
      color: '#333',
    }}>
      <TitleBar />
      <Settings
        boardSize={boardSize}
        onBoardSizeChange={setBoardSize}
        komi={komi}
        onKomiChange={setKomi}
        gameMode={gameMode}
        onGameModeChange={setGameMode}
        aiDifficulty={aiDifficulty}
        onAiDifficultyChange={setAiDifficulty}
        onNewGame={newGame}
      />
      {gameMode === 'network' && (
        <NetworkPanel
          status={net.status}
          myColor={net.myColor}
          errorMsg={net.errorMsg}
          onHost={(port, roomId) => net.hostGame(port, roomId)}
          onJoin={(addr, roomId) => net.joinGame(addr, roomId)}
          onDisconnect={net.disconnect}
        />
      )}
      <Board state={state} onPlace={handlePlace} disabled={!isMyTurn || thinking || state.isOver} />
      <GameInfo state={state} onPass={handlePass} onResign={handleResign} disabled={!isMyTurn || thinking} />
      {thinking && <div style={{ textAlign: 'center', fontSize: 11, color: '#888', padding: 4 }}>AI 思考中...</div>}
    </div>
  );
}
