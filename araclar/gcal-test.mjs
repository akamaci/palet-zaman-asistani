/* gcal-test.mjs — Google Takvim bağlantısı ve eşitleme
   Palet Zaman Asistanı · GPL-3.0

   Kullanıcı bildirimi (tur 4): "Google takvimle entegre olacak yere
   tıklanmasına rağmen açılmıyor."

   Bu akışın tamamı ağ üzerinden çalışır ve yerelde (Rust derleyicisi
   olmadan, Google istemcisi olmadan) uçtan uca denenemez. Bu yüzden
   test, akışın KARAR veren bütün parçalarını sahte bir `fetch` ve
   sahte bir Tauri köprüsü üzerinde çalıştırır:

     • PKCE çifti gerçekten RFC 7636'ya uygun mu (S256, base64url)
     • yetki URL'i Google'ın istediği bütün alanları taşıyor mu
     • dönüş adresi doğru çözülüyor mu (kod / hata / state)
     • not → olay dönüşümü doğru mu (özellikle 23:45 → ertesi gün)
     • eşitleme kararı: hangi not eklenir, hangisi güncellenir,
       hangi olay silinir
     • `state` tutmazsa akış DURUYOR mu (CSRF)
     • istemci sırrı hiçbir istekte gitmiyor mu

   Çalıştırma:  npm run test        */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KOK = path.join(import.meta.dirname, '..', 'src', 'js') + path.sep;
const src = f => fs.readFileSync(KOK + f, 'utf8');

