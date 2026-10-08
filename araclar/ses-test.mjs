/* ses-test.mjs — sesli okuma, okuyucu sesi seçimi ve Türkçe sayı→kelime
   Palet Zaman Asistanı · GPL-3.0

   speech.js sahte bir speechSynthesis ve sahte bir DOM üzerinde
   çalıştırılır; hem üretilen utterance'lar hem çizilen seçim listesi
   denetlenir.

   Bu dosya gerçek hatalardan doğdu:
     • Türkçe ses yoksa uygulama sessiz kalıyordu — artık eldeki seslere düşer
     • TEK Türkçe ses varken "Ece / Emre" adlı iki uydurma okuyucu aynı
       sesi veriyordu; perde farkı (1.40 ↔ 0.60) kullanıcıyı ikna etmedi.
       Kullanıcının son sözü: "ece ve emre ilavesi gereksiz olmuş ...
       windowstan yapılacaksa 2 ismi de kaldır ayar sayfasına yönlendir,
       not olarak bayan sesi buradan ayarlanır gibi ibare koy."
       Uydurma adlar kaldırıldı: liste artık sistemde KURULU seslerden
       gelir; ses kurulu değilse kullanıcı yönlendirilir.

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
const dogru = (c, m) => c ? ok(m) : bad_(m);

/* ── Sahte ortam ─────────────────────────────────────── */
let konusulan = [];
class SahteUtterance {
  constructor(metin) { this.text = metin; this.pitch = 1; this.rate = 1; this.voice = null; }
}

function mkEl(id) {
  const cls = new Set();
  return {
    id, textContent: '', innerHTML: '', hidden: false, disabled: false, value: '',
    dataset: {}, style: {},
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }
    },
    setAttribute() {}, getAttribute() { return null; }
  };
}
let els = new Map();
const el = id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
const store = new Map();

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
  addEventListener() {}
};
g.SpeechSynthesisUtterance = SahteUtterance;

function seslerKur(liste) {
  g.speechSynthesis = {
    getVoices: () => liste,
    speak: u => konusulan.push(u),
    cancel() {}, resume() {},
    onvoiceschanged: null
  };
}
const V = (name, lang) => ({ name, lang });
const TOLGA = V('Microsoft Tolga - Turkish (Turkey)', 'tr-TR');
const FILIZ = V('Microsoft Filiz - Turkish (Turkey)', 'tr-TR');

function yukle() {
  delete g.PZA;
  konusulan = [];
  els = new Map();
  store.clear();
  new Function(src('settings.js') + '\n' + src('speech.js'))();
  return g.PZA;
}

console.log('\n1 · İki Türkçe ses: Filiz (kadın) + Tolga (erkek)');
seslerKur([TOLGA, FILIZ]);
let PZA = yukle();
esit(PZA.sesListesi.length, 2, 'liste iki ses');
esit(PZA.trSesSayisi, 2, 'Türkçe ses sayısı');
esit(PZA.tekSes, false, 'seçenek var → tek ses DEĞİL');
esit(PZA.voiceHint(), null, 'yeterli ses varken uyarı yok');
// Otomatik seçim kadın sesini önce arar (kullanıcı isteği)
esit(PZA.otomatikSesSec().name, FILIZ.name, 'otomatik seçim: kadın ses (Filiz)');
esit(PZA.settings.voiceName, FILIZ.name, 'otomatik seçim KALICI yazıldı');
esit(JSON.parse(store.get('pza.settings.v1')).voiceName, FILIZ.name, 'depoya da yazıldı');

PZA.say(15, 0);
esit(konusulan[0].text, 'saat on beş', 'metin');
esit(konusulan[0].voice?.name, FILIZ.name, 'seçili ses kullanıldı');
esit([konusulan[0].pitch, konusulan[0].rate], [1.0, 0.95], 'perde nötr, tempo hafif yavaş');

