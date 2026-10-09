// Palet Zaman Asistanı — Tauri giriş noktası
// Copyright © 2026 Paletweb Bilişim · GPL-3.0-or-later
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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

/* ── Google Takvim OAuth (Yol B) ──────────────────────────────────
   Akışın tamamı arayüzde (src/js/gcal.js): yetki URL'i, PKCE, kod↔token
   değişimi ve takvim çağrıları orada. Google'ın token uç noktası CORS
   başlığı verdiği için (curl ile doğrulandı) arayüz bunları doğrudan
   `fetch` ile yapabiliyor. Rust'a yalnızca iki iş kalıyor:

     1. Tarayıcıyı açmak            → gcal_ac
     2. Yönlendirmeyi yakalamak     → gcal_port + gcal_bekle

   İSTEMCİ SIRRI YOK: masaüstü istemcileri için PKCE yeterlidir, bu
   yüzden GPL kaynağında hiçbir sır yayımlanmaz. Kullanıcı yalnızca
   herkese açık olan Client ID'yi girer.

   Loopback dinleyicisi komutlar arasında paylaşıldığı için State'te
   tutulur; `gcal_port` açar, `gcal_bekle` alıp tüketir.

   TUR 7 — vazgeçme gerçekten iptal eder: `gcal_kapat` bir zamanlar
   yalnızca State'i boşaltıyordu; ama `gcal_bekle` dinleyiciyi oradan
   ALIP kendi iş parçacığına taşıdığı için, bekleme SÜRERKEN bu komut
   hiçbir şey yapmıyordu. Yani kullanıcının "vazgeç" düğmesi boş
   olurdu — bu projede en pahalı hata sınıfı. İptal artık dinleyicinin
   her turda baktığı bir bayraktır. */
#[derive(Default)]
struct OauthKapi {
    dinleyici: Mutex<Option<TcpListener>>,
    iptal: Arc<AtomicBool>,
}

/// Boş bir yerel port aç ve numarasını döndür. Google, masaüstü
/// istemcilerinde `http://127.0.0.1:<herhangi bir port>` yönlendirmesine
/// izin verir — bu yüzden port sabitlenmez, çakışma riski kalmaz.
#[tauri::command]
fn gcal_port(kapi: tauri::State<'_, OauthKapi>) -> Result<u16, String> {
    let l = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = l.local_addr().map_err(|e| e.to_string())?.port();
    /* Yeni akış: önceki akıştan kalan iptal işareti sıfırlanır, yoksa
       ikinci deneme daha başlamadan "iptal edildi" diye biterdi. */
    kapi.iptal.store(false, Ordering::Relaxed);
    *kapi.dinleyici.lock().map_err(|e| e.to_string())? = Some(l);
    Ok(port)
}

/// Sistemin varsayılan tarayıcısında aç.
///
/// Kabuk (cmd/sh) KULLANILMAZ: URL tek bir argv öğesi olarak geçtiği için
/// içindeki `&` ve `?` karakterleri komut ayırıcı olarak yorumlanamaz.
///
/// TUR 6: kullanıcı "bağlan düğmesi URL'i açmadı" dedi. Tek yönteme
/// güvenmek yanlıştı — bu adım işletim sistemine bağlı ve yöntemler
/// makineden makineye sessizce başarısız olabiliyor (özellikle
/// `rundll32 url.dll,FileProtocolHandler` bazı sistemlerde hiçbir şey
/// açmaz). Bu yüzden üç yöntem sırayla denenir. Biri işe yaramazsa
/// ötekine geçilir; hiçbiri açamazsa hata döner ve ARAYÜZ ÇIKMAZA
/// GİRMEZ: onay adresi kullanıcıya gösterilir, kendi tarayıcısında
/// açıp izin verir (bkz. gcal.js · `PZA.gcalElle`).
#[tauri::command]
fn gcal_ac(url: String) -> Result<bool, String> {
    // Yalnızca listedeki adresler açılır: arayüzden gelen bir dize
    // doğrudan kabuğa/tarayıcıya verildiği için beyaz liste şart.
    const IZINLI: [&str; 2] = [
        "https://accounts.google.com/",
        "https://console.cloud.google.com/",
    ];
    if !IZINLI.iter().any(|p| url.starts_with(p)) {
        return Err("Beklenmeyen adres reddedildi.".into());
    }
    let denemeler: [(&str, &[&str]); 3] = [
        ("explorer.exe", &[]),
        ("rundll32.exe", &["url.dll,FileProtocolHandler"]),
        ("cmd.exe", &["/C", "start", ""]),
    ];
    let mut son = String::from("bilinmeyen hata");
    for (program, onler) in denemeler {
        let mut c = std::process::Command::new(program);
        for o in onler {
            c.arg(o);
        }
        /* CREATE_NO_WINDOW (0x0800_0000): pencere yok, konsol da
           parlamasın. Yalnız Windows'ta anlamlı. */
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            c.creation_flags(0x0800_0000);
        }
        match c.arg(&url).spawn() {
            Ok(_) => return Ok(true),
            Err(e) => son = format!("{program}: {e}"),
        }
    }
    Err(format!("Tarayıcı açılamadı ({son})"))
}