let bad = 0, iyi = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const bad_ = m => { bad++; console.log('  X    ' + m); };
const esit = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b))
  ? ok(m + ' = ' + JSON.stringify(a))
  : bad_(m + ' → beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a));
const dogru = (c, m) => c ? ok(m) : bad_(m);

/* ── Sahte ortam ──────────────────────────────────────── */
const g = globalThis;
let store, istekler, cevap, komutlar, yuklemeHatasi, els;

function sahteFetch(url, opt = {}) {
  const u = String(url);
  const ct = (opt.headers && opt.headers['Content-Type']) || '';
  const govde = !opt.body ? null
    : ct.includes('json') ? JSON.parse(opt.body)
    : Object.fromEntries(new URLSearchParams(opt.body));
  istekler.push({ url: u, opt, govde });
  const r = cevap ? (cevap(u, opt) || {}) : {};
  return Promise.resolve({
    ok: r.ok !== false,
    status: r.status || 200,
    json: () => Promise.resolve(r.json || {})
  });
}

function kur(secenek = {}) {
  store = new Map(secenek.depo || []);
  istekler = [];
  cevap = secenek.cevap || null;
  yuklemeHatasi = null;
  komutlar = [];
  cevap = secenek.cevap || null;

  g.window = g;
  g.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  /* Panel mesajı, elle açma kutusu ve o kutunun notu DOM'a yazıyor;
     ölçebilmek için yalnız bu dört öğe sahtelenir. Ötekiler `null`
     kalır — gcal.js olmayan öğeye yazmaya çalışırsa sessizce geçer. */
  els = new Map();
  const mkEl = id => {
    const cls = new Set();
    return {
      id, textContent: '', value: '', hidden: true, _cls: cls,
      classList: {
        add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
        toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }
      }
    };
  };
  g.document = {
    getElementById: id => {
      if (id !== 'gcal-state' && id !== 'gcal-elle' && id !== 'gcal-url' &&
          id !== 'gcal-elle-not') return null;
      if (!els.has(id)) els.set(id, mkEl(id));
      return els.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  g.fetch = sahteFetch;

  // Tauri köprüsü: Rust komutlarını taklit eder, çağrıları kaydeder.
  if (secenek.tauri !== false) {
    g.__TAURI__ = {
      core: {
        invoke: (cmd, args) => {
          komutlar.push({ cmd, args });
          const h = (secenek.komutlar || {})[cmd];
          if (typeof h === 'function') return h(args);
          if (h === undefined && secenek.komutlar) return Promise.reject('tanımsız komut: ' + cmd);
          return Promise.resolve(null);
        }
      }
    };
  } else {
    delete g.__TAURI__;
    delete g.__TAURI_INTERNALS__;
  }

  delete g.PZA;
  /* gcal.js klasik script: üst düzey `const`/`function` bildirimleri
     dosya kapsamında kalır. Testin iç yardımcılara erişebilmesi için
     kaynağın SONUNA kendi çıkışımızı ekliyoruz — üretim koduna
     test amaçlı hiçbir şey eklenmez. */
  new Function(src('settings.js') + '\n' + src('gcal.js') + '\n' +
    'window.__G = { gcalSaatEkle, gcalGunKaydir, gcalB64url, gcalPkce, gcalRastgele };'
  )();
  return g.PZA;
}

const b64urlGecerli = s => /^[A-Za-z0-9_-]+$/.test(s);

/* ══════════════════════════════════════════════════════════ */
console.log('\n1 · Not saati → takvim saati (gece yarısı taşması)');
{
  kur();
  const { gcalSaatEkle, gcalGunKaydir } = g.__G;
  esit(gcalSaatEkle('2026-10-09', '09:00', 30), { gun: '2026-10-09', saat: '09:30' }, '09:00 + 30 dk');
  esit(gcalSaatEkle('2026-10-09', '23:45', 30), { gun: '2026-10-10', saat: '00:15' }, '23:45 → ertesi gün');
  esit(gcalSaatEkle('2026-12-31', '23:50', 30), { gun: '2027-01-01', saat: '00:20' }, 'yıl devri');
  esit(gcalSaatEkle('2026-02-28', '23:50', 30), { gun: '2026-03-01', saat: '00:20' }, 'artık olmayan yıl → 1 Mart');
  esit(gcalSaatEkle('2024-02-28', '23:50', 30), { gun: '2024-02-29', saat: '00:20' }, 'artık yıl → 29 Şubat');
  // "24:15" gibi geçersiz bir saat üretilseydi Google isteği reddederdi.
  dogru(!gcalSaatEkle('2026-10-09', '23:45', 30).saat.startsWith('24'), 'geçersiz 24:xx üretilmiyor');
  esit(gcalGunKaydir('2026-03-01', -1), '2026-02-28', 'gün geri');
  esit(gcalGunKaydir('2026-12-31', 1), '2027-01-01', 'gün ileri');
  esit(gcalGunKaydir('2026-10-09', 2), '2026-10-11', 'iki gün ileri');
}

console.log('\n2 · PKCE — istemci sırrı olmadan güvenlik');
await (async () => {
  kur();
  const { gcalPkce, gcalRastgele, gcalB64url } = g.__G;
  const a = await gcalPkce();
  esit(a.dogrulayici.length, 43, 'code_verifier uzunluğu (RFC 7636: 43–128)');
  dogru(b64urlGecerli(a.dogrulayici), 'verifier base64url alfabesinde (+ / = yok)');
  dogru(b64urlGecerli(a.ozet), 'challenge base64url alfabesinde');
  esit(a.ozet.length, 43, 'SHA-256 → 32 bayt → 43 karakter');

  // Bağımsız doğrulama: challenge gerçekten SHA-256(verifier) mı?
  const beklenen = crypto.createHash('sha256').update(a.dogrulayici).digest('base64url');
  esit(a.ozet, beklenen, 'challenge = base64url(SHA-256(verifier))');

  const b = await gcalPkce();
  dogru(b.dogrulayici !== a.dogrulayici, 'her akışta yeni verifier (tekrar saldırısı yok)');
  esit(gcalB64url(new Uint8Array([251, 255, 190])), '-_--', '+ / karakterleri - _ olur');
  dogru(!gcalRastgele(32).includes('='), 'dolgu (=) atılıyor');
})();

console.log('\n3 · Yetki URL\'i — Google\'ın istediği alanlar');
{
  const PZA = kur();
  const url = PZA.gcalYetkiUrl('123-abc.apps.googleusercontent.com',
    'http://127.0.0.1:53142', 'OZET', 'DURUM');
  const q = new URLSearchParams(url.split('?')[1]);
  dogru(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'), 'onay uç noktası');
  esit(q.get('client_id'), '123-abc.apps.googleusercontent.com', 'client_id');
  esit(q.get('redirect_uri'), 'http://127.0.0.1:53142', 'loopback yönlendirme');
  esit(q.get('response_type'), 'code', 'response_type');
  esit(q.get('code_challenge'), 'OZET', 'code_challenge');
  esit(q.get('code_challenge_method'), 'S256', 'code_challenge_method');
  esit(q.get('state'), 'DURUM', 'state (CSRF)');
  esit(q.get('access_type'), 'offline', 'access_type — refresh_token için');
  esit(q.get('prompt'), 'consent', 'prompt=consent — yeniden bağlanışta da refresh_token');
  esit(q.get('scope'), 'https://www.googleapis.com/auth/calendar.events', 'yalnızca olay kapsamı');
  dogru(q.get('client_secret') === null, 'istemci SIRRI gönderilmiyor');
}

console.log('\n4 · Dönüş adresini çözme');
{
  const PZA = kur();
  esit(PZA.gcalKodCoz('/?code=4/0AY0e&state=xyz'),
    { kod: '4/0AY0e', durum: 'xyz', hata: null }, 'kod + state');
  esit(PZA.gcalKodCoz('/?error=access_denied'),
    { kod: null, durum: null, hata: 'access_denied' }, 'kullanıcı reddetti');
  esit(PZA.gcalKodCoz(''), { kod: null, durum: null, hata: null }, 'boş hedef çökertmiyor');
  esit(PZA.gcalKodCoz('/?code=4%2F0AY0e%20x').kod, '4/0AY0e x', 'yüzde kodlaması çözülüyor');
}

console.log('\n5 · Not → takvim olayı');
{
  const PZA = kur();
  const o = PZA.gcalOlay('2026-10-09', { t: '14:30', x: 'Toplantı' }, 1);
  esit(o.summary, 'Toplantı', 'başlık notun metni');
  esit(o.start.dateTime, '2026-10-09T14:30:00', 'başlangıç');
  esit(o.end.dateTime, '2026-10-09T15:00:00', 'bitiş = +30 dk');
  esit(o.extendedProperties.private.pza, '2026-10-09|14:30|1', 'köken işareti (eşleşme anahtarı)');
  dogru(o.start.timeZone === undefined, 'saat dilimi yazılmıyor → takvimin varsayılanı');

  const gec = PZA.gcalOlay('2026-10-09', { t: '23:45', x: 'Gece' }, 1);
  esit(gec.end.dateTime, '2026-10-10T00:15:00', '23:45 notu ertesi güne taşıyor');

  const d = PZA.gcalOlay('2026-10-09', { x: 'Saatsiz' }, 1);
  esit(d.start.dateTime, '2026-10-09T12:00:00', 'saatsiz not öğlene düşer');
}

console.log('\n6 · Token isteği — gövde ve sır yokluğu');
await (async () => {
  const PZA = kur({ cevap: () => ({ json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }) });
  const j = await PZA.gcalTokenAl('CID', 'http://127.0.0.1:1', 'KOD', 'DOGRULAYICI');
  esit(j.access_token, 'AT', 'erişim jetonu döndü');
  const i = istekler[0];
  esit(i.url, 'https://oauth2.googleapis.com/token', 'token uç noktası');
  esit(i.opt.method, 'POST', 'yöntem POST');
  dogru(/application\/x-www-form-urlencoded/.test(i.opt.headers['Content-Type']), 'basit içerik türü (CORS ön kontrolü gerekmez)');
  esit(i.govde.grant_type, 'authorization_code', 'grant_type');
  esit(i.govde.code, 'KOD', 'kod');
  esit(i.govde.code_verifier, 'DOGRULAYICI', 'PKCE doğrulayıcı');
  esit(i.govde.redirect_uri, 'http://127.0.0.1:1', 'yönlendirme (token isteğinde de şart)');
  dogru(i.govde.client_secret === undefined, 'istemci sırrı YOK');

  kur({ cevap: () => ({ ok: false, status: 400, json: { error: 'invalid_grant', error_description: 'Kod süresi doldu' } }) });
  let hata = null;
  try { await g.PZA.gcalTokenAl('C', 'R', 'K', 'V'); } catch (e) { hata = e.message; }
  esit(hata, 'Kod süresi doldu', 'Google hatası okunabilir metne çevriliyor');
})();

console.log('\n7 · Jeton yenileme');
await (async () => {
  let PZA = kur({ depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'CID' })]] });
  let hata = null;
  try { await PZA.gcalYenile(); } catch (e) { hata = e.message; }
  esit(hata, 'Yenileme anahtarı yok.', 'refresh_token yokken yenileme denenmiyor');

  PZA = kur({
    depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'CID', refreshToken: 'RT' })]],
    cevap: () => ({ json: { access_token: 'YENI', expires_in: 3600 } })
  });
  await PZA.gcalYenile();
  esit(PZA.gcal.accessToken, 'YENI', 'yeni erişim jetonu yazıldı');
  esit(PZA.gcal.refreshToken, 'RT', 'refresh_token korundu (yenisi gelmedi)');
  dogru(PZA.gcal.exp > Date.now(), 'son kullanma ileri bir tarihte');
  esit(istekler[0].govde.grant_type, 'refresh_token', 'grant_type');
  dogru(istekler[0].govde.client_secret === undefined, 'istemci sırrı YOK');
  esit(JSON.parse(store.get('pza.gcal.v1')).accessToken, 'YENI', 'diske yazıldı (yeniden açılışta hazır)');

  // Geçerli jeton varken ağa çıkılmamalı
  istekler = [];
  esit(await PZA.gcalToken(), 'YENI', 'geçerli jeton doğrudan döndü');
  esit(istekler.length, 0, 'gereksiz ağ isteği yok');

  // Süresi dolmuşsa yenilenmeli
  PZA.gcal.exp = Date.now() - 1000;
  istekler = [];
  await PZA.gcalToken();
  esit(istekler.length, 1, 'süresi dolunca yenilendi');
})();

