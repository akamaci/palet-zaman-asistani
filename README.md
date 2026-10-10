# Palet Zaman Asistanı

Windows masaüstünde **her zaman görünen** flip clock + günün notları + hava durumu widget'ı.
Halo/uzay estetiği, çoklu skin desteği, sesli saat okuma.

> Durum: **§4 Yazılım · §7 Yayın** — arayüz ve yayın hattı çalışıyor. Kurulum paketi
> GitHub Actions'ta derleniyor (`v1.10.3`, ön sürüm). Kurulum testi kullanıcıda.

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
| **Sesli okuma** | `15:00` → *"saat on beş"* · `17:30` → *"saat on yedi, otuz"* |
| **Saat anonsu** | Ayarlar → üç ayrı anahtar: **Her saat başı oku** (varsayılan açık) · **Her yarım saatte oku (:30)** (kapalı) · **Önemli kayıtları oku**. Ölçüt artık `saniye === 0` değil **dakika 00 + mandal**: eski kod tam o saniyeyi arıyordu ve saat kaydığında (ya da pencere gizliyken saat durduğunda) anons **tamamen kayboluyordu**. Artık dakika 00 içindeki herhangi bir saniyede **bir kez** okunur; aynı saat başı ikinci kez okunmaz. Saat başı ile yarım saat **ayrı mandal** taşır — biri diğerini düşürmez |
| **Önemli kayıt anonsu** | Yıldızla işaretlenen not/randevu, saati gelince *"**Önemli.** …"* diye okunur; gün değişince yeni kayıt okunur, dünkü kayıt **tekrar edilmez**. Anons saatiyle aynı saniyeye düşerse **tek cümlede** gider (ayrı iki çağrı birbirini keserdi) |
| **Okuyucu sesi** | Sistemde **kurulu** sesler listelenir; kadın sesi otomatik seçilir ve adıyla hatırlanır. Tek (veya hiç) Türkçe ses varsa panel ses ekleme yolunu gösterir — *"Bayan sesi buradan ayarlanır"* |
| **Yeri kilitle** | Sağ üstteki kilit ikonu pencereyi olduğu yere sabitler; yanlışlıkla sürüklenmez. Seçim kalıcıdır |
| **Tema** | Aydınlık / karanlık — "Günün notları"nın altındaki anahtardan |
| **Skin** | Halo · Klasik · Neon · Minimal — Winamp mantığı, genişletilebilir |
| **Skin Stüdyosu** | Kendi temanızı tasarlayın: 27 renk, arka plan görseli, köşe, font — canlı önizlemeli |
| **Boyut** | 1/2 · 1/3 · 1/4 ölçek. Genişlik kutuya değil **içeriğe** göre daraltılır — saat kenarlarda boşlukta kalmaz. 1/4'te mini hava göstergesi korunur |
| **Ekran sığdırma** | Ayarlar paneli açılınca pencere büyür ve **görev çubuğunu aşmaz**: çalışma alanına (`screen.availHeight`) sığdırılır, gerekirse yukarı kaydırılır, panel kapanınca eski yerine döner |
| **Panel yönü** | Saat masaüstünün **dibine** yerleştirilmişse notlar/hava paneli **yukarı doğru** açılır — aşağı açılsa görev çubuğunun altında kalır ve okunamaz. Pencere panelin eklediği yükseklik kadar yukarı kayar, böylece **saat ekranda olduğu yerde kalır** |
| **Google Takvim** | "Hesap Bağla" tarayıcıda Google onay sayfasını açar; izin verilince notlar takvime gönderilir; **bütün günler** birden eşitlenir. Panel **"Bağlı"** yazarken bunu iddia etmez, **ölçer** (açılışta takvime sorar) ve reddi sebebiyle söyler — *"iptal ettiniz"* ile *"Google reddetti"* aynı mesaja düşmez. Eşitleme özeti sayıyla konuşur (*N gün tarandı · X yeni, Y güncellendi, Z silindi · takvimde K not*) ve **atlanan gün gizlenmez** — hangi günün neden atlandığı yazılır. Kurulum için kendi Google istemcinizin **Client ID** ve **istemci sırrı** değerleri gerekir (ikisi de yalnız sizin makinenizde saklanır; uygulama kendi sırrını taşımaz), erişim yalnızca `calendar.events` kapsamındadır ve bağlantı konsoldan kesilebilir |
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

