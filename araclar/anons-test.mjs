/* anons-test.mjs — saat başı / yarım saat ve "Önemli" kayıt anonsu
   Palet Zaman Asistanı · GPL-3.0

   KULLANICI İSTEKLERİ (tur 12):
     • "saatimiz ayrıca saat başı saati söylemiyor. Bunun için 2. eklenti
       olmalı ayarlarda saat başı uyarı her yarım saatte uyarı olsun."
     • "önemli yani yıldız konulan randevu ve notlarda da Önemli diye
       başlayıp notumuz ne ise sesli okuyabilir mi?"

   İkisi de DUYULAN davranıştır: bu yüzden test, statik tarama değil
   gerçek yolun ölçümüdür — settings.js + clock.js + notes.js + speech.js
   birlikte çalıştırılır, sahte `speechSynthesis` NE SÖYLENDİĞİNİ, sahte
   `Date` NE ZAMAN söylendiğini kaydeder.

   Neden bu kadar ayrıntı: anons kodunun tamamı ZAMANA bağlıdır ve zaman
   kayan bir saattir (`setInterval(1000)` kayar, pencere gizlenince saat
   durur). "Eşitlik" ile "mandal" arasındaki fark burada kaybolur ya da
   kazanılır — bu yüzden ölçülür.

   Çalıştırma:  npm run test        */
import fs from 'fs';
import path from 'path';

const KOK = path.join(import.meta.dirname, '..', 'src', 'js') + path.sep;
const src = f => fs.readFileSync(KOK + f, 'utf8');

let bad = 0, iyi = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const bad_ = m => { bad++; console.log('  X    ' + m); };
const esit = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b))
  ? ok(m + ' = ' + JSON.stringify(a))
  : bad_(m + ' → beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a));
const dogru = (c, m) => c ? ok(m) : bad_(m + ' (şart sağlanmadı)');

/* ── Sahte ortam ─────────────────────────────────────── */
let konusulan = [];

class SahteUtterance {
  constructor(metin) { this.text = metin; this.pitch = 1; this.rate = 1; this.voice = null; }
}

function mkEl(id) {
  const cls = new Set();
  /* `style` gerçek bir CSSStyleDeclaration gibi davranmalı: skins.js
     token'ları `setProperty`/`removeProperty` ile yazar, sade bir nesne
     bunlarda patlar (bu testin konusu değil ama ölçümü de düşürmemeli). */
  const stil = { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' };
  return {
    id, textContent: '', innerHTML: '', hidden: false, disabled: false, value: '',
    checked: false, dataset: {}, style: stil,
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }
    },
    setAttribute() {}, getAttribute() { return null; },
    focus() {}, querySelector: () => null, closest: () => null
  };
}
let els = new Map();
const el = id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
let store = new Map();

