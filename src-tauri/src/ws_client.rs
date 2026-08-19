use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tauri::{async_runtime, AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::{connect_async, tungstenite::Message};

enum ClientCmd {
    Send(String),
    Disconnect,
}

pub struct WsClientState {
    cmd_tx: Arc<Mutex<Option<mpsc::Sender<ClientCmd>>>>,
}

impl Default for WsClientState {
    fn default() -> Self {
        Self {
            cmd_tx: Arc::new(Mutex::new(None)),
        }
    }
}

async fn stop_client(state: &WsClientState) {
    let tx = state.cmd_tx.lock().await.take();
    if let Some(tx) = tx {
        let _ = tx.send(ClientCmd::Disconnect).await;
    }
}

#[tauri::command]
pub async fn ws_connect(
    app: AppHandle,
    state: State<'_, WsClientState>,
    url: String,
    room_id: String,
) -> Result<(), String> {
    stop_client(state.inner()).await;

    let (ws_stream, _) = connect_async(&url).await.map_err(|e| format!("连接失败: {e}"))?;
    let (mut write, mut read) = ws_stream.split();

    write
        .send(Message::Text(room_id))
        .await
        .map_err(|e| format!("发送房间号失败: {e}"))?;

    let _ = app.emit("ws-open", ());

    let (cmd_tx, mut cmd_rx) = mpsc::channel::<ClientCmd>(32);
    *state.cmd_tx.lock().await = Some(cmd_tx);

    let app_bg = app.clone();
    async_runtime::spawn(async move {
        loop {
            tokio::select! {
                cmd = cmd_rx.recv() => {
                    match cmd {
                        Some(ClientCmd::Send(text)) => {
                            if write.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                        Some(ClientCmd::Disconnect) | None => break,
                    }
                }
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            let _ = app_bg.emit("ws-message", text);
                        }
                        Some(Ok(Message::Close(_))) | None => break,
                        Some(Err(e)) => {
                            let _ = app_bg.emit("ws-error", e.to_string());
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
        let _ = app_bg.emit("ws-close", ());
    });

    Ok(())
}

#[tauri::command]
pub async fn ws_send(state: State<'_, WsClientState>, message: String) -> Result<(), String> {
    let tx = state.cmd_tx.lock().await.clone();
    let Some(tx) = tx else {
        return Err("未连接".into());
    };
    tx.send(ClientCmd::Send(message))
        .await
        .map_err(|_| "发送失败".to_string())
}

#[tauri::command]
pub async fn ws_disconnect(state: State<'_, WsClientState>) -> Result<(), String> {
    stop_client(state.inner()).await;
    Ok(())
}