`Palet.Zaman.Asistani_1.10.3_x64-setup.exe` dosyasını çalıştırın.
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
npm run dogrula        # kod bekçisi: 10 statik kontrol (aşağıya bakın)
npm run test           # davranış testleri: notlar + ses + anons + kilit + panel yönü + takvim (568 kontrol)
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

Her değişiklikten sonra çalıştırın. On kontrol yapar:

| # | Kontrol | Neyi yakalar |
|---|---------|--------------|
| 1 | JS sözdizimi | `node --check` ile her dosya |
| 2 | JSON | `tauri.conf.json`, `capabilities`, `package.json` |
| 3 | HTML ↔ JS kimlikleri | `$('x')` var ama `id="x"` yok; tekrar eden id |
| 4 | **Üst düzey global ad çakışması** | Klasik script'lerde iki dosya aynı adı tanımlarsa ikincisi sessizce hiç çalışmaz |
| 5 | Token kataloğu ↔ CSS | `PZA.TOKENS`'ta olup `:root`'ta tanımsız token |
| 6 | innerHTML'e ham dış veri | Statik tarama: kaçış çağrılmadan yazılan dış veri |
| 7 | Kaçış **davranış** testi | Düşmanca bir skin dosyası içe aktarılır; HTML kırılmıyor, `javascript:` reddediliyor |
| 8 | **Sürüm tek kaynak** | `PZA.SURUM` ≠ `package.json` ≠ `tauri.conf.json` ≠ `Cargo.toml`; HTML sürümü sabit yazmış |
| 9 | **Taşıma bölgesi bütünlüğü** | `data-tauri-drag-region` taşıyan her öğe `data-drag` de işaretli mi — kilit açılınca geri konacak mı |
| 10 | **Saat başı süpürme bağlı mı** | `gcal.js` süpürmeyi tanımlıyor ama `clock.js` çağırmıyorsa özellik **ölü koddur**: testler elle çağırdığı için yeşil kalır, uygulamada hiç çalışmaz |

10 bu turda eklendi: saat başı takvim süpürmesi (tur 16) yalnız `gcal.js`
içinde tanımlıysa ve `clock.js` onu çağırmıyorsa, davranış testleri onu **elle**
çağırdığı için hep yeşil kalırdı. Statik kontrol o bağı ölçer.

4 ve 7 gerçek hatalardan doğdu: `esc` adı `notes.js`'i tamamen çökertmişti ve skin
adı üzerinden `<img src=x onerror=…>` çalışabiliyordu. İkisi de bir daha sessizce
geri gelemeyecek. 8 ve 9 bu turda eklendi: sürüm dört dosyada elle yazılıyordu
(biri unutulunca kurulum paketi yanlış numara taşır), ve kilit yalnızca
`data-tauri-drag-region`'ı kaldırdığı için o özniteliği taşıyan **her** öğenin
işaretli olması şart — biri işaretsiz kalırsa kilit açıldığında widget bir daha
taşınamaz.

### `npm run test` — davranış testleri

`dogrula` koda bakar ("çağrı var mı"), `test` çalıştırır ("işe yarıyor mu").
Gerçek kaynak dosyalar sahte bir DOM, sahte bir `speechSynthesis`, sahte bir Tauri
penceresi ve sahte bir `fetch` üzerinde çalıştırılır; ne tarayıcı ne de Rust gerekir.
Toplam **568 kontrol**:

