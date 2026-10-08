# Palet Zaman Asistanı

Windows masaüstünde **her zaman görünen** flip clock + günün notları + hava durumu widget'ı.
Halo/uzay estetiği, çoklu skin desteği, sesli saat okuma.

> Durum: **§4 Yazılım · §7 Yayın** — arayüz ve yayın hattı çalışıyor. Kurulum paketi
> GitHub Actions'ta derleniyor (`v1.0.0`, taslak sürüm). Kurulum testi bekliyor.

---

## Özellikler

| | |
|---|---|
| **Flip saat** | 24 saat mantığı, saniyeli, rakam değişiminde flip animasyonu |
| **Tarih** | Üstte küçük: `18 Mayıs 2026 • Pazartesi` |
| **Günün notları** | Sağdaki oktan aşağı açılır; saat-saat notlar, yıldızla önemli işaretleme |
| **Takvim** | Tarih düğmesine basınca açılır; başka bir güne not girebilir, geçmişe bakabilirsiniz — "Bugüne dön" ile çıkılır |
| **Not önizleme** | Ana ekranda ilk 5 not başlığı şerit halinde |
| **Hava durumu** | `<` / sol kutucuk → 7 günlük tahmin, gün doğumu yayı, telemetri |
| **Konum** | Manuel il seçimi (geocoding ile arama) + önbellek |
| **Sesli okuma** | `15:00` → *"saat on beş"* · `17:30` → *"saat on yedi, otuz"* — iki okuyucu: **Ece** ve **Emre** |
| **Tema** | Aydınlık / karanlık — "Günün notları"nın altındaki anahtardan |
| **Skin** | Halo · Klasik · Neon · Minimal — Winamp mantığı, genişletilebilir |
| **Skin Stüdyosu** | Kendi temanızı tasarlayın: 27 renk, arka plan görseli, köşe, font — canlı önizlemeli |
| **Boyut** | 1/2 · 1/3 · 1/4 ölçek. 1/4'te mini hava göstergesi korunur |
| **Görünürlük** | Hava durumu ve not başlıkları ayrı ayrı kapatılabilir (sade mod) |
| **Her Zaman Üstte** | Açılıp kapatılır (**varsayılan kapalı**). Kapalıyken widget normal bir penceredir — tarayıcının ya da videonun önüne geçmez, masaüstünde görünür |
| **Başlangıç** | Windows ile otomatik başlar (8 sn gecikmeli), ayarlardan kapatılır |
| **Tepsi** | Kapatınca tepsiye küçülür; tepsiden geri açılır |

---

## Teknoloji

**Tauri 2.x** (WebView2 / Edge motoru) — Electron'a göre ~3 kat hafif.

| | Tauri 2.x | Electron |
|---|---|---|
| Kurulum boyutu | **1,1 MB** (ölçüldü) | ~150–200 MB |
| Boşta RAM | ~40–80 MB | ~120–200 MB |
| Motor | Sistemdeki WebView2 | Paketlenmiş Chromium |

Arayüz **bağımlılıksız** vanilla HTML/CSS/JS'tir; Tailwind CDN veya framework yok —
çevrimdışı çalışır ve kaynak tüketmez.

### Kaynak optimizasyon kuralları

| Kural | Neden |
|---|---|
| `backdrop-filter` yok — statik gradyan doku | Blur her karede yeniden hesaplanır (%5–15 CPU) |
| Animasyon yalnız rakam değişiminde | Boşta %0 CPU hedefi |
| Hava durumu 20 dk önbellekli | API kotası + ağ trafiği |
| Pencere gizliyken `setInterval` durur | `visibilitychange` ile |
| `setInterval(1000)`, `requestAnimationFrame` değil | Saniyelik saat için yeterli, daha ucuz |

---

## Kurulum (kullanıcı)

`Palet.Zaman.Asistani_1.0.0_x64-setup.exe` dosyasını çalıştırın.
Yönetici izni gerekmez, yalnızca sizin hesabınıza kurulur.