/// Yönlendirmeyi bekle ve istek satırını (`/?code=…`) döndür.
/// Engellememesi için ayrı bir iş parçacığında çalışır.
#[tauri::command]
async fn gcal_bekle(kapi: tauri::State<'_, OauthKapi>) -> Result<String, String> {
    let l = kapi
        .dinleyici
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or_else(|| "Dinleyici başlatılmadı.".to_string())?;
    /* İptal bayrağı iş parçacığına KOPYALANARAK geçer (Arc): dinleyici
       taşındığı için State'ten okunamaz, ama bayrak paylaşılır. */
    let iptal = kapi.iptal.clone();
    tauri::async_runtime::spawn_blocking(move || dinle(l, iptal))
        .await
        .map_err(|e| e.to_string())?
}

/// Kullanıcı vazgeçebilsin diye bekleyen dinleyiciyi iptal et.
#[tauri::command]
fn gcal_kapat(kapi: tauri::State<'_, OauthKapi>) {
    kapi.iptal.store(true, Ordering::Relaxed);
}

/// Yönlendirme isteğini bekle. Tarayıcı sayfa için ek istekler
/// (favicon, ön bağlantı) gönderebilir; yalnızca `code=`/`error=`
/// taşıyan istek gerçek yönlendirmedir, ötekiler yok sayılır.
fn dinle(l: TcpListener, iptal: Arc<AtomicBool>) -> Result<String, String> {
    let bitis = Instant::now() + Duration::from_secs(180);
    l.set_nonblocking(true).map_err(|e| e.to_string())?;
    loop {
        match l.accept() {
            Ok((s, _)) => {
                let hedef = hedefOku(&s).unwrap_or_default();
                if hedef.contains("code=") || hedef.contains("error=") {
                    cevapla(&s, true);
                    return Ok(hedef);
                }
                cevapla(&s, false); // favicon / boş bağlantı → yok say
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                /* Vazgeç işareti süre dolumundan ÖNCE sorulur: kullanıcı
                   beklemekten vazgeçtiyse 3 dakika daha bekletilmez. */
                if iptal.load(Ordering::Relaxed) {
                    return Err("İptal edildi.".into());
                }
                if Instant::now() > bitis {
                    return Err("Google yanıtı beklenirken süre doldu.".into());
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

/// İstek satırından hedefi çıkar: `GET /?code=… HTTP/1.1` → `/?code=…`
fn hedefOku(s: &TcpStream) -> Option<String> {
    s.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let mut satir = String::new();
    BufReader::new(s).read_line(&mut satir).ok()?;
    satir.split_whitespace().nth(1).map(|h| h.to_string())
}

/// Tarayıcıya küçük bir kapanış sayfası gönder.
fn cevapla(mut s: &TcpStream, tamam: bool) {
    let govde = if tamam {
        "<!doctype html><meta charset=\"utf-8\"><title>Palet Zaman Asistanı</title>\
         <body style=\"font:16px/1.6 'Segoe UI',sans-serif;background:#0b1017;color:#e8f6ff;\
         display:flex;align-items:center;justify-content:center;height:100vh;margin:0\">\
         <div style=\"text-align:center\"><h2 style=\"margin:0 0 8px\">Bağlantı alındı &#10003;</h2>\
         <p style=\"margin:0;color:#8fa3b8\">Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.</p></div>"
    } else {
        "<!doctype html><meta charset=\"utf-8\"><title>Palet Zaman Asistanı</title>\
         <body style=\"background:#0b1017\"></body>"
    };
    let yanit = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{}",
        govde.len(),
        govde
    );
    let _ = s.write_all(yanit.as_bytes());
    let _ = s.flush();
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
        .manage(OauthKapi::default())
        .invoke_handler(tauri::generate_handler![
            set_autostart,
            get_autostart,
            gcal_port,
            gcal_ac,
            gcal_bekle,
            gcal_kapat,
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
