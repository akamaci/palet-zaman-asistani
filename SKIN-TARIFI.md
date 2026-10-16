# 🎨 SKIN TARİFİ — yapay zekâ ajanları için `pza-skin/2`

> **Bu bir "yemek tarifi"dir.** Bir yapay zekâ botu/ajanı (veya insan) bu adımları
> izleyerek Palet Zaman Asistanı için **yeni bir görünüm (skin)** üretir.
> Çıktı: tek bir **`.pzaskin.json`** dosyası. Uygulamada **Ayarlar → Görünüm → ＋**
> → Stüdyo → *İçe aktar* ile yüklenir ve **Görünüm** listesinde seçilir.
>
> Bu biçim **Winamp'ın "classic skin" mantığının** Web karşılığıdır: **bütün olarak
> tasarla → döşeme(plaka) + koordinat haritası → paketle.** Fark: BMP değil
> **WebP/PNG**, `skin.txt` değil **JSON**.

---

## 0. Malzeme listesi (sen ne üretirsin)

| Malzeme | Ne | Zorunlu? |
|---|---|---|
| **plaka** (`plate`) | Widget'ın **statik şasi/çerçeve** görseli. **İçinde saat/tarih/hava gibi CANLI yazı OLMAZ.** | ✅ |
| **tuval** (`canvas`) | Plakanın piksel ölçüsü, `{ "w": 940, "h": 430 }` | ✅ |
| **bölgeler** (`regions`) | Canlı kontrollerin plaka üzerindeki **dikdörtgenleri** | ✅ (en az 1) |
| **renkler** (`tokens`) | Yazı/vurgu renkleri (CSS değişkenleri) | ➖ (ops.) |
| **fontlar** (`fontUI`,`fontNum`) | Yazı tipleri | ➖ (ops.) |

Kural: **plaka = dekor**, **bölgeler = canlı veri**. Saati plakaya basma — uygulama
saati kendi çizer, sen yalnız "saat burada duracak" diye koordinat verirsin.

---

## 1. Tarif — adım adım

### 1) Plakayı elde et (940×430 önerilir)
- Bir tasarım aracıyla (veya bir görsel üreticiyle) **widget şasisini** çiz:
  gövde, çerçeve, köşe vurguları, pod/kutu **zeminleri**.
- **Dinamik yazı koyma** (saat, tarih, derece, şehir, "Ayarlar" yazısı…). İstersen
  **boş** kutu/pod çerçevelerini çiz; canlı kontrol o kutunun içine oturacak.
- Kaydet: **WebP** (önerilen, küçük) veya **PNG** (alfa için). **BMP KULLANMA.**
- Uygulamaya `data:image/webp;base64,…` olarak gömülecek.

> 💡 Ajanlar için: `skin-araclari/plaka-uret.mjs` bir HTML tasarımından
> **plaka + bölge koordinatlarını** otomatik çıkarır (bkz. §4).

### 2) Tuvali yaz
```json
"canvas": { "w": 940, "h": 430 }
```

### 3) Bölgeleri ölç (piksel, sol-üst = 0,0)
8 bölge adı vardır; **hepsi zorunlu değil**, yalnız kullandıklarını ver:

| Bölge anahtarı | Ne | Örnek `{x,y,w,h}` (940×430) |
|---|---|---|
| `clock`    | flip saat (HH:MM:SS) | 256,144,428,122 |
| `date`     | tarih satırı         | 383,32,174,24 |
| `weather`  | hava durumu kutucuğu | 36,109,202,126 |
| `notes`    | "Günün Notları" düğmesi | 702,136,202,66 |
| `theme`    | aydınlık/karanlık şalteri | 702,218,202,56 |
| `settings` | Ayarlar düğmesi      | 36,251,202,50 |
| `ezan`     | ezan ses/vakit düğmesi | 817,366,36,32 |
| `pa`       | PA (sürüm) rozeti    | 865,369,39,26 |

