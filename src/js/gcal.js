/* gcal.js — Google Takvim bağlantısı ve not eşitleme
   Palet Zaman Asistanı · GPL-3.0

   KULLANICI BİLDİRİMİ (tur 4): "Google takvimle entegre olacak yere
   tıklanmasına rağmen açılmıyor. Browserdan Google bağlantı isteği
   gönderip eğer kullanıcı 'google bağlan' demesi halinde takvimle
   senkronize olmalı."

   ESKİDEN: düğme, her çağrıda sabit bir hata dönen `gcal_connect`
   Rust komutunu çağırıyordu; ekranda yalnızca bir metin değişiyordu.
   Hiçbir tarayıcı açılmıyor, hiçbir token alınmıyordu.

   ŞİMDİ — OAuth 2.0 yetkilendirme kodu akışı + PKCE:
     1. Rust boş bir yerel port açar                → gcal_port
     2. Tarayıcı Google onay sayfasına gider        → gcal_ac
     3. Kullanıcı izin verirse Google
        `http://127.0.0.1:<port>/?code=…` adresine döner
     4. Rust bu isteği yakalar                      → gcal_bekle
     5. Arayüz kodu token'a çevirir                 → oauth2.googleapis.com
     6. refresh_token diske yazılır, notlar takvime gönderilir

   NEDEN TOKEN DEĞİŞİMİ ARAYÜZDE? Google'ın token uç noktası CORS
   başlığı veriyor (`Access-Control-Allow-Origin` isteğin Origin'ini
   yansıtıyor — curl ile doğrulandı). Böylece Rust tarafında HTTP
   istemcisi (reqwest) gerekmiyor; iki ilkel yeterli: tarayıcı açmak
   ve loopback dinlemek.

   TUR 14 — İSTEMCİ SIRRI GEREKLİ (önceki varsayım YANLIŞTI).
   Kullanıcı bildirimi: *"Anahtar alınamadı client_secret is missing"*.
   Google'ın "iOS & Masaüstü Uygulamaları" belgesi `client_secret` alanını
   tabloda **"Optional / isteğe bağlı"** yazar; ama uç nokta masaüstü
   istemcilerinde varlığını ZORUNLU tutar. Ölçülen davranış: alan hiç
   yoksa `client_secret is missing`, BOŞ gönderilirse aynı hata, yanlışsa
   `invalid_client`. PKCE bunun yerini TUTMAZ — `code_verifier` kodu çalan
   üçüncü kişiyi engeller, istemciyi tanımlamaz. v1.10.0'a kadar buradaki
   yorum *"masaüstü istemcileri için PKCE yeterlidir"* diyordu; bu yüzden
   jeton takası hiç tamamlanamadı ve hata kullanıcıya ham İngilizce
   (`client_secret is missing`) olarak göründü.

   GPL açısından sorun YOK: uygulama kendi sırrını taşımaz. Her kullanıcı
   kendi Google projesinde kendi istemcisini açar (tur 5-11) ve sır yalnız
   o kullanıcının makinesindeki localStorage'da durur; kaynakta yayımlanan
   bir sır yoktur. Google'ın kendi ifadesiyle bu bağlamda *"client secret
   is obviously not treated as a secret"*.

   KAPSAM: yalnızca `calendar.events`. Kişisel bilgi, kişi listesi veya
   başka takvim okunmaz; `primary` takvimin olayları okunur/yazılır. */
window.PZA = window.PZA || {};

const GCALKEY = 'pza.gcal.v1';

PZA.GCAL = {
  AUTH: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN: 'https://oauth2.googleapis.com/token',
  KES: 'https://oauth2.googleapis.com/revoke',
  API: 'https://www.googleapis.com/calendar/v3',
  SCOPE: 'https://www.googleapis.com/auth/calendar.events',
  IZ: 'pza',                    // extendedProperties.private anahtarı
  SURE: 30,                     // bir notun takvimdeki süresi (dakika)
  /* TUR 7 — erişim reddedildiğinde gidilecek yer: OAuth izin ekranının
     "Kitle (Audience)" sayfası; test kullanıcıları ve Yayınla düğmesi
     orada. Adres `gcal_ac` beyaz listesine de uyar (console.cloud.google.com). */
  KITLE: 'https://console.cloud.google.com/auth/audience'
};

/* TUR 7 — "Paletsaat, Google doğrulama sürecini tamamlamadı … yalnızca
   test kullanıcıları erişebilir · Hata 403: access_denied".

   Google bu durumda YÖNLENDİRME YAPMAZ: kullanıcıya kendi hata sayfasını
   gösterir ve loopback dinleyicisine hiçbir istek düşmez. Yani uygulama
   reddi ÖĞRENEMEZ — öğrenebildiği tek şey 180 saniyelik zaman aşımıdır.
   Bu yüzden sebep ve atılacak adım, akış boyunca ve zaman aşımında
   gösterilir: öğrenilemeyen bir reddi kullanıcıya açıklamanın tek yolu,
   olasılığı ÖNCEDEN yazmaktır. */
PZA.GCAL.TEST_NOT = 'Google onay sayfası yerine "erişim engellendi (403)" ya da ' +
  '"uygulama test edilmektedir" yazısı görürseniz: uygulama Google\'da Test ' +
  'durumunda ve bu hesap test kullanıcısı listesinde değil. Konsolda OAuth izin ' +
  'ekranı → Kitle (Audience) → Test kullanıcıları bölümüne bu hesabı ekleyin, ' +
  'sonra "Hesap Bağla"ya yeniden basın. Kalıcı çözüm: aynı sayfadan Yayınla — ' +
  'test izinleri 7 günde dolar, yayımlanınca dolmaz.';

/* TUR 8 — kısa sürüm: DURUM SATIRINDA gösterilir (beklerken ve iptalde).
   TUR 7'de bu bilgi yalnız `#gcal-elle` kutusunun İÇİNDEKİ nota konmuştu;
   kullanıcı tarayıcıda 403'ü görüp panele döndüğünde o kutu ekranın
   altında kalıyor ve kimse okumuyor. Kullanıcı çözümü uygulamada değil,
   bize sorarak buldu — yani mesaj yanlış yerdeydi. Artık asıl durum
   satırı da söylüyor; kutu yalnız adresi taşıyor. */
PZA.GCAL.TEST_KISA = 'Sayfada "erişim engellendi (403)" yazıyorsa hesabınız ' +
  'test kullanıcısı listesinde değil — aşağıdaki adresi "Tarayıcıda aç" ile ' +
  'açıp hesabınızı ekleyin, sonra yeniden deneyin.';