PZA.otomatikSesSec();
PZA.renderVoiceUi();
const secenekler = el('voice-select').innerHTML;
dogru(secenekler.includes(FILIZ.name), 'liste Filiz\'i gösteriyor');
dogru(secenekler.includes('(kadın)'), 'liste cinsiyet etiketi taşıyor');
dogru(!el('voice-select').disabled, 'seçim kutusu etkin');
esit(el('voice-name').textContent, FILIZ.name, 'etiket seçili sesin adı');
esit(el('voice-hint').hidden, true, 'uyarı gizli');

console.log('\n2 · Tek Türkçe ses — kullanıcının bildirdiği asıl durum');
seslerKur([TOLGA]);
PZA = yukle();
esit(PZA.sesListesi.length, 1, 'tek ses listelendi');
esit(PZA.tekSes, true, 'tek ses işaretlendi');
esit(PZA.trSesSayisi, 1, 'Türkçe ses sayısı 1');
esit(PZA.otomatikSesSec().name, TOLGA.name, 'otomatik seçim eldeki tek ses');

const ipucu = PZA.voiceHint();
dogru(typeof ipucu === 'string' && ipucu.length > 0, 'uyarı metni var');
dogru(ipucu.includes('tek Türkçe ses'), 'uyarı tek sesi bildiriyor');
dogru(ipucu.includes(TOLGA.name), 'uyarı hangi sesin kurulu olduğunu yazıyor');
dogru(ipucu.includes('Bayan sesi buradan ayarlanır'), 'uyarı "bayan sesi buradan ayarlanır" diyor');
dogru(ipucu.includes('Konuşma'), 'uyarı Windows yolunu tarif ediyor');
dogru(ipucu.includes(PZA.SES_URI), 'uyarı kopyalanabilir URI\'yi veriyor');
dogru(ipucu.includes('data-kopya'), 'kopyalama düğmesi üretildi');

// ASIL DÜZELTME: uydurma okuyucu adları tamamen gitti
dogru(PZA.OKUYUCU === undefined, 'Ece/Emre adları (PZA.OKUYUCU) kaldırıldı');
dogru(PZA.ayar === undefined, 'perde ile ayrıştırma (PZA.ayar) kaldırıldı');
dogru(PZA.voices === undefined, 'female/male ikilisi kaldırıldı');
dogru(!ipucu.includes('Ece') && !ipucu.includes('Emre'), 'uyarıda uydurma ad geçmiyor');
/* Adlar artık YALNIZCA "kaldırıldı" diye anlatan yorumlarda geçebilir;
   kodda geçmemeli. Bu yüzden yorumlar ayıklanarak aranır. */
const yorumsuz = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '');
dogru(!/['"]Ece['"]|['"]Emre['"]/.test(yorumsuz(src('speech.js'))),
  'speech.js KODUNDA Ece/Emre adı kalmadı');
const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'index.html'), 'utf8');
dogru(!/data-voice|voice-seg/.test(html), 'index.html\'de Ece/Emre düğmeleri kaldırıldı');
dogru(/id="voice-select"/.test(html), 'index.html\'de ses seçim kutusu var');
for (const f of ['app.js', 'settings.js', 'speech.js']) {
  dogru(!/data-voice|voice-seg|PZA\.OKUYUCU|PZA\.ayar\b/.test(yorumsuz(src(f))),
    f + ' içinde eski okuyucu koduna referans kalmadı');
}

PZA.renderVoiceUi();
dogru(el('voice-select').innerHTML.includes(TOLGA.name), 'liste tek sesi gösteriyor');
dogru(el('voice-select').innerHTML.includes('(erkek)'), 'Tolga erkek olarak etiketlendi');
esit(el('voice-hint').hidden, false, 'uyarı görünür');
dogru(el('voice-hint').innerHTML.includes('Bayan sesi buradan ayarlanır'), 'uyarı panele yazıldı');