console.log('\n8 · Eşitleme kararı — ekle / güncelle / sil');
await (async () => {
  const olay = (id, oz, ozet) => ({
    id, summary: ozet, extendedProperties: { private: { pza: oz } }
  });
  const bagli = ['pza.gcal.v1', JSON.stringify({ clientId: 'C', refreshToken: 'R', accessToken: 'A', exp: Date.now() + 6e5 })];

  // Aynı not → dokunma, değişmiş not → PATCH, karşılığı olmayan olay → DELETE
  let PZA = kur({
    depo: [bagli],
    cevap: url => url.includes('/events?')
      ? { json: { items: [olay('e1', '2026-10-09|09:00|1', 'Kahve'), olay('e2', '2026-10-09|11:00|1', 'Eski iş')] } }
      : { status: 200, json: { id: 'yeni' } }
  });
  PZA.notes = { '2026-10-09': [{ t: '09:00', x: 'Kahve' }, { t: '14:30', x: 'Toplantı' }] };
  let s = await PZA.gcalEsitle('2026-10-09');
  esit([s.eklenen, s.guncellenen, s.silinen], [1, 0, 1], '1 eklendi, 0 güncellendi, 1 silindi');
  const yollar = istekler.map(i => i.opt.method + ' ' + i.url.replace(/^.*calendar\/v3/, ''));
  esit(yollar[1], 'POST /calendars/primary/events', 'yeni not POST ile');
  esit(yollar[2], 'DELETE /calendars/primary/events/e2', 'notu silinmiş olay DELETE ile');
  esit(istekler[1].govde.extendedProperties.private.pza, '2026-10-09|14:30|1', 'yeni olay köken işaretini taşıyor');

  // Metni değişmiş not → PATCH, olay yeniden üretilmez
  PZA = kur({
    depo: [bagli],
    cevap: url => url.includes('/events?')
      ? { json: { items: [olay('e1', '2026-10-09|09:00|1', 'Eski metin')] } }
      : { status: 200, json: {} }
  });
  PZA.notes = { '2026-10-09': [{ t: '09:00', x: 'Yeni metin' }] };
  s = await PZA.gcalEsitle('2026-10-09');
  esit([s.eklenen, s.guncellenen, s.silinen], [0, 1, 0], 'metin değişince güncellendi');
  esit(istekler[1].opt.method, 'PATCH', 'PATCH kullanıldı');
  esit(istekler[1].govde.summary, 'Yeni metin', 'yalnızca başlık gönderildi');
  dogru(!('start' in istekler[1].govde), 'saat yeniden gönderilmedi (kullanıcı takvimde taşımış olabilir)');

  // Aynı saatte iki not → çakışmasın
  PZA = kur({ depo: [bagli], cevap: url => url.includes('/events?') ? { json: { items: [] } } : { json: {} } });
  PZA.notes = { '2026-10-09': [{ t: '09:00', x: 'Bir' }, { t: '09:00', x: 'İki' }] };
  await PZA.gcalEsitle('2026-10-09');
  const anahtarlar = istekler.filter(i => i.opt.method === 'POST').map(i => i.govde.extendedProperties.private.pza);
  esit(anahtarlar, ['2026-10-09|09:00|1', '2026-10-09|09:00|2'], 'aynı saatteki notlar ayrı olay');

  // Yalnızca bu uygulamanın olaylarına dokunulur
  PZA = kur({
    depo: [bagli],
    cevap: url => url.includes('/events?')
      ? { json: { items: [{ id: 'x', summary: 'Kullanıcının kendi etkinliği' }] } }
      : { json: {} }
  });
  PZA.notes = { '2026-10-09': [] };
  s = await PZA.gcalEsitle('2026-10-09');
  esit(s.silinen, 0, 'işaretsiz olay SİLİNMEZ (kullanıcının kendi takvimi)');

  // Bağlı değilken uyarmalı
  PZA = kur({ depo: [['pza.gcal.v1', JSON.stringify({})]] });
  let hata = null;
  try { await PZA.gcalEsitle('2026-10-09'); } catch (e) { hata = e.message; }
  esit(hata, 'Önce hesabı bağlayın.', 'bağlantı yokken eşitleme duruyor');
})();

