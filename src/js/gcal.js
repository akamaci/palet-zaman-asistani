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

   İSTEMCİ SIRRI YOK. Masaüstü istemcileri için PKCE yeterlidir; bu
   yüzden GPL lisanslı bu kaynakta hiçbir sır yayımlanmaz. Kullanıcı
   yalnızca herkese açık olan Client ID'yi girer (ayarlar paneli).

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
  'test kullanıcısı listesinde değil — aşağıdaki adresten ekleyip yeniden deneyin.';

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

/** Rust'ın yakaladığı istek hedefini çöz: `/?code=…&state=…` */
PZA.gcalKodCoz = function (hedef) {
  const p = new URLSearchParams(String(hedef || '').split('?')[1] || '');
  return {
    kod: p.get('code') || null,
    durum: p.get('state') || null,
    hata: p.get('error') || null
  };
};

/** Yetkilendirme kodunu token'a çevir. İstemci sırrı YOK — yerine
    `code_verifier` gönderilir; kodu yakalayan biri jetonu kullanamaz. */
PZA.gcalTokenAl = async function (clientId, yonlendirme, kod, dogrulayici) {
  const r = await fetch(PZA.GCAL.TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code: kod,
      code_verifier: dogrulayici,
      grant_type: 'authorization_code',
      redirect_uri: yonlendirme
    }).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(j.error_description || j.error || ('Google ' + r.status));
  }
  return j;
};

/** Süresi dolmuş erişim jetonunu refresh_token ile tazele. */
PZA.gcalYenile = async function () {
  const g = PZA.gcal;
  if (!g.clientId || !g.refreshToken) throw new Error('Yenileme anahtarı yok.');
  const r = await fetch(PZA.GCAL.TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: g.clientId,
      refresh_token: g.refreshToken,
      grant_type: 'refresh_token'
    }).toString()
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
    throw new Error(j.error_description || j.error || ('Google ' + r.status));
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

PZA.gcalOzet = function () {
  if (!PZA.gcalBagliMi()) return null;
  return PZA.gcal.sonEsitleme
    ? 'Bağlı ✓ · son eşitleme ' + PZA.gcal.sonEsitleme
    : 'Bağlı ✓ · notlar takvime gönderiliyor.';
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

/** Bir notu Google Takvim olayına çevir.
    Olay, hangi nottan doğduğunu `extendedProperties.private` içinde
    taşır: `<gün>|<saat>|<sıra>`. Böylece yerel bir kimlik tablosu
    tutmadan eşleşme bulunur — not silinince olay da bulunup silinir.
    Saat dilimi belirtilmez; Google takvimin varsayılan dilimini uygular. */
PZA.gcalOlay = function (gun, not, sira) {
  const bas = gun + 'T' + String(not.t || '12:00') + ':00';
  const son = gcalSaatEkle(gun, not.t, PZA.GCAL.SURE);
  return {
    summary: not.x,
    start: { dateTime: bas },
    end: { dateTime: son.gun + 'T' + son.saat + ':00' },
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
    not → olay güncellenir, silinen not → olay silinir. */
PZA.gcalEsitle = async function (gun) {
  if (!PZA.gcalBagliMi()) throw new Error('Önce hesabı bağlayın.');
  const token = await PZA.gcalToken();
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
  return 'Client ID kaydedildi — "Hesap Bağla" ile izin verin.';
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
      yaz('Google yanıtı gelmedi. Tarayıcıda "erişim engellendi (403)" ya da ' +
          '"uygulama test edilmektedir" yazısı gördüyseniz hesabınız test ' +
          'kullanıcısı listesinde değil — aşağıdaki adresten ekleyip yeniden deneyin.', 'err');
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
    yaz(c.hata === 'access_denied' ? 'İzin verilmedi.' : ('Google: ' + c.hata), 'err');
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
    const s = await PZA.gcalEsitle(PZA.activeDay);
    yaz('Bağlandı ✓ · ' + s.toplam + ' not takvimde (' +
        s.eklenen + ' yeni, ' + s.guncellenen + ' güncel, ' + s.silinen + ' silindi)');
  } catch (e) {
    yaz('Bağlandı ✓ — eşitleme sonra tekrar denenecek: ' + e.message, 'err');
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

/** Bekleyen bağlanma akışını iptal et ("Vazgeç" düğmesi).
    Rust, iptal bayrağını dinleyicinin her turunda okur; bekleme üç
    dakika dolmadan biter ve akış "Bağlanma iptal edildi." der. */
PZA.gcalVazgec = async function () {
  if (!GCAL_TAURI) return false;
  try { await gcalCagir('gcal_kapat'); return true; }
  catch (e) { return false; }
};

/** Bağlantıyı kes: jetonu Google tarafında da geçersiz kıl, yerel kopyayı sil.
    Client ID kalır — yeniden bağlanmak için tekrar konsola gidilmesin. */
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
  PZA.gcal = { clientId: g.clientId };
  PZA.gcalKaydet();
};

/* Not eklenip silindikçe takvimi kendiliğinden tazele. Kısa bir gecikme
   şart: kullanıcı arka arkaya not yazarken her tuş için istek gitmesin. */
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
