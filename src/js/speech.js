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
   Okuyucu seçimi SİSTEMDE KURULU gerçek seslerden yapılır.
   Eskiden "Ece" / "Emre" adlı iki uydurma okuyucu vardı; sistemde
   tek Türkçe ses (Microsoft Tolga) olunca ikisi de AYNI sesi alıyor,
   ayrım yalnız perdede kalıyordu. Kullanıcı bunu üst üste iki kez
   bildirdi ve son sözü net oldu: "ece ve emre ilavesi gereksiz
   olmuş; çalışır hâle geliyorsa getir, Windows'tan yapılacaksa iki
   ismi de kaldır, ayar sayfasına yönlendir, 'bayan sesi buradan
   ayarlanır' diye not koy."
   Artık liste neyse o: kurulu sesler ADLARIYLA listelenir (Filiz
   kuruluysa listede görünür), ses kurulu değilse kullanıcı sesi
   ekleyeceği yere yönlendirilir (PZA.voiceHint). */
/* Türkçe sesler önce; İngilizce adlar YEDEK içindir (Türkçe ses
   kurulu değilse oraya düşülür — orada da cinsiyet ters atanmasın).
   `\b` sınırı şart: "Tom" gibi kısa adlar "Tomas"ın içinde de geçer. */
const SES_DISI  = /(emel|filiz|dilara|yelda|seda|aylin|female|kad[ıi]n|woman|\bzira\b|\bhazel\b|\bsusan\b|\bsamantha\b|\bvictoria\b|\bkaren\b|\bmoira\b|\btessa\b|\bfiona\b|\bserena\b|\ballison\b|\bava\b|\bjoanna\b|\bsalli\b|\bamy\b|\bemma\b|\baria\b|\bjenny\b|\bmichelle\b|\bclara\b|\bnatasha\b)/i;
const SES_ERKEK = /(tolga|ahmet|burak|male|erkek|\bdavid\b|\bmark\b|\bgeorge\b|\bdaniel\b|\balex\b|\bfred\b|\bjames\b|\bguy\b|\bryan\b|\bwilliam\b|\boliver\b|\bthomas\b|\beric\b|\bchristopher\b|\bsteffan\b|\bjorge\b)/i;

/* Okuma ayarı — TEK ve doğal. Perde artık okuyucu ayrımı için
   KULLANILMAZ; ayrımı sesin kendisi yapar (perdeyi oynatıp "iki
   kişi" taklidi yapmak kullanıcıyı ikna etmedi, haklı olarak).
   Hafif yavaş tempo yalnız saatin net anlaşılması için. */
const OKUMA_AYAR = { pitch: 1.0, rate: 0.95 };

/* Windows'ta ses ekleme yolu. Uygulama bu ayar sayfasını AÇAMAZ:
   Tauri'de opener eklentisi ve `ms-settings:` şema izni yok, zorlamak
   özel şema navigasyonuyla webview'ı bozabilirdi. Bu yüzden metin
   yazılır + URI kopyalanabilir verilir (kullanıcı Win+R'ye yapıştırır). */
PZA.SES_YOLU = 'Ayarlar › Saat ve Dil › Konuşma › Ses ekle';
PZA.SES_URI  = 'ms-settings:speech';

PZA.sesListesi = [];     // { voice, name, lang, tr, kadin }
PZA.trSesSayisi = 0;     // yalnız Türkçe seslerin sayısı
PZA.tekSes = false;      // Türkçe ses ≤ 1 → listede seçenek yok, uyarı çıkar

/** Kurulu sesleri topla. Türkçe varsa YALNIZ Türkçeler listelenir:
    saat Türkçe okunurken İngilizce ses seçmek anlamsız olurdu. */
function sesleriTopla() {
  if (!('speechSynthesis' in window)) { PZA.sesListesi = []; PZA.trSesSayisi = 0; PZA.tekSes = true; return []; }
  const hepsi = speechSynthesis.getVoices() || [];
  const tr = hepsi.filter(v => (v.lang || '').toLowerCase().startsWith('tr'));
  const havuz = tr.length ? tr : hepsi;     // Türkçe yoksa eldekini kullan
  const gorulen = new Set();
  PZA.sesListesi = havuz
    .filter(v => {
      const a = (v.name || '') + '|' + (v.lang || '');
      if (gorulen.has(a)) return false;     // aynı ses iki kez listelenmesin
      gorulen.add(a);
      return true;
    })
    .map(v => ({
      voice: v,
      name: v.name || v.lang || 'İsimsiz ses',
      lang: v.lang || '',
      tr: (v.lang || '').toLowerCase().startsWith('tr'),
      kadin: SES_DISI.test(v.name || ''),
      erkek: SES_ERKEK.test(v.name || '')
    }));
  PZA.trSesSayisi = tr.length;
  PZA.tekSes = tr.length <= 1;
  return PZA.sesListesi;
}

