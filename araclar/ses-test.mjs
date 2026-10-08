/* ses-test.mjs — sesli okuma, okuyucu seçimi ve Türkçe sayı→kelime
   Palet Zaman Asistanı · GPL-3.0

   speech.js sahte bir speechSynthesis üzerinde çalıştırılır; üretilen
   utterance'lar yakalanıp metni, sesi, perdesi ve hızı denetlenir.

   Bu dosya gerçek hatalardan doğdu:
     • Türkçe ses yoksa uygulama sessiz kalıyordu — artık eldeki seslere düşer
     • Tek Türkçe ses varsa Ece ve Emre aynı sesi alır; seçim ancak perde/hız
       farkıyla duyulur, yoksa iki okuyucu birbirinin kopyası olurdu
     • Okuyucular "kadın/erkek" diye değil **Ece/Emre** diye anılır; etiket
       her durumda adla başlar, teknik ses adı yanında kalır

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

/* Konuşulanları yakala */
let konusulan = [];
class SahteUtterance {
  constructor(metin) { this.text = metin; this.pitch = 1; this.rate = 1; this.voice = null; }
}
const g = globalThis;
g.window = g;
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
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

const TR_BOTH = [V('Microsoft Tolga - Turkish (Turkey)', 'tr-TR'), V('Microsoft Filiz - Turkish (Turkey)', 'tr-TR')];

function yukle() {
  delete g.PZA;
  konusulan = [];
  new Function(src('settings.js') + '\n' + src('speech.js'))();
  return g.PZA;
}

console.log('\n1 · İki Türkçe ses: Filiz (kadın) + Tolga (erkek)');
seslerKur(TR_BOTH);
let PZA = yukle();
esit(PZA.voices.female?.name, 'Microsoft Filiz - Turkish (Turkey)', 'kadın sesi eşleşti');
esit(PZA.voices.male?.name, 'Microsoft Tolga - Turkish (Turkey)', 'erkek sesi eşleşti');
dogru(PZA.voices.female !== PZA.voices.male, 'iki okuyucu FARKLI ses');
esit(PZA.tekSes, false, 'tek ses DEĞİL → ölçülü perde');
esit(PZA.voiceHint(), null, 'uyarı yok');

PZA.settings.voice = 'female';
PZA.say(15, 0);
esit(konusulan[0].text, 'saat on beş', 'kadın: metin');
esit(konusulan[0].voice?.name, 'Microsoft Filiz - Turkish (Turkey)', 'kadın: ses');
esit([konusulan[0].pitch, konusulan[0].rate], [1.06, 0.95], 'kadın: perde/hız');

PZA.settings.voice = 'male';
PZA.say(15, 0);
esit(konusulan[1].voice?.name, 'Microsoft Tolga - Turkish (Turkey)', 'erkek: ses');
esit([konusulan[1].pitch, konusulan[1].rate], [0.78, 0.92], 'erkek: perde/hız');
dogru(konusulan[0].pitch !== konusulan[1].pitch, 'iki okuyucu farklı perdede');

console.log('\n2 · Tek Türkçe ses — kullanıcının bildirdiği asıl durum');
// Kullanıcının sisteminde yalnız Microsoft Tolga (erkek) kuruluydu.
// Eski kod kadını da Tolga\'ya düşürüyor, perde farkı 1.06 ↔ 0.78 ise
// duyulmuyordu: "Ece ve Emre ikisi de erkek" hatası tam buydu.
seslerKur([V('Microsoft Tolga - Turkish (Turkey)', 'tr-TR')]);
PZA = yukle();
esit(PZA.voices.female?.name, 'Microsoft Tolga - Turkish (Turkey)', 'kadın: elde kalan sesi aldı');
esit(PZA.voices.male?.name, 'Microsoft Tolga - Turkish (Turkey)', 'erkek: aynı ses');
esit(PZA.tekSes, true, 'tek ses kurulu olarak işaretlendi');

