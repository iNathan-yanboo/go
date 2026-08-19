use tauri::{command, AppHandle, Manager};

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