PZA.say(9, 30);
esit(konusulan[0].voice?.name, TOLGA.name, 'tek sesle de konuşuyor (sessiz kalmıyor)');
esit(konusulan[0].text, 'saat dokuz, otuz', 'metin');

console.log('\n3 · Türkçe ses yok → eldeki seslere düşer');
seslerKur([V('Microsoft David - English (US)', 'en-US'), V('Microsoft Zira - English (US)', 'en-US')]);
PZA = yukle();
esit(PZA.sesListesi.length, 2, 'yedek sesler listelendi');
esit(PZA.trSesSayisi, 0, 'Türkçe ses sayısı 0');
esit(PZA.tekSes, true, 'Türkçe yokken uyarı açık');
esit(PZA.sesListesi[1].kadin, true, 'Zira kadın olarak tanındı');
dogru(PZA.voiceHint().includes('Türkçe konuşma sesi yok'), 'uyarı Türkçe ses yokluğunu yazıyor');
dogru(PZA.voiceHint().includes('Bayan sesi buradan ayarlanır'), 'yönlendirme yine var');
esit(PZA.otomatikSesSec().name, 'Microsoft Zira - English (US)', 'yedekte kadın ses seçildi');

console.log('\n4 · Hiç ses yok — çökmemeli');
seslerKur([]);
PZA = yukle();
esit(PZA.sesListesi.length, 0, 'liste boş');
esit(PZA.seciliSes(), null, 'seçili ses yok');
esit(PZA.voiceLabel(), 'Sistemde konuşma sesi bulunamadı', 'etiket durumu söylüyor');
dogru(PZA.say(12, 0) === true, 'konuşma yine de denenir (çökme yok)');
esit(konusulan.at(-1).text, 'saat on iki', 'metin doğru üretildi');
esit(konusulan.at(-1).voice, null, 'ses atanmadı, motor kendi seçer');
PZA.renderVoiceUi();
esit(el('voice-select').disabled, true, 'seçim kutusu devre dışı');
dogru(el('voice-select').innerHTML.includes('Ses bulunamadı'), 'liste boşluğu yazıyla bildiriyor');
dogru(el('voice-hint').innerHTML.includes('Bayan sesi buradan ayarlanır'), 'uyarı boş listede de çıkıyor');

console.log('\n5 · Seçim sesin ADIYLA saklanır');
seslerKur([TOLGA, FILIZ]);
PZA = yukle();
PZA.settings.voiceName = TOLGA.name;      // kullanıcı listeden erkeği seçti
PZA.save();
esit(PZA.seciliSes().name, TOLGA.name, 'kayıtlı ad kullanıldı');
PZA.say(8, 0);
esit(konusulan[0].voice?.name, TOLGA.name, 'seçim konuşmaya yansıdı');
// Seçili ses sistemden kaldırılırsa otomatiğe düşmeli, sessiz kalmamalı
PZA.settings.voiceName = 'Silinmiş Ses - Turkish';
esit(PZA.seciliSes().name, FILIZ.name, 'bilinmeyen ad → otomatik seçime düşer');

console.log('\n6 · Türkçe sayı → kelime (regresyon)');
seslerKur([TOLGA, FILIZ]); PZA = yukle();
esit(PZA.trClock(0, 0), 'saat sıfır', '00:00');
esit(PZA.trClock(17, 30), 'saat on yedi, otuz', '17:30');
esit(PZA.trClock(9, 5), 'saat dokuz, beş', '09:05');
esit(PZA.trClock(1, 45), 'saat bir, kırk beş', '01:45');
esit(PZA.trNumber(0), 'sıfır', 'trNumber(0)');
esit(PZA.trNumber(99), 'doksan dokuz', 'trNumber(99)');
esit(PZA.trNumber(100), 'yüz', 'trNumber(100)');
esit(PZA.trNumber(250), 'iki yüz elli', 'trNumber(250)');
esit(PZA.trClock(23, 59), 'saat yirmi üç, elli dokuz', '23:59');

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
