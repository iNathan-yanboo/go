# GG Relay Server

Standalone WebSocket relay server for online Go games.

## Deploy

```bash
# Requires Node.js 18+
npm install
PORT=9080 npm start
```

Environment variables:
- `PORT` - listening port (default: 9080)

## Protocol

1. Client connects via WebSocket
2. First message is the room ID (plain text)
3. Server relays all subsequent messages to the other client in the same room
4. Max 2 clients per room; extra clients receive "room_full" and are disconnected