console.log('\n9 · Bağlanma akışı');
await (async () => {
  // Client ID yok
  let PZA = kur();
  let mesaj = [], sonuc = await PZA.gcalBaglan((m, s) => mesaj.push([m, s]));
  esit(sonuc, false, 'Client ID yokken bağlanmıyor');
  dogru(mesaj[0][0].includes('Client ID'), 'kullanıcı Client ID alanına yönlendiriliyor');

  // Biçimi bozuk Client ID
  PZA = kur({ depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'yanlis-deger' })]] });
  mesaj = [];
  esit(await PZA.gcalBaglan((m, s) => mesaj.push([m, s])), false, 'yanlış biçimli Client ID reddedildi');
  dogru(mesaj[0][0].includes('apps.googleusercontent.com'), 'beklenen biçim söyleniyor');

  // TUR 6: API anahtarı girildi (kullanıcı bildirimi: "Api key girdim kabul etti")
  PZA = kur({ depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'AIzaSyA1b2C3d4E5f6G7h8I9j0KLMNOPQRSTUV' })]] });
  mesaj = [];
  esit(await PZA.gcalBaglan((m, s) => mesaj.push([m, s])), false, 'API anahtarı Client ID sanılmıyor');
  dogru(mesaj[0][0].includes('API anahtarı'), 'API anahtarı olduğu AÇIKÇA söyleniyor');
  dogru(mesaj[0][0].includes('Masaüstü uygulaması'), 'doğru istemci türü (Masaüstü) söyleniyor');

  // TUR 6: geçersiz değer kurulum kutusunu GİZLEMEMELİ (kurtarma yolu kalsın)
  PZA = kur({ depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'AIzaSyA1b2C3d4E5f6G7h8I9j0KLMNOPQRSTUV' })]] });
  esit(PZA.gcalClientIdGecerliMi(), false, 'API anahtarı geçerli Client ID sayılmıyor');
  esit(PZA.gcalClientIdGecerliMi('a.apps.googleusercontent.com'), true, 'doğru biçim geçerli sayılıyor');
  esit(PZA.gcalClientIdGecerliMi(''), false, 'boş değer geçersiz');
  esit(PZA.gcalVarsayilan(null, 'AIzaSyA1b2C3d4E5f6G7h8I9j0KLMNOPQRSTUV', false), null,
    'geçersiz değerde türetilmiş ipucu YAZILMAZ (yanıltmaz)');
  esit(PZA.gcalVarsayilan(null, 'a.apps.googleusercontent.com', true),
    'Client ID kaydedildi — "Hesap Bağla" ile izin verin.', 'geçerli değerde ipucu gelir');

  // Tarayıcı önizlemesi (Tauri yok)
  PZA = kur({ tauri: false, depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'a.apps.googleusercontent.com' })]] });
  mesaj = [];
  esit(await PZA.gcalBaglan((m, s) => mesaj.push([m, s])), false, 'tarayıcıda bağlanmıyor');
  dogru(mesaj[0][0].includes('uygulamada çalışır'), 'neden çalışmadığı söyleniyor');

  // `state` tutmazsa akış DURUR (CSRF)
  const cid = 'a.apps.googleusercontent.com';
  const depo = [['pza.gcal.v1', JSON.stringify({ clientId: cid })]];
  PZA = kur({
    depo, komutlar: { gcal_port: () => 51234, gcal_ac: () => true, gcal_bekle: () => '/?code=K&state=YANLIS' }
  });
  mesaj = [];
  esit(await PZA.gcalBaglan((m, s) => mesaj.push([m, s])), false, 'state uyuşmazlığında bağlanmıyor');
  dogru(mesaj.some(m => m[0].includes('state')), 'güvenlik uyarısı gösteriliyor');
  esit(istekler.length, 0, 'STATE TUTMADIĞINDA TOKEN İSTENMEZ');

  // Kullanıcı reddetti
  PZA = kur({
    depo, komutlar: { gcal_port: () => 51234, gcal_ac: () => true, gcal_bekle: () => '/?error=access_denied' }
  });
  mesaj = [];
  esit(await PZA.gcalBaglan((m, s) => mesaj.push([m, s])), false, 'izin verilmeyince bağlanmıyor');
  dogru(mesaj.some(m => m[0] === 'İzin verilmedi.'), 'reddetme anlaşılır biçimde bildiriliyor');

  // Mutlu yol
  const durumlar = [];
  PZA = kur({
    depo,
    komutlar: {
      gcal_port: () => 51234,
      gcal_ac: a => { durumlar.push(a.url); return true; },
      gcal_bekle: () => '/?code=GERCEK&state=' + (durumlar[0].match(/state=([^&]+)/) || [])[1]
    },
    cevap: url => url.includes('/token')
      ? { json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }
      : { json: { items: [] } }
  });
  mesaj = [];
  esit(await PZA.gcalBaglan((m, s) => mesaj.push([m, s])), true, 'mutlu yolda bağlandı');
  esit(PZA.gcal.refreshToken, 'RT', 'refresh_token diske yazıldı');
  esit(PZA.gcal.clientId, cid, 'Client ID korundu');
  esit(PZA.gcalBagliMi(), true, 'artık bağlı sayılıyor');
  esit(komutlar.map(k => k.cmd), ['gcal_port', 'gcal_ac', 'gcal_bekle'], 'üç Rust komutu çağrıldı');
  esit(komutlar[0].args, undefined, 'gcal_port argümansız');
  dogru(durumlar[0].startsWith('https://accounts.google.com/'), 'yalnızca Google adresi açıldı');
  dogru(durumlar[0].includes('redirect_uri=http%3A%2F%2F127.0.0.1%3A51234'), 'yönlendirme açılan portu gösteriyor');
  esit(PZA.gcalOzet().startsWith('Bağlı ✓'), true, 'panel özeti bağlıyı bildiriyor');
})();

