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

/* ── Saat başı / yarım saat okuma ────────────────────────
   Eskiden şart `seconds === 0` idi. setInterval(1000) kayar ve
   pencere gizlenince saat durur; o TEK saniye kaçınca okuma
   tamamen kayboluyordu. Artık "bu saatin anonsu yapıldı mı"
   damgası tutulur → dakika 00 boyunca ilk tick yakalar.

   TUR 12: anons artık iki anahtara bağlı (kullanıcı isteği) —
   `saatBasi` (:00) ve `yarimSaat` (:30). Mandal ikisi için AYRI
   tutulur; tek mandal olsaydı bir saat diliminde yalnız ilk anons
   yapılır, öteki sessizce düşerdi. */
let anonsSaat = null;      // "YYYY-MM-DD HH" — saat başı okundu
let anonsYarim = null;     // "YYYY-MM-DD HH:30" — yarım saat okundu

/* ── Önemli kayıt anonsu (tur 12) ────────────────────────
   KULLANICI İSTEĞİ: "önemli yani yıldız konulan randevu ve notlarda
   da Önemli diye başlayıp notumuz ne ise sesli okuyabilir mi?"
   Kaydın SAATİ geldiğinde BİR KEZ okunur (mandal, küme ile).
   Eşitlik değil PENCERE kullanılır: pencere gizlenince saat durur
   (`visibilitychange`); 17:30 kaydı 17:33'te geri gelindiğinde
   kaybolmamalı. Pencere dışındaki (geçmiş) kayıtlar okunmaz — yoksa
   uygulama her açılışta günün bütün önemli kayıtlarını sıralardı. */
const ONEMLI_PENCERE_DK = 5;
let onemliOkunan = new Set();
let onemliGun = null;

function onemliAnonslari(d) {
  if (!PZA.settings || PZA.settings.onemliOku === false) return [];
  const gun = PZA.todayKey();
  /* Gün değişince küme sıfırlanır: dünkü anahtarlar birikmesin
     (küme günde en fazla birkaç kayıt büyür). */
  if (onemliGun !== gun) { onemliOkunan.clear(); onemliGun = gun; }

  const suDk = d.getHours() * 60 + d.getMinutes();
  const cikti = [];
  for (const n of ((PZA.notes && PZA.notes[gun]) || [])) {
    if (!n || !n.star) continue;                       // yalnız ÖNEMLİ olanlar
    const [h, mk] = String(n.t || '').split(':').map(Number);
    if (!isFinite(h) || !isFinite(mk)) continue;
    const fark = suDk - (h * 60 + mk);
    if (fark < 0 || fark > ONEMLI_PENCERE_DK) continue;
    const k = gun + '|' + n.t + '|' + n.x;             // metin de anahtarda:
    if (onemliOkunan.has(k)) continue;                 // metin değişirse yeniden okunur
    onemliOkunan.add(k);
    cikti.push('Önemli. ' + n.x);
  }
  return cikti;
}

/** Bu tick'te okunacakları seslendir. Saat anonsu ile önemli kayıt
    aynı saniyeye düşerse TEK cümlede okunur (`ekler`): `PZA.say`
    konuşmadan önce `cancel()` çağırır, ayrı iki çağrı birbirini
    keserdi (17:30 hem yarım saat hem önemli kayıt olabilir). */
function saatAnonsu(d) {
  const s = PZA.settings || {};
  const onemli = onemliAnonslari(d);

  let saat = null;
  if (s.speech) {
    const gun = PZA.todayKey(), h = d.getHours(), mk = d.getMinutes();
    if (s.saatBasi !== false && mk === 0) {
      const damga = gun + ' ' + h;
      if (anonsSaat !== damga) { anonsSaat = damga; saat = [h, 0]; }
    } else if (s.yarimSaat && mk === 30) {
      const damga = gun + ' ' + h + ':30';
      if (anonsYarim !== damga) { anonsYarim = damga; saat = [h, 30]; }
    }
  }

  if (saat) PZA.say?.(saat[0], saat[1], onemli);
  else if (onemli.length) PZA.sayMetin?.(onemli.join('. '));
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
