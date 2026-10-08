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
  SURE: 30                      // bir notun takvimdeki süresi (dakika)
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

/* ── Bağlan / kes ──────────────────────────────────────── */

const GCAL_TAURI = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

async function gcalCagir(cmd, args) {
  const core = window.__TAURI__.core || window.__TAURI__;
  return await core.invoke(cmd, args);
}

/** Tam bağlanma akışı. `bildir(metin, 'err')` ile ilerleme duyurulur. */
PZA.gcalBaglan = async function (bildir) {
  const yaz = bildir || (() => {});
  const clientId = PZA.gcalClientId();

  if (!clientId) { yaz('Önce aşağıdaki Client ID alanını doldurun.', 'err'); return false; }
  if (!GCAL_TAURI) { yaz('Tarayıcı önizlemesinde bağlanılamaz — uygulamada çalışır.', 'err'); return false; }
  if (!(window.crypto && crypto.subtle && crypto.getRandomValues)) {
    yaz('Bu ortam güvenli anahtar üretimini desteklemiyor; bağlantı kurulamaz.', 'err');
    return false;
  }
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    yaz('Client ID "…apps.googleusercontent.com" ile bitmeli.', 'err');
    return false;
  }

  let port;
  try { port = await gcalCagir('gcal_port'); }
  catch (e) { yaz('Yerel dinleyici açılamadı: ' + e, 'err'); return false; }
  const yonlendirme = 'http://127.0.0.1:' + port;

  const { dogrulayici, ozet } = await gcalPkce();
  const durum = gcalRastgele(16);

  yaz('Tarayıcıda Google onay sayfası açıldı — izin verin…');
  try {
    await gcalCagir('gcal_ac', { url: PZA.gcalYetkiUrl(clientId, yonlendirme, ozet, durum) });
  } catch (e) { yaz('Tarayıcı açılamadı: ' + e, 'err'); return false; }

  let hedef;
  try { hedef = await gcalCagir('gcal_bekle'); }
  catch (e) { yaz('Google yanıtı alınamadı: ' + e, 'err'); return false; }

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
    PZA.gcalEsitle(PZA.activeDay).catch(e => console.warn('takvim eşitleme', e));
  }, 2500);
});
