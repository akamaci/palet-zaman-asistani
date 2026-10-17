/* settings.js — ayar deposu, skin tanımları, DOM'a uygulama
   Palet Zaman Asistanı · GPL-3.0 */
window.PZA = window.PZA || {};

/* ── Sürüm — TEK KAYNAK ──────────────────────────────────
   Aynı numara `package.json`, `src-tauri/Cargo.toml` ve
   `src-tauri/tauri.conf.json` içinde de durur. Ayarlar panelinin
   altındaki yazı BURADAN beslenir; elle yazıldığında v1.1.0
   yayımlandığı hâlde panelde "v1.0" kalıyordu.
   Üç dosyayla eşleşme `npm run dogrula` (kontrol 8) ile denetlenir —
   sürüm yükseltmesi unutulursa yayın durur. */
PZA.SURUM = '1.33.0';

/* ── Skin kataloğu ──────────────────────────────────────
   Winamp mantığı: her skin bir token seti. Kullanıcı skin'i
   eklemek için buraya bir kayıt + CSS'te [data-skin="id"] bloğu yeter. */
PZA.SKINS = [
  { id: 'klasik',  name: 'Klasik',  swatch: 'linear-gradient(135deg,#1c1f24,#9aa4b2)', note: 'Düz antrasit' }
];