/* TUR 8 — Tarayıcının açıldığını İDDİA ETMEYEN çıkış yolu.
   Kullanıcı bildirimi: *"browserda açılan bişi yok"*, ardından
   *"onun yerine belgelerim açılıyor"*. Sebep Rust tarafında bulundu
   (`explorer.exe` adresi klasör sanıp Belgeler'i açıyordu) ama ders
   arayüzde: tarayıcı açma isteğinin kabul edilmiş olması, tarayıcının
   AÇILDIĞINI göstermez. Bu yüzden mesaj "açıldı" demez; iki olasılığı
   da söyler ve her durumda elinin altında duran yolu gösterir. */
PZA.GCAL.ACILMADI = 'Aşağıdaki adresi "Adresi kopyala" ile alıp tarayıcınızın ' +
  'adres çubuğuna yapıştırın — dönüş yine yakalanır.';

/* TUR 8 — Konsol adresi, İSTEMCİNİN PROJESİNE sabitlenir. Client ID'nin
   tire öncesi parçası Google proje NUMARASIDIR (631177154665-…). Proje
   seçicisinde başka bir proje duruyorsa kullanıcı yanlış projenin izin
   ekranını düzenler ve hata "hiçbir şey yapmamışım gibi" sürer. Adresi
   sabitlemek bu tuzağı tamamen kaldırır. */
PZA.gcalKitleUrl = function () {
  const no = String(PZA.gcalClientId() || '').split('-')[0].trim();
  return /^\d{6,}$/.test(no) ? PZA.GCAL.KITLE + '?project=' + no : PZA.GCAL.KITLE;
};

/* TUR 14 — İstemci sırrı sayfası da istemcinin PROJESİNE sabitlenir
   (tur 8 dersi: proje seçicisinde başka bir proje duruyorsa kullanıcı
   yanlış istemcinin sırrını kopyalar ve hata "hiçbir şey yapmamışım
   gibi" sürer). Adres `gcal_ac` beyaz listesine uyar. */
PZA.gcalSirUrl = function () {
  const no = String(PZA.gcalClientId() || '').split('-')[0].trim();
  const yol = 'https://console.cloud.google.com/auth/clients';
  return /^\d{6,}$/.test(no) ? yol + '?project=' + no : yol;
};

/* TUR 14 — sır eksikken durum satırına yazılan metin. Söylenmesi gereken
   iki şey var: (1) Google alanı belgede "isteğe bağlı" gösterse de
   masaüstü istemcisinde ZORUNLU tutuyor, (2) değerin nereden alınacağı. */
PZA.GCAL.SIR_YOK = 'İstemci sırrı eksik — Google onaydan sonra anahtarı ' +
  'vermiyor ("client_secret is missing"). Google\'ın belgesi bu alanı ' +
  '"isteğe bağlı" yazsa da masaüstü istemcilerinde zorunlu tutuyor. ' +
  'Aşağıdaki adresten istemci sırrını (GOCSPX-…) kopyalayıp "İstemci sırrı" ' +
  'alanına yapıştırın, sonra yeniden deneyin.';

/* Aynı işin uzun anlatımı: elle açma kutusunun notu (adım adım yer tarifi). */
PZA.GCAL.SIR_NOT = 'Konsol → Google Auth Platform → İstemciler: kendi ' +
  'masaüstü istemcinizin içinde "İstemci sırrı" değeri durur (GOCSPX-… ile ' +
  'başlar). Eski arayüzde: APIs & Services → Kimlik Bilgileri → OAuth 2.0 ' +
  'İstemci Kimlikleri → istemciniz. Kopyalayıp uygulamadaki "İstemci sırrı" ' +
  'alanına yapıştırın. Değer yalnız sizin makinenizde saklanır; uygulama ' +
  'kendi sırrını taşımaz ve bu değer hiçbir mesajda görünmez.';

PZA.gcalYukle = function () {
  try { return JSON.parse(localStorage.getItem(GCALKEY)) || {}; }
  catch { return {}; }
};

PZA.gcal = PZA.gcalYukle();

PZA.gcalKaydet = function () {
  try { localStorage.setItem(GCALKEY, JSON.stringify(PZA.gcal)); return true; }
  catch (e) { console.warn('takvim kaydı yazılamadı', e); return false; }
};

/* ── Küçük yardımcılar ─────────────────────────────────── */

function gcalPad2(n) { return String(n).padStart(2, '0'); }

/* base64url: PKCE ve `state` için `+ / =` karakterleri URL'de
   sorun çıkardığından alfabe daraltılır (RFC 7636). */
function gcalB64url(bayt) {
  let s = '';
  for (const b of bayt) s += String.fromCharCode(b);
  const b64 = (typeof btoa === 'function')
    ? btoa(s)
    : Buffer.from(s, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function gcalRastgele(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return gcalB64url(b);
}

async function gcalSha256(metin) {
  const veri = new TextEncoder().encode(metin);
  const ozet = await crypto.subtle.digest('SHA-256', veri);
  return gcalB64url(new Uint8Array(ozet));
}

/** PKCE çifti: `code_verifier` gizli kalır, `code_challenge` Google'a gider. */
async function gcalPkce() {
  const dogrulayici = gcalRastgele(32);          // 43 karakter base64url
  return { dogrulayici, ozet: await gcalSha256(dogrulayici) };
}

/** `YYYY-MM-DD` + gün kaydırma — yerel saat diliminden bağımsız olsun
    diye UTC üzerinden hesaplanır (yaz saati geçişinde gün atlamasın). */
function gcalGunKaydir(gun, n) {
  const [y, a, g] = String(gun).split('-').map(Number);
  return new Date(Date.UTC(y, a - 1, g + n)).toISOString().slice(0, 10);
}

/** "HH:MM" + dakika → { gun, saat }. Gece yarısını taşırırsa günü ilerletir:
    23:45 + 30 dk = ertesi gün 00:15. Taşırma yapılmasa "24:15" gibi geçersiz
    bir saat üretilirdi ve Google isteği reddederdi. */
function gcalSaatEkle(gun, t, dakika) {
  const [s, d] = String(t || '12:00').split(':').map(Number);
  const top = (s * 60 + d) + dakika;
  const fazla = Math.floor(top / 1440);
  const kalan = ((top % 1440) + 1440) % 1440;
  return {
    gun: fazla ? gcalGunKaydir(gun, fazla) : gun,
    saat: gcalPad2(Math.floor(kalan / 60)) + ':' + gcalPad2(kalan % 60)
  };
}

/* ── Tarayıcı tarafı OAuth ─────────────────────────────── */

/** Google onay sayfasının adresi. `access_type=offline` + `prompt=consent`
    şart: ilk izinde refresh_token verilmesi ve yeniden bağlanışta da
    yenilenmesi için. Aksi hâlde uygulama bir saat sonra sessizce ölürdü. */
PZA.gcalYetkiUrl = function (clientId, yonlendirme, ozet, durum) {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: yonlendirme,
    response_type: 'code',
    scope: PZA.GCAL.SCOPE,
    code_challenge: ozet,
    code_challenge_method: 'S256',
    state: durum,
    access_type: 'offline',
    prompt: 'consent'
  });
  return PZA.GCAL.AUTH + '?' + p.toString();
};

