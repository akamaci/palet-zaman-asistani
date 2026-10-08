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

/* ── Sesli okuma ─────────────────────────────────────── */
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices();
  // Önce Türkçe, yoksa ilk kullanılabilir ses
  voice = vs.find(v => v.lang && v.lang.toLowerCase().startsWith('tr'))
       || vs.find(v => v.lang && v.lang.toLowerCase().startsWith('tr-TR'))
       || null;
  return voice;
}

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
  const metin = PZA.trClock(h, m);
  const u = new SpeechSynthesisUtterance(metin);
  u.lang = 'tr-TR';
  u.rate = 0.95;
  u.pitch = 1;
  if (!voice) pickVoice();
  if (voice) u.voice = voice;

  speechSynthesis.cancel();     // üst üste binmesin
  speechSynthesis.speak(u);
  PZA.emit('speech:said', { metin, h, m });
  return true;
};

/** Şu anki saati oku (ayarlar önizlemesi için) */
PZA.sayNow = function () {
  const d = new Date();
  return PZA.say(d.getHours(), d.getMinutes());
};
