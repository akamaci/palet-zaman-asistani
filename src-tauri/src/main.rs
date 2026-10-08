// Palet Zaman Asistanı — Tauri giriş noktası
// Copyright © 2026 Paletweb Bilişim · GPL-3.0-or-later
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// Ayarlardan "Windows ile Başlat" toggle'ı bu komutu çağırır.
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    let al = app.autolaunch();
    let sonuc = if enabled { al.enable() } else { al.disable() };
    sonuc.map(|_| true).map_err(|e| e.to_string())
}

/// Başlangıçta otomatik başlatma açık mı?
#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Google Takvim OAuth — Yol B. Cloud Console istemcisi girilene kadar kapalı.
#[tauri::command]
fn gcal_connect() -> Result<bool, String> {
    Err("Google OAuth istemcisi henüz yapılandırılmadı.".into())
}

/// Pencereyi gizle (tepside kalsın)
#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

/// "Her Zaman Üstte" — ayarlardan yönetilir.
/// Kapatılınca widget normal bir pencere olur ve tarayıcı/video gibi
/// uygulamalar önüne geçebilir; açıkken masaüstünde hep görünür kalır.
#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "Ana pencere bulunamadı.".to_string())?;
    w.set_always_on_top(enabled)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![
            set_autostart,
            get_autostart,
            gcal_connect,
            hide_window,
            set_always_on_top
        ])
        .setup(|app| {
            // ── Sistem tepsisi ──
            let goster = MenuItem::with_id(app, "show", "Göster", true, None::<&str>)?;
            let cikis  = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu   = Menu::with_items(app, &[&goster, &cikis])?;

            TrayIconBuilder::with_id("pza-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Palet Zaman Asistanı")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = ev
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // Kapatma tuşu = tepsiye küçül, uygulamadan çıkma
        .on_window_event(|w, ev| {
            if let WindowEvent::CloseRequested { api, .. } = ev {
                api.prevent_close();
                let _ = w.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Palet Zaman Asistanı başlatılamadı");
}