/** Rust'ın yakaladığı istek hedefini çöz: `/?code=…&state=…`
    TUR 12: `error_description` de okunur — Google reddettiğinde
    (ör. `access_denied`) sebep İngilizce tek kelime değil, cümledir;
    kullanıcıya gösterilecek olan odur. */
PZA.gcalKodCoz = function (hedef) {
  const p = new URLSearchParams(String(hedef || '').split('?')[1] || '');
  return {
    kod: p.get('code') || null,
    durum: p.get('state') || null,
    hata: p.get('error') || null,
    aciklama: p.get('error_description') || null
  };
};

/** Yetkilendirme kodunu token'a çevir.
    TUR 14: istemci sırrı GÖNDERİLİR (ayarlarda varsa). v1.10.0'a kadar
    "PKCE yeter" deniyordu; Google masaüstü istemcilerinde sırrın
    varlığını zorunlu tutuyor, bu yüzden her deneme
    `client_secret is missing` ile bitiyordu. Sır BOŞSA alan hiç
    eklenmez: boş dize Google'da da "yok" sayılır, yalnız gövdeyi kirletir. */
PZA.gcalTokenAl = async function (clientId, yonlendirme, kod, dogrulayici) {
  const govde = {
    client_id: clientId,
    code: kod,
    code_verifier: dogrulayici,
    grant_type: 'authorization_code',
    redirect_uri: yonlendirme
  };
  const sir = PZA.gcalClientSecret();
  if (sir) govde.client_secret = sir;
  const r = await fetch(PZA.GCAL.TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(govde).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(gcalHataMetni(j, r));
  return j;
};

/** Süresi dolmuş erişim jetonunu refresh_token ile tazele. */
PZA.gcalYenile = async function () {
  const g = PZA.gcal;
  if (!g.clientId || !g.refreshToken) throw new Error('Yenileme anahtarı yok.');
  const govde = {
    client_id: g.clientId,
    refresh_token: g.refreshToken,
    grant_type: 'refresh_token'
  };
  /* TUR 14: sır YENİLEMEDE de gerekir. Eklenmeseydi bağlantı ilk saat
     sorunsuz çalışıp sonra sessizce `invalid_client` ile ölür ve hata
     "bağlıyım" diyen bir panelin arkasında saklanırdı. */
  const sr = PZA.gcalClientSecret();
  if (sr) govde.client_secret = sr;
  const r = await fetch(PZA.GCAL.TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(govde).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    /* TUR 7: `invalid_grant` = yenileme anahtarı ölmüş. Google, Test
       durumundaki bir uygulamada test kullanıcısının iznini 7 GÜN
       sonra düşürür (yayımlanmış uygulamada düşmez). Ham "invalid_grant"
       kullanıcıya hiçbir şey söylemez; üstelik anahtar yerinde
       kaldığı sürece bağlantı "bağlı" görünür ve hata HER eşitlemede
       sessizce tekrarlanırdı. Ölü anahtar silinir: durum olduğu gibi
       görünür, "Hesap Bağla" ile düzelir. */
    if (j.error === 'invalid_grant') {
      g.refreshToken = null;
      g.accessToken = null;
      g.exp = 0;
      PZA.gcalKaydet();
      throw new Error('Google izni düşmüş — uygulama Test durumundayken ' +
        'verilen izinler 7 günde dolar. "Hesap Bağla" ile yeniden bağlanın.');
    }
    throw new Error(gcalHataMetni(j, r));
  }
  g.accessToken = j.access_token;
  /* 60 sn emniyet payı: istek yoldayken süresi dolmasın. */
  g.exp = Date.now() + (j.expires_in || 3600) * 1000 - 60000;
  if (j.refresh_token) g.refreshToken = j.refresh_token;
  PZA.gcalKaydet();
  return g.accessToken;
};

/** Geçerli erişim jetonu — gerekirse sessizce yeniler. */
PZA.gcalToken = async function () {
  const g = PZA.gcal;
  if (g.accessToken && g.exp && Date.now() < g.exp) return g.accessToken;
  return PZA.gcalYenile();
};

PZA.gcalBagliMi = function () {
  const g = PZA.gcal;
  return !!(g.clientId && (g.refreshToken || g.accessToken));
};

PZA.gcalClientId = function () { return PZA.gcal.clientId || ''; };

/* TUR 14 — istemci sırrı. Google masaüstü istemcilerinde bunu zorunlu
   tutuyor (bkz. dosya başı); kullanıcı kendi istemcisinin sırrını girer
   ve değer yalnız bu makinede saklanır. */
PZA.gcalClientSecret = function () {
  return String(PZA.gcal.clientSecret || '').trim();
};

/* TUR 14 — Google'ın ham hatası kullanıcıya YOL GÖSTERMEZ.
   "client_secret is missing" ne yapılacağını söylemez; üstelik Google'ın
   kendi belgesi alanı "isteğe bağlı" gösterdiği için kullanıcı yanlış
   yerde çözüm arar. İstemciyi tanımlayan iki hata TANINIR, Türkçe ve adım
   veren metne çevrilir; ayrıca panele "kimlik kutusunu yeniden aç" işareti
   konur (tur 9 dersi: düzeltilecek alan görünmüyorsa kullanıcı çıkmazda
   kalır). Dönen metin ASLA sırrın kendisini içermez. */
function gcalHataMetni(j, r) {
  /* Google hatayı İKİ alana böler: `error` kısa koddur (`invalid_client`),
     `error_description` cümledir. Yalnız cümleye bakmak `invalid_client`ı
     kaçırırdı — cümlede kod geçmez ("The provided client secret is
     invalid."). İkisi ayrı ayrı sınanır. */
  const kod = String((j && j.error) || '');
  const ham = String((j && (j.error_description || j.error)) ||
    ('Google ' + ((r && r.status) || '?')));
  const sirSorunu = kod === 'invalid_client' || /client_secret is missing/i.test(ham);
  if (sirSorunu) {
    PZA.gcal.sirHatasi = 1;
    PZA.gcalKaydet();
    return PZA.GCAL.SIR_YOK + (kod === 'invalid_client'
      ? ' (Google: istemci tanınmadı — sır ya da Client ID hatalı.)' : '');
  }
  return ham;
}

/* TUR 12 — BAĞLANTI ÖLÇÜLÜR, İDDİA EDİLMEZ.
   Kullanıcı bildirimi: "şu an google takvime bağlı ancak dün girdiğim
   verileri google takvime aktarmadı." Panel "bağlı" görünüyordu çünkü
   durum satırı **saklanan jetonun varlığından** türetiliyordu; jetonun
   gerçekten çalıştığı hiç sınanmamıştı (diskte de tazeleme anahtarı
   yoktu). Artık gerçek bir API çağrısı yapılır ve satır, ÖLÇÜLEN
   sonucu yazar. Hata varsa "bağlı" denmez. */
PZA.gcalDogrula = async function () {
  if (!PZA.gcalBagliMi()) return false;
  const g = PZA.gcal;
  try {
    const token = await PZA.gcalToken();          // jeton tazelenebiliyor mu?
    const j = await gcalIstek('GET', '/calendars/primary/events?maxResults=1', null, token);
    g.sonDogrulama = new Date().toTimeString().slice(0, 5);
    g.dogrulamaHata = null;
    PZA.gcalKaydet();
    PZA.logYaz?.('bilgi', 'Takvim bağlantısı doğrulandı', {
      okunan: ((j && j.items) || []).length
    });
    return true;
  } catch (e) {
    g.dogrulamaHata = String((e && e.message) || e);
    PZA.gcalKaydet();
    PZA.logYaz?.('uyari', 'Takvim bağlantısı doğrulanamadı: ' + g.dogrulamaHata);
    return false;
  }
};

PZA.gcalOzet = function () {
  if (!PZA.gcalBagliMi()) return null;
  const g = PZA.gcal;
  if (g.dogrulamaHata) {
    return 'Bağlantı kurulamıyor: ' + g.dogrulamaHata +
      ' — "Bağlantıyı kes" deyip yeniden bağlanın.';
  }
  /* Doğrulama henüz yapılmadıysa "Bağlı ✓" DENMEZ: bu, ölçülmemiş bir
     iddia olurdu. Satır yalnız kaydın varlığını söyler. */
  if (!g.sonDogrulama) return 'Anahtar kaydedildi ✓ — bağlantı sınanıyor…';
  const p = ['Bağlı ✓', 'doğrulandı ' + g.sonDogrulama];
  if (g.sonEsitleme) p.push('son eşitleme ' + g.sonEsitleme);
  return p.join(' · ');
};

/* ── Takvim yazma/okuma ────────────────────────────────── */

async function gcalIstek(yontem, yol, govde, token) {
  const r = await fetch(PZA.GCAL.API + yol, {
    method: yontem,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: govde ? JSON.stringify(govde) : undefined
  });
  // 410 Gone: olay zaten silinmiş — hata sayma, hedefe ulaşıldı.
  if (!r.ok && r.status !== 410) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j.error && j.error.message) || ('Takvim ' + r.status));
  }
  if (yontem === 'DELETE' || r.status === 204) return null;
  return r.json().catch(() => null);
}

