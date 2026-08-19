export type NetMessage =
  | { type: 'join'; roomId: string; color: 'black' | 'white' }
  | { type: 'move'; x: number; y: number }
  | { type: 'pass' }
  | { type: 'resign' }
  | { type: 'sync'; state: unknown }
  | { type: 'chat'; text: string }
  | { type: 'error'; message: string };

export function encode(msg: NetMessage): string {
  return JSON.stringify(msg);
}

export function decode(data: string): NetMessage | null {
  try {
    return JSON.parse(data) as NetMessage;
  } catch {
    return null;
  }
}