PZA.settings.voice = 'female'; PZA.say(9, 30);
PZA.settings.voice = 'male';   PZA.say(9, 30);
esit([konusulan[0].pitch, konusulan[0].rate], [1.40, 0.98], 'kadın: GENİŞ perde');
esit([konusulan[1].pitch, konusulan[1].rate], [0.60, 0.88], 'erkek: GENİŞ perde');
dogru(konusulan[0].pitch / konusulan[1].pitch >= 2,
  'perde oranı ≥ 2 (duyulur ayrım), oran = ' + (konusulan[0].pitch / konusulan[1].pitch).toFixed(2));
dogru(konusulan[0].pitch !== konusulan[1].pitch, 'iki okuyucu farklı perdede');

// Etiket ve uyarı bu durumu SAKLANMADAN söyler
dogru(PZA.voiceLabel('female').includes('perde ile ayrıştırıldı'),
  'Ece etiketi perde ayrımını bildiriyor → ' + PZA.voiceLabel('female'));
dogru(PZA.voiceLabel('male').startsWith('Emre'), 'Emre etiketi adla başlıyor');
dogru(typeof PZA.voiceHint() === 'string' && PZA.voiceHint().length > 0, 'uyarı metni var');
dogru(PZA.voiceHint().includes('Microsoft Tolga'), 'uyarı hangi sesin paylaşıldığını yazıyor');
dogru(PZA.voiceHint().includes('Filiz'), 'uyarı kadın sesi kurulumunu tarif ediyor');

console.log('\n3 · Türkçe ses yok → eldeki seslere düşer');
seslerKur([V('Microsoft David - English (US)', 'en-US'), V('Microsoft Zira - English (US)', 'en-US')]);
PZA = yukle();
dogru(!!PZA.voices.female, 'kadın: yedek atandı → ' + PZA.voices.female?.name);
dogru(!!PZA.voices.male, 'erkek: yedek atandı → ' + PZA.voices.male?.name);
dogru(PZA.voices.female !== PZA.voices.male, 'yedekler farklı sesler');
esit(PZA.voices.male?.name, 'Microsoft David - English (US)', 'erkek: David (erkek adı) seçildi');
esit(PZA.tekSes, false, 'iki farklı yedek → tek ses değil');

console.log('\n4 · Hiç ses yok — çökmemeli');
seslerKur([]);
PZA = yukle();
esit([PZA.voices.female, PZA.voices.male], [null, null], 'boş liste → null');
esit(PZA.tekSes, false, 'ses yokken tek-ses bayrağı kapalı');
esit(PZA.voiceLabel('female'), 'Ece — sistem sesi bulunamadı', 'etiket: ses yok, ad yine görünür');
dogru(PZA.say(12, 0) === true, 'konuşma yine de denenir (çökme yok)');
esit(konusulan.at(-1).text, 'saat on iki', 'metin doğru üretildi');

console.log('\n5 · Türkçe sayı → kelime (regresyon)');
seslerKur(TR_BOTH); PZA = yukle();
esit(PZA.trClock(0, 0), 'saat sıfır', '00:00');
esit(PZA.trClock(17, 30), 'saat on yedi, otuz', '17:30');
esit(PZA.trClock(9, 5), 'saat dokuz, beş', '09:05');
esit(PZA.trClock(1, 45), 'saat bir, kırk beş', '01:45');
esit(PZA.voiceLabel('male'), 'Emre — Microsoft Tolga - Turkish (Turkey)', 'etiket: erkek okuyucu adı + sesi');

console.log('\n6 · Okuyucu adları (Ece / Emre)');
esit(PZA.OKUYUCU, { female: 'Ece', male: 'Emre' }, 'adlar tanımlı');
esit(PZA.voiceLabel('female'), 'Ece — Microsoft Filiz - Turkish (Turkey)', 'Ece etiketi');
dogru(PZA.voiceLabel('female').startsWith('Ece'), 'etiket Ece ile başlıyor');
dogru(PZA.voiceLabel('male').startsWith('Emre'), 'etiket Emre ile başlıyor');
// Bilinmeyen/bozuk bir değer geldiğinde de bir okuyucuya düşmeli
esit(PZA.voiceLabel('bilinmeyen'), PZA.voiceLabel('female'), 'geçersiz değer → Ece');

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