| Dosya | Kapsam |
|-------|--------|
| `araclar/notlar-test.mjs` | **70 kontrol** — takvim tarih matematiği (ay/yıl taşması, Pazartesi başlangıcı), ay gezinme, notun **seçili güne** yazılması, gece yarısı devri, saat başı okuma mandalı, **30 dakikalık zaman ızgarası** (48 dilim / 24 eşleştirilmiş satır, notun doğru dilime düşmesi) ve **gün+saat katmanı**. "Başka gün" gerçek bugünden türetilir — sabit tarih yazılırsa test takvim o güne gelince kendi kendine bozuluyordu. Tur 12: yıldızlı kaydın anons metni ayrıca ölçülür ve eski ayar yeni anahtarlara **yükseltilir** |
| `araclar/ses-test.mjs` | **70 kontrol** — liste sistemde kurulu seslerden gelir (uydurma ad yok), kadın sesi otomatik seçilir ve **adıyla** saklanır, seçili ses silinirse otomatiğe düşer, tek Türkçe seste yönlendirme notu çıkar, Türkçe ses yokken yedeğe düşer, hiç ses yokken çökmeme, Türkçe sayı→kelime |
| `araclar/anons-test.mjs` | **40 kontrol** — saat başı / yarım saat / **"Önemli"** kayıt anonsları. Statik tarama değil: sahte `speechSynthesis` **ne söylendiğini**, sahte `Date` **ne zaman söylendiğini** kaydeder, yani ölçülen şey kullanıcının **duyduğu**dur. Mandal (aynı saat başını iki kez okumama), eski `saniye === 0` şartının **kayboluşu**, gün değişiminde yeni kaydın okunması ve dünkü kaydın **tekrar edilmemesi** burada kilitli |
| `araclar/kilit-test.mjs` | **27 kontrol** — kilit kapatınca `data-tauri-drag-region` üç öğeden de kalkar, **açılınca geri konur** (konmazsa widget bir daha taşınamaz), aç/kapa turları özniteliği yıpratmaz, seçim yeniden açılışta kalıcı, sürüm panel alt yazısına tek kaynaktan gider |
| `araclar/yukari-test.mjs` | **43 kontrol** — sahte bir Tauri penceresi (konum, boyut, iş alanı) üzerinde `fit()` gerçekten çalıştırılır; ölçülen şey kullanıcının şikâyetiyle aynı: **saatin ekrandaki yeri değişiyor mu?** Aşağıda yer varsa panel aşağı açılır ve pencere hiç oynamaz; saat dibe yerleştirilmişse panel yukarı alınır ve pencere tam panel yüksekliği kadar yukarı kayar; panel kapanınca her şey eski yerine döner. Ayarlar paneli iş alanına kırpılır; hiçbir yere sığmayan panelde bile saat görünür kalır |
| `araclar/gcal-test.mjs` | **318 kontrol** — PKCE çifti (gerçekten `base64url(SHA-256(verifier))` mi, bağımsız olarak doğrulanır), yetki URL'inin Google'ın istediği bütün alanları taşıması, dönüş adresinin çözülmesi, not → olay dönüşümü (**23:45 + 30 dk = ertesi gün 00:15**), eşitleme kararı (hangi not eklenir / güncellenir / silinir), `state` tutmazsa akışın **durması**, ve istemci sırrının **yalnız token isteğinde** gitmesi (boşken hiç gitmemesi, hiçbir mesaja sızmaması). Son bölümler tur 5'nın iki arızasını kilitler (**tarayıcı açılamazsa akış çıkmaza girmez**, **hata mesajı panel tazelemesi tarafından ezilmez**), tur 12'nin dördünü (**bütün günler eşitlenir**, **"Bağlı" iddia edilmez — ölçülür**, **tarayıcıdaki kapanış sayfası reddi de söyler**, **reddin sebebi arayüze ulaşır**), tur 14'ün ikisini (**sır eksikse akış tarayıcı hiç açılmadan durur** — kullanıcı üç onay ekranını boşuna dolaşmaz; **`client_secret is missing` gibi ham İngilizce hatalar nereye gidileceğini söyleyen Türkçe metne çevrilir**) ve tur 15'i: olay gövdesi **saat dilimini açıkça taşır** (`timeZone` yoksa Google olayı *"Missing time zone definition for start time"* ile reddediyor; `dateTime` kaydırma içermediği için dilimi yalnız bu alan belirler, cihaz dilimi okunamazsa kayıtlı yedeğe düşülür) ve tur 16'yı: takvime ekleme **kendiliğinden** çalışır — not yazınca **bütün günler** gider ve panel ölçülen özeti yazar, saat başı **güvenlik süpürmesi** tek seferlik başarısızlığı yakalar (saniyede bir çağrıldığı için mandallı: iş saatte bir, istek saatte bir) |

