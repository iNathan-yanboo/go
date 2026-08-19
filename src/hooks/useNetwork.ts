import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { GameClient } from '../network/client';
import { NetMessage, encode, decode } from '../network/protocol';
import { GameState, BLACK, WHITE } from '../game/types';
import { playMove, pass, resign } from '../game/engine';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function isTauri() {
  return !!(window as any).__TAURI_INTERNALS__;
}

function normalizeServerUrl(address: string): string {
  const normalized = address.trim().replace(/：/g, ':');
  if (!normalized) return '';

  let url = normalized;
  if (/^https?:\/\//i.test(url)) {
    url = url.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  } else if (!/^wss?:\/\//i.test(url)) {
    url = `ws://${url}`;
  }
  return url;
}

interface UseNetworkReturn {
  status: ConnectionStatus;
  myColor: typeof BLACK | typeof WHITE | null;
  hostGame: (port: number, roomId: string) => Promise<void>;
  joinGame: (address: string, roomId: string) => Promise<void>;
  disconnect: () => void;
  sendMove: (x: number, y: number) => void;
  sendPass: () => void;
  sendResign: () => void;
  errorMsg: string;
}

export function useNetwork(
  state: GameState,
  setState: React.Dispatch<React.SetStateAction<GameState>>,
): UseNetworkReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [myColor, setMyColor] = useState<typeof BLACK | typeof WHITE | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const clientRef = useRef<GameClient | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearListeners = useCallback(() => {
    unlistenRef.current.forEach((u) => u());
    unlistenRef.current = [];
  }, []);

  const handleMessage = useCallback((msg: NetMessage) => {
    const s = stateRef.current;
    switch (msg.type) {
      case 'move': {
        const next = playMove(s, msg.x, msg.y);
        if (next) setState(next);
        break;
      }
      case 'pass':
        setState(pass(s));
        break;
      case 'resign':
        setState(resign(s));
        break;
    }
  }, [setState]);

  const handleRawMessage = useCallback((data: string) => {
    if (data === 'room_full') {
      setStatus('error');
      setErrorMsg('房间已满');
      return true;
    }
    const msg = decode(data);
    if (msg) {
      if (msg.type === 'error' && msg.message === 'room_full') {
        setStatus('error');
        setErrorMsg('房间已满');
        return true;
      }
      handleMessage(msg);
    }
    return false;
  }, [handleMessage]);

  const disconnect = useCallback((clearError = true) => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    clearListeners();
    if (isTauri()) {
      invoke('ws_disconnect').catch(() => {});
    }
    setStatus('disconnected');
    setMyColor(null);
    if (clearError) setErrorMsg('');
  }, [clearListeners]);

  const connectToServer = useCallback(async (url: string, roomId: string, color: typeof BLACK | typeof WHITE) => {
    disconnect();
    setStatus('connecting');
    setErrorMsg('');

    let settled = false;
    let closeReason: 'normal' | 'error' = 'normal';

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      closeReason = 'error';
      setStatus('error');
      setErrorMsg(`${msg} (${url})`);
      setMyColor(null);
      disconnect(false);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      setMyColor(color);
      setStatus('connected');
    };

    const timer = window.setTimeout(() => {
      fail('连接超时，请检查服务器地址、端口和安全组是否放行');
    }, 10000);

    const finishTimer = () => clearTimeout(timer);

    if (isTauri()) {
      try {
        const unsubs = await Promise.all([
          listen('ws-open', () => {
            finishTimer();
            succeed();
          }),
          listen<string>('ws-message', (event) => {
            handleRawMessage(event.payload);
          }),
          listen<string>('ws-error', (event) => {
            finishTimer();
            fail(event.payload || '连接失败，无法访问服务器');
          }),
          listen('ws-close', () => {
            finishTimer();
            if (closeReason === 'error') return;
            if (!settled) {
              fail('连接已断开，服务器可能未启动或端口未开放');
              return;
            }
            setStatus('disconnected');
            setMyColor(null);
          }),
        ]);
        unlistenRef.current = unsubs;
        await invoke('ws_connect', { url, roomId });
      } catch (e) {
        finishTimer();
        fail(String(e));
      }
      return;
    }

    const client = new GameClient(url);
    clientRef.current = client;

    client.onOpen = () => {
      finishTimer();
      client.sendRaw(roomId);
      succeed();
    };

    client.onMessage = (msg) => handleMessage(msg);
    client.onRawMessage = (data) => handleRawMessage(data);

    client.onError = () => {
      // 浏览器里 error 可能误报，最终以 close/timeout 为准
    };

    client.onClose = () => {
      finishTimer();
      if (closeReason === 'error') return;
      if (!settled) {
        fail('连接已断开，服务器可能未启动或端口未开放');
        return;
      }
      setStatus('disconnected');
      setMyColor(null);
      clientRef.current = null;
    };

    client.connect();
  }, [disconnect, handleMessage, handleRawMessage]);

  const hostGame = useCallback(async (port: number, roomId: string) => {
    try {
      await invoke('start_ws_server', { port });
    } catch (e: any) {
      if (!String(e).includes('already running')) {
        setErrorMsg(String(e));
        setStatus('error');
        return;
      }
    }
    await connectToServer(`ws://127.0.0.1:${port}`, roomId, BLACK);
  }, [connectToServer]);

  const joinGame = useCallback(async (address: string, roomId: string) => {
    const url = normalizeServerUrl(address);
    if (!url) {
      setStatus('error');
      setErrorMsg('地址不能为空');
      return;
    }
    await connectToServer(url, roomId, WHITE);
  }, [connectToServer]);

  const sendMove = useCallback((x: number, y: number) => {
    if (isTauri()) {
      invoke('ws_send', { message: encode({ type: 'move', x, y }) }).catch(() => {});
      return;
    }
    clientRef.current?.send({ type: 'move', x, y });
  }, []);

  const sendPass = useCallback(() => {
    if (isTauri()) {
      invoke('ws_send', { message: encode({ type: 'pass' }) }).catch(() => {});
      return;
    }
    clientRef.current?.send({ type: 'pass' });
  }, []);

  const sendResign = useCallback(() => {
    if (isTauri()) {
      invoke('ws_send', { message: encode({ type: 'resign' }) }).catch(() => {});
      return;
    }
    clientRef.current?.send({ type: 'resign' });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { status, myColor, hostGame, joinGame, disconnect, sendMove, sendPass, sendResign, errorMsg };
}
