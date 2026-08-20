use crate::gtp_engine::{parse_gtp_coord, to_gtp_coord, GtpEngine};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct PachiState {
    engine: Mutex<Option<GtpEngine>>,
    last_size: Mutex<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiBoardState {
    pub size: u32,
    pub komi: f64,
    pub board: Vec<Vec<u8>>,
    pub current_player: u8,
    pub difficulty: u32,
}

#[derive(Debug, Serialize)]
pub struct AiMoveResult {
    pub x: i32,
    pub y: i32,
    pub pass: bool,
    pub engine: String,
}

fn find_pachi_binary() -> Option<PathBuf> {
    let candidates = [
        "/opt/homebrew/bin/pachi",
        "/usr/local/bin/pachi",
        "/opt/homebrew/opt/pachi/bin/pachi",
    ];
    for path in candidates {
        if PathBuf::from(path).exists() {
            return Some(PathBuf::from(path));
        }
    }
    which_pachi()
}

fn which_pachi() -> Option<PathBuf> {
    let output = std::process::Command::new("which")
        .arg("pachi")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

fn playout_budget(size: u32, difficulty: u32) -> (u32, u32) {
    let base = match size {
        5..=9 => (800, 1600),
        10..=15 => (1800, 3600),
        _ => (3200, 6400),
    };
    let scale = difficulty.clamp(500, 5000) as f64 / 2000.0;
    (
        ((base.0 as f64) * scale) as u32,
        ((base.1 as f64) * scale) as u32,
    )
}

fn ensure_engine(state: &PachiState, size: u32, difficulty: u32) -> Result<(), String> {
    let path = find_pachi_binary().ok_or("未找到 Pachi，请先执行: brew install pachi")?;
    let (min_sims, max_sims) = playout_budget(size, difficulty);
    let args = vec![
        "-t".to_string(),
        format!("={min_sims}:{max_sims}"),
        "threads=2".to_string(),
    ];
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
    let need_respawn = guard.is_none() || *state.last_size.lock().map_err(|e| e.to_string())? != size;
    if need_respawn {
        *guard = Some(GtpEngine::spawn(
            path.to_str().ok_or("Pachi 路径无效")?,
            &arg_refs,
        )?);
        *state.last_size.lock().map_err(|e| e.to_string())? = size;
    }
    Ok(())
}

fn color_name(player: u8) -> &'static str {
    if player == 1 { "black" } else { "white" }
}

fn sync_board(engine: &mut GtpEngine, req: &AiBoardState) -> Result<(), String> {
    engine.send(&format!("boardsize {}", req.size))?;
    engine.send("clear_board")?;
    engine.send(&format!("komi {}", req.komi))?;

    let size = req.size as usize;
    for y in 0..size {
        for x in 0..size {
            let stone = req.board[y][x];
            if stone == 0 {
                continue;
            }
            let color = if stone == 1 { "black" } else { "white" };
            let coord = to_gtp_coord(x, y, size);
            engine.send(&format!("play {color} {coord}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn pachi_genmove(app: AppHandle, req: AiBoardState) -> Result<AiMoveResult, String> {
    let size = req.size;
    let difficulty = req.difficulty;
    let player = req.current_player;
    let board = req.clone();

    tokio::task::spawn_blocking(move || {
        let state = app.state::<PachiState>();
        ensure_engine(state.inner(), size, difficulty)?;
        let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
        let engine = guard.as_mut().ok_or("Pachi 引擎未就绪")?;
        sync_board(engine, &board)?;
        let color = color_name(player);
        let response = engine.send(&format!("genmove {color}"))?;
        let token = response.lines().next().unwrap_or("pass").trim();
        if token.eq_ignore_ascii_case("pass") || token.eq_ignore_ascii_case("resign") {
            return Ok(AiMoveResult {
                x: -1,
                y: -1,
                pass: true,
                engine: "pachi".into(),
            });
        }
        let (x, y) = parse_gtp_coord(token, size as usize).ok_or_else(|| format!("无法解析走法: {token}"))?;
        Ok(AiMoveResult {
            x: x as i32,
            y: y as i32,
            pass: false,
            engine: "pachi".into(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn pachi_available() -> bool {
    find_pachi_binary().is_some()
}

#[tauri::command]
pub fn pachi_shutdown(state: State<'_, PachiState>) -> Result<(), String> {
    let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