console.log('\n10 · Bağlantıyı kesme (jeton iptali)');
await (async () => {
  const PZA = kur({
    depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'CID', refreshToken: 'RT', accessToken: 'AT' })]],
    cevap: () => ({ json: {} })
  });
  await PZA.gcalKes();
  esit(istekler[0].url, 'https://oauth2.googleapis.com/revoke', 'jeton Google tarafında iptal edildi');
  esit(istekler[0].govde.token, 'RT', 'refresh_token iptal edildi');
  esit(PZA.gcal.refreshToken, undefined, 'yerel yenileme anahtarı silindi');
  esit(PZA.gcal.accessToken, undefined, 'yerel erişim jetonu silindi');
  esit(PZA.gcal.clientId, 'CID', 'Client ID kaldı — yeniden bağlanmak kolay');
  esit(PZA.gcalBagliMi(), false, 'artık bağlı değil');
  esit(JSON.parse(store.get('pza.gcal.v1')).refreshToken, undefined, 'diskten de silindi');
})();

console.log('\n11 · Kalıcılık — yeniden açılış');
{
  let PZA = kur({ depo: [['pza.gcal.v1', JSON.stringify({ clientId: 'CID', refreshToken: 'RT' })]] });
  esit(PZA.gcalBagliMi(), true, 'depodan bağlı okundu');
  esit(PZA.gcalClientId(), 'CID', 'Client ID depodan geldi');
  PZA = kur({ depo: [['pza.gcal.v1', '{bozuk json']] });
  esit(PZA.gcalBagliMi(), false, 'bozuk kayıt çökertmiyor');
}