```json
"regions": {
  "clock":   { "x": 256, "y": 144, "w": 428, "h": 122 },
  "date":    { "x": 383, "y": 32,  "w": 174, "h": 24 },
  "weather": { "x": 36,  "y": 109, "w": 202, "h": 126 },
  "notes":   { "x": 702, "y": 136, "w": 202, "h": 66 },
  "theme":   { "x": 702, "y": 218, "w": 202, "h": 56 },
  "settings":{ "x": 36,  "y": 251, "w": 202, "h": 50 },
  "ezan":    { "x": 817, "y": 366, "w": 36,  "h": 32 },
  "pa":      { "x": 865, "y": 369, "w": 39,  "h": 26 }
}
```
> `clock` otomatik olarak **bölgeye sığdırılır** (merkezlenir + ölçeklenir); diğer
> kontroller bölge kutusunu **doldurur**.

### 4) Renk ve font (opsiyonel)
```json
"tokens": { "--fg": "#cbd5e1", "--fg-dim": "#7b8ea8", "--accent": "#00f0ff",
            "--on-accent": "#04121a", "--warn": "#ffb703", "--ok": "#34d399" },
"fontUI":  "'JetBrains Mono', 'Segoe UI', monospace",
"fontNum": "'JetBrains Mono', 'Consolas', monospace"
```

### 5) Dosyayı birleştir
```json
{
  "format": "pza-skin/2",
  "id": "orbital-hud",
  "name": "Orbital HUD",
  "author": "Paletweb",
  "canvas": { "w": 940, "h": 430 },
  "plate": "data:image/webp;base64,…………",
  "regions": { … §3 … },
  "tokens": { … §4 … },
  "fontUI": "…", "fontNum": "…"
}
```

### 6) Kendi kendini denetle (kabul kuralları)
- `format` **tam olarak** `"pza-skin/2"`.
- `plate` `data:image/(webp|png|jpeg|gif);base64,…` ile başlar.
- `canvas.w ≥ 100`, `canvas.h ≥ 60`.
- Her bölge `x,y,w,h` **sayı** ve **tuval içinde** (0 ≤ x, x+w ≤ canvas.w …).
- **En az bir** tanınan bölge anahtarı (§3 listesi dışındakiler yok sayılır).
- Plakaya canlı yazı basma (yoksa çift yazı olur).

### 7) Uygula
Ayarlar → **Görünüm** → **＋** → Stüdyo → *Dosyadan al / kodu yapıştır* →
liste başında/adında görünür → seç.

---

## 2. Bölge → canlı kontrol eşlemesi (uygulama içi)
`clock→#flip-row · date→.dateline · weather→#weather-tile · notes→#btn-notes ·
theme→.theme-switch · settings→#btn-settings · ezan→.ezan-ctl · pa→#pa-btn`

---

## 3. İyi tarif örnekleri (yapay zekâya verilecek istemler)
- *"940×430 lacivert HUD gövdesi, ortada altı haneli flip-clock pod'u, solda hava
  kutusu, sağda düğme kutusu; üzerine HİÇ yazı yazma, yalnız çerçeveler. WebP."*
- *"Amber taktik tema, aynı yerleşim; köşe kelepçeleri ve turuncu glow."*
- *"Monokrom, tek beyaz vurgu; cam gibi yarı saydam gövde."*

Bölgeleri **aynı bırak**, yalnız plakayı değiştir → yeni skin hazır.

---

## 4. Araçlar (agent'lar için)
- **`skin-araclari/plaka-uret.mjs`** — bir **HTML** tasarımından plaka (WebP) +
  `regions` koordinatlarını üretir, `.pzaskin.json` yazar:
  ```
  node skin-araclari/plaka-uret.mjs tasarim.html cikti.pzaskin.json <id> "<Ad>"
  ```
- **Gömülü örnek:** `src/js/skins-builtin.js` → `PZA.PLATE_SKINS.orbital`
  (gerçek `pza-skin/2`). Kopyala, plakayı/token'ları değiştir.
- **Doğrulayıcı:** `PZA.importSkin(text)` (uygulama içi) — §6 kurallarını uygular.

## 5. Lisans & sınırlar
- Skin = JSON + görsel; **kimlik/şifre gömme**. Görsellerin lisansı sana ait olsun.
- Biçim sürümü `pza-skin/2`; `pza-skin/1` (yalnız renk+arka plan) hâlâ geçerli.
