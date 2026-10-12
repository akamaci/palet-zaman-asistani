# Sık Sorulan Sorular

## Kurulum

**Windows "bilgisayarınızı korudu" diyor, güvenli mi?**
Kurulum paketi imzasız olduğu için SmartScreen uyarır. Paket, bu deponun
kaynağından GitHub Actions üzerinde üretilir; kaynak kodu açıktır ve
[Actions sekmesinden](https://github.com/akamaci/palet-zaman-asistani/actions)
derleme kaydını görebilirsiniz. **Ek bilgi → Yine de çalıştır** ile devam edin.

**Yönetici izni istiyor mu?**
Hayır. Yalnızca sizin hesabınıza kurulur.

**MSI kurulum dosyası yok mu?**
Yok, bilinçli olarak. MSI hedefi `light.exe` adımında düşüyor; NSIS (`.exe`)
aynı derlemede sorunsuz üretiliyor. Son kullanıcı için fark yoktur — MSI yalnızca
grup ilkesiyle (GPO) kurumsal dağıtımda gerekir.

---

## Veri ve gizlilik

**Notlarım nerede tutuluyor?**
Yalnızca kendi bilgisayarınızda (`localStorage` → WebView2 profil klasörü).
Hiçbir sunucuya gönderilmez. Tam metin: <https://www.palet-web.com/gizlilik/>

**Program beni izliyor mu?**
Hayır. Çerez yok, analitik yok, çökme raporu yok, reklam kimliği yok.

**İnternet bağlantısı olmadan çalışır mı?**
Evet — hava durumu ve Google Takvim dışında her şey çevrimdışı çalışır.

---

## Saat ve anons

**Saat başı anons bazen gelmiyor.**
Anons, **dakika 00 içindeki herhangi bir saniyede** bir kez çalışır ve mandallıdır:
aynı saat başı ikinci kez okunmaz. Bilgisayar o dakika uykudaysa anons o saat için
kaçar, bir sonraki saatte yeniden çalışır.

**Kadın sesi yok, ne yapmalıyım?**
Windows'a Türkçe kadın sesi kurun: **Ayarlar → Saat ve Dil → Konuşma → Ses ekle**.
Kurulumdan sonra widget'ı yeniden açın; ses listesi kendini tazeler.

---

## Google Takvim

**Neden kendi istemcimi kurmak zorundayım?**
Program GPL-3.0 açık kaynak; içine gömülü istemci sırrı koymak onu yayınlamak
olurdu. Bu yüzden her kullanıcı kendi istemcisini açar. Tek seferlik ~5 dakikalık
bir iştir. Ayrıntı: **[Google Takvim Bağlantısı](Google-Takvim)**

**Bir hafta sonra tekrar bağlanmam isteniyor.**
OAuth uygulamanız *Testing* modunda olduğu için yenileme jetonu 7 günde doluyor.
Uygulamayı **Production**'a alırsanız bu sınır kalkar. Adımlar:
[Google Takvim → adım 3c notu](Google-Takvim)

**"Bu uygulama doğrulanmadı" uyarısı çıkıyor.**
Normaldir — uygulama kendi Google projenizde test modunda. **Gelişmiş** →
git ile devam edin.

---

## Görünüm ve pencere

**Widget tarayıcının önüne geçiyor.**
**Her Zaman Üstte** varsayılan olarak **kapalıdır**; açmışsınızdır. Sağ üstteki
anahtardan kapatın.

**Pencere yanlışlıkla taşınıyor.**
Sağ üstteki **kilit** ikonunu kullanın. Seçim kalıcıdır.

**Panel aşağı açılıyor ve görev çubuğunun altında kalıyor.**
Saat masaüstünün dibindeyse panel **otomatik olarak yukarı** açılır. Aşağı açılıyor
görüyorsanız saati biraz yukarı taşıyın.

**Skinlerimi paylaşabilir miyim?**
Evet. Ayarlar → GÖRÜNÜM / SKİN → **Kodu kopyala** ile kodu alıp gönderin;
karşı taraf **Kod yapıştır** ile alır. Dosya olarak da (`.pzaskin.json`)
indirebilirsiniz.

---

## Katkı ve hata bildirimi

- Hata bildirimi / öneri: <https://github.com/akamaci/palet-zaman-asistani/issues>
- Kaynak kod: <https://github.com/akamaci/palet-zaman-asistani>
- Lisans: **GPL-3.0-or-later** — Paletweb Bilişim

---

## İlgili sayfalar

- [Kurulum](Kurulum) · [Kullanım](Kullanim) · [Google Takvim](Google-Takvim)
