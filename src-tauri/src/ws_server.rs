use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{Mutex, RwLock};
use tokio_tungstenite::accept_async;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;
use tauri::command;

type Tx = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    Message,
>;

struct Room {
    clients: Vec<Arc<Mutex<Tx>>>,
}

struct ServerState {
    shutdown: Option<tokio::sync::oneshot::Sender<()>>,
}

static SERVER: std::sync::OnceLock<Arc<RwLock<Option<ServerState>>>> = std::sync::OnceLock::new();

fn server_state() -> &'static Arc<RwLock<Option<ServerState>>> {
    SERVER.get_or_init(|| Arc::new(RwLock::new(None)))
}

#[command]
pub async fn start_ws_server(port: u16) -> Result<String, String> {
    let state = server_state();
    {
        let guard = state.read().await;
        if guard.is_some() {
            return Err("Server already running".into());
        }
    }

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Bind failed: {}", e))?;

    let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    {
        let mut guard = state.write().await;
        *guard = Some(ServerState {
            shutdown: Some(shutdown_tx),
        });
    }

    let rooms: Arc<RwLock<HashMap<String, Arc<Mutex<Room>>>>> =
        Arc::new(RwLock::new(HashMap::new()));

    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => break,
                result = listener.accept() => {
                    if let Ok((stream, _)) = result {
                        let rooms = rooms.clone();
                        tokio::spawn(handle_connection(stream, rooms));
                    }
                }
            }
        }
    });

    Ok(format!("WebSocket server started on {}", addr))
}

#[command]
pub async fn stop_ws_server() -> Result<String, String> {
    let state = server_state();
    let mut guard = state.write().await;
    if let Some(mut s) = guard.take() {
        if let Some(tx) = s.shutdown.take() {
            let _ = tx.send(());
        }
        Ok("Server stopped".into())
    } else {
        Err("Server not running".into())
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    rooms: Arc<RwLock<HashMap<String, Arc<Mutex<Room>>>>>,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };

    let (tx, mut rx) = ws_stream.split();
    let tx = Arc::new(Mutex::new(tx));

    // First message from client is the room id
    let room_id = match rx.next().await {
        Some(Ok(Message::Text(text))) => text.to_string(),
        _ => return,
    };

    let room = {
        let mut map = rooms.write().await;
        let room = map
            .entry(room_id.clone())
            .or_insert_with(|| {
                Arc::new(Mutex::new(Room {
                    clients: Vec::new(),
                }))
            })
            .clone();
        room
    };

    {
        let mut r = room.lock().await;
        if r.clients.len() >= 2 {
            let mut sink = tx.lock().await;
            let _ = sink.send(Message::Text("room_full".into())).await;
            return;
        }
        r.clients.push(tx.clone());
    }

    while let Some(Ok(msg)) = rx.next().await {
        if msg.is_close() {
            break;
        }
        let r = room.lock().await;
        for client in &r.clients {
            if !Arc::ptr_eq(client, &tx) {
                let mut sink = client.lock().await;
                let _ = sink.send(msg.clone()).await;
            }
        }
    }

    // Remove client from room
    let mut r = room.lock().await;
    r.clients.retain(|c| !Arc::ptr_eq(c, &tx));
    if r.clients.is_empty() {
        drop(r);
        let mut map = rooms.write().await;
        map.remove(&room_id);
    }
}
