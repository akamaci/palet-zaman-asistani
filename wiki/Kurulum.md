# Kurulum

## İndirme

En son sürüm: <https://github.com/akamaci/palet-zaman-asistani/releases/latest>

**Assets** bölümünden şu dosyayı indirin:

```
Palet.Zaman.Asistani_<sürüm>_x64-setup.exe
```

> **Dosya adı neden böyle?** Tauri, dosya adındaki boşluk ve Türkçe karakterleri
> noktaya çevirir: `Palet Zaman Asistanı` → `Palet.Zaman.Asistani`. Korkmayın,
> kurulunca uygulamanın adı düzgün görünür.

## Kurma

1. İndirdiğiniz `.exe` dosyasını çalıştırın.
2. Windows **SmartScreen** uyarısı çıkabilir:
   *"Windows kişisel bilgisayarınızı korudu"*
   → **Ek bilgi** → **Yine de çalıştır**.
   *(Kurulum paketi imzasız olduğu için bu uyarı normaldir; paket GitHub Actions
   üzerinde bu deponun kaynağından üretilir.)*
3. Kurulum sihirbazını izleyin → **Kur**.

- **Yönetici izni gerekmez** — yalnızca sizin kullanıcı hesabınıza kurulur
  (`currentUser` modu).
- Kurulum dili **Türkçe**'dir.
- Kurulumdan sonra uygulama otomatik açılır; bir daha açmak için Başlat menüsünde
  **Palet Zaman Asistanı**'nı arayın.

## İlk açılış

Saat ekranın bir köşesinde belirir. Yapmanız gereken **tek şey** konum seçmek
(hava durumu için):

**Ayarlar → KONUM** → il adını yazın → seçin.

Başka hiçbir şey zorunlu değil. Not yazmak, skin değiştirmek, tema değiştirmek —
hepsi hazır.

## Kaldırma

**Ayarlar → Uygulamalar → Palet Zaman Asistanı → Kaldır**

veya Başlat menüsünde sağ tık → *Kaldır*.

Kaldırma, `localStorage`'daki notlarınızı ve skinlerinizi de siler. Saklamak
isterseniz skinlerinizi **kod olarak kopyalayıp** bir yere kaydedin (Ayarlar →
GÖRÜNÜM / SKİN → *Kodu kopyala*).

## Windows ile otomatik başlatma

**Ayarlar → BAŞLANGIÇ** anahtarı. Açıkken uygulama Windows açılışında
**8 saniye gecikmeyle** başlar — sistem açılışını yavaşlatmaz.

> Tarayıcı önizlemesinde (`npm run web`) bu anahtar ve *Her Zaman Üstte* çalışmaz;
> ikisi de işletim sistemi API'si ister. Kurulu uygulamada sorunsuz çalışır.

## Sistem gereksinimleri

| | |
|---|---|
| İşletim sistemi | Windows 10 / 11 (64-bit) |
| WebView2 | Windows 10/11'de hazır gelir |
| Disk | ~1,1 MB (ölçülmüş kurulum boyutu) |
| RAM (boşta) | ~40–80 MB |
| Ağ | Yalnızca hava durumu ve (kullanırsanız) Google Takvim için |

---

## İlgili sayfalar

- [Kullanım](Kullanim)
- [Google Takvim Bağlantısı](Google-Takvim)
- [Sık Sorulan Sorular](SSS)