console.log('\n12 · Tarayıcı açılamazsa akış ÇIKMAZA GİRMEZ (tur 5)');
await (async () => {
  /* Kullanıcı bildirimi: "Api key girdim kabul etti ama bağlan
     butonuna basınca açması gereken URL açılmadı."
     Tarayıcıyı açmak işletim sistemine bağlı bir adım; başarısız
     olabileceği kabul edilir. Kritik olan, bu başarısızlığın
     akışı DURDURMAMASI: adres kullanıcıya gösterilir, kullanıcı
     kendi tarayıcısında açar, dönüş yine dinleyiciye düşer. */
  const cid = 'a.apps.googleusercontent.com';
  const depo = [['pza.gcal.v1', JSON.stringify({ clientId: cid })]];

  /* `gcal_ac` çağrıldığı ANDA kutunun durumu kaydedilir: akış
     bittiğinde kutu kapanacağı için sonradan bakılamaz, oysa
     güvence verilmesi gereken şey tam da "adres, tarayıcı
     denenmeden önce görünür" olmasıdır. */
  let elleAcikKen = null, denenenAdres = null;
  let PZA = kur({
    depo,
    komutlar: {
      gcal_port: () => 51234,
      /* Tarayıcı hiç açılamıyor — kullanıcının bildirdiği durum. */
      gcal_ac: a => {
        elleAcikKen = els.get('gcal-elle') ? !els.get('gcal-elle').hidden : null;
        denenenAdres = els.get('gcal-url') ? els.get('gcal-url').value : null;
        throw 'Tarayıcı açılamadı (explorer.exe: yok)';
      },
      /* Google'ın dönüşü, açılmaya ÇALIŞILAN adresteki `state` ile
         gelir: kullanıcı adresi kopyalayıp kendi tarayıcısında açmış
         gibi. `komutlar` kaydından okunur, zamanlamaya bağlı değildir. */
      gcal_bekle: () => {
        const ac = komutlar.find(k => k.cmd === 'gcal_ac');
        const st = (ac.args.url.match(/state=([^&]+)/) || [])[1];
        return '/?code=ELLE&state=' + st;
      }
    },
    cevap: url => url.includes('/token')
      ? { json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }
      : { json: { items: [] } }
  });

  let mesaj = [];
  const elle = () => els.get('gcal-elle');
  const urlKutusu = () => els.get('gcal-url');

  const sonuc = await PZA.gcalBaglan((m, s) => mesaj.push([m, s]));
  const acilan = komutlar.find(k => k.cmd === 'gcal_ac');
  dogru(!!acilan, 'tarayıcı açma denendi (başarısız oldu)');
  esit(elleAcikKen, true, 'adres, tarayıcı denenmeden ÖNCE gösterilmiş');
  esit(denenenAdres, acilan.args.url, 'gösterilen adres, açılmaya çalışılan adresin AYNISI');
  dogru(denenenAdres.startsWith('https://accounts.google.com/'), 'adres Google onay sayfası');
  dogru(denenenAdres.includes('code_challenge='), 'adres PKCE challenge taşıyor (elle açmak da güvenli)');
  esit(sonuc, true, 'tarayıcı açılamasa bile bağlanma TAMAMLANDI (elle açılan adres üzerinden)');
  esit(PZA.gcalBagliMi(), true, 'bağlantı kuruldu');
  dogru(mesaj.some(m => m[1] === 'err' && m[0].includes('kopyalayıp')),
    'kullanıcıya "adresi kopyalayıp tarayıcınıza yapıştırın" deniyor');
  esit(elle().hidden, true, 'akış bitince elle açma kutusu kapanıyor');

  /* ── Mesajın ezilmemesi: tur 5'nın asıl hatası ──
     Düğmenin `finally` bloğu paneli tazeliyordu ve akışın yazdığı
     HATA mesajını anında siliyordu. Kullanıcı "Client ID kaydedildi"
     görüp düğmenin hiçbir şey yapmadığını sanıyordu. */
  esit(PZA.gcalVarsayilan('Bağlı ✓ · özet', cid), null,
    'akış mesaj yazdıysa tazeleme YAZMAZ (hata görünür kalır)');
  PZA.gcalMesajTemizle();
  dogru(typeof PZA.gcalVarsayilan(null, cid) === 'string',
    'mesaj temizlenince türetilen ipucu geri geliyor');

  // Hata mesajı DOM'a gerçekten yazıldı mı ve işaretlendi mi?
  PZA.gcalYaz('Yerel dinleyici açılamadı: test', 'err');
  esit(els.get('gcal-state').textContent, 'Yerel dinleyici açılamadı: test', 'hata metni panele yazıldı');
  esit(els.get('gcal-state')._cls.has('err'), true, 'hata olarak işaretlendi (kırmızı)');
  PZA.gcalYaz('Bağlandı ✓', null);
  esit(els.get('gcal-state')._cls.has('err'), false, 'başarı mesajında hata işareti kalkıyor');

  /* ── Elle açma kutusu kapanabilmeli ── */
  PZA.gcalElle('https://accounts.google.com/x');
  esit(elle().hidden, false, 'adres verilince kutu açılıyor');
  PZA.gcalElle(null);
  esit(elle().hidden, true, 'null verilince kutu kapanıyor');
})();