const g = globalThis;
g.window = g;
g.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
g.document = {
  getElementById: id => el(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: { classList: mkEl('body').classList }
};
if (!g.addEventListener) g.addEventListener = () => {};
g.SpeechSynthesisUtterance = SahteUtterance;

const V = (name, lang) => ({ name, lang });
g.speechSynthesis = {
  getVoices: () => [V('Microsoft Filiz - Turkish (Turkey)', 'tr-TR'),
                    V('Microsoft Tolga - Turkish (Turkey)', 'tr-TR')],
  speak: u => konusulan.push(u),
  cancel() {}, resume() {},
  onvoiceschanged: null
};

/** Uygulamayı (gerçek dosyalarla) yeniden yükle. `ayar` verilirse
    depodaki kayıt o olur — eski kayıt yükseltmesini ölçmek için. */
function yukle(ayar) {
  konusulan = [];
  els = new Map();
  store = new Map();
  if (ayar !== undefined) store.set('pza.settings.v1', JSON.stringify(ayar));
  delete g.PZA;
  new Function(src('log.js') + '\n' + src('settings.js') + '\n' + src('skins.js') +
    '\n' + src('clock.js') + '\n' + src('notes.js') + '\n' + src('speech.js'))();
  const P = g.PZA;
  /* skins.js gerçek bir tuval/kütüphane bekliyor; bu testin konusu
     değil. Panel bağlama ölçümü `apply()` üzerinden yapıldığı için
     yalnız o çizim atlanır. */
  P.renderSkins = () => {};
  return P;
}

/* ── Sahte saat ──────────────────────────────────────── */
const GercekDate = g.Date;
/** Verilen ana saati kur. Tarih sabittir: anonslar güne göre
    anahtarlanır (`gun|saat|metin`), testin günü de sabit olmalı. */
function saat(h, m, s = 0, gun = '2026-10-09') {
  const [y, a, gg] = gun.split('-').map(Number);
  const t = new GercekDate(y, a - 1, gg, h, m, s);
  g.Date = class { constructor() { return t; } static now() { return t.getTime(); } };
}
const sonMetin = () => (konusulan.length ? konusulan[konusulan.length - 1].text : null);
const metinler = () => konusulan.map(u => u.text);

/* ══════════════════════════════════════════════════════════ */
console.log('\n1 · Ayar anahtarları ve eski kaydın yükseltilmesi');
{
  let PZA = yukle();                       // hiç kayıt yok → varsayılanlar
  esit([PZA.settings.speech, PZA.settings.saatBasi, PZA.settings.yarimSaat,
        PZA.settings.onemliOku],
    [true, true, false, true],
    'varsayılanlar: saat başı açık, yarım saat kapalı, önemli kayıt açık');

  /* KULLANICI BİLDİRİMİ: "saatimiz ayrıca saat başı saati söylemiyor."
     v1.9 ve öncesinde `speech` varsayılanı KAPALIYDI ve kullanıcı o
     ayara hiç dokunmamıştı; yükseltme olmasaydı sessizlik sürerdi. */
  PZA = yukle({ skin: 'halo', theme: 'dark', weather: true });
  esit(PZA.settings.speech, true, 'v1.9 kaydı yükseltildi: saat anonsu AÇILDI');
  esit(PZA.settings.saatBasi, true, 'yükseltmede saat başı açık');
  esit(PZA.settings.skin, 'halo', 'kullanıcının öteki ayarları korundu');
  dogru(/yükseltildi/.test(PZA.logDok()), 'yükseltme günlüğe yazıldı (sessiz sürpriz yok)');

  // Kullanıcı KAPATTIYSA saygı gösterilir — yükseltme onu geri açmaz
  PZA = yukle({ saatBasi: false, speech: false, yarimSaat: false });
  esit([PZA.settings.speech, PZA.settings.saatBasi], [false, false],
    'kullanıcının kendi seçimi (kapalı) korundu');
}

console.log('\n2 · Ayar satırları panele bağlı');
{
  const PZA = yukle({ saatBasi: true, yarimSaat: true, onemliOku: false, speech: true });
  PZA.apply();
  esit([el('opt-speech').checked, el('opt-saatbasi').checked,
        el('opt-yarimsaat').checked, el('opt-onemli').checked],
    [true, true, true, false], 'dört anahtar da kendi kutusuna yansıdı');

  PZA.settings.yarimSaat = false;
  PZA.apply();
  esit(el('opt-yarimsaat').checked, false, 'değişiklik kutuya yansıyor');

  const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'index.html'), 'utf8');
  for (const id of ['opt-speech', 'opt-saatbasi', 'opt-yarimsaat', 'opt-onemli']) {
    dogru(html.includes('id="' + id + '"'), 'index.html satırı var: ' + id);
  }
  const app = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'js', 'app.js'), 'utf8');
  for (const [id, anahtar] of [['opt-saatbasi', 'saatBasi'], ['opt-yarimsaat', 'yarimSaat'],
                               ['opt-onemli', 'onemliOku']]) {
    dogru(new RegExp("'" + id + "':\\s*'" + anahtar + "'").test(app),
      'app.js kutuyu ayara bağlıyor: ' + id + ' → ' + anahtar);
  }
}

