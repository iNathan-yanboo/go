use tauri::{command, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[command]
pub fn set_always_on_top(app: AppHandle, on_top: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_always_on_top(on_top);
    }
}

#[command]
pub fn toggle_visible(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
            let _ = w.set_skip_taskbar(true);
        } else {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
            let _ = w.set_skip_taskbar(false);
        }
    }
}

pub fn open_or_focus_settings(app: &AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("设置")
        .inner_size(400.0, 560.0)
        .min_inner_size(320.0, 400.0)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .always_on_top(true)
        .build()
        .map_err(|e| e.to_string())?;

    let _ = window.set_shadow(false);
    Ok(())
}

#[command]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    open_or_focus_settings(&app)
}

#[command]
pub fn set_stealth_mode(app: AppHandle, stealth: bool) {
    if let Some(w) = app.get_webview_window("main") {
        if stealth {
            let _ = w.set_always_on_top(true);
            let _ = w.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 200.0, height: 200.0 }));
        } else {
            let _ = w.set_always_on_top(false);
            let _ = w.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 600.0, height: 650.0 }));
        }
    }
}