Altısı da gerçek hatalardan doğdu — saat başı okuma mandalı `seconds === 0` iken
pencere gizlendiğinde o tek saniyeyi kaçırıyordu; notlar hangi güne bakarsanız
bakın **bugüne** yazılıyordu; tek Türkçe sesli bir makinede "Ece" ile "Emre"
**aynı** sesi veriyordu; kilidin geri konmadığı bir tasarım widget'ı kalıcı
olarak taşınamaz hâle getirirdi; ve **"Hesap Bağla" düğmesi hiçbir şey
yapmıyordu — arkasında işlev yoktu**, üstelik çıkan hata panel tazelemesi
tarafından anında eziliyordu, yani kullanıcı hatayı da göremiyordu. Altıncısı
kullanıcının *"saatimiz ayrıca saat başı saati söylemiyor"* bildirimiydi: anons
kodu tamamen **zamana** bağlı olduğu için statik tarama yeterli değildi — sahte
saat ile **gerçekten söylenip söylenmediği** ölçüldü.
Yayın iş akışı, paket derlenmeden **önce** bu testleri çalıştırır.

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
│  ├─ ses-test.mjs          ← davranış testi: sesli okuma + okuyucu sesi
│  ├─ anons-test.mjs        ← davranış testi: saat başı/yarım saat + önemli kayıt anonsu
│  ├─ kilit-test.mjs        ← davranış testi: yeri kilitle + sürüm kaynağı
│  ├─ yukari-test.mjs       ← davranış testi: panel yönü + pencere yerleşimi
│  ├─ gcal-test.mjs         ← davranış testi: Google Takvim yetkilendirme + eşitleme
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
│     ├─ gcal.js            ← Google Takvim: OAuth (PKCE) + eşitleme
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

## Google Takvim kurulumu (tek seferlik ≈5 dk)

Takvim entegrasyonu **kendi** Google projeniz üzerinden çalışır. Nedeni teknik
değil ilkesel: program GPL-3.0 ve kaynak kodu herkese açık, dolayısıyla içine
gömülü bir **istemci sırrı** koymak onu yayınlamak olurdu. Bunun yerine her
kullanıcı kendi istemcisini açar ve **kendi** sırrını girer; sır yalnız o
kullanıcının makinesinde (`localStorage`) durur. Akış ayrıca **PKCE** ile
korunur — kodu ele geçiren biri `code_verifier` olmadan jetonu kullanamaz.

> **Neden sır gerekiyor?** Google'ın "iOS & Masaüstü Uygulamaları" belgesi
> `client_secret` alanını *"isteğe bağlı"* yazar; ama uç nokta masaüstü
> istemcilerinde varlığını **zorunlu** tutar. Alan hiç yoksa istek
> `client_secret is missing` ile, yanlışsa `invalid_client` ile reddedilir.
> PKCE bunun yerini tutmaz: `code_verifier` kodu çalan üçüncü kişiyi engeller,
> istemciyi **tanımlamaz**.

1. <https://console.cloud.google.com/> → yeni proje (ör. `Palet Zaman`)
2. **APIs & Services → Library** → *Google Calendar API* → **Enable**
3. **OAuth consent screen** → *External* → uygulama adı + e-posta → kaydet.
   *Test users* listesine **kendi Gmail adresinizi** ekleyin (uygulamayı yayına
   almanız gerekmez; test modu bunun için yeterlidir)
