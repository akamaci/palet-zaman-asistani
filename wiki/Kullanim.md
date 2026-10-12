# Kullanım

![Ana widget](https://raw.githubusercontent.com/akamaci/palet-zaman-asistani/main/wiki-img/01-widget.jpg)

---

## Saat

- **24 saat** mantığıyla, saniyeli çalışır. Rakam değişirken **flip** animasyonu oynar.
- Üstte küçük tarih: `12 Ekim 2026 • Pazartesi`
- Saat **saniye saniye** değil, saniyede bir güncellenir — boşta **%0 CPU** hedefi.
  Pencere gizliyken sayaç tamamen durur, pilinizi yemez.

## Günün notları

Sağdaki oktan aşağı açılan panelde o günün notları durur.

- **Saat-saat notlar** — her not bir saat dilimine bağlıdır.
- **Yıldız** — bir kaydı *önemli* işaretler. Önemli kayıtların saati gelince
  sesli olarak **"Önemli. …"** diye okunur.
- **Önizleme** — ana ekranda ilk 5 not başlığı şerit hâlinde görünür.

## Takvim

Tarihe basınca takvim açılır:

- Başka bir **güne not girebilirsiniz** — not, baktığınız güne yazılır.
- **Geçmişe** bakabilirsiniz.
- **"Bugüne dön"** ile çıkılır.

## Hava durumu

Sol kutucuğa (veya `<` işaretine) basın:

- **7 günlük tahmin**
- **Gün doğumu yayı**
- **Telemetri** şeridi
- **Konum** — Ayarlar → KONUM'dan elle il seçilir (geocoding ile arama).
  Seçim önbelleğe alınır; her açılışta yeniden sorulmaz.

Veri **20 dakika** önbelleklenir: API kotası ve ağ trafiği boşa harcanmaz.

## Sesli okuma

Ayarlar → **SESLİ OKUMA**:

| Anahtar | Varsayılan | Ne yapar |
|---|---|---|
| **Her saat başı oku** | açık | `15:00` → *"saat on beş"* |
| **Her yarım saatte oku (:30)** | kapalı | `17:30` → *"saat on yedi, otuz"* |
| **Önemli kayıtları oku** | — | Yıldızlı kaydın saati gelince okur |

**Okuyucu sesi** — sistemde **kurulu** sesler listelenir; kadın sesi otomatik
seçilir ve **adıyla** hatırlanır. Seçtiğiniz ses sonradan silinirse otomatik
seçime düşer.

> Tek (veya hiç) Türkçe ses varsa panel size ses ekleme yolunu gösterir:
> *"Bayan sesi buradan ayarlanır"* — Windows'a yeni bir Türkçe kadın sesi
> kurmak için Ayarlar → Zaman ve Dil → Konuşma.

## Ayarlar paneli

![Ayarlar](https://raw.githubusercontent.com/akamaci/palet-zaman-asistani/main/wiki-img/02-ayarlar.jpg)

| Bölüm | İçindekiler |
|---|---|
| **GÖRÜNÜM / SKİN** | Halo · Klasik · Neon · Minimal seçimi, **＋ Yeni** ile Skin Stüdyosu |
| **GÖRÜNÜRLÜK** | Hava durumu ve not başlıklarını ayrı ayrı kapatma (sade mod) |
| **TEMA** | Aydınlık / karanlık |
| **SESLİ OKUMA** | Yukarıya bakın |
| **KONUM** | Hava durumu için il seçimi |
| **GOOGLE TAKVİM** | [Ayrı sayfa](Google-Takvim) |
| **WİDGET BOYUTU** | 1/2 · 1/3 · 1/4 ölçek |
| **BAŞLANGIÇ** | Windows ile otomatik başlatma (8 sn gecikmeli) |

## Skinler ve Skin Stüdyosu

Winamp mantığı: **skin** arayüzün renk ve tipografi dünyasını değiştirir.
Dört yerleşik skin var; siz de kendinizinkini yapabilirsiniz.

**Ayarlar → GÖRÜNÜM / SKİN → ＋ Yeni**

- **27 renk** — zemin, yüzey, çizgi, metin, vurgu, flip kartı, anlamsal.
  Her rengin yanındaki kaydırıcı **saydamlık**.
- **Karanlık / Aydınlık** ayrı sekmeler. Aydınlık sekmeye ilk geçişte karanlık
  palet kopyalanır — sıfırdan başlamazsınız.
- **Arka plan görseli** — opaklık ve *kapla / sığdır / döşe*. Görsel otomatik
  küçültülüp sıkıştırılır.
- **Köşe yuvarlaklığı** ve **font**.
- Her değişiklik **anında** gerçek widget'a uygulanır.

**Paylaşma:** *Kodu kopyala* → arkadaşınıza gönderin → o da *Kod yapıştır* ile
alsın. Dosya olarak da indirebilirsiniz (`.pzaskin.json`).

## Pencere davranışları

- **Yeri kilitle** — sağ üstteki kilit ikonu pencereyi olduğu yere sabitler.
  Seçim kalıcıdır; açılışta korunur.
- **Her Zaman Üstte** — varsayılan **kapalı**. Kapalıyken widget normal bir
  penceredir; tarayıcının veya videonun önüne geçmez.
- **Boyut** — genişlik kutuya değil **içeriğe** göre daralır, yani saat
  kenarlarda boşlukta kalmaz. 1/4 ölçekte mini hava göstergesi korunur.
- **Panel yönü** — saat masaüstünün dibindeyse notlar/hava paneli **yukarı**
  açılır (aşağı açılsa görev çubuğunun altında kalırdı). Pencere panelin
  yüksekliği kadar kayar, **saat ekranda olduğu yerde kalır**.
- **Ekrana sığdırma** — Ayarlar paneli açılınca pencere büyür ama
  **görev çubuğunu aşmaz**; panel kapanınca eski yerine döner.
- **Tepsi** — Kapatınca uygulama tepsiye küçülür, tepsiden geri açılır.

---

## İlgili sayfalar

- [Kurulum](Kurulum)
- [Google Takvim Bağlantısı](Google-Takvim)
- [Sık Sorulan Sorular](SSS)
