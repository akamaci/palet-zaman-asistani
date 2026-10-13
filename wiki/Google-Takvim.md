# Google Takvim Bağlantısı

Palet Zaman Asistanı, günün notlarınızı **kendi Google Takviminize** aynalayabilir.
İsterseniz hiç kullanmayabilirsiniz — bu özellik **tamamen isteğe bağlıdır** ve
program onsuz da eksiksiz çalışır.

> **Özet:** Ayarlar → GOOGLE TAKVİM → iki alanı doldur → **Hesap Bağla**.
> İki alanı nereden alacağınız aşağıda, ~5 dakikada bir kez yapılır.

---

## 1. Google Takvim bölümünü bulun

![Google Takvim ayarları](https://raw.githubusercontent.com/akamaci/palet-zaman-asistani/main/wiki-img/03-google-takvim.jpg)

Widget'ta **Ayarlar**'ı açın ve **GOOGLE TAKVİM** başlığına inin. Burada şunlar var:

| Öğe | Ne yapar |
|---|---|
| **Hesap Bağla** | Tarayıcıda Google onay sayfasını açar; izin verince bağlantı kurulur |
| **Konsolu aç** | Google Cloud Console'u doğrudan bu sayfadan açar (adım 2–4) |
| **Ayrıntılı anlatım (wiki)** | Bu sayfayı uygulamadan açar — adres ezberlemenize gerek yok |
| **Client ID alanı** | `…apps.googleusercontent.com` ile biten **açık** değer |
| **İstemci sırrı alanı** | `GOCSPX-…` ile başlayan değer — yalnızca bu makinede saklanır |

---

## 2. Neden kendi istemcimi kurmam gerekiyor?

Bu teknik bir zorunluluk değil, **ilkesel** bir tercih:

Program **GPL-3.0** lisanslı açık kaynak. Kaynak kodu herkese açık olduğu için
içine gömülü bir **istemci sırrı** koymak, onu herkesle paylaşmak anlamına gelirdi.
Onun yerine her kullanıcı **kendi** Google istemcisini açar ve **kendi** sırrını
girer. Sır yalnızca sizin makinenizde (`localStorage`) durur; hiçbir yere
gönderilmez ve hiçbir hata mesajında görünmez.

Akış ayrıca **PKCE** ile korunur — yetki kodunu ele geçiren biri, `code_verifier`
olmadan onu jetona çeviremez.

> **"Neden istemci sırrı gerekiyor?"** Google'ın *iOS & Masaüstü Uygulamaları*
> belgesi bu alanı "isteğe bağlı" yazar; fakat uç nokta masaüstü istemcilerinde
> varlığını **zorunlu** tutar. Alan boşsa istek `client_secret is missing` ile
> reddedilir.

**Tek seferlik bir kurulumdur.** Bir kere yaptıktan sonra bir daha uğraşmazsınız.

---

## 3. Kendi istemcinizi oluşturun (≈5 dk)

### a) Proje açın

<https://console.cloud.google.com/> → üstteki proje seçicisi → **New Project**
→ ad verin (ör. `Palet Zaman`) → **Create**.

### b) Google Calendar API'yi açın

**APIs & Services → Library** → arama kutusuna *Google Calendar API* yazın →
açın → **Enable**.

> API'yi açmadan sonraki adımlar çalışmaz; "API has not been used in project"
> hatası alırsanız bu adımı atlamışsınızdır.

### c) İzin ekranını doldurun

**APIs & Services → OAuth consent screen**

- **User type:** *External* → **Create**
- Uygulama adı, destek e-postası, geliştirici iletişim e-postası → **Save and continue**
- **Scopes:** hiçbir şey eklemeyin, kaydedip devam edin
- **Test users:** **kendi Gmail adresinizi** ekleyin → **Save and continue**

> **Not:** Uygulamayı yayına almanız gerekmez. *Testing* modu bu iş için
> yeterlidir. Sonradan uygulamanızı **Production**'a alırsanız, yenileme jetonu
> artık 7 günde bir dolmaz ve tekrar tekrar bağlanmanız gerekmez — bunu
> yapmak isterseniz Branding sayfasındaki *Application home page* ve
> *Application privacy policy link* alanlarını doldurmanız gerekir.

### d) Masaüstü istemcisi oluşturun

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- **Application type:** **Desktop app**
- Ad verin (ör. `Palet Zaman Asistanı`) → **Create**

### e) İki değeri kopyalayın

Açılan pencerede:

| Değer | Biçim | Nereye |
|---|---|---|
| **Client ID** | `1234567890-xxxx.apps.googleusercontent.com` | Widget → *Client ID* alanı |
| **Client secret** | `GOCSPX-…` | Widget → *İstemci sırrı* alanı |

Pencereyi kapatırsanız değerleri sonradan **Credentials** listesinden açıp
tekrar görebilirsiniz.

---

## 4. Widget'a girin ve bağlanın

1. İki değeri ilgili alanlara yapıştırın.
2. **Hesap Bağla** düğmesine basın.
3. Varsayılan tarayıcınızda Google onay sayfası açılır.
4. Hesabınızı seçin. *"Google bu uygulamayı doğrulamadı"* uyarısı çıkarsa
   **§4.1**'e bakın (düğme adları orada, birebir).
5. Açılan izin ekranında **"Devam Et"**e basın. *(Ekranda vurgulu/mavi düğme
   varsa dikkat — doğru olan düz **"Devam Et"** olabilir.)*

Sekme kendini kapatmayı dener; kapanmazsa **"Bağlandı"** yazan sayfayı görüp
elle kapatabilirsiniz. Birkaç saniye içinde panelde **"Bağlı"** yazısını görürsünüz.

> Panel "Bağlı" yazarken bunu **iddia etmez, ölçer** — açılışta takvime sorar.
> Yani gördüğünüz yazı gerçek durumdur.

### 4.1 "Google bu uygulamayı doğrulamadı" ekranı

Bu ekran **normaldir**: uygulama kendi Google projenizde çalıştığı için Google
onu "doğrulanmamış" sayar. Ekranda **iki** yon var; yanlış olan **vurgulu**
düğmedir — çoğu kullanıcı burada akıştan çıkıyor.

| Ekranda görünen | Basılacak mı? |
|---|---|
| **"GÜVENLİĞE GERİ DÖN"** (mavi, vurgulu, sağda) | ❌ **HAYIR** — akıştan çıkarır |
| **"Gelişmiş Ayarlar"** (solda, küçük, altı çizili) | ✅ **EVET** — buna basın |
| Açılan yerden **"<uygulama adı> uygulamasına git (güvenli değil)"** | ✅ **EVET** — buna basın |
| Sonraki izin ekranında **"Devam Et"** | ✅ **EVET** |

> **Kısaca:** *Gelişmiş Ayarlar → … uygulamasına git → Devam Et.*
> Mavi **"Güvenliğe geri dön"**e basmayın.

---

## 5. Ne olur, ne olmaz

**İstenen izin yalnızca şudur:**

```
https://www.googleapis.com/auth/calendar.events
```

Yani **yalnızca takvim etkinlikleri** — görme, oluşturma, güncelleme, silme.
Program başka hiçbir Google verinize erişemez (Gmail, Drive, kişiler, takvim
listesi dâhil değil).

**Takvimde ne oluşur:** Her notunuz, yazdığınız saatte başlayan **30 dakikalık**
bir etkinliğe dönüşür ve `pza` özel alanıyla işaretlenir. Program takviminizde
yalnızca **kendi oluşturduğu** etkinlikleri günceller ve siler; elle girdiğiniz
etkinliklere dokunmaz.

**Eşitleme özeti sayıyla konuşur:** *"N gün tarandı · X yeni, Y güncellendi,
Z silindi · takvimde K not"*. Atlanan gün **gizlenmez** — hangi günün neden
atlandığı yazılır.

**Bağlantıyı kesme:**

- Widget içindeki **Bağlantıyı kes** düğmesi erişim jetonunu iptal eder.
- Alternatif: <https://myaccount.google.com/permissions> → uygulamayı seçin →
  **Erişimi kaldır**.

Bağlantıyı kesmek takviminizdeki etkinlikleri **silmez**.

---

## 6. Sorun giderme

| Belirti | Sebep ve çözüm |
|---|---|
| `client_secret is missing` | İstemci sırrı alanı boş. Konsol → **Credentials** → istemciyi açıp **Client secret**'ı kopyalayın. Paneldeki **Konsolu aç** düğmesi sizi doğrudan oraya götürür. |
| `invalid_client` | Client ID veya sır yanlış kopyalanmış. Baştan sona tekrar kopyalayın (baş/son boşluk olmasın). |
| `access_denied` | OAuth *consent screen* → **Test users** listesine kendi Gmail adresiniz eklenmemiş. Ekleyin. |
| *"Google bu uygulamayı doğrulamadı"* ekranı | Normaldir (kendi projeniz, doğrulanmamış). **Gelişmiş Ayarlar → "… uygulamasına git (güvenli değil)" → Devam Et.** Mavi **"Güvenliğe geri dön"**e basmayın. Ayrıntı: bölüm 4.1. |
| Bir hafta sonra tekrar bağlanmam gerekiyor | *Testing* modunda yenileme jetonu 7 günde dolar. Uygulamayı **Production**'a alın (bkz. adım 3c notu). |
| Tarayıcı hiç açılmıyor | Akış durmaz. Panelde görünen **Adresi kopyala** düğmesiyle adresi kopyalayıp kendi tarayıcınıza yapıştırın — dönüş yine `127.0.0.1` dinleyicisine düşer. Adres tek kullanımlıktır ve istemci sırrını **taşımaz**, kopyalanması güvenlidir. |
| Not yazdım ama takvimde görünmüyor | Sağ üstteki eşitleme durumuna bakın. Bağlantı kopmuşsa panel bunu söyler. Bağlıyken not değişikliği **kendiliğinden** gönderilir; ayrıca saat başı bir güvenlik süpürmesi kaçan kaydı yakalar. |

---

## İlgili sayfalar

- [Kullanım](Kullanim)
- [Sık Sorulan Sorular](SSS)
- [Gizlilik Politikası](https://www.palet-web.com/gizlilik/)