console.log('\n13 · Rust tarayıcı açma: tek yönteme güvenilmez (tur 5)');
{
  /* `gcal_ac` üç yöntemi sırayla dener. Bu statik bir kontrol:
     yöntemlerden birinin sessizce çalışmaması durumunda ötekine
     geçildiğini kodda görmek istiyoruz. Rust derleyicisi olmadan
     davranışı ölçemiyoruz, ama yöntem listesi ve sırası sabitlenir. */
  const rs = fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src-tauri', 'src', 'main.rs'), 'utf8');
  const fn = rs.slice(rs.indexOf('fn gcal_ac'), rs.indexOf('async fn gcal_bekle'));
  dogru(fn.includes('explorer.exe'), 'explorer.exe yöntemi var');
  dogru(fn.includes('rundll32.exe'), 'rundll32 yöntemi var');
  dogru(fn.includes('"start"'), 'cmd start yedek yöntemi var');
  dogru(/for \(program, onler\) in denemeler/.test(fn), 'yöntemler SIRAYLA deneniyor');
  dogru(/Err\(e\) => son = format!/.test(fn), 'başarısız yöntem hatayı kaydedip devam ediyor');
  dogru(fn.includes('accounts.google.com') && fn.includes('console.cloud.google.com'),
    'beyaz liste korunuyor (arayüzden gelen adres doğrudan açılmaz)');
  dogru(/IZINLI\.iter\(\)\.any/.test(fn), 'beyaz liste dışı adres reddediliyor');
}