/** Seçili ses: kayıtlı ad → yoksa OTOMATİK seçim.
    Otomatik seçim önce kadın sesini arar (kullanıcı isteği: "eğer
    olmuyorsa otomatik kadın sesi ekle"), yoksa listenin ilkini alır. */
PZA.seciliSes = function () {
  const liste = PZA.sesListesi;
  if (!liste.length) return null;
  const ad = PZA.settings && PZA.settings.voiceName;
  if (ad) {
    const bulunan = liste.find(v => v.name === ad);
    if (bulunan) return bulunan.voice;
  }
  const kadin = liste.find(v => v.kadin);
  return (kadin || liste[0]).voice;
};

/** Kayıtlı seçim yoksa otomatik seçimi KALICI hâle getir — kullanıcı
    listede ne seçili olduğunu görsün, her açılışta yeniden seçmesin. */
PZA.otomatikSesSec = function () {
  const v = PZA.seciliSes();
  if (v && !PZA.settings.voiceName) { PZA.settings.voiceName = v.name; PZA.save(); }
  return v;
};

/** Seçili okuyucunun okunur etiketi: "Ece" (yerel kadın) ya da sistem sesi. */
PZA.voiceLabel = function () {
  if (PZA.settings && PZA.settings.ses === 'ece') return PZA.eceEtiket();
  const v = PZA.seciliSes();
  if (!v) return PZA.eceEtiket();      // sistem sesi yoksa Ece zaten var
  return v.name || v.lang || 'Sistem sesi';
};

/* Ses ekleme yolu — kullanıcının Win+R'ye yapıştırabilmesi için
   URI'yi panoya kopyalayan düğme (tıklaması app.js'te, delege). */
function kopyaDugmesi() {
  return '<br><button type="button" class="lnk vh-kopya" data-kopya="' + PZA.SES_URI + '">'
    + PZA.SES_URI + ' yolunu kopyala</button>';
}

/** Uyarı artık YOK: kadın ses "Ece" pakete GÖMÜLÜ geldiği için
    "Windows'a ses ekle" yönlendirmesine gerek kalmadı (kullanıcı:
    iki seçici kafa karıştırıyordu → tek listeye indirildi). */
PZA.voiceHint = function () { return null; };

/** TEK okuyucu listesi: "Ece (yerel kadın)" + sistemde KURULU sesler.
    (v1.16.1) Eskiden üstte "Okuyucu sesi" + altta "SES MOTORU" diye İKİ
    seçici vardı — kafa karıştırıyordu (kullanıcı bildirimi) → tek listeye indi. */
const ECE_VAL = '__ece';
PZA.eceEtiket = function () {
  return (PZA.i18n && typeof PZA.i18n.t === 'function')
    ? PZA.i18n.t('voice_ece', 'Ece (kadın ses, yerel)')
    : 'Ece (kadın ses, yerel)';
};
PZA.renderVoiceUi = function () {
  PZA.otomatikSesSec();                 // kayıtsız seçimi kalıcılaştır
  const ece = (PZA.settings && PZA.settings.ses) === 'ece';
  const sel = document.getElementById('voice-select');
  if (sel) {
    const E = PZA.escHtml || (s => String(s));
    sel.disabled = false;               // Ece her zaman var → liste hep etkin
    sel.innerHTML =
      '<option value="' + ECE_VAL + '">' + E(PZA.eceEtiket()) + '</option>' +
      PZA.sesListesi.map(v =>
        '<option value="' + E(v.name) + '">' + E(v.name)
        + (v.kadin ? ' (kadın)' : v.erkek ? ' (erkek)' : '') + '</option>'
      ).join('');
    const secili = PZA.seciliSes();
    sel.value = ece ? ECE_VAL : (secili ? secili.name : ECE_VAL);
    if (!sel.value) sel.value = ECE_VAL;
  }
  const vn = document.getElementById('voice-name');
  if (vn) vn.textContent = PZA.voiceLabel();
  const vh = document.getElementById('voice-hint');
  if (vh) { vh.innerHTML = ''; vh.hidden = true; }
};

if ('speechSynthesis' in window) {
  sesleriTopla();
  /* Sesler gecikmeli yüklenebilir: liste gelince hem seçimi hem
     etiketi hem uyarıyı tazele. */
  speechSynthesis.onvoiceschanged = () => {
    sesleriTopla();
    if (PZA.renderVoiceUi) PZA.renderVoiceUi();
    PZA.emit('speech:voices', PZA.sesListesi);
  };
}

/** Verilen METNİ konuş (tur 12). Saatten bağımsız: önemli kayıt
    anonsu ("Önemli …") bu yolu kullanır.
    Konuşmadan önce `cancel()` çağrılır — üst üste binen anonslar
    birbirini kesmesin diye, aynı saniyeye düşen metinleri ÇAĞIRAN
    taraf tek cümlede birleştirir (bkz. clock.js → `saatAnonsu`). */
