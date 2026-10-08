/* speech.js — Türkçe sayı → kelime + sesli okuma
   Palet Zaman Asistanı · GPL-3.0
   TTS ham "15:00"ı yanlış okur; bu yüzden metni biz kurarız. */
window.PZA = window.PZA || {};

const BIRLER = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const ONLAR  = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

/** 0-99 arası sayıyı Türkçe kelimeye çevirir. 15 → "on beş" */
PZA.trNumber = function (n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'sıfır';
  if (n < 10) return BIRLER[n];
  if (n < 100) {
    const o = ONLAR[Math.floor(n / 10)];
    const b = BIRLER[n % 10];
    return b ? `${o} ${b}` : o;
  }
  if (n < 1000) {
    const y = Math.floor(n / 100);
    const kalan = n % 100;
    const yStr = (y === 1 ? 'yüz' : `${BIRLER[y]} yüz`);
    return kalan ? `${yStr} ${PZA.trNumber(kalan)}` : yStr;
  }
  return String(n);
};

/** Saat cümlesi: 15:00 → "saat on beş" · 17:30 → "saat on yedi, otuz" */
PZA.trClock = function (h, m) {
  let s = 'saat ' + PZA.trNumber(h);
  if (m > 0) s += ', ' + PZA.trNumber(m);
  return s;
};

/* ── Sesli okuma ─────────────────────────────────────────
   İki okuyucu: kadın / erkek. Windows'ta hazır gelen Türkçe
   sesler Microsoft Filiz (kadın) ve Microsoft Tolga (erkek);
   Edge'in doğal sesleri de (Emel / Ahmet) aynı desene uyar.
   Sistemde tek Türkçe ses varsa ikisi de aynı sesi kullanır —
   bu yüzden perde (pitch) farkı ZORUNLU: yoksa "Emre" seçimi
   hiçbir şey değiştirmez ve kullanıcı bozuk sanır. */
/* Türkçe sesler önce; İngilizce adlar YEDEK içindir (Türkçe ses
   kurulu değilse oraya düşülür — orada da cinsiyet ters atanmasın).
   `\b` sınırı şart: "Tom" gibi kısa adlar "Tomas"ın içinde de geçer. */
const SES_DISI  = /(emel|filiz|dilara|yelda|seda|aylin|female|kad[ıi]n|woman|\bzira\b|\bhazel\b|\bsusan\b|\bsamantha\b|\bvictoria\b|\bkaren\b|\bmoira\b|\btessa\b|\bfiona\b|\bserena\b|\ballison\b|\bava\b|\bjoanna\b|\bsalli\b|\bamy\b|\bemma\b|\baria\b|\bjenny\b|\bmichelle\b|\bclara\b|\bnatasha\b)/i;
const SES_ERKEK = /(tolga|ahmet|burak|male|erkek|\bdavid\b|\bmark\b|\bgeorge\b|\bdaniel\b|\balex\b|\bfred\b|\bjames\b|\bguy\b|\bryan\b|\bwilliam\b|\boliver\b|\bthomas\b|\beric\b|\bchristopher\b|\bsteffan\b|\bjorge\b)/i;

/* İki ayrı Türkçe ses (Filiz + Tolga) kuruluyken perde farkı ÖLÇÜLÜ
   kalır: sesler zaten ayrı kişiler, perdeyi abartmak yapaylaştırır. */
const SES_AYAR = {
  female: { pitch: 1.06, rate: 0.95 },
  male:   { pitch: 0.78, rate: 0.92 }
};

/* Tek Türkçe ses kuruluyken iki okuyucu AYNI sesi paylaşır ve ayrım
   yalnız perdede kalır. Kullanıcı bu durumda "her ikisi de erkek"
   bildirdi: 1.06 ↔ 0.78 aralığı kulakla iki ayrı kişi gibi
   duyulmuyor. Aynı-ses hâlinde aralık bilinçli olarak geniş tutulur. */
const SES_AYAR_TEK = {
  female: { pitch: 1.40, rate: 0.98 },
  male:   { pitch: 0.60, rate: 0.88 }
};

let voice = null;                 // geriye dönük: seçili ses
PZA.voices = { female: null, male: null };
/* Tek ses kurulu mu? true ise etiketler bunu söyler ve perde
   geniş aralığa geçer (bkz. PZA.ayar). */
