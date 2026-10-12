# Gizlilik Politikası — Palet Zaman Asistanı

**Son güncelleme:** 12 Ekim 2026
**Geliştirici:** Paletweb Bilişim
**İletişim:** akamaci@gmail.com

Bu politika, **Palet Zaman Asistanı** adlı Windows masaüstü uygulamasının hangi
verileri işlediğini açıklar.

---

## 1. Özet

Palet Zaman Asistanı **hesap açmanızı istemez**, **hiçbir veriyi kendi sunucusuna
göndermez** ve **hiçbir veriyi satmaz veya paylaşmaz**. Notlarınız, ayarlarınız ve
kendi oluşturduğunuz temalar (skinler) yalnızca **kendi bilgisayarınızda** kalır.

## 2. Cihazınızda kalan veriler

Aşağıdakiler yalnızca bilgisayarınızdaki yerel uygulama deposunda (`localStorage`
→ WebView2 profil klasörü) tutulur ve hiçbir sunucuya gönderilmez:

- Günün notları ve randevularınız
- Uygulama ayarlarınız (görünüm, tema, ses, konum tercihi)
- Kendi oluşturduğunuz temalar ve tema arka plan görselleri
- Google Takvim için girdiğiniz **Client ID** ve **istemci sırrı**

Bu verileri uygulamayı kaldırarak veya uygulama içindeki ayarlardan silerek
tamamen yok edebilirsiniz.

## 3. Hava durumu

Hava durumu tahmini için **yalnızca seçtiğiniz şehrin coğrafi koordinatı**
[Open-Meteo](https://open-meteo.com) servisine gönderilir. Kimlik, hesap bilgisi,
çerez veya başka bir kişisel veri gönderilmez. Open-Meteo'nun kendi gizlilik
politikası geçerlidir: <https://open-meteo.com/en/terms>

## 4. Google Takvim entegrasyonu

Google Takvim bağlantısı **isteğe bağlıdır** ve yalnızca siz "Hesap Bağla"
dediğinizde kurulur.

- **İstenen izin (kapsam):** yalnızca
  `https://www.googleapis.com/auth/calendar.events`
  — yani yalnızca takvim **etkinliklerini** görme, oluşturma, güncelleme ve silme.
  Program başka hiçbir Google verinize erişemez.
- **Kimlik doğrulama:** Google'ın standart OAuth 2.0 akışı, **PKCE** korumasıyla.
  Erişim jetonu ve yenileme jetonu yalnızca cihazınızda saklanır.
- **Kendi istemcinizi kullanırsınız:** Program GPL-3.0 ile açık kaynak olduğundan
  içine gömülü bir istemci sırrı **yoktur**. Her kullanıcı kendi Google Cloud
  projesinde bir masaüstü istemcisi açar ve kendi Client ID ile istemci sırrını
  girer. Bu değerler yalnızca sizin makinenizde tutulur; hiçbir yere gönderilmez ve
  hiçbir hata mesajında görünmez.
- **Takvimde ne oluşturulur:** Her notunuz, yazdığınız saatte başlayan 30 dakikalık
  bir etkinliğe dönüşür ve `pza` özel alanıyla işaretlenir. Program takviminizde
  yalnızca **kendi oluşturduğu** etkinlikleri günceller ve siler; diğer
  etkinliklerinize dokunmaz.
- **Bağlantıyı kesme:** Uygulama içindeki **Bağlantıyı kes** düğmesi erişim
  jetonunu iptal eder. Ayrıca
  <https://myaccount.google.com/permissions> adresinden erişimi her zaman
  kaldırabilirsiniz. Bağlantıyı kesmek takviminizdeki etkinlikleri silmez.

### Google API Hizmetleri Kullanıcı Verileri Politikası

Palet Zaman Asistanı'nın Google API'lerinden aldığı bilgilerin kullanımı,
[Google API Hizmetleri Kullanıcı Verileri Politikası](https://developers.google.com/terms/api-services-user-data-policy)
ve *Limited Use* (Sınırlı Kullanım) şartlarına uygundur.

Özellikle:

- Google kullanıcı verileri yalnızca uygulamanın **kendi işlevini yerine getirmek**
  için kullanılır (notlarınızı kendi takviminize yansıtmak).
- Google kullanıcı verileri **reklam amacıyla kullanılmaz**, reklam kişiselleştirme
  için işlenmez ve **üçüncü taraflara aktarılmaz**.
- Program Google verilerinizi **hiçbir sunucuya göndermez**; veri akışı doğrudan
  kendi bilgisayarınızdan Google'a gider.
- Google kullanıcı verileri insanlar tarafından **okunmaz**; geliştiricinin verinize
  erişimi yoktur.

## 5. Çerezler ve izleme

Uygulama **çerez kullanmaz**, **analitik toplamaz**, **çökme raporu göndermez** ve
sizi **izlemez**. Reklam kimliği veya cihaz parmak izi oluşturmaz.

## 6. Üçüncü taraf servisler

| Servis | Amaç | Gönderilen veri |
|--------|------|-----------------|
| Open-Meteo | Hava durumu tahmini | Yalnızca seçilen şehrin koordinatı |
| Google Calendar API | Takvim eşitleme (isteğe bağlı, yalnız siz bağlarsanız) | Notlarınızdan oluşturulan etkinlikler |

Başka hiçbir üçüncü taraf servis kullanılmaz.

## 7. Çocukların gizliliği

Uygulama 13 yaş altı çocuklardan bilerek veri toplamaz; zaten hiçbir kişisel veri
toplamaz veya iletmez.

## 8. Değişiklikler

Bu politika güncellenirse "Son güncelleme" tarihi değişir ve yeni sürüm bu
adreste yayımlanır.

## 9. İletişim

Sorularınız için: **akamaci@gmail.com**

Kaynak kod: <https://github.com/akamaci/palet-zaman-asistani>