console.log('\n14 · Dış servisin reddi kullanıcıyı yalnız bırakmaz (tur 7)');
await (async () => {
  /* KULLANICI BİLDİRİMİ (tur 7): Google, hesabı reddettiğinde
     (`Hata 403: access_denied` — "uygulama test edilmektedir")
     YÖNLENDİRME YAPMAZ. Dinleyiciye hiç istek düşmediği için akış
     zaman aşımına düşer ve eski kod kullanıcıya yalnızca
     "Google yanıtı alınamadı: … süre doldu" diyordu: ne sebep, ne
     atılacak adım. Oysa bu, ilk kurulumda en sık karşılaşılan durum. */
  const cid = 'b.apps.googleusercontent.com';
  const depo = [['pza.gcal.v1', JSON.stringify({ clientId: cid })]];

  let notBeklerken = null;
  const PZA = kur({
    depo,
    komutlar: {
      gcal_port: () => 52001,
      /* Tarayıcı açıldı; Google onay sayfası yerine 403 gösterdi. */
      gcal_ac: () => {
        notBeklerken = els.get('gcal-elle-not') ? els.get('gcal-elle-not').textContent : null;
        return true;
      },
      gcal_bekle: () => { throw 'Google yanıtı beklenirken süre doldu.'; }
    }
  });

  const mesaj = [];
  const oldu = await PZA.gcalBaglan((m, s) => mesaj.push([m, s]));
  const son = mesaj[mesaj.length - 1] || ['', null];

  esit(oldu, false, 'akış başarısız dönüyor (bağlantı kurulmuş sayılmıyor)');
  dogru(/403|test kullanıcısı/i.test(son[0]), 'mesaj SEBEBİ söylüyor (403 / test kullanıcısı)');
  dogru(/test kullanıcısı listesinde değil/i.test(son[0]), 'mesaj kullanıcının atacağı adımı söylüyor');
  dogru(!/süre doldu/i.test(son[0]), 'ham "süre doldu" metni kullanıcıya gösterilmiyor');
  esit(son[1], 'err', 'mesaj hata olarak işaretli (kırmızı)');

  /* Adım, KOPYALANABİLİR adresle verilir: "Konsolu aç" düğmesi de
     tarayıcı açma adımına bağlıdır ve o adım başarısız olabilir. */
  const kutu = els.get('gcal-elle');
  esit(kutu.hidden, false, 'zaman aşımında adres kutusu AÇILIYOR');
  esit(els.get('gcal-url').value, PZA.GCAL.KITLE,
    'kutu, OAuth "Kitle (Audience)" sayfasını gösteriyor');
  dogru(PZA.GCAL.KITLE.startsWith('https://console.cloud.google.com/'),
    'adres, Rust beyaz listesindeki köklerden biri (açılabilir)');

  /* Bekleme SÜRERKEN de not görünür: kullanıcı üç dakika boyunca
     tarayıcıda "erişim engellendi" yazısına bakıp ne yapacağını
     bilemezdi. */
  dogru(!!notBeklerken && /403/.test(notBeklerken), 'beklerken de not görünür (403)');
  dogru(/Yayınla/.test(notBeklerken || ''), 'not kalıcı çözümü söylüyor (Yayınla)');
  dogru(/7 günde/.test(notBeklerken || ''), 'not, test izinlerinin 7 günde dolduğunu söylüyor');

  /* ── Vazgeç: bekleyen akış gerçekten durur ──
     Eskiden "vazgeç" düğmesi boş olurdu: `gcal_kapat` yalnızca State'i
     boşaltıyordu, ama dinleyici çoktan iş parçacığına taşınmıştı. */
  const PZA2 = kur({
    depo,
    komutlar: {
      gcal_port: () => 52002,
      gcal_ac: () => true,
      gcal_bekle: () => { throw 'İptal edildi.'; },
      gcal_kapat: () => null
    }
  });
  const m2 = [];
  const s2 = await PZA2.gcalBaglan((m, s) => m2.push([m, s]));
  const son2 = m2[m2.length - 1];
  esit(s2, false, 'iptal edilen akış "bağlandı" demiyor');
  dogru(/iptal/i.test(son2[0]), 'kullanıcıya iptal edildiği söyleniyor');
  dogru(!/yanıtı alınamadı/i.test(son2[0]), 'iptal, hata gibi görünmüyor');
  esit(els.get('gcal-elle').hidden, true, 'iptalde adres kutusu kapanıyor');

  komutlar.length = 0;
  esit(await PZA2.gcalVazgec(), true, 'gcalVazgec Rust komutunu çağırıp başarılı dönüyor');
  esit(komutlar.filter(k => k.cmd === 'gcal_kapat').length, 1,
    'Vazgeç düğmesi gcal_kapat komutunu çağırıyor');

  /* ── Rust tarafı: iptal bayrağı gerçekten okunuyor mu? ── */
  const rs = fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src-tauri', 'src', 'main.rs'), 'utf8');
  const kap = rs.slice(rs.indexOf('fn gcal_kapat'), rs.indexOf('fn dinle'));
  const dn = rs.slice(rs.indexOf('fn dinle'), rs.indexOf('fn hedefOku'));
  dogru(/iptal\.store\(true/.test(kap), 'gcal_kapat, iptal bayrağını kaldırıyor');
  dogru(/iptal\.load\(Ordering::Relaxed\)/.test(dn), 'dinle, bayrağı her turda okuyor');
  dogru(dn.indexOf('iptal.load') < dn.indexOf('Instant::now() > bitis'),
    'iptal, süre dolumundan ÖNCE soruluyor (3 dakika bekletilmiyor)');
  dogru(/gcal_kapat/.test(src('gcal.js')), 'arayüz gcal_kapat komutunu çağırıyor');
  dogru(/iptal\.store\(false/.test(rs.slice(rs.indexOf('fn gcal_port'), rs.indexOf('fn gcal_ac'))),
    'yeni akış, önceki akıştan kalan iptal işaretini SIFIRLIYOR');

  /* ── Ölü yenileme anahtarı: 7 günlük jeton ömrü ──
     Google, Test durumundaki uygulamada izni 7 gün sonra düşürür ve
     token uç noktası `invalid_grant` döner. Ham hata kullanıcıya
     hiçbir şey söylemez; dahası anahtar yerinde kaldıkça bağlantı
     "bağlı" görünür ve hata her eşitlemede tekrarlanır. */
  const PZA3 = kur({
    depo: [['pza.gcal.v1', JSON.stringify({ clientId: cid, refreshToken: 'OLU' })]],
    cevap: url => url.includes('/token')
      ? { ok: false, status: 400, json: { error: 'invalid_grant' } }
      : { json: { items: [] } }
  });
  esit(PZA3.gcalBagliMi(), true, 'ölü anahtar başlangıçta "bağlı" görünüyor');
  let hata = null;
  try { await PZA3.gcalYenile(); } catch (e) { hata = e.message; }
  dogru(/7 günde/.test(hata || ''), 'invalid_grant → "7 günde dolar" açıklaması');
  dogru(/Hesap Bağla/.test(hata || ''), 'invalid_grant → atılacak adım söyleniyor');
  dogru(!/^invalid_grant$/.test((hata || '').trim()), 'ham "invalid_grant" metni gösterilmiyor');
  esit(PZA3.gcalBagliMi(), false, 'ölü anahtar siliniyor: durum gerçeği yansıtıyor');

  /* ── Arka plan eşitlemesi sessizce ölmez ──
     Not eklenince takvim kendiliğinden tazelenir. Bu istek
     başarısız olduğunda hata YALNIZ konsola yazılıyordu: kullanıcı
     notunu yazıyor, takvime gittiğini sanıyordu. */
  const PZA4 = kur({
    depo: [['pza.gcal.v1', JSON.stringify({ clientId: cid, refreshToken: 'OLU' })]],
    cevap: url => url.includes('/token')
      ? { ok: false, status: 400, json: { error: 'invalid_grant' } }
      : { json: { items: [] } }
  });
  const gercekZaman = g.setTimeout;
  g.setTimeout = fn => { fn(); return 0; };      // 2,5 sn'lik gecikmeyi atla
  try { PZA4.emit('notes:changed'); } finally { g.setTimeout = gercekZaman; }
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const durum = els.get('gcal-state');
  dogru(durum.textContent.includes('Takvim eşitlemesi başarısız'),
    'arka plan eşitleme hatası PANELE yazılıyor (eskiden yalnız konsola)');
  esit(durum._cls.has('err'), true, 'arka plan hatası da hata olarak işaretli');
  dogru(/7 günde/.test(durum.textContent), 'paneldeki sebep, jeton ömrünü söylüyor');

  /* Bağlı değilken arka plan eşitlemesi hiç denenmemeli (boşuna ağ trafiği). */
  const PZA5 = kur({ depo: [['pza.gcal.v1', JSON.stringify({ clientId: cid })]] });
  istekler.length = 0;
  g.setTimeout = fn => { fn(); return 0; };
  try { PZA5.emit('notes:changed'); } finally { g.setTimeout = gercekZaman; }
  for (let i = 0; i < 5; i++) await Promise.resolve();
  esit(istekler.length, 0, 'bağlı değilken arka planda istek gidilmiyor');
})();

console.log('\n' + (bad ? `SONUC: ${bad} hata, ${iyi} basarili` : `SONUC: temiz — ${iyi} kontrol`));
process.exit(bad ? 1 : 0);