4. **Credentials → Create credentials → OAuth client ID → Desktop app**
5. Çıkan **Client ID**'yi kopyalayın (`…apps.googleusercontent.com` ile biter)
6. Aynı istemcinin **istemci sırrını** kopyalayın (`GOCSPX-…` ile başlar)
7. Widget → **Ayarlar → GOOGLE TAKVİM** → iki değeri de yapıştırın →
   **Hesap Bağla**

Tarayıcıda Google onay sayfası açılır. İzin verince sekme kendini kapatır ve
widget takvimle eşitlenir; bundan sonra her not değişikliği takvime yansır.
Bağlantı **Bağlantıyı kes** ile koparılır.

> **Tarayıcı açılmazsa ne olur?** Onay adresi, tarayıcı denenmeden **önce**
> panelde görünür. Windows bir sebeple varsayılan tarayıcıyı açamazsa akış
> durmaz: yanındaki **Adresi kopyala** düğmesiyle adresi kopyalayıp kendi
> tarayıcınıza yapıştırın — dönüş yine `127.0.0.1` dinleyicisine düşer ve
> bağlantı normal şekilde tamamlanır. Adres tek kullanımlıktır ve **istemci
> sırrını taşımaz** (yalnız PKCE `code_challenge`), yani kopyalanması güvenlidir.

> **Bağlantı yine kurulmuyorsa** paneldeki mesajı okuyun — hata metni artık
> gizlenmez. En sık üç sebep: (1) Client ID `…apps.googleusercontent.com`
> ile bitmiyor, (2) **istemci sırrı eksik** (*"client_secret is missing"* —
> panel sizi doğrudan Konsol'un İstemciler sayfasına götürür), (3) OAuth
> *consent screen* → *Test users* listesine kendi Gmail adresiniz
> eklenmemiş (test modunda listede olmayan hesap reddedilir: `access_denied`).

> **Sır kimin?** Gömülü bir sır yok. Client ID ve istemci sırrı **sizin kendi**
> istemcinize aittir ve yalnızca bu makinede (`localStorage`) tutulur; hiçbir
> yere gönderilmez ve hiçbir hata mesajında görünmez. Client ID gizli bilgi
> değildir; istemci sırrı da bu bağlamda Google tarafından *"secret olarak
> görülmez"* — yine de bu program onu asla kaynağına gömmez, her kullanıcı
> kendisininki girer. Erişim jetonu yalnızca `calendar.events` kapsamına
> sahiptir — program takviminize yazabilir, ama başka hiçbir Google verinize
> erişemez.

> **Eşitleme kapsamı:** "Gönder" düğmesi ve bağlanma anı, yalnızca baktığınız
> günü değil **notu olan bütün günleri** gönderir. Tek bir gün hata verirse
> eşitleme **durmaz**; o gün "atlandı" olarak sayılır ve özet cümlesinde sebebiyle
> görünür — sessizce yutulmaz.

> **Bağlantı gerçekten kuruldu mu?** Panel bunu **iddia etmez, ölçer**: açılışta
> takvime tek bir istek atar. Ölçüm başarısızsa *"Bağlı ✓"* **yazılmaz**; sebep ve
> çıkış yolu (*"Bağlantıyı kes" deyip yeniden bağlanın*) gösterilir. Başarılıysa
> saat damgası düşülür: *"Bağlı ✓ · doğrulandı 14:05 · son eşitleme 14:03"*.

> **Notlar takvimde nasıl görünür?** Her not, yazdığınız saatte başlayan
> **30 dakikalık** bir olay olur. Olaylar `pza` özel alanıyla işaretlenir, bu
> yüzden widget yalnızca **kendi** oluşturduğu olayları günceller ve siler —
> takviminizdeki diğer etkinliklere dokunmaz. Bağlantıyı kesmek takvimdeki
> notları **silmez**.

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