PZA.DEFAULTS = {
  skin: 'klasik',
  theme: 'dark',
  plateTheme: null,   // pza-skin/3 Winamp ColorThemes: seçili renk teması (null = skinin ilk teması)
  size: '2',          // 2 = 1/2 · 3 = 1/3 · 4 = 1/4 · 'bar' = görev çubuğu gibi tek satır
  /* v1.18.0 — BAR MODU: tek satırda tüm arayüz; üst/alt seçilebilir. Otomatik
     gizlemede açılış tetiği TAM ORTADA ince bir oktur ve TIKLAYINCA açılır
     (kullanıcı: "her yerine tıklanınca değil — browser ve programlara engel olur"). */
  barKonum: 'alt',    // 'alt' | 'ust'
  barGizli: false,    // true → başlangıçta kapalı (yalnız ortadaki ince ok görünür)
  weather: true,
  preview: true,      // not başlıkları şeridi
  seconds: true,
  /* ── Sesli okuma (tur 12) ─────────────────────────────────
     KULLANICI BİLDİRİMİ: "saatimiz ayrıca saat başı saati
     söylemiyor. Bunun için 2. eklenti olmalı; ayarlarda saat başı
     uyarı, her yarım saatte uyarı olsun."
     `speech` = saat anonsunun ANA anahtarı. Tur 12'ye kadar
     varsayılanı KAPALIYDI: kullanıcı ayarı hiç açmadığı için saat
     başı okuma hiç duyulmadı ve "saat konuşmuyor" diye bildirdi.
     Eski kayıtlar `yukle()` içinde BİR KEZ yükseltilir (gerekçe orada). */
  speech: true,       // saat anonsu (sesli)
  saatBasi: true,     // her saat başı oku (:00)
  yarimSaat: false,   // her yarım saatte oku (:30)
  /* Ayrı anahtar, çünkü ayrı bir iş: yıldızlı (önemli) kaydın SAATİ
     geldiğinde metni "Önemli …" diye okunur. Saat anonsu kapalıyken de
     çalışır — kullanıcı yalnız hatırlatma istiyor olabilir. */
  onemliOku: true,
  /* Okuyucu sesi = sistemde kurulu sesin ADI (ör. "Microsoft Filiz
     - Turkish (Turkey)"). Eskiden 'female' | 'male' tutuluyordu ama
     bu iki "kişi" tek Türkçe sesli sistemde aynı sesi veriyordu;
     adla saklamak hem gerçek hem kalıcı. null = otomatik seç. */
  voiceName: null,
  locked: false,      // widget yeri kilitli mi (sağ üstteki asma kilit)
  /* Varsayılan KAPALI: kullanıcı "browser açılınca arkaplana gitmiyor,
     sürekli en ön planda kullanımı engelliyor" diye bildirdi. Açık
     bırakılsaydı hata varsayılan davranış olarak kalırdı. Widget masaüstünde
     görünür, ama normal pencerelerin önüne geçmez; isteyen ayardan açar. */
  alwaysOnTop: false,
  /* v1.10.5 — kullanıcı bildirimi: "Windows açılışta açılması gerekiyordu.
     Açılmıyor." Kök neden: varsayılan KAPALI'ydı ve açılışta kayıt hiç
     güvenceye alınmıyordu (HKCU\...\Run kaydı yok). Artık varsayılan AÇIK
     ve app.js açılışta set_autostart(true) ile kaydı tazeler. */
  autostart: true,
  city: null,         // { name, lat, lon }
  gcal: false,
  /* Günlük (log.js): varsayılan AÇIK — yalnızca bellekte döner,
     diske yazmaz, zamanlayıcı kurmaz; yani eski makinelerde de sıfır
     yük. Kullanıcı isterse KAPATABİLİR (bkz. tur 6). */
  log: true,
  /* v1.12.0 — arayüz dili. 'auto' = sistem dili (tr/en gömülü; diğerleri
     GitHub'dan otomatik indirilir). Kullanıcı Ayarlar'dan seçebilir. */
  dil: 'auto',
  /* v1.16.0 — ses motoru. 'tolga' = Windows'un kendi Türkçe sesi
     (çevrimdışı, varsayılan). 'ece' = YEREL kadın ses (EMA Lightning ile
     üretilmiş klipler, `ses/*.wav`) — internet/Python gerekmez, hiçbir
     metin dışarı çıkmaz; yalnız saat anonsu Ece ile, not başlıkları daima
     Tolga ile okunur (bkz. speech.js). */
  ses: 'tolga',
  /* v1.17.0 — Ezan (namaz vakitleri). TEK ana anahtar (`ezan`); vakit bazlı
     ayrı aç/kapa YOK (kullanıcı kararı). Konum hava durumu şehriyle
     paylaşılır; emushaf il/ilçe ID ile çalışır. Ses dosyaları GitHub'dan
     (`assets/ezan/`) indirilir — pakete gömülmez. */
  ezan: false,
  ezanSehir: null,     // emushaf SehirID
  ezanIlce: null,      // emushaf IlceID
  ezanSehirAd: null,
  ezanIlceAd: null,
  ezanSes: 0.8,        // 0..1
  /* v1.18.0 — ANA PANEL ezan ses düğmesi: ana `ezan` anahtarı açıkken sesi
     geçici olarak SESSİZE alır (vakitler yine takip edilir, ses çıkmaz).
     Kullanıcı: "ezan sesini kısıp açacak bir buton" + altında vakitler. */
  ezanSessiz: false
};

const KEY = 'pza.settings.v1';

/* ── Basit olay yolu ─────────────────────────────────── */
const listeners = {};
PZA.on  = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
PZA.emit = (ev, data) => (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

/* ── Depo ─────────────────────────────────────────────── */
function load() {
  let ham = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) ham = JSON.parse(raw);
  } catch (e) { console.warn('ayar okunamadı', e); }
  const s = Object.assign({}, PZA.DEFAULTS, ham || {});

  /* v1.16.0 — bulut "Emel" (Edge TTS) kaldırıldı; yerine YEREL "Ece"
     geldi. Kayıtlı seçim "emel" ise "ece"ye taşınır (kullanıcı yeniden
     seçmek zorunda kalmaz; davranış: kadın ses korunur, ama artık yerel). */
  if (s.ses === 'emel') s.ses = 'ece';

  /* TUR 12 — ESKİ AYARI BİR KEZ YÜKSELT.
     `saatBasi`/`yarimSaat`/`onemliOku` anahtarları tur 12'de geldi.
     Bu anahtarlar yoksa kayıt v1.9 ya da öncesinden geliyordur; oradaki
     `speech: false` KULLANICININ SEÇİMİ DEĞİL, hiç dokunulmamış
     varsayılandı. Kullanıcı "saat başı saati söylemiyor" diye bildirdi;
     yükseltme yapılmasaydı aynı sessizlik yeni sürümde de sürerdi.
     Saat anonsu bu yüzden AÇILIR ve bu GÜNLÜĞE yazılır — kullanıcı
     isterse ayardan kapatır (karar, tur kaydında gerekçesiyle duruyor). */
  if (ham && ham.saatBasi === undefined) {
    s.speech = true;
    s.saatBasi = true;
    PZA.logYaz?.('bilgi', 'Eski ayar yükseltildi: saat anonsu açıldı (v1.10)');
  }
  return s;
}

