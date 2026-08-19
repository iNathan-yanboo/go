import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GameClient } from '../network/client';
import { NetMessage } from '../network/protocol';
import { GameState, BLACK, WHITE } from '../game/types';
import { playMove, pass, resign } from '../game/engine';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

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
  const stateRef = useRef(state);
  stateRef.current = state;

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

  const connectToServer = useCallback((url: string, roomId: string, color: typeof BLACK | typeof WHITE) => {
    const client = new GameClient(url);
    clientRef.current = client;
    setStatus('connecting');
    setErrorMsg('');

    client.onOpen = () => {
      client.sendRaw(roomId);
      setMyColor(color);
      setStatus('connected');
    };

    client.onMessage = (msg) => {
      if (msg.type === 'error' && msg.message === 'room_full') {
        setStatus('error');
        setErrorMsg('Room is full');
        client.disconnect();
        return;
      }
      handleMessage(msg);
    };

    client.onRawMessage = (data) => {
      if (data === 'room_full') {
        setStatus('error');
        setErrorMsg('Room is full');
        client.disconnect();
      }
    };

    client.onClose = () => {
      if (status !== 'error') setStatus('disconnected');
    };

    client.connect();
  }, [handleMessage, status]);

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
    connectToServer(`ws://127.0.0.1:${port}`, roomId, BLACK);
  }, [connectToServer]);

  const joinGame = useCallback(async (address: string, roomId: string) => {
    const url = address.startsWith('ws://') ? address : `ws://${address}`;
    connectToServer(url, roomId, WHITE);
  }, [connectToServer]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus('disconnected');
    setMyColor(null);
    setErrorMsg('');
  }, []);

  const sendMove = useCallback((x: number, y: number) => {
    clientRef.current?.send({ type: 'move', x, y });
  }, []);

  const sendPass = useCallback(() => {
    clientRef.current?.send({ type: 'pass' });
  }, []);

  const sendResign = useCallback(() => {
    clientRef.current?.send({ type: 'resign' });
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return { status, myColor, hostGame, joinGame, disconnect, sendMove, sendPass, sendResign, errorMsg };
}
