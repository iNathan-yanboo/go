import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TitleBar from './components/TitleBar';
import Board from './components/Board';
import GameInfo from './components/GameInfo';
import Settings from './components/Settings';
import NetworkPanel from './components/NetworkPanel';
import { GameState, BLACK } from './game/types';
import { createGameState, playMove, pass, resign } from './game/engine';
import { getAIMove, terminateAI } from './game/ai';
import { useNetwork } from './hooks/useNetwork';
import { getInitialSettings, saveSettings } from './utils/settingsStorage';
import { startWindowDrag } from './utils/windowDrag';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

export default function App() {
  const initial = getInitialSettings();
  const [boardSize, setBoardSize] = useState(initial.boardSize);
  const [komi, setKomi] = useState(initial.komi);
  const [gameMode, setGameMode] = useState<'local' | 'ai' | 'network'>(initial.gameMode);
  const [aiDifficulty, setAiDifficulty] = useState(initial.aiDifficulty);
  const [state, setState] = useState<GameState>(() => createGameState(initial.boardSize, initial.komi));
  const [thinking, setThinking] = useState(false);
  const [boardColor, setBoardColor] = useState(initial.boardColor);
  const [boardTransparent, setBoardTransparent] = useState(initial.boardTransparent);
  const [bossKey, setBossKey] = useState(initial.bossKey);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [alwaysOnTop, setAlwaysOnTop] = useState(initial.alwaysOnTop);
  const [stealthMode, setStealthMode] = useState(initial.stealthMode);
  const [bossKeyTriggerAt, setBossKeyTriggerAt] = useState<number | null>(null);

  const net = useNetwork(state, setState);

  useEffect(() => {
    document.documentElement.style.opacity = String(initial.opacity);
    if (isTauri()) {
      invoke('set_always_on_top', { onTop: initial.alwaysOnTop }).catch(() => {});
      invoke('set_stealth_mode', { stealth: initial.stealthMode }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    saveSettings({
      boardSize,
      komi,
      gameMode,
      aiDifficulty,
      boardColor,
      boardTransparent,
      bossKey,
      opacity,
      alwaysOnTop,
      stealthMode,
    });
  }, [boardSize, komi, gameMode, aiDifficulty, boardColor, boardTransparent, bossKey, opacity, alwaysOnTop, stealthMode]);

  const handleOpacityChange = useCallback((v: number) => {
    setOpacity(v);
    document.documentElement.style.opacity = String(v);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    const key = bossKey;

    import('@tauri-apps/plugin-global-shortcut').then(async (mod) => {
      if (cancelled) return;
      try {
        // 防止多次切换快捷键导致注册残留
        try {
          await mod.unregister(key);
        } catch {}

        await mod.register(key, (event) => {
          if (event.state === 'Pressed') {
            console.log('[boss-key] triggered:', key, 'event=', event);
            setBossKeyTriggerAt(Date.now());
            import('@tauri-apps/api/core').then(({ invoke }) => {
              invoke('toggle_visible').catch((e) => {
                console.error('[boss-key] invoke toggle_visible failed:', e);
              });
            });
          }
        });

        try {
          const ok = await mod.isRegistered(key);
          console.log('[boss-key] registered:', key, 'ok=', ok);
        } catch {}
      } catch (e) {
        console.error('[boss-key] failed to register:', key, e);
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
      import('@tauri-apps/plugin-global-shortcut').then(async (mod) => {
        try {
          await mod.unregister(key);
        } catch {}
      }).catch(() => {});
    };
  }, [bossKey]);

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
      padding: 2,
      background: 'transparent',
    }}>
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
        boardColor={boardColor}
        onBoardColorChange={setBoardColor}
        boardTransparent={boardTransparent}
        onBoardTransparentChange={setBoardTransparent}
        bossKey={bossKey}
        onBossKeyChange={setBossKey}
        bossKeyTriggerAt={bossKeyTriggerAt}
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
        alwaysOnTop={alwaysOnTop}
        onAlwaysOnTopChange={setAlwaysOnTop}
        stealthMode={stealthMode}
        onStealthModeChange={setStealthMode}
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
      <Board state={state} onPlace={handlePlace} disabled={!isMyTurn || thinking || state.isOver} boardColor={boardColor} boardTransparent={boardTransparent} />
      <GameInfo state={state} onPass={handlePass} onResign={handleResign} disabled={!isMyTurn || thinking} />
      {thinking && <div style={{ textAlign: 'center', fontSize: 11, color: '#888', padding: 4 }}>AI 思考中...</div>}
      </div>
    </div>
  );
}