/** Cihazın saat dilimi (IANA adı, ör. `Europe/Istanbul`).
    TUR 15: Google, `dateTime` alanı saat kaydırması (`+03:00`) içermiyorsa
    `timeZone` alanını **zorunlu** tutar; gönderilmezse olay
    *"Missing time zone definition for start time"* ile reddedilir.
    Bu uç nokta davranışı belgede bu şekilde yazmıyor — ölçülerek bulundu
    ([[Tasarım Kuralları]] §6: *belge "isteğe bağlı" diyorsa da davranış ölçülür*).
    `Intl` yoksa (pratikte olmaz) İstanbul'a düşülür; bu bir **tahmin**
    olduğu için dürüstlük notunda kayıtlıdır. */
PZA.gcalDilim = function () {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (z && /^[A-Za-z][A-Za-z0-9_+/-]*$/.test(z)) return z;
  } catch (e) { /* aşağıdaki yedeğe düşülür */ }
  return 'Europe/Istanbul';
};

/** Bir notu Google Takvim olayına çevir.
    Olay, hangi nottan doğduğunu `extendedProperties.private` içinde
    taşır: `<gün>|<saat>|<sıra>`. Böylece yerel bir kimlik tablosu
    tutmadan eşleşme bulunur — not silinince olay da bulunup silinir.
    Saat dilimi AÇIKÇA yazılır (tur 15): "takvimin varsayılanı uygulanır"
    varsayımı ölçülmemişti ve yanlıştı — olay hiç oluşmuyordu. */
PZA.gcalOlay = function (gun, not, sira) {
  const bas = gun + 'T' + String(not.t || '12:00') + ':00';
  const son = gcalSaatEkle(gun, not.t, PZA.GCAL.SURE);
  const dilim = PZA.gcalDilim();
  return {
    summary: not.x,
    start: { dateTime: bas, timeZone: dilim },
    end: { dateTime: son.gun + 'T' + son.saat + ':00', timeZone: dilim },
    extendedProperties: {
      private: { [PZA.GCAL.IZ]: gun + '|' + not.t + '|' + (sira || 1) }
    }
  };
};

/** O güne ait, bu uygulamanın ürettiği olaylar.
    Aralık bir gün geniş tutulur (yerel saat UTC'nin önünde/arkasında
    olabilir) ve süzme istemcide yapılır — Google'ın
    `privateExtendedProperty` süzgeci joker karakter desteklemiyor. */
PZA.gcalGunOlaylari = async function (gun, token) {
  const p = new URLSearchParams({
    timeMin: gcalGunKaydir(gun, -1) + 'T00:00:00Z',
    timeMax: gcalGunKaydir(gun, 2) + 'T00:00:00Z',
    singleEvents: 'true',
    maxResults: '250'
  });
  const j = await gcalIstek('GET', '/calendars/primary/events?' + p.toString(), null, token);
  return ((j && j.items) || []).filter(e => {
    const oz = e.extendedProperties && e.extendedProperties.private;
    return !!(oz && oz[PZA.GCAL.IZ]);
  });
};

/** Bir günün notlarını takvime yansıt: yeni not → yeni olay, değişen
    not → olay güncellenir, silinen not → olay silinir.
    `hazirToken` verilirse jeton yeniden istenmez (tam eşitleme tek
    jetonla bütün günleri dolaşır). */
