#!/bin/bash
# 围棋中转服务器一键部署脚本
# 支持 Ubuntu/Debian/CentOS，需要 root 或 sudo 权限
# 用法: curl -sL <url>/deploy.sh | bash
#   或: chmod +x deploy.sh && ./deploy.sh

set -e

PORT="${PORT:-9080}"
APP_DIR="/opt/gg-relay"
SERVICE_NAME="gg-relay"

echo "=== 围棋中转服务器一键部署 ==="
echo "端口: $PORT (可通过 PORT=xxxx ./deploy.sh 修改)"

# 检测包管理器
if command -v apt-get &>/dev/null; then
  PKG="apt-get"
elif command -v yum &>/dev/null; then
  PKG="yum"
else
  echo "不支持的系统，请手动安装 Node.js"
  exit 1
fi

# 安装 Node.js (如果不存在)
if ! command -v node &>/dev/null; then
  echo ">>> 安装 Node.js..."
  if [ "$PKG" = "apt-get" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
    sudo yum install -y nodejs
  fi
fi

echo "Node.js 版本: $(node -v)"

# 创建应用目录
sudo mkdir -p "$APP_DIR"

# 复制文件（如果从项目目录运行）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/relay.js" ]; then
  sudo cp "$SCRIPT_DIR/relay.js" "$APP_DIR/"
  sudo cp "$SCRIPT_DIR/package.json" "$APP_DIR/"
else
  # 内联创建 relay.js
  sudo tee "$APP_DIR/relay.js" > /dev/null << 'RELAY_EOF'
const { WebSocketServer, WebSocket } = require('ws');
const PORT = parseInt(process.env.PORT || '9080', 10);
const rooms = new Map();
const wss = new WebSocketServer({ port: PORT });
wss.on('listening', () => console.log(`Relay server listening on port ${PORT}`));
wss.on('connection', (ws) => {
  let roomId = null;
  ws.on('message', (data) => {
    const msg = data.toString();
    if (roomId === null) {
      roomId = msg;
      let room = rooms.get(roomId);
      if (!room) { room = new Set(); rooms.set(roomId, room); }
      if (room.size >= 2) { ws.send('room_full'); ws.close(); return; }
      room.add(ws);
      return;
    }
    const room = rooms.get(roomId);
    if (!room) return;
    for (const client of room) {
      if (client !== ws && client.readyState === WebSocket.OPEN) client.send(msg);
    }
  });
  ws.on('close', () => {
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) { room.delete(ws); if (room.size === 0) rooms.delete(roomId); }
    }
  });
});
RELAY_EOF

  sudo tee "$APP_DIR/package.json" > /dev/null << 'PKG_EOF'
{"name":"gg-relay-server","version":"1.0.0","main":"relay.js","scripts":{"start":"node relay.js"},"dependencies":{"ws":"^8.18.0"}}
PKG_EOF
fi

# 安装依赖
cd "$APP_DIR"
sudo npm install --production

# 创建 systemd 服务
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=GG Relay Server
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
ExecStart=$(which node) ${APP_DIR}/relay.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

# 开放防火墙端口
if command -v ufw &>/dev/null; then
  sudo ufw allow ${PORT}/tcp 2>/dev/null || true
elif command -v firewall-cmd &>/dev/null; then
  sudo firewall-cmd --permanent --add-port=${PORT}/tcp 2>/dev/null || true
  sudo firewall-cmd --reload 2>/dev/null || true
fi

echo ""
echo "=== 部署完成 ==="
echo "服务状态:"
sudo systemctl status ${SERVICE_NAME} --no-pager -l
echo ""
echo "客户端连接地址: ws://你的服务器IP:${PORT}"
echo ""
echo "常用命令:"
echo "  查看状态: sudo systemctl status ${SERVICE_NAME}"
echo "  查看日志: sudo journalctl -u ${SERVICE_NAME} -f"
echo "  重启服务: sudo systemctl restart ${SERVICE_NAME}"
echo "  停止服务: sudo systemctl stop ${SERVICE_NAME}"
