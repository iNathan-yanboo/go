import { NetMessage, encode, decode } from './protocol';

export class GameClient {
  private ws: WebSocket | null = null;
  private url: string;
  public onMessage: ((msg: NetMessage) => void) | null = null;
  public onRawMessage: ((data: string) => void) | null = null;
  public onClose: (() => void) | null = null;
  public onOpen: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.onOpen?.();
    this.ws.onclose = () => this.onClose?.();
    this.ws.onmessage = (e) => {
      const msg = decode(e.data);
      if (msg) this.onMessage?.(msg);
      else this.onRawMessage?.(e.data);
    };
  }

  send(msg: NetMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encode(msg));
    }
  }

  sendRaw(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
