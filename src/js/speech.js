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
   bu yüzden perde (pitch) farkı ZORUNLU: yoksa "Erkek" seçimi
   hiçbir şey değiştirmez ve kullanıcı bozuk sanır. */
/* Türkçe sesler önce; İngilizce adlar YEDEK içindir (Türkçe ses
   kurulu değilse oraya düşülür — orada da cinsiyet ters atanmasın).
   `\b` sınırı şart: "Tom" gibi kısa adlar "Tomas"ın içinde de geçer. */
const SES_DISI  = /(emel|filiz|dilara|yelda|seda|aylin|female|kad[ıi]n|woman|\bzira\b|\bhazel\b|\bsusan\b|\bsamantha\b|\bvictoria\b|\bkaren\b|\bmoira\b|\btessa\b|\bfiona\b|\bserena\b|\ballison\b|\bava\b|\bjoanna\b|\bsalli\b|\bamy\b|\bemma\b|\baria\b|\bjenny\b|\bmichelle\b|\bclara\b|\bnatasha\b)/i;
const SES_ERKEK = /(tolga|ahmet|burak|male|erkek|\bdavid\b|\bmark\b|\bgeorge\b|\bdaniel\b|\balex\b|\bfred\b|\bjames\b|\bguy\b|\bryan\b|\bwilliam\b|\boliver\b|\bthomas\b|\beric\b|\bchristopher\b|\bsteffan\b|\bjorge\b)/i;

const SES_AYAR = {
  female: { pitch: 1.06, rate: 0.95 },
  male:   { pitch: 0.78, rate: 0.92 }
};

let voice = null;                 // geriye dönük: seçili ses
PZA.voices = { female: null, male: null };

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const hepsi = speechSynthesis.getVoices() || [];
  const tr = hepsi.filter(v => (v.lang || '').toLowerCase().startsWith('tr'));
  const havuz = tr.length ? tr : hepsi;     // Türkçe yoksa eldekini kullan

  PZA.voices = { female: null, male: null };
  for (const v of havuz) {
    const ad = v.name || '';
    if (!PZA.voices.female && SES_DISI.test(ad))  PZA.voices.female = v;
    if (!PZA.voices.male   && SES_ERKEK.test(ad)) PZA.voices.male = v;
  }
  // Ada göre ayrıştırılamadıysa: ilk ses kadın, farklı bir ses erkek
  if (!PZA.voices.female) PZA.voices.female = havuz[0] || null;
  if (!PZA.voices.male)   PZA.voices.male = havuz.find(v => v !== PZA.voices.female) || PZA.voices.female;

  voice = PZA.voices.female;
  PZA.emit('speech:voices', PZA.voices);
  return voice;
}

/** Seçili okuyucunun ses adı — ayarlar panelinde gösterilir */
PZA.voiceLabel = function (g) {
  const v = PZA.voices[(g === 'male') ? 'male' : 'female'];
  if (!v) return 'Sistem sesi bulunamadı';
  return v.name || v.lang || 'Sistem sesi';
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
  const ayar = SES_AYAR[secim];

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