PZA.settings = load();

PZA.save = function () {
  try { localStorage.setItem(KEY, JSON.stringify(PZA.settings)); }
  catch (e) { console.warn('ayar yazılamadı', e); }
};

/** Ayar değiştir → kaydet → uygula → duyur */
PZA.set = function (key, value) {
  PZA.settings[key] = value;
  PZA.save();
  PZA.apply();
  PZA.emit('change', { key, value });
};

/* ── Ayarları DOM'a yansıt ───────────────────────────── */
PZA.apply = function () {
  const s = PZA.settings;

  const w = document.getElementById('widget');
  if (!w) return;
  w.dataset.skin  = s.skin;          // kullanıcı skiniyse applySkin 'ozel' yazar
  w.dataset.theme = s.theme;
  w.dataset.size  = s.size;
  w.dataset.barKonum = s.barKonum || 'alt';     // v1.18.0 — bar modu üst/alt
  if (PZA.__barAcik === undefined) PZA.__barAcik = (s.barGizli !== true);  // gizliyse kapalı başla

  w.classList.toggle('hide-weather', !s.weather);
  w.classList.toggle('hide-preview', !s.preview);
  w.classList.toggle('hide-seconds', !s.seconds);

  /* v1.18.0 — Alt bardaki "Tema: Karanlık" yazısı kaldırıldı (kullanıcı:
     gereksiz); yerine ezan ses düğmesi geldi. Tema durumu zaten soldaki
     Aydınlık/Karanlık düğmelerinin `.on` hâlinden okunuyor. */
  document.getElementById('btn-light')?.classList.toggle('on', s.theme === 'light');
  document.getElementById('btn-dark')?.classList.toggle('on', s.theme === 'dark');

  // Ayarlar panelindeki kontroller
  const bind = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  bind('opt-weather', s.weather);
  bind('opt-preview', s.preview);
  bind('opt-seconds', s.seconds);
  bind('opt-speech', s.speech);
  /* `!== false` / `=== true`: eski kayıtta bu anahtarlar yoktu; eksik
     anahtar "kapalı" değil "varsayılan" demektir (bkz. `PZA.DEFAULTS`). */
  bind('opt-saatbasi', s.saatBasi !== false);
  bind('opt-yarimsaat', s.yarimSaat === true);
  bind('opt-onemli', s.onemliOku !== false);
  bind('opt-ontop', s.alwaysOnTop);
  bind('opt-autostart', s.autostart);
  bind('opt-log', s.log !== false);
  if (PZA.LOG) PZA.LOG.acik = s.log !== false;

  /* v1.18.0 — BAR MODU ayarları (yalnız size='bar' iken görünür). */
  { const ba = document.getElementById('bar-ayar'); if (ba) ba.hidden = s.size !== 'bar'; }
  { const bk = document.getElementById('bar-konum');
    if (bk && document.activeElement !== bk) bk.value = s.barKonum || 'alt'; }
  bind('opt-bargizli', s.barGizli === true);
  { const t = document.getElementById('bar-tutamak');
    if (t) t.hidden = !(s.size === 'bar' && s.barGizli === true); }
  w.classList.toggle('bar-kapali',
    s.size === 'bar' && s.barGizli === true && PZA.__barAcik !== true);

  /* v1.17.0 — Ezan: tek anahtar + (açıkken) il/ilçe/ses bölümü. */
  bind('opt-ezan', s.ezan === true);
  { const ea = document.getElementById('ezan-ayar'); if (ea) ea.hidden = s.ezan !== true; }
  if (PZA.ezanAyarCiz) PZA.ezanAyarCiz();

  /* v1.18.0 — Ana paneldeki ezan ses düğmesi + dropdown durumu. */
  { const eb = document.getElementById('ezan-ses-btn');
    if (eb) { eb.classList.toggle('sessiz', s.ezanSessiz === true); eb.setAttribute('aria-pressed', s.ezanSessiz === true ? 'true' : 'false'); } }
  { const st = document.getElementById('ezan-ses-txt'); if (st) st.textContent = s.ezanSessiz === true ? 'Sessiz' : 'Ezan'; }
  { const sb = document.getElementById('ezan-sessiz-btn'); if (sb) sb.setAttribute('aria-pressed', s.ezanSessiz === true ? 'true' : 'false'); }
  { const sw = document.getElementById('em-sw-txt'); if (sw) sw.textContent = s.ezanSessiz === true ? 'Sessiz' : 'Ses açık'; }
  { const ik = document.getElementById('em-ikon'); if (ik) ik.textContent = s.ezanSessiz === true ? '🔇' : '🔊'; }
  { const eh = document.getElementById('ezan-hizli-ses');
    if (eh && document.activeElement !== eh) eh.value = (typeof s.ezanSes === 'number') ? s.ezanSes : 0.8; }
  if (PZA.ezanMenuCiz) PZA.ezanMenuCiz();

  // Okuyucu sesi: sistemde kurulu seslerin listesi (speech.js).
  // Ayrı bir çizim fonksiyonu çünkü liste ancak sesler yüklendikten
  // sonra dolar — `voiceschanged` de aynı fonksiyonu çağırır.
  if (PZA.renderVoiceUi) PZA.renderVoiceUi();

  // Yeri kilitle (sağ üst köşe)
  PZA.applyLock();

  // Sürüm yazısı — tek kaynak PZA.SURUM
  const sv = document.getElementById('set-ver');
  if (sv) sv.textContent = PZA.SURUM;

  document.querySelectorAll('[data-theme-set]').forEach(b =>
    b.classList.toggle('on', b.dataset.themeSet === s.theme));
  document.querySelectorAll('input[name="size"]').forEach(r =>
    r.checked = r.value === s.size);

  PZA.renderSkins();

  // Şehir çipleri
  const chips = document.getElementById('city-chips');
  if (chips && s.city) {
    // Şehir adı geocoding API'sinden gelir — dış veri, kaçış şart
    chips.innerHTML = `<button data-city-clear>${PZA.escHtml(s.city.name)} ✕</button>`;
  } else if (chips) {
    chips.innerHTML = '<span style="font-size:10px;color:var(--fg-mute)">Henüz şehir seçilmedi.</span>';
  }

  // Kullanıcı skini aktifse token'ları satır içi olarak uygula
  PZA.applySkin && PZA.applySkin();
};