PZA.gcalEsitle = async function (gun, hazirToken) {
  if (!PZA.gcalBagliMi()) throw new Error('Önce hesabı bağlayın.');
  const token = hazirToken || await PZA.gcalToken();
  const notlar = (PZA.notes && PZA.notes[gun]) || [];
  const mevcut = await PZA.gcalGunOlaylari(gun, token);

  const kalan = new Map();
  for (const e of mevcut) kalan.set(e.extendedProperties.private[PZA.GCAL.IZ], e);

  let eklenen = 0, guncellenen = 0, silinen = 0;
  const sayac = {};

  for (const n of notlar) {
    const k = gun + '|' + n.t;
    sayac[k] = (sayac[k] || 0) + 1;
    const anahtar = k + '|' + sayac[k];
    const varOlan = kalan.get(anahtar);
    if (!varOlan) {
      await gcalIstek('POST', '/calendars/primary/events',
        PZA.gcalOlay(gun, n, sayac[k]), token);
      eklenen++;
    } else if (varOlan.summary !== n.x) {
      await gcalIstek('PATCH', '/calendars/primary/events/' + encodeURIComponent(varOlan.id),
        { summary: n.x }, token);
      guncellenen++;
    }
    kalan.delete(anahtar);
  }

  // Eşleşmeyen olaylar: notu silinmiş → olay da silinmeli.
  for (const e of kalan.values()) {
    await gcalIstek('DELETE', '/calendars/primary/events/' + encodeURIComponent(e.id), null, token);
    silinen++;
  }

  PZA.gcal.sonEsitleme = new Date().toTimeString().slice(0, 5);
  PZA.gcalKaydet();
  return { eklenen, guncellenen, silinen, toplam: notlar.length };
};

/* ── TAM EŞİTLEME — bütün günler (tur 12) ────────────────
   KULLANICI BİLDİRİMİ: "dün girdiğim verileri google takvime
   aktarmadı. Senkronize olmadı."

   KÖK NEDEN: eşitleme ÜÇ yolda da tek günü kapsıyordu —
   `gcalEsitle(PZA.activeDay)`: bağlanma anında, not değişince ve elle
   "Notları takvime gönder" düğmesinde. Yani yalnız EKRANDA SEÇİLİ
   günün notları takvime gidiyordu; başka günlere girilmiş notlar
   takvime HİÇ ulaşmıyor, o günlerde silinen notların olayları da
   takvimde kalıyordu. Tek günlük eşitleme hâlâ yerinde (not
   değişince hızlı tepki için); eksik olan BÜTÜN günleri kapsayan
   bir işlemdi ve bu o. */

/** Notu olan bütün günler (ISO, artan sırada). */
PZA.gcalNotGunleri = function () {
  return Object.keys(PZA.notes || {})
    .filter(g => /^\d{4}-\d{2}-\d{2}$/.test(g) && (PZA.notes[g] || []).length)
    .sort();
};

/** Bütün günleri takvimle eşitle. `bildir(i, n)` verilirse ilerleme
    bildirilir (panel uzun işte sessiz kalmasın).

    Hangi günler taranır: notu olan bütün günler + **son eşitlemede
    dokunulmuş** günler. İkincisi şart: bir günün notları tamamen
    silinirse o gün `gcalNotGunleri()`nden düşer, ama takvimde olayları
    durur — kayıt tutulmasaydı o olaylar sonsuza dek takvimde kalırdı.
    (v1.9 ve öncesinde takvime hiçbir şey yazılmadığı için — jetonsuz
    "bağlı" görünen o sürümlerde eşitleme fiilen çalışmamıştı — geriye
    dönük yetim olay temizliği gerekmiyor.) */
PZA.gcalTumunuEsitle = async function (bildir) {
  if (!PZA.gcalBagliMi()) throw new Error('Önce hesabı bağlayın.');
  const g = PZA.gcal;
  const token = await PZA.gcalToken();

  const notGunleri = PZA.gcalNotGunleri();
  const dokunulan = (Array.isArray(g.gunler) ? g.gunler : [])
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
  const gunler = [...new Set([...notGunleri, ...dokunulan])].sort();

  const top = { gunler: gunler.length, degisenGun: 0, eklenen: 0,
                guncellenen: 0, silinen: 0, toplam: 0, atlanan: 0, hata: null };

  /* Hiç gün yoksa hiç API çağrısı yapılmaz ve "bağlandı ✓" ölçülmemiş
     kalırdı. En az bir gerçek çağrı garanti edilir: bağlantı sınanır. */
  if (!gunler.length) await PZA.gcalDogrula();

  for (let i = 0; i < gunler.length; i++) {
    const gun = gunler[i];
    if (bildir) bildir(i + 1, gunler.length, gun);
    try {
      const s = await PZA.gcalEsitle(gun, token);
      top.eklenen += s.eklenen;
      top.guncellenen += s.guncellenen;
      top.silinen += s.silinen;
      top.toplam += s.toplam;
      if (s.eklenen || s.guncellenen || s.silinen) top.degisenGun++;
    } catch (e) {
      /* TEK gün patlarsa eşitlemenin tamamı düşmez: kalan günler
         denenir ve atlanan gün DÜRÜSTÇE bildirilir (sessiz yutma, bu
         projede en pahalı hata sınıfı). */
      top.atlanan++;
      top.hata = top.hata || String((e && e.message) || e);
      PZA.logYaz?.('uyari', 'Gün eşitlenemedi: ' + gun,
        { hata: String((e && e.message) || e) });
    }
  }

  g.gunler = notGunleri;                 // bir sonraki taramanın kaydı
  g.sonEsitleme = new Date().toTimeString().slice(0, 5);
  g.sonEsitlemeGun = gunler.length;
  PZA.gcalKaydet();
  PZA.logYaz?.('bilgi', 'Takvim eşitlemesi bitti (' + gunler.length + ' gün)', {
    eklenen: top.eklenen, guncellenen: top.guncellenen,
    silinen: top.silinen, atlanan: top.atlanan
  });
  return top;
};

/** Eşitleme sonucunu ÖLÇTÜĞÜ gibi anlatan cümle. Sıfırları saymaz,
    atlanan günü gizlemez. */
PZA.gcalEsitlemeOzeti = function (s) {
  if (!s) return 'Eşitleme yapılmadı.';
  if (!s.gunler) return 'Gönderilecek not yok.';
  const p = [];
  if (s.eklenen) p.push(s.eklenen + ' yeni');
  if (s.guncellenen) p.push(s.guncellenen + ' güncellendi');
  if (s.silinen) p.push(s.silinen + ' silindi');
  let m = s.gunler + ' gün tarandı'
    + (s.degisenGun ? ' (' + s.degisenGun + ' günde değişiklik)' : '')
    + ' · ' + (p.length ? p.join(', ') : 'değişiklik yok');
  m += ' · takvimde ' + s.toplam + ' not';
  if (s.atlanan) m += ' · ' + s.atlanan + ' gün atlandı (' + (s.hata || 'hata') + ')';
  return m;
};