console.log('\n3 · Saat başı anonsu — kayarsa da kaçmaz (mandal)');
{
  const PZA = yukle();
  PZA.settings.speech = true;
  PZA.settings.saatBasi = true;
  PZA.settings.yarimSaat = false;
  PZA.notes = {};

  /* ESKİ HATA: şart `saniye === 0` idi. Saat kaydığı (ya da pencere
     gizliyken saat durduğu) için o tek saniye kaçtığında anons
     tamamen kayboluyordu. */
  saat(15, 0, 3);
  PZA.tick();
  esit(sonMetin(), 'saat on beş', 'dakika 00 / saniye 03 → okundu (eski kod kaçırırdı)');

  saat(15, 0, 45);
  PZA.tick();
  esit(konusulan.length, 1, 'aynı saat başı ikinci kez okunmuyor (mandal)');

  saat(15, 1, 0);
  PZA.tick();
  esit(konusulan.length, 1, 'dakika 01 → okuma yok');

  saat(16, 0, 0);
  PZA.tick();
  esit(metinler(), ['saat on beş', 'saat on altı'], 'yeni saat başı → okundu');

  // Yarım saat kapalıyken :30 sessiz
  saat(16, 30, 0);
  PZA.tick();
  esit(konusulan.length, 2, 'yarım saat KAPALI → :30 sessiz');

  // Gece yarısı: 00:00 da bir saat başıdır
  saat(0, 0, 2);
  PZA.tick();
  esit(sonMetin(), 'saat sıfır', 'gece yarısı okunuyor');
}

console.log('\n4 · Yarım saat anonsu — AYRI mandal');
{
  const PZA = yukle();
  PZA.settings.speech = true;
  PZA.settings.saatBasi = true;
  PZA.settings.yarimSaat = true;
  PZA.notes = {};

  saat(15, 0, 1);
  PZA.tick();
  saat(15, 30, 4);
  PZA.tick();
  esit(metinler(), ['saat on beş', 'saat on beş, otuz'],
    'aynı saat içinde hem :00 hem :30 okundu (tek mandal olsaydı :30 düşerdi)');

  saat(15, 30, 40);
  PZA.tick();
  esit(konusulan.length, 2, ':30 ikinci kez okunmuyor (kendi mandalı)');

  saat(16, 30, 0);
  PZA.tick();
  esit(sonMetin(), 'saat on altı, otuz', 'sonraki yarım saat okundu');

  // Ana anahtar kapalıysa ikisi de susar
  PZA.settings.speech = false;
  saat(17, 0, 0);
  PZA.tick();
  saat(17, 30, 0);
  PZA.tick();
  esit(konusulan.length, 3, 'saat anonsu kapalıyken :00 ve :30 sessiz');

  // Sonradan açmak, geçmişi geri getirmez (geçmiş anons birikmez)
  PZA.settings.speech = true;
  saat(18, 0, 0);
  PZA.tick();
  esit(konusulan.length, 4, 'yeniden açılınca yalnız GELECEK saat okunur');
}

