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

/// Windows'un kendi "varsayılan uygulamayla aç" API'si.
///
/// TUR 8 — kullanıcı bildirimi: *"browserda açılan bişi yok"*, üstelik
/// arayüz "tarayıcıda onay sayfası açıldı" yazıyordu. Sebep: `spawn()`
/// başarısı yalnızca bir sürecin BAŞLATILDIĞINI söyler; üç yardımcı
/// program da sessizce hiçbir şey açmadan dönebilir (tur 5'in dersi,
/// tekrar yaşandı).
///
/// Doğru yol süreç başlatmak değil, işi **kabuğa devretmektir**:
/// `ShellExecuteW` tam olarak bunu yapar ve Windows'ta bir adresi
/// varsayılan tarayıcıda açmanın kanonik yoludur. Dönüş değeri 32'den
/// büyükse kabuk isteği kabul etmiştir.
#[cfg(windows)]
mod kabuk {
    use core::ffi::c_void;

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut c_void,
            islem: *const u16,
            dosya: *const u16,
            parametreler: *const u16,
            dizin: *const u16,
            goster: i32,
        ) -> *mut c_void;
    }

    /// SW_SHOWNORMAL = 1 (pencere normal boyutta, öne gelir).
    pub fn ac(url: &str) -> bool {
        let genis: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
        let r = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                std::ptr::null(),
                genis.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1,
            )
        };
        r as isize > 32
    }
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
///
/// TUR 8: zincirin BAŞINA `ShellExecuteW` kondu, `explorer.exe`
/// yedeklerden ÇIKARILDI.
///
/// Kullanıcı bildirimi: *"onun yerine belgelerim açılıyor"*. Sebep net —
/// `explorer.exe`'ye URL verildiğinde Windows onu bir klasör yolu sanar,
/// bulamayınca varsayılanına (Belgeler) düşer. Üstelik süreç başarıyla
/// başladığı için `spawn()` `Ok` döner ve uygulama "tarayıcı açıldı"
/// sanır. Yani bu yöntem yalnız işe yaramıyor değildi; **yanlış şeyi
/// yapıp başarılı görünüyordu** — bu projede en pahalı hata sınıfı.
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

    /* Birinci yol: kabuğa devret. Süreç başlatmadığı için "başladı ama
       görünmedi" durumu oluşmaz. */
    #[cfg(windows)]
    if kabuk::ac(&url) {
        return Ok(true);
    }

    let denemeler: [(&str, &[&str]); 2] = [
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

/// Kapanış sayfasının türü.
/// `Yok` = tarayıcının kendi ek isteği (favicon, ön bağlantı) — boş
/// sayfa döner ve akış DEVAM eder.
#[derive(Clone, Copy, PartialEq)]
enum Durum {
    Yok,
    Tamam,
    Red,
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
                /* TUR 12 — BÖCEK KAPATILDI: eskiden `code=` ve `error=`
                   AYNI "Bağlantı alındı ✓" sayfasını alıyordu. Google
                   reddettiğinde kullanıcı tarayıcıda BAŞARI görüyor,
                   panele dönüyor ve bağlandığını sanıyordu — mesajın
                   ölçmediği şeyi olmuş gibi anlatması (bu projede en
                   pahalı hata sınıfı) tam buradaydı. Artık iki durum
                   AYRI sayfa alır ve reddin SEBEBİ yazılır. */
                if hedef.contains("code=") {
                    cevapla(&s, Durum::Tamam, &hedef);
                    return Ok(hedef);
                }
                if hedef.contains("error=") {
                    cevapla(&s, Durum::Red, &hedef);
                    return Ok(hedef);
                }
                cevapla(&s, Durum::Yok, &hedef); // favicon / boş bağlantı → yok say
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

/// HTML kaçışı. Sayfaya yazılan tek dış veri Google'ın döndürdüğü
/// `error` / `error_description` metnidir; ham konmaz.
fn kacis(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Hedefin sorgu dizesinden parametre oku (`?error=access_denied&…`).
fn sorgu(hedef: &str, ad: &str) -> Option<String> {
    let q = hedef.split_once('?')?.1;
    for cift in q.split('&') {
        if let Some((k, v)) = cift.split_once('=') {
            if k == ad {
                return Some(yuzdeCoz(v));
            }
        }
    }
    None
}

/// `application/x-www-form-urlencoded` çözümü: `+` → boşluk, `%XX` → bayt.
/// Google `error_description` metnini yüzde kodlayarak döndürür
/// ("The+user+denied+…"); çözülmezse kullanıcı ham `%2B` okurdu.
fn yuzdeCoz(s: &str) -> String {
    let b = s.as_bytes();
    let mut cikti: Vec<u8> = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'+' => { cikti.push(b' '); i += 1; }
            b'%' if i + 2 < b.len() => {
                let okt = std::str::from_utf8(&b[i + 1..i + 3])
                    .ok()
                    .and_then(|h| u8::from_str_radix(h, 16).ok());
                match okt {
                    Some(v) => { cikti.push(v); i += 3; }
                    None => { cikti.push(b[i]); i += 1; }
                }
            }
            c => { cikti.push(c); i += 1; }
        }
    }
    String::from_utf8_lossy(&cikti).to_string()
}

/// Kapanış sayfasının ortak iskeleti.
fn sayfa(govde: &str) -> String {
    format!(
        "<!doctype html><meta charset=\"utf-8\"><title>Palet Zaman Asistanı</title>\
         <body style=\"font:16px/1.6 'Segoe UI',sans-serif;background:#0b1017;color:#e8f6ff;\
         display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0\">\
         <div style=\"text-align:center;max-width:640px;padding:24px\">{govde}</div></body>"
    )
}

/// Tarayıcıya küçük bir kapanış sayfası gönder.
fn cevapla(mut s: &TcpStream, durum: Durum, hedef: &str) {
    let govde = match durum {
        Durum::Yok => "<!doctype html><meta charset=\"utf-8\">\
                       <title>Palet Zaman Asistanı</title><body style=\"background:#0b1017\"></body>"
            .to_string(),
        Durum::Tamam => sayfa(
            "<h2 style=\"margin:0 0 8px\">Bağlantı alındı &#10003;</h2>\
             <p style=\"margin:0;color:#8fa3b8\">Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.</p>",
        ),
        Durum::Red => {
            let hata = sorgu(hedef, "error").unwrap_or_else(|| "bilinmeyen".to_string());
            let aciklama = sorgu(hedef, "error_description").unwrap_or_default();
            let mut b = String::from(
                "<h2 style=\"margin:0 0 8px\">Bağlantı kurulamadı &#10007;</h2>\
                 <p style=\"margin:0 0 12px\">Google izin vermedi: <b>",
            );
            b.push_str(&kacis(&hata));
            b.push_str("</b></p>");
            if !aciklama.is_empty() {
                b.push_str(&format!(
                    "<p style=\"margin:0 0 12px;color:#8fa3b8\">{}</p>",
                    kacis(&aciklama)
                ));
            }
            b.push_str(
                "<p style=\"margin:0 0 8px;color:#8fa3b8\">Uygulama Google'da <b>Test</b> \
                 durumundaysa yalnızca test kullanıcısı listesindeki hesaplar izin verebilir. \
                 Aşağıdaki sayfadan bu hesabı listeye ekleyin ya da uygulamayı yayımlayın \
                 (test izinleri 7 günde dolar):</p>\
                 <p style=\"margin:0 0 12px\"><a style=\"color:#67e8f9\" \
                 href=\"https://console.cloud.google.com/auth/audience\">\
                 console.cloud.google.com/auth/audience</a></p>\
                 <p style=\"margin:0;color:#8fa3b8\">Bu sekmeyi kapatıp uygulamaya \
                 dönebilirsiniz.</p>",
            );
            sayfa(&b)
        }
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