/* ── Panel mesajı ──────────────────────────────────────── */

/* TUR 5 HATASI: bağlanma akışı bir hata yazıyordu, ama düğmenin
   `finally` bloğundaki panel tazelemesi o mesajı HEMEN eziyordu.
   Kullanıcı "Client ID kaydedildi" görüyor, düğmenin hiçbir şey
   yapmadığını sanıyordu — hatanın kendisi görünmez oluyordu.
   Bu yüzden mesaj burada tutulur ve tazeleme onu ezmez. */
let gcalSon = null;                       // { metin, hata } | null

PZA.gcalYaz = function (m, sinif) {
  const st = document.getElementById('gcal-state');
  gcalSon = { metin: m, hata: sinif === 'err' };
  if (!st) return;
  st.textContent = m;
  st.classList.toggle('err', sinif === 'err');
};

/** Akışın yazdığı mesaj duruyorsa `null` döner: tazeleme yazmasın. */
/** Client ID geçerli mi? "…apps.googleusercontent.com" ile bitmeli ve
    API anahtarı (`AIza…`) OLMAMALI.
    TUR 6: kullanıcı API anahtarı girdi; eski kod "Client ID var" sanıp
    kurulum kutusunu kalıcı olarak gizledi ve kurtarma yolu bırakmadı. */
PZA.gcalClientIdGecerliMi = function (cid) {
  const s = (cid === undefined ? PZA.gcalClientId() : cid) || '';
  if (!s) return false;
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(s)) return false;
  return /\.apps\.googleusercontent\.com$/.test(s);
};

PZA.gcalVarsayilan = function (ozet, cid, gecerliMi) {
  if (gcalSon) return null;
  if (ozet) return ozet;
  const s = cid || '';
  if (!s) return 'Notlarınız telefonunuzda da görünsün.';
  const gecerli = gecerliMi === undefined ? PZA.gcalClientIdGecerliMi(s) : gecerliMi;
  /* Geçersiz değer (API anahtarı vb.) kayıtlıysa türetilmiş ipucu YAZMA:
     aksi hâlde "Client ID kaydedildi" diyerek kullanıcıyı yanıltır. */
  if (!gecerli) return null;
  /* TUR 14: Client ID tek başına yetmiyor — sır eksikse ipucu onu söyler
     (yoksa kullanıcı "kaydedildi" yazısını görüp bağlanmayı dener ve
     Google'dan ham bir İngilizce hata alırdı). */
  if (!PZA.gcalClientSecret()) {
    return 'Client ID kaydedildi — bir de "İstemci sırrı" alanını doldurun.';
  }
  return 'Client ID + istemci sırrı kaydedildi — "Hesap Bağla" ile izin verin.';
};

/** Yeni bir akış başlarken çağrılır: eski mesaj yeni denemeyi engellemesin. */
PZA.gcalMesajTemizle = function () { gcalSon = null; };

/** Elle açma kutusu. Tarayıcı açılamazsa akış DURMAZ: adres burada
    gösterilir, kullanıcı kopyalayıp kendi tarayıcısına yapıştırır ve
    dönüş yine `127.0.0.1` dinleyicisine düşer.

    TUR 7: kutu artık bir ADRES ve bir AÇIKLAMA taşır (`not`). Aynı kutu,
    Google reddettiğinde Konsol adresini ve nedenini göstermek için de
    kullanılır — yeni bileşen eklenmedi, mevcut kutu genelleştirildi.
    `not` verilmezse kutunun kendi metni (HTML'den bir kez okunur) döner. */
let gcalElleVarsayilan = null;
PZA.gcalElle = function (url, not) {
  const k = document.getElementById('gcal-elle');
  const i = document.getElementById('gcal-url');
  if (!k || !i) return;
  const n = document.getElementById('gcal-elle-not');
  if (n && gcalElleVarsayilan === null) gcalElleVarsayilan = n.textContent;
  if (!url) { k.hidden = true; return; }
  if (n) n.textContent = not || gcalElleVarsayilan || '';
  i.value = url;
  k.hidden = false;
};

/* ── Bağlan / kes ──────────────────────────────────────── */

const GCAL_TAURI = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

async function gcalCagir(cmd, args) {
  const core = window.__TAURI__.core || window.__TAURI__;
  return await core.invoke(cmd, args);
}

/** Tam bağlanma akışı. `bildir(metin, 'err')` verilirse ilerleme
    oraya da duyurulur (testler bunu kullanır).
    Mesaj her hâlükârda PANELE yazılır (`PZA.gcalYaz`): panel
    tazelemesinin hata metnini ezmemesi bu kayda bağlıdır. */
