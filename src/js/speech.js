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

/** Seçili sesin okunur etiketi. */
PZA.voiceLabel = function () {
  const v = PZA.seciliSes();
  if (!v) return 'Sistemde konuşma sesi bulunamadı';
  return v.name || v.lang || 'Sistem sesi';
};

/* Ses ekleme yolu — kullanıcının Win+R'ye yapıştırabilmesi için
   URI'yi panoya kopyalayan düğme (tıklaması app.js'te, delege). */
function kopyaDugmesi() {
  return '<br><button type="button" class="lnk vh-kopya" data-kopya="' + PZA.SES_URI + '">'
    + PZA.SES_URI + ' yolunu kopyala</button>';
}

/** Kurulu ses uyarısı — yeterli Türkçe ses varsa null.
    Kullanıcı isteği: "not olarak bayan sesi buradan ayarlanır gibi
    ibare koy." */
PZA.voiceHint = function () {
  if (PZA.trSesSayisi >= 2) return null;
  const E = PZA.escHtml || (s => String(s));
  const bas = PZA.trSesSayisi === 1
    ? 'Sistemde tek Türkçe ses var (<b>' + E(PZA.sesListesi[0].name) + '</b>).'
    : 'Sistemde Türkçe konuşma sesi yok.';
  return bas + '<br>Bayan sesi buradan ayarlanır: <b>' + PZA.SES_YOLU + '</b>.' + kopyaDugmesi();
};

/** Arayüz: seçim listesi + etiket + kurulu ses uyarısı.
    `voiceschanged` de bunu çağırır — sesler gecikmeli yüklenebiliyor. */
PZA.renderVoiceUi = function () {
  const secili = PZA.otomatikSesSec();
  const sel = document.getElementById('voice-select');
  if (sel) {
    const E = PZA.escHtml || (s => String(s));
    if (!PZA.sesListesi.length) {
      sel.innerHTML = '<option value="">Ses bulunamadı</option>';
      sel.disabled = true;
    } else {
      sel.disabled = false;
      // "(kadın)" / "(erkek)" etiketi ses adından TAHMİN edilir —
      // kullanıcı hangi sesin hangi cinsiyette olduğunu listede görsün.
      sel.innerHTML = PZA.sesListesi.map(v =>
        '<option value="' + E(v.name) + '">' + E(v.name)
        + (v.kadin ? ' (kadın)' : v.erkek ? ' (erkek)' : '') + '</option>'
      ).join('');
      sel.value = secili ? secili.name : '';
    }
  }
  const vn = document.getElementById('voice-name');
  if (vn) vn.textContent = PZA.voiceLabel();
  const vh = document.getElementById('voice-hint');
  if (vh) {
    const ipucu = PZA.voiceHint();
    vh.innerHTML = ipucu || '';
    vh.hidden = !ipucu;
  }
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

/** Verilen saat için konuş */
PZA.say = function (h, m) {
  if (!('speechSynthesis' in window)) {
    console.warn('Bu ortamda speechSynthesis yok.');
    return false;
  }
  if (!PZA.sesListesi.length) sesleriTopla();
  const v = PZA.seciliSes();

  const metin = PZA.trClock(h, m);
  const u = new SpeechSynthesisUtterance(metin);
  u.lang = 'tr-TR';
  u.rate = OKUMA_AYAR.rate;
  u.pitch = OKUMA_AYAR.pitch;
  if (v) u.voice = v;

  speechSynthesis.cancel();     // üst üste binmesin
  speechSynthesis.resume();     // kimi motorlarda cancel sonrası takılı kalır
  speechSynthesis.speak(u);
  PZA.emit('speech:said', { metin, h, m, voice: v ? v.name : null });
  return true;
};

/** Şu anki saati oku (ayarlar önizlemesi için) */
PZA.sayNow = function () {
  const d = new Date();
  return PZA.say(d.getHours(), d.getMinutes());
};
