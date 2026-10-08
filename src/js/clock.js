/* clock.js — flip saat + Türkçe tarih satırı
   Palet Zaman Asistanı · GPL-3.0
   Optimizasyon: setInterval(1000); animasyon YALNIZ rakam değişiminde. */
window.PZA = window.PZA || {};

PZA.AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
             'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
PZA.GUNLER = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

let timer = null;
const last = { h: null, m: null, s: null };

/** Flip kartındaki rakamı değiştir; değiştiyse animasyonu tetikle */
function setDigit(unit, value) {
  if (last[unit] === value) return;          // değişmedi → DOM'a dokunma
  const card = document.querySelector(`.flip[data-unit="${unit}"]`);
  if (!card) return;
  card.querySelector('.flip-num').textContent = value;

  card.classList.remove('tick');
  void card.offsetWidth;                     // reflow → animasyonu yeniden başlat
  if (last[unit] !== null) card.classList.add('tick');

  last[unit] = value;
}

const p2 = n => String(n).padStart(2, '0');

/* ── Saat başı okuma ─────────────────────────────────────
   Eskiden şart `seconds === 0` idi. setInterval(1000) kayar ve
   pencere gizlenince saat durur; o TEK saniye kaçınca okuma
   tamamen kayboluyordu. Artık "bu saatin anonsu yapıldı mı"
   damgası tutulur → dakika 00 boyunca ilk tick yakalar. */
let anonsSaat = null;

function saatAnonsu(d) {
  if (!PZA.settings || !PZA.settings.speech) return;
  if (d.getMinutes() !== 0) return;
  const damga = `${PZA.todayKey()} ${d.getHours()}`;
  if (anonsSaat === damga) return;
  anonsSaat = damga;
  PZA.say?.(d.getHours(), 0);
}

PZA.tick = function () {
  const d = new Date();

  setDigit('h', p2(d.getHours()));
  setDigit('m', p2(d.getMinutes()));
  setDigit('s', p2(d.getSeconds()));

  const main = `${d.getDate()} ${PZA.AYLAR[d.getMonth()]} ${d.getFullYear()}`;
  const el = document.getElementById('date-main');
  if (el && el.textContent !== main) el.textContent = main;

  const dy = document.getElementById('date-day');
  if (dy && dy.textContent !== '• ' + PZA.GUNLER[d.getDay()])
    dy.textContent = '• ' + PZA.GUNLER[d.getDay()];

  // Notlar paneli: takvimden başka bir gün seçilmiş olabilir.
  // Her saniye yazmak seçimi ezerdi; yalnızca gün dönüşünde tazelenir.
  PZA.checkRollover?.();

  // Saat başı → sesli okuma
  saatAnonsu(d);
};

PZA.startClock = function () {
  if (timer) return;
  PZA.tick();
  timer = setInterval(PZA.tick, 1000);
  PZA.emit('clock:started');
};

PZA.stopClock = function () {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  PZA.emit('clock:stopped');
};

PZA.clockRunning = () => timer !== null;

/** Bugünün ISO anahtarı — not deposu için */
PZA.todayKey = function () {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

/* Pencere gizlenince durdur, geri gelince devam et (kaynak kuralı) */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) PZA.stopClock();
  else PZA.startClock();
});