> Tauri, dosya adındaki boşluk ve Türkçe karakterleri noktaya çevirir:
> `Palet Zaman Asistanı` → `Palet.Zaman.Asistani`. Dosya adı bu yüzden böyle.

---

## Geliştirme

### Gereksinimler

- Node.js 18+
- Rust (stable) + C++ derleyici
  - **MSVC**: Visual Studio Build Tools → *Desktop development with C++*
  - **veya hafif alternatif**: `rustup target add x86_64-pc-windows-gnu` + MinGW-w64
- WebView2 (Windows 10/11'de hazır gelir)

### Komutlar

```bash
npm install            # Tauri CLI
npm run icon           # assets/logo.png → src-tauri/icons/*
npm run dev            # geliştirme modu (sıcak yenileme)
npm run build          # NSIS kurulum paketi (bkz. MSI notu)
npm run web            # yalnızca arayüz — tarayıcıda önizleme
npm run dogrula        # kod bekçisi: 7 statik kontrol (aşağıya bakın)
npm run test           # davranış testleri: notlar/takvim + ses (70 kontrol)
```

> `npm run web` Rust kurmadan arayüzü test etmenizi sağlar. Yerel bir sunucu
> (`http://127.0.0.1:5173`) açar — **`file://` ile değil**, çünkü tarayıcılar
> `file://` sayfalarında `localStorage`'ı engelleyebiliyor ve o zaman ayarlarınız
> ve skinleriniz kaydedilmez. Arayüz Tauri API'sini bulamazsa otomatik olarak
> tarayıcı moduna düşer — **takvim dâhil** her şey çalışır; yalnızca Windows ile
> otomatik başlatma ve "her zaman üstte" çalışmaz (ikisi de işletim sistemi ister).

> **MSI hedefi neden kapalı?** `bundle.targets` yalnızca `["nsis"]` içerir.
> MSI (WiX) derlemesi `light.exe` adımında sıfırdan farklı çıkışla düşüyor;
> NSIS ise aynı derlemede sorunsuz üretiliyor. Hata metni Tauri tarafından
> yalnızca **debug** seviyesinde loglanıyor, bu yüzden normal CI çıktısında
> görünmüyor — nedenini görmek için `npm run build -- --verbose` gerekir.
> Son kullanıcı için fark yok: dağıtılan dosya `...-setup.exe` (NSIS) ve
> MSI yalnızca grup ilkesi (GPO) ile kurumsal dağıtımda gerekir.
> MSI geri istenirse önce `--verbose` ile gerçek `light.exe` hatası alınmalı.

### `npm run dogrula` — kod bekçisi

Her değişiklikten sonra çalıştırın. Yedi kontrol yapar:

| # | Kontrol | Neyi yakalar |
|---|---------|--------------|
| 1 | JS sözdizimi | `node --check` ile her dosya |
| 2 | JSON | `tauri.conf.json`, `capabilities`, `package.json` |
| 3 | HTML ↔ JS kimlikleri | `$('x')` var ama `id="x"` yok; tekrar eden id |
| 4 | **Üst düzey global ad çakışması** | Klasik script'lerde iki dosya aynı adı tanımlarsa ikincisi sessizce hiç çalışmaz |
| 5 | Token kataloğu ↔ CSS | `PZA.TOKENS`'ta olup `:root`'ta tanımsız token |
| 6 | innerHTML'e ham dış veri | Statik tarama: kaçış çağrılmadan yazılan dış veri |
| 7 | Kaçış **davranış** testi | Düşmanca bir skin dosyası içe aktarılır; HTML kırılmıyor, `javascript:` reddediliyor |

4 ve 7 gerçek hatalardan doğdu: `esc` adı `notes.js`'i tamamen çökertmişti ve skin
adı üzerinden `<img src=x onerror=…>` çalışabiliyordu. İkisi de bir daha sessizce
geri gelemeyecek.

### `npm run test` — davranış testleri

`dogrula` koda bakar ("çağrı var mı"), `test` çalıştırır ("işe yarıyor mu").
Gerçek kaynak dosyalar sahte bir DOM ve sahte bir `speechSynthesis` üzerinde
çalıştırılır; tarayıcı da Rust da gerekmez. Toplam **70 kontrol**:

| Dosya | Kapsam |
|-------|--------|
| `araclar/notlar-test.mjs` | Takvim tarih matematiği (ay/yıl taşması, Pazartesi başlangıcı), ay gezinme, notun **seçili güne** yazılması, gece yarısı devri, saat başı okuma mandalı |
| `araclar/ses-test.mjs` | Ece/Emre eşleşmesi, tek Türkçe seste perde farkı, Türkçe ses yokken yedeğe düşme, hiç ses yokken çökmeme, Türkçe sayı→kelime |

İkisi de gerçek hatalardan doğdu — saat başı okuma mandalı `seconds === 0` iken
pencere gizlendiğinde o tek saniyeyi kaçırıyordu ve notlar hangi güne bakarsanız
bakın **bugüne** yazılıyordu. Yayın iş akışı, paket derlenmeden **önce** bu
testleri çalıştırır.

---

## Proje yapısı

```
PaletZamanAsistani/
├─ LICENSE                  ← GNU GPL-3.0 resmî metni
├─ kurulum-lisans.txt       ← Kurulum ekranındaki Türkçe lisans açıklaması
├─ package.json
├─ araclar/                 ← geliştirici araçları (uygulamaya girmez)
│  ├─ dogrula.mjs           ← statik kod bekçisi
│  ├─ notlar-test.mjs       ← davranış testi: notlar/takvim
│  ├─ ses-test.mjs          ← davranış testi: sesli okuma
│  └─ sunucu.mjs            ← `npm run web` önizleme sunucusu
├─ src/                     ← arayüz (frontendDist)
│  ├─ index.html
│  ├─ styles/widget.css     ← skin token'ları + tüm stiller
│  └─ js/
│     ├─ settings.js        ← ayar deposu, skin kataloğu
│     ├─ skins.js           ← skin motoru: token'lar, türetme, paylaşım
│     ├─ studio.js          ← Skin Stüdyosu arayüzü
│     ├─ clock.js           ← flip saat + Türkçe tarih
│     ├─ notes.js           ← notlar: depo, önizleme, panel
│     ├─ weather.js         ← Open-Meteo geocoding + tahmin
│     ├─ speech.js          ← Türkçe sayı→kelime + TTS
│     └─ app.js             ← başlatma ve olay bağlama
└─ src-tauri/
   ├─ Cargo.toml
   ├─ tauri.conf.json       ← pencere, CSP, paketleme, lisans ekranı
   ├─ capabilities/default.json
   └─ src/main.rs           ← tepsi, otomatik başlatma, komutlar
```

### Kendi skininizi yapmak (uygulama içinden)

Ayarlar → **GÖRÜNÜM / SKİN** → **＋ Yeni**. Stüdyo açılır:

- **27 renk** — zemin, yüzey, çizgi, metin, vurgu, flip kartı, anlamsal. Her rengin
  yanındaki kaydırıcı saydamlıktır.
- **Karanlık / Aydınlık palet** — ayrı sekmeler. Aydınlık sekmeye ilk geçişte
  karanlık palet kopyalanır, sıfırdan başlamazsınız.
- **Arka plan görseli** — opaklık ve *kapla / sığdır / döşe* seçenekleriyle.
  Görsel otomatik küçültülüp sıkıştırılır.
- **Köşe yuvarlaklığı** ve **font** seçimi.
- Her değişiklik **anında** gerçek widget'a uygulanır; içerideki minik önizleme
  aynı satır içi stilleri kopyaladığı için birebir aynı sonucu gösterir.

**Paylaşma:** *Kodu kopyala* → arkadaşınıza gönderin → o da *Kod yapıştır* ile
alsın. Dosya olarak da indirip açabilirsiniz (`.pzaskin.json`).

### Skin dosyası biçimi

```jsonc
{
  "format": "pza-skin/1",
  "id": "aurora", "name": "Aurora", "author": "Ali",
  "dark":  { "--bg-1": "#101722", "--accent": "#06b6d4", /* … 27 token */ },
  "light": { /* opsiyonel — yoksa karanlık palet kullanılır */ },
  "bg": { "image": "data:image/jpeg;base64,…", "opacity": 0.35, "fit": "cover" },
  "radius": 16, "fontUI": "'Segoe UI', sans-serif", "fontNum": "Consolas, monospace"
}
```

Yalnızca `dark` zorunludur. **Geri kalan ~10 token renklerden türetilir** —
gölge, dikiş ve yarı saydam vurgular `--bg-1` ile `--accent`'ten hesaplanır, yani
skin kendi kendine yeter ve tema değişince yarım kalmaz.

> Not: elle yazılmış kısmî bir skin içe aktarılabilir, ama stüdyonun ürettiği
> dosya her zaman 27/27 token içerir — paylaşılan skin alıcıda eksik görünmesin.

### Yerleşik skin eklemek (geliştirici)

1. `src/styles/widget.css` içine `[data-skin="benim-skin"] { --accent: …; }` bloğu ekleyin
2. `src/js/settings.js` içindeki `PZA.SKINS` dizisine kaydı ekleyin

Yerleşik skinler isteğe bağlı olarak **kısmî** olabilir (CSS cascade'i tamamlar).
Paylaşılabilir kullanıcı skinleri ise tam olmak zorundadır.

---

## Veri ve gizlilik

- Notlar, ayarlar ve **kendi skinleriniz** (arka plan görseli dâhil) **cihazda**
  tutulur (`localStorage` → WebView2 profil klasörü). Hiçbiri bir sunucuya gitmez.
- Skin paylaşımı tamamen sizin elinizdedir: kod panoya kopyalanır, nereye
  göndereceğinize siz karar verirsiniz.
- Hava durumu için yalnızca seçtiğiniz şehrin koordinatı Open-Meteo'ya gönderilir.
  Hesap, çerez veya kişisel veri gönderilmez.
- Google Takvim bağlanırsa yetki yalnızca `calendar.events` kapsamındadır.

---

## Lisans

Copyright © 2026 **Paletweb Bilişim**

Bu program özgür yazılımdır: **GNU Genel Kamu Lisansı sürüm 3** (GPL-3.0-or-later)
koşulları altında yeniden dağıtabilir ve/veya değiştirebilirsiniz.

Özgür yazılım, fiyatı sıfır olan yazılım demek değildir; **kullanma, inceleme,
değiştirme ve paylaşma özgürlüğü** demektir. Bu programın ücretsiz dağıtılması bu
özgürlüklerin bir sonucudur, şartı değildir. GPLv3 programı bir ücret karşılığında
satmanıza da izin verir.

Bu program, yararlı olacağı umuduyla dağıtılmaktadır; ancak **hiçbir garanti
verilmez**. Ayrıntı için [`LICENSE`](LICENSE) dosyasına bakın:
<https://www.gnu.org/licenses/gpl-3.0.html>

**Kaynak kod:** <https://github.com/akamaci/palet-zaman-asistani>

GPL-3.0 kaynak kodun açık kalmasını gerektirir. Katkı gönderen herkes aynı lisans
altında katkı vermeyi kabul etmiş sayılır.

### Teşekkür

- [Tauri](https://tauri.app) — MIT / Apache-2.0
- [Open-Meteo](https://open-meteo.com) — CC BY 4.0, anahtarsız hava durumu API'si