console.log('\n5 · Önemli (yıldızlı) kayıt anonsu');
{
  const PZA = yukle();
  PZA.settings.speech = false;          // saat anonsu kapalı
  PZA.settings.onemliOku = true;        // hatırlatma yine isteniyor
  PZA.notes = { '2026-10-09': [
    { t: '15:00', x: 'Japon iş adamlarıyla yemek', star: true },
    { t: '15:10', x: 'Yıldızsız not', star: false }
  ] };

  saat(15, 0, 1);
  PZA.tick();
  esit(metinler(), ['Önemli. Japon iş adamlarıyla yemek'],
    'yıldızlı kaydın saati gelince "Önemli" diye başlayıp metni okuyor');

  saat(15, 3, 20);
  PZA.tick();
  esit(konusulan.length, 1, 'aynı kayıt her saniye tekrarlanmıyor (mandal)');

  saat(15, 10, 30);
  PZA.tick();
  esit(konusulan.length, 1, 'yıldızsız not okunmuyor');

  /* Pencere: pencere gizlenince saat DURUR (`visibilitychange`), yani
     15:00 kaydı ilk tick'te 15:03'te görülebilir. Bu yüzden eşitlik
     değil 5 dakikalık pencere kullanılır. */
  const P2 = yukle();
  P2.settings.speech = false;
  P2.notes = { '2026-10-09': [{ t: '16:00', x: 'Geç kalınan', star: true }] };
  saat(16, 5, 0);
  P2.tick();
  esit(metinler(), ['Önemli. Geç kalınan'], 'pencere içinde (5 dk) yakalanıyor');

  const P3 = yukle();
  P3.settings.speech = false;
  P3.notes = { '2026-10-09': [{ t: '17:00', x: 'Kaçırılan', star: true }] };
  saat(17, 6, 0);
  P3.tick();
  esit(konusulan.length, 0, 'pencere dışı (6 dk) okunmuyor — gün boyu birikmiyor');

  const P4 = yukle();
  P4.settings.speech = false;
  P4.notes = { '2026-10-09': [{ t: '09:00', x: 'Sabahki', star: true }] };
  saat(15, 0, 0);
  P4.tick();
  esit(konusulan.length, 0, 'geçmiş kayıtlar uygulama açılışında sıralanmıyor');

  // Ayrı anahtar: kapatılınca yalnız HATIRLATMA susar, saat anonsu susmaz
  const P5 = yukle();
  P5.settings.speech = true;
  P5.settings.saatBasi = true;
  P5.settings.onemliOku = false;
  P5.notes = { '2026-10-09': [{ t: '15:00', x: 'Kapalıyken', star: true }] };
  saat(15, 0, 0);
  P5.tick();
  esit(metinler(), ['saat on beş'],
    'önemli kayıt anonsu kapalı → yalnız saat okunur, kayıt metni okunmaz');

  // Metin değişirse yeniden okunur (kayıt düzeltilebilir)
  const P6 = yukle();
  P6.settings.speech = false;
  P6.notes = { '2026-10-09': [{ t: '15:00', x: 'İlk hâli', star: true }] };
  saat(15, 1, 0);
  P6.tick();
  P6.notes['2026-10-09'][0].x = 'Düzeltilmiş hâli';
  saat(15, 2, 0);
  P6.tick();
  esit(metinler(), ['Önemli. İlk hâli', 'Önemli. Düzeltilmiş hâli'],
    'metin düzeltilirse yeni hâli okunuyor');
}

console.log('\n6 · Aynı saniyeye düşen iki anons TEK cümle olur');
{
  /* `PZA.say`, konuşmadan önce `cancel()` çağırır. Saat başı ile
     "Önemli" kaydı ayrı iki çağrı olsaydı ikincisi birincisini keserdi
     (17:30 hem yarım saat hem önemli kayıt olabilir). */
  const PZA = yukle();
  PZA.settings.speech = true;
  PZA.settings.saatBasi = true;
  PZA.settings.yarimSaat = true;
  PZA.notes = { '2026-10-09': [{ t: '15:30', x: 'Toplantı', star: true }] };

  saat(15, 30, 2);
  PZA.tick();
  esit(konusulan.length, 1, 'tek konuşma üretildi (kesişme yok)');
  esit(sonMetin(), 'saat on beş, otuz. Önemli. Toplantı',
    'saat cümlesi ile "Önemli" kaydı TEK cümlede');
  esit(sonMetin().indexOf('Önemli'), 'saat on beş, otuz. '.length,
    '"Önemli" kaydın hemen başında');
}

console.log('\n7 · Gün değişimi');
{
  const PZA = yukle();
  PZA.settings.speech = false;
  PZA.notes = {
    '2026-10-09': [{ t: '15:00', x: 'Dünkü kayıt', star: true }],
    '2026-10-10': [{ t: '15:00', x: 'Bugünkü kayıt', star: true }]
  };

  saat(15, 0, 1, '2026-10-09');
  PZA.tick();
  esit(metinler(), ['Önemli. Dünkü kayıt'], 'ilk gün okundu');

  saat(15, 0, 1, '2026-10-10');
  PZA.tick();
  esit(metinler(), ['Önemli. Dünkü kayıt', 'Önemli. Bugünkü kayıt'],
    'yeni günün kaydı okundu (dünkü tekrar edilmedi)');

  saat(15, 1, 1, '2026-10-10');
  PZA.tick();
  esit(konusulan.length, 2, 'bugünkü kayıt da bir kez okunuyor');
}

g.Date = GercekDate;

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