/* ── Yeri kilitle ──────────────────────────────────────────
   Kullanıcı isteği: "sağ üst köşeye kilit ikonu koyarsan olduğu
   yere kilitleyelim, yerinden yanlışlıkla oynamasın".
   Tauri'de pencereyi taşıyan TEK mekanizma `data-tauri-drag-region`
   özniteliğidir (Rust tarafında `start_dragging` çağrılmaz). Bu
   yüzden kilitlemek için özniteliği kaldırmak yeterli: ek Rust
   komutu, yeni yetki ya da pencere durumu gerekmez.
   Öğeler `[data-drag]` ile KALICI işaretlidir; yoksa kilidi açarken
   hangi öğelerin taşınabilir olduğu bilinemezdi. */
PZA.applyLock = function () {
  const kilitli = !!(PZA.settings && PZA.settings.locked);
  document.querySelectorAll('[data-drag]').forEach(el => {
    if (kilitli) el.removeAttribute('data-tauri-drag-region');
    else el.setAttribute('data-tauri-drag-region', '');
  });
  const w = document.getElementById('widget');
  if (w) w.classList.toggle('locked', kilitli);
  const b = document.getElementById('btn-lock');
  if (b) {
    b.classList.toggle('on', kilitli);
    b.setAttribute('aria-pressed', kilitli ? 'true' : 'false');
    b.title = kilitli ? 'Kilit açık — widget taşınabilir' : 'Yerine kilitle — yanlışlıkla oynamasın';
  }
  return kilitli;
};