PZA.gcalBaglan = async function (bildir) {
  const yaz = (m, sinif) => {
    PZA.gcalYaz(m, sinif);
    if (bildir) bildir(m, sinif);
  };
  const clientId = PZA.gcalClientId();

  if (!clientId) { yaz('Önce aşağıdaki Client ID alanını doldurun.', 'err'); return false; }
  if (!GCAL_TAURI) { yaz('Tarayıcı önizlemesinde bağlanılamaz — uygulamada çalışır.', 'err'); return false; }
  if (!(window.crypto && crypto.subtle && crypto.getRandomValues)) {
    yaz('Bu ortam güvenli anahtar üretimini desteklemiyor; bağlantı kurulamaz.', 'err');
    return false;
  }
  /* TUR 6 HATASI: kullanıcı "Api key girdim kabul etti" dedi. Girdiği
     değer bir **API anahtarıydı** (`AIza…`), Client ID değil. Eski kod
     bunu yalnız "…apps.googleusercontent.com ile bitmeli" diye
     reddediyordu; kullanıcı ne yaptığını anlamıyordu. Artık API
     anahtarı ayrıca ve açıkça tanınır — ve doğru istemci türü söylenir. */
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(clientId)) {
    yaz('Bu bir API anahtarı (AIza…), Client ID değil. Google Cloud Console → ' +
        'Kimlik Bilgileri → "OAuth istemcisi oluştur" → **Masaüstü uygulaması** seçip ' +
        'onun "…apps.googleusercontent.com" ile biten Client ID değerini yapıştırın. ' +
        'Anahtarlar ve İstemciler sayfasında API anahtarı değil, **OAuth 2.0 İstemci Kimliği** ' +
        'kopyalanmalıdır.', 'err');
    return false;
  }
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    yaz('Client ID "…apps.googleusercontent.com" ile bitmeli. ' +
        'Cloud Console → Kimlik Bilgileri → "OAuth istemcisi oluştur" → ' +
        'uygulama türü **Masaüstü uygulaması** olmalı.', 'err');
    return false;
  }

  /* TUR 14 — sır eksikse akış BURADA durur. Google onaydan sonra jetonu
     vermeyeceği için kullanıcıyı üç onay ekranından geçirmenin anlamı yok:
     bir dakikasını harcar, döner ve aynı hatayı görür. Üstelik kutu açık
     bırakılır ki alan görünür olsun (tur 9 dersi). */
  if (!PZA.gcalClientSecret()) {
    PZA.gcal.sirHatasi = 1;
    PZA.gcalKaydet();
    PZA.gcalElle(PZA.gcalSirUrl(), PZA.GCAL.SIR_NOT);
    yaz(PZA.GCAL.SIR_YOK, 'err');
    return false;
  }

  let port;
  try { port = await gcalCagir('gcal_port'); }
  catch (e) { yaz('Yerel dinleyici açılamadı: ' + e, 'err'); return false; }
  const yonlendirme = 'http://127.0.0.1:' + port;

  const { dogrulayici, ozet } = await gcalPkce();
  const durum = gcalRastgele(16);

  /* Onay adresi, tarayıcı açılsa da açılmasa da GÖSTERİLİR — ve yanında
     TUR 7 notu vardır: Google reddederse (403) dönüş hiç gelmez, akış
     zaman aşımına düşer; kullanıcı beklerken sebebi ve çözümü görebilsin. */
  const yetkiUrl = PZA.gcalYetkiUrl(clientId, yonlendirme, ozet, durum);
  PZA.gcalElle(yetkiUrl, PZA.GCAL.TEST_NOT);

  /* TUR 8 — burada "tarayıcı açıldı" DENMEZ. `gcal_ac`'ın başarılı
     dönmesi yalnız "açma isteği kabul edildi" demektir; işletim sistemi
     adresi yanlış yorumlayıp başka bir pencere açabilir (kullanıcı
     "onun yerine belgelerim açılıyor" dedi) ya da hiçbir şey açmaz.
     Süreç başlatma başarısı ≠ tarayıcı açıldı — tur 5'in dersi, tur 8'de
     arayüzde tekrar ihlal edilmişti. */
  try {
    await gcalCagir('gcal_ac', { url: yetkiUrl });
    yaz('Google onay sayfası tarayıcınızda açılmalı. Açılmadıysa ya da ' +
        'beklediğinizden başka bir pencere (ör. Belgeler) açıldıysa: ' +
        PZA.GCAL.ACILMADI + ' ' + PZA.GCAL.TEST_KISA);
  } catch (e) {
    /* Burada DÖNMÜYORUZ: tarayıcı açılamaması, kullanıcının adresi
       elle açmasına engel değil. */
    yaz('Tarayıcı açılamadı (' + e + '). ' +
        PZA.GCAL.ACILMADI + ' ' + PZA.GCAL.TEST_KISA, 'err');
  }

  let hedef;
  try { hedef = await gcalCagir('gcal_bekle'); }
  catch (e) {
    /* TUR 7 HATASI: Google hesabı reddettiğinde (403 / "uygulama test
       edilmektedir") YÖNLENDİRME YAPMAZ. Dinleyiciye istek düşmediği
       için akış zaman aşımına düşer ve kullanıcı "Google yanıtı alınamadı:
       süre doldu" görürdü — SEBEPSİZ ve YOLSUZ. Oysa bu, ilk kurulumda
       en sık karşılaşılan durumdur. Artık mesaj sebebi söyler ve
       kullanıcının atacağı adımı kopyalanabilir adresle gösterir. */
    const m = String(e);
    if (/süre doldu/i.test(m)) {
      /* TUR 9: adım, "adresi kopyala" değil "aşağıdaki adresi AÇ"tır —
         kutudaki düğme o adresi doğrudan açar. Kopyalama, açma
         başarısız olursa diye yedek olarak yanında duruyor. */
      yaz('Google yanıtı gelmedi. Tarayıcıda "erişim engellendi (403)" ya da ' +
          '"uygulama test edilmektedir" yazısı gördüyseniz hesabınız test ' +
          'kullanıcısı listesinde değil — aşağıdaki adresi "Tarayıcıda aç" ' +
          'ile açıp hesabınızı ekleyin, sonra yeniden deneyin.', 'err');
      PZA.gcalElle(PZA.gcalKitleUrl(), PZA.GCAL.TEST_NOT);
    } else if (/ptal/i.test(m)) {
      /* Neden `/ptal/` ve `/iptal/` değil: Rust "İptal edildi." döndürür,
         ve JavaScript'te `/i` bayrağı TÜRKÇE noktalı büyük İ'yi `i` ile
         EŞLEŞTİRMEZ (İ'nin küçüğü `i` değil, `i̇`). `/iptal/i` sessizce
         hiçbir zaman tutmaz ve iptal, genel hataya düşerdi.

         Ayrıca kutu AÇIK bırakılır: Google bekleyişini iptal eden
         kullanıcının sebebi çoğu zaman "tarayıcıda olmadı"dır; yol
         görünür kalmazsa tam da burada çıkmaza girer. */
      PZA.gcalElle(PZA.gcalKitleUrl(), PZA.GCAL.TEST_NOT);
      yaz('Bağlanma iptal edildi. Tarayıcıda "erişim engellendi (403)" ' +
          'gördüyseniz hesabınız test kullanıcısı listesinde değil — ' +
          'aşağıdaki adresten ekleyip yeniden deneyin.');
    } else {
      PZA.gcalElle(null);
      yaz('Google yanıtı alınamadı: ' + m, 'err');
    }
    return false;
  }
  PZA.gcalElle(null);

  const c = PZA.gcalKodCoz(hedef);
  if (c.hata) {
    /* TUR 12 — red artık tek satıra düşmüyor. Eskiden her hata
       "İzin verilmedi." oluyordu; kullanıcı ne olduğunu ve nereye
       gideceğini öğrenemiyordu. Şimdi sebep (`error_description`)
       yazılır ve 403'ün çözüm yeri (Konsol → Kitle) gösterilir. */
    if (c.hata === 'access_denied') {
      PZA.gcalElle(PZA.gcalKitleUrl(), PZA.GCAL.TEST_NOT);
      yaz('Google izin vermedi' + (c.aciklama ? ': ' + c.aciklama : ' (access_denied)') +
          '. Hesabınız uygulamanın test kullanıcısı listesinde olmayabilir — ' +
          'aşağıdaki adresten ekleyip yeniden deneyin.', 'err');
    } else {
      yaz('Google bağlanmaya izin vermedi: ' + c.hata +
          (c.aciklama ? ' — ' + c.aciklama : ''), 'err');
    }
    PZA.logYaz?.('uyari', 'OAuth reddi', { hata: c.hata, aciklama: c.aciklama });
    return false;
  }
  if (!c.kod) { yaz('Google yetki kodu döndürmedi.', 'err'); return false; }
  /* `state` karşılaştırması: başka bir sekmede üretilmiş yönlendirmenin
     bu akışa enjekte edilmesini engeller (CSRF). */
  if (c.durum !== durum) { yaz('Güvenlik doğrulaması tutmadı (state).', 'err'); return false; }

  yaz('İzin alındı, anahtar isteniyor…');
  let tok;
  try { tok = await PZA.gcalTokenAl(clientId, yonlendirme, c.kod, dogrulayici); }
  catch (e) { yaz('Anahtar alınamadı: ' + e.message, 'err'); return false; }

  const g = PZA.gcal;
  g.clientId = clientId;
  g.accessToken = tok.access_token;
  g.refreshToken = tok.refresh_token || g.refreshToken || null;
  g.exp = Date.now() + (tok.expires_in || 3600) * 1000 - 60000;
  g.sirHatasi = 0;      // sır tuttu: paneldeki uyarı işareti kalksın
  if (!g.refreshToken) {
    // prompt=consent'e rağmen gelmediyse bağlantı bir saat sonra ölür;
    // bunu sessizce yaşatmak yerine söyle.
    yaz('Bağlandı, ancak yenileme anahtarı verilmedi — yeniden bağlanmayı deneyin.', 'err');
    PZA.gcalKaydet();
    return false;
  }
  PZA.gcalKaydet();

  yaz('Bağlandı ✓ — notlar gönderiliyor…');
  try {
    /* TUR 12: bağlanma anında SEÇİLİ gün değil, BÜTÜN günler gönderilir.
       Kullanıcının bildirdiği tam olarak buydu: "dün girdiğim verileri
       aktarmadı" — çünkü o an ekranda duran gün eşitleniyordu. */
    const s = await PZA.gcalTumunuEsitle((i, n) => {
      if (n > 1) yaz('Notlar gönderiliyor… ' + i + '/' + n);
    });
    yaz('Bağlandı ✓ · ' + PZA.gcalEsitlemeOzeti(s),
        s.atlanan ? 'err' : undefined);
  } catch (e) {
    yaz('Bağlandı ✓ — eşitleme sonra yeniden denenecek: ' + e.message, 'err');
    PZA.logYaz?.('hata', 'Bağlanma sonrası eşitleme başarısız', { hata: String(e.message || e) });
  }
  return true;
};