PZA.tekSes = false;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const hepsi = speechSynthesis.getVoices() || [];
  const tr = hepsi.filter(v => (v.lang || '').toLowerCase().startsWith('tr'));
  const havuz = tr.length ? tr : hepsi;     // Türkçe yoksa eldekini kullan

  // Önce adından tanınanlar
  const kadin = havuz.filter(v => SES_DISI.test(v.name || ''));
  const erkek = havuz.filter(v => SES_ERKEK.test(v.name || ''));

  let f = kadin[0] || null;
  let m = erkek[0] || null;

  /* Ada göre ayrıştırılamayan sesler: kadın için elde kalan ilk ses,
     erkek için kadına düşmeyen başka bir ses. Sıra ÖNEMLİ — önce
     kadın seçilir ki `m` ona eşit olmayanı bulabilsin. */
  if (!f) f = havuz.find(v => v !== m) || havuz[0] || null;
  if (!m) m = havuz.find(v => v !== f) || f;

  PZA.voices = { female: f, male: m };
  /* İki okuyucu aynı sese düştüyse tek ses kurulu demektir.
     Kullanıcı sistemine ikinci bir Türkçe ses (kadın) kurabilir;
     etiket ve ayar bunu açıkça söyler. */
  PZA.tekSes = !!(f && m && f === m);

  voice = PZA.voices.female;
  PZA.emit('speech:voices', PZA.voices);
  return voice;
}

/** Okuyucunun perde/hız ayarı — tek ses kuruluysa geniş aralık. */
PZA.ayar = function (secim) {
  const anahtar = (secim === 'male') ? 'male' : 'female';
  return (PZA.tekSes ? SES_AYAR_TEK : SES_AYAR)[anahtar];
};

/* Okuyucu adları. "Kadın / Erkek" bir ayar etiketi; "Ece / Emre" iki ayrı
   okuyucu. Kullanıcı seçimi isimle hatırlıyor, cinsiyetle değil. Hangi
   sistem sesine denk geldiği etikette yanında kalır — teknik ayrıntı
   kaybolmasın, sesi değiştiren kullanıcı ne olduğunu görsün. */
PZA.OKUYUCU = { female: 'Ece', male: 'Emre' };

/** Seçili okuyucunun etiketi — "Ece — Microsoft Filiz" gibi.
    Tek ses kuruluysa perdeyle ayrıştırıldığı AÇIKÇA yazılır: aksi
    hâlde kullanıcı iki okuyucunun aynı sesi paylaştığını görmez ve
    "ses değişmiyor" diye hata bildirir. */
PZA.voiceLabel = function (g) {
  const anahtar = (g === 'male') ? 'male' : 'female';
  const ad = PZA.OKUYUCU[anahtar];
  const v = PZA.voices[anahtar];
  if (!v) return ad + ' — sistem sesi bulunamadı';
  const ses = v.name || v.lang || 'sistem sesi';
  return PZA.tekSes ? ad + ' — ' + ses + ' · perde ile ayrıştırıldı' : ad + ' — ' + ses;
};

/** Tek ses uyarısı — arayüz bunu gösterir; normal durumda null. */
PZA.voiceHint = function () {
  if (!PZA.tekSes) return null;
  return 'Sistemde tek Türkçe ses var (' + ((PZA.voices.female || {}).name || 'bilinmiyor')
    + '). Ece ve Emre bu sesi perdeyle ayrıştırır. Ayrı bir kadın sesi için: '
    + 'Ayarlar → Saat ve Dil → Konuşma → Ses ekle → Türkçe (Filiz).';
};

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;   // sesler gecikmeli yüklenebilir
}

/** Verilen saat için konuş */
PZA.say = function (h, m) {
  if (!('speechSynthesis' in window)) {
    console.warn('Bu ortamda speechSynthesis yok.');
    return false;
  }
  const secim = (PZA.settings && PZA.settings.voice === 'male') ? 'male' : 'female';
  const ayar = PZA.ayar(secim);   // tek ses kuruluysa geniş perde aralığı

  if (!PZA.voices.female && !PZA.voices.male) pickVoice();
  const v = PZA.voices[secim] || PZA.voices.female || null;

  const metin = PZA.trClock(h, m);
  const u = new SpeechSynthesisUtterance(metin);
  u.lang = 'tr-TR';
  u.rate = ayar.rate;
  u.pitch = ayar.pitch;
  if (v) u.voice = v;

  speechSynthesis.cancel();     // üst üste binmesin
  speechSynthesis.resume();     // kimi motorlarda cancel sonrası takılı kalır
  speechSynthesis.speak(u);
  PZA.emit('speech:said', { metin, h, m, reader: secim, voice: v ? v.name : null });
  return true;
};

/** Şu anki saati oku (ayarlar önizlemesi için) */
PZA.sayNow = function () {
  const d = new Date();
  return PZA.say(d.getHours(), d.getMinutes());
};
