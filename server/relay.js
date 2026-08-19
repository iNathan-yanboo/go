const { WebSocketServer, WebSocket } = require('ws');

const PORT = parseInt(process.env.PORT || '9080', 10);
const rooms = new Map();

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`Relay server listening on port ${PORT}`);
});

wss.on('connection', (ws) => {
  let roomId = null;

  ws.on('message', (data) => {
    const msg = data.toString();

    if (roomId === null) {
      roomId = msg;
      let room = rooms.get(roomId);
      if (!room) {
        room = new Set();
        rooms.set(roomId, room);
      }
      if (room.size >= 2) {
        ws.send('room_full');
        ws.close();
        return;
      }
      room.add(ws);
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;
    for (const client of room) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  ws.on('close', () => {
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) rooms.delete(roomId);
      }
    }
  });
});