/** OAuth istemcisini oluşturacağı yeri aç: kullanıcı adresi
    ezberlemek zorunda kalmasın. Rust yalnızca izinli adresleri açar. */
PZA.gcalKonsolAc = async function () {
  const url = 'https://console.cloud.google.com/apis/credentials';
  if (!GCAL_TAURI) { window.open(url, '_blank', 'noopener'); return true; }
  return await gcalCagir('gcal_ac', { url });
};

/** Kutuda gösterilen adresi tarayıcıda aç ("Tarayıcıda aç" düğmesi).
    TUR 9: 403 sonrası kutu, kullanıcının gideceği Konsol sayfasını
    taşır — ama iki adım istemek (kopyala → adres çubuğuna yapıştır)
    kullanıcıyı yanlış yere sürükledi: bir Google ürününde çözüm
    ararken buldu kendini. Adresi uygulama açsın.

    Dönüş: gerçekten açıldı mı diye İDDİA EDİLMEZ (tur 5-8 dersi);
    açma başarısız olursa çağıran taraf kopyalama yolunu gösterir. */
PZA.gcalAdresAc = async function () {
  const i = document.getElementById('gcal-url');
  const url = i ? String(i.value || '').trim() : '';
  if (!url) return false;
  if (!GCAL_TAURI) { window.open(url, '_blank', 'noopener'); return true; }
  try { await gcalCagir('gcal_ac', { url }); return true; }
  catch (e) { return false; }
};

/** Bekleyen bağlanma akışını iptal et ("Vazgeç" düğmesi).
    Rust, iptal bayrağını dinleyicinin her turunda okur; bekleme üç
    dakika dolmadan biter ve akış "Bağlanma iptal edildi." der. */
PZA.gcalVazgec = async function () {
  if (!GCAL_TAURI) return false;
  try { await gcalCagir('gcal_kapat'); return true; }
  catch (e) { return false; }
};

/** Bağlantıyı kes: jetonu Google tarafında da geçersiz kıl, yerel kopyayı sil.
    Client ID ve istemci sırrı KALIR — yeniden bağlanmak için konsola tekrar
    gidilmesin. TUR 14: sır da zorunlu olduğu için silinseydi kullanıcı her
    "Bağlantıyı kes"te konsola dönmek zorunda kalırdı. */
PZA.gcalKes = async function () {
  const g = PZA.gcal;
  const t = g.refreshToken || g.accessToken;
  if (t) {
    try {
      await fetch(PZA.GCAL.KES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: t }).toString()
      });
    } catch (e) { /* ağ yoksa yerel silme yeterli */ }
  }
  PZA.gcal = { clientId: g.clientId, clientSecret: g.clientSecret };
  PZA.gcalKaydet();
};

/* Not eklenip silindikçe takvimi kendiliğinden tazele. Kısa bir gecikme
   şart: kullanıcı arka arkaya not yazarken her tuş için istek gitmesin.
   TUR 12: burası TEK GÜNÜ eşitler — kullanıcının o an düzenlediği gün,
   hızlı tepki için. BÜTÜN günler bağlanma anında ve elle
   "Notları takvime gönder" düğmesiyle eşitlenir. */
let gcalZaman = null;
PZA.on('notes:changed', () => {
  if (!PZA.gcalBagliMi()) return;
  clearTimeout(gcalZaman);
  gcalZaman = setTimeout(() => {
    PZA.gcalEsitle(PZA.activeDay).catch(e => {
      /* TUR 7: bu hata eskiden YALNIZ konsola yazılıyordu. Kullanıcı
         notunu yazıyor, takvime gittiğini sanıyor, gerçekte hiçbir şey
         gitmiyordu — sessiz başarısızlık bu projede en pahalı hata
         sınıfı. Artık panelde görünür. */
      PZA.gcalYaz('Takvim eşitlemesi başarısız: ' + (e && e.message || e), 'err');
    });
  }, 2500);
});