/* ── Skin listesi + seçili skin çubuğu ────────────────────
   Ayrı fonksiyon: stüdyo kaydettikten sonra yalnızca burası
   tazelenir. Tüm PZA.apply() çağrılsaydı stüdyonun tema
   önizlemesi (açık/karanlık sekmesi) sıfırlanırdı. */
PZA.renderSkins = function () {
  const s = PZA.settings;

  /* v1.18.5 — Kullanıcı: "yeni skinler eklendikçe bir listeden seçilsin,
     tıpkı ses listesindeki Ece/Tolga gibi." → kart ızgarası yerine
     ETİKET + <select> listesi. Yerleşik + kullanıcı skinleri tek listede;
     kullanıcı skinleri sonda ve "✎" ile işaretli. */
  const sel = document.getElementById('skin-select');
  if (sel) {
    const builtin = PZA.SKINS.map(sk => ({ id: sk.id, name: sk.name }))
      .concat(Object.keys(PZA.PLATE_SKINS || {}).map(k =>
        ({ id: k, name: (PZA.PLATE_SKINS[k].name || k) })));
    const custom = PZA.customSkins().map(sk => ({
      id: 'user:' + sk.id, name: (sk.name || 'İsimsiz') + '  ✎'
    }));
    const E = PZA.escHtml;
    sel.innerHTML = builtin.concat(custom).map(sk =>
      `<option value="${E(sk.id)}"${sk.id === s.skin ? ' selected' : ''}>${E(sk.name)}</option>`
    ).join('');
  }

  // Seçili skin kullanıcı skiniyse altındaki çubuğu göster
  const bar = document.getElementById('skin-bar');
  if (bar) {
    const cur = PZA.skinById(String(s.skin).replace(/^user:/, ''));
    const on = String(s.skin).indexOf('user:') === 0 && cur;
    bar.hidden = !on;
    if (on) {
      bar.dataset.skinId = cur.id;
      document.getElementById('skin-bar-name').textContent = cur.name || 'İsimsiz';
    }
  }

  // Winamp ColorThemes: renk teması seçicisi (yalnız plaka skinlerinde, ≥2 tema)
  PZA.renderRenk();
};

/* pza-skin/3 renk teması seçicisi — Winamp "ColorThemes"/gammagroup karşılığı.
   Aktif plaka skininin `colorthemes` listesini <select>'e döker; seçim
   `settings.plateTheme`'e yazılır ve motor filtresi/aksanı ona göre uygular. */
PZA.renderRenk = function () {
  const row = document.getElementById('skin-renk-row');
  const sel = document.getElementById('skin-renk');
  if (!row || !sel) return;
  // Test/erken yükleme: motor (skins.js) henüz yoksa sessizce çık
  if (typeof PZA.activeSkin !== 'function' || typeof PZA.plateThemeObj !== 'function') { row.hidden = true; return; }
  const sk = PZA.activeSkin();
  const list = (sk && sk.colorthemes) || [];
  row.hidden = list.length < 2;
  if (list.length < 2) { sel.innerHTML = ''; return; }
  const cur = PZA.plateThemeObj(sk);
  const E = PZA.escHtml;
  sel.innerHTML = list.map(t =>
    `<option value="${E(t.id)}"${cur && cur.id === t.id ? ' selected' : ''}>${E(t.name || t.id)}</option>`
  ).join('');
};