/* ── Kadın ses "Ece" (EMA Lightning · YEREL, internet gerekmez) ──
   KULLANICI: *"lokale kurulabilecek bayan sesi"* + bulutun KVKK'ya
   aykırı olduğu kararı → bulut (Edge "Emel" + Python) TAMAMEN kaldırıldı.
   Kadın ses artık **EMA Lightning** (8.6M param, Apache-2.0) ile yerelde
   üretilmiş kliplerden çalınır: `ses/saat-HH.wav` (24 saat) +
   `ses/dk-MM.wav` (59 dakika). Hiçbir metin dışarı çıkmaz; Python/espeak/
   internet gerekmez.

   GİZLİLİK (değişmedi, ama artık çevrimiçi motor yok): not başlıkları
   her zaman **Tolga** (Windows) ile okunur. */
const SES_KLIP = 'ses/';                        // index.html'e göreli yol
const iki = n => String(n).padStart(2, '0');

PZA.__eceAudio = null;                          // üst üste binmesin

/** Bir klibi çal; bitince `sonra` çağrılır (klip zinciri için).
    Klip yoksa/çalınamazsa zincir KIRILMAZ — sonraki adıma geçilir. */
function eceCal(yol, sonra) {
  try {
    if (PZA.__eceAudio) { try { PZA.__eceAudio.pause(); } catch (e) {} PZA.__eceAudio = null; }
    const a = new Audio(yol);
    PZA.__eceAudio = a;
    let bitti = false;
    const bitir = () => { if (bitti) return; bitti = true; PZA.__eceAudio = null; if (sonra) sonra(); };
    a.onended = bitir;
    a.onerror = bitir;
    const p = a.play();
    if (p && p.catch) p.catch(bitir);           // otomatik oynatma reddi → devam
  } catch (e) { if (sonra) sonra(); }
}

/** Saati Ece ile oku: "saat HH" (+ :MM) klipleri, sonra varsa notlar
    (notlar Tolga ile — gizlilik). */
PZA.eceSaat = function (h, m, ekMetin) {
  const son = ekMetin ? () => PZA.sayMetin(ekMetin, { not: true }) : null;
  const saatYol = SES_KLIP + 'saat-' + iki(h) + '.wav';
  if (m > 0) eceCal(saatYol, () => eceCal(SES_KLIP + 'dk-' + iki(m) + '.wav', son));
  else eceCal(saatYol, son);
  PZA.emit('speech:said', { metin: PZA.trClock(h, m), voice: 'ece' });
  return true;
};

/** Metni konuş — Windows sesi (Tolga). Not başlıkları / önemli kayıtlar
    buradan okunur (çevrimdışı; hiçbir metin dışarı çıkmaz). */
PZA.sayMetin = function (metin, baglam) {
  const m = String(metin == null ? '' : metin).trim();
  if (!m) return false;
  if (!('speechSynthesis' in window)) {
    console.warn('Bu ortamda speechSynthesis yok.');
    return false;
  }
  if (!PZA.sesListesi.length) sesleriTopla();
  const v = PZA.seciliSes();

  const u = new SpeechSynthesisUtterance(m);
  u.lang = 'tr-TR';
  u.rate = OKUMA_AYAR.rate;
  u.pitch = OKUMA_AYAR.pitch;
  if (v) u.voice = v;

  speechSynthesis.cancel();     // üst üste binmesin
  speechSynthesis.resume();     // kimi motorlarda cancel sonrası takılı kalır
  speechSynthesis.speak(u);
  PZA.emit('speech:said',
    Object.assign({ metin: m, voice: v ? v.name : null }, baglam || {}));
  return true;
};

/** Verilen saat için konuş. `ekler` verilirse AYNI cümleye eklenir:
    saat başı / yarım saat anonsu ile "Önemli …" kaydı aynı saniyeye
    düşerse tek ses olsun — iki ayrı çağrı birbirini keserdi. */
PZA.say = function (h, m, ekler) {
  const parcalar = [];
  let notVar = false;
  for (const e of (ekler || [])) {
    const t = String(e == null ? '' : e).trim();
    if (t) { parcalar.push(t); notVar = true; }
  }
  /* Ece (yerel kadın ses): saat anonsunu KLİPTEN çal. Not karışmışsa
     notlar klipten SONRA Tolga ile okunur (gizlilik: notlar dışarı gitmez). */
  if ((PZA.settings && PZA.settings.ses) === 'ece') {
    return PZA.eceSaat(h, m, notVar ? parcalar.join('. ') : null);
  }
  /* Tolga: tek cümlede (üst üste binmesin diye tek konuşma). */
  return PZA.sayMetin([PZA.trClock(h, m), ...parcalar].join('. '), { h, m, not: notVar });
};

/** Şu anki saati oku (ayarlar önizlemesi için) */
PZA.sayNow = function () {
  const d = new Date();
  return PZA.say(d.getHours(), d.getMinutes());
};