/* ══ AYARLAR SEKMELERİ (v1.20.0) ══════════════════════════════
   Kullanıcı: "ayarlar içinde sekme yapalım; uzadıkça en aşağı kadar uzuyor,
   gruplayalım; her grup AYNI UZUNLUKTA olsun." → Mevcut `.set-body`
   bölümleri (<h4> başlıklarından) sekmelere BÖLÜNÜR; DOM taşınır ama
   öğe kimlikleri korunur (mevcut bağlar bozulmaz). */
PZA.AYAR_SEKMELERI = [
  { id: 'genel',   ad: 'Genel',   basliklar: ['h_lang', 'h_vis', 'h_theme', 'h_size', 'h_start'] },
  { id: 'gorunum', ad: 'Görünüm', basliklar: ['h_skin'] },
  { id: 'ses',     ad: 'Ses',     basliklar: ['h_speech', 'h_loc', 'h_ezan'] },
  { id: 'takvim',  ad: 'Takvim',  basliklar: ['h_gcal'] },
  { id: 'diger',   ad: 'Diğer',   basliklar: ['h_log'] }
];

PZA.ayarSekmeAc = function (id) {
  const govde = document.querySelector('#settings .set-body');
  if (!govde) return;
  govde.querySelectorAll('.set-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  govde.querySelectorAll('.set-tab-panel').forEach(p => p.classList.toggle('on', p.dataset.tab === id));
};

PZA.kurAyarlarSekmeleri = function () {
  const govde = document.querySelector('#settings .set-body');
  if (!govde || govde.dataset.sekmeli === '1') return;
  govde.dataset.sekmeli = '1';

  /* Bölümleri <h4> sınırlarından ayır (h4 + ardındakiler). */
  const bolumler = [];
  let anlik = null;
  Array.from(govde.children).forEach(el => {
    if (el.tagName === 'H4') { anlik = { bas: el, ogeler: [el] }; bolumler.push(anlik); }
    else if (anlik) { anlik.ogeler.push(el); }
  });

  const sekmeBul = k => PZA.AYAR_SEKMELERI.find(s => s.basliklar.indexOf(k) >= 0) || PZA.AYAR_SEKMELERI[PZA.AYAR_SEKMELERI.length - 1];

  /* Paneller (sabit sıra) */
  const kok = document.createElement('div');
  const paneller = {};
  PZA.AYAR_SEKMELERI.forEach(s => {
    const d = document.createElement('div');
    d.className = 'set-tab-panel'; d.dataset.tab = s.id;
    paneller[s.id] = d; kok.appendChild(d);
  });

  /* Öğeleri panellere TAŞI (id ve olay bağları korunur) */
  bolumler.forEach(b => {
    const s = sekmeBul(b.bas.getAttribute('data-i18n') || '');
    b.ogeler.forEach(el => paneller[s.id].appendChild(el));
  });

  /* Sekme çubuğu */
  const bar = document.createElement('div');
  bar.className = 'set-tabs'; bar.id = 'set-tabs'; bar.setAttribute('role', 'tablist');
  PZA.AYAR_SEKMELERI.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'set-tab' + (i === 0 ? ' on' : '');
    btn.dataset.tab = s.id; btn.textContent = s.ad;
    bar.appendChild(btn);
  });
  bar.addEventListener('click', e => {
    const b = e.target.closest('.set-tab');
    if (b) PZA.ayarSekmeAc(b.dataset.tab);
  });

  govde.insertBefore(bar, govde.firstChild);
  govde.insertBefore(kok, bar.nextSibling);
  PZA.ayarSekmeAc(PZA.AYAR_SEKMELERI[0].id);
};

/* DOM hazır (script'ler sayfa sonunda) → hemen kur. */
PZA.kurAyarlarSekmeleri();
