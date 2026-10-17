/* skins.js — kullanıcı skin motoru (Winamp mantığı)
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim
   ══════════════════════════════════════════════════════════════
   Bir skin = 27 renk + arka plan görseli + köşe yuvarlaklığı + 2 font.
   Geri kalan ~10 token bu değerlerden TÜRETİLİR. Böylece skin kendi
   kendine yeter: gölge, dikiş ve yarı saydam vurgular zeminin
   koyuluğuna göre kendini ayarlar; tema değişince yarım kalmaz.

   Dosya biçimi (.pzaskin.json):
   {
     "format": "pza-skin/1",
     "id": "aurora", "name": "Aurora", "author": "Ali",
     "dark":  { "--bg-1": "#101722", … },   // zorunlu
     "light": { … },                         // opsiyonel
     "bg": { "image": "data:image/jpeg;base64,…", "opacity": .35, "fit": "cover" },
     "radius": 16, "fontUI": "…", "fontNum": "…"
   }
   ══════════════════════════════════════════════════════════════ */
window.PZA = window.PZA || {};

PZA.SKIN_FORMAT = 'pza-skin/1';

/* ── pza-skin/2 (KATMAN+BÖLGE · Winamp usulü) ────────────────
   Statik bir "plaka" görseli (şasi/çerçeve, dinamik yazı YOK) + canlı
   kontrollerin plaka üzerindeki KOORDİNATLARI. BMP değil WebP/PNG. */
PZA.SKIN_FORMAT_V2 = 'pza-skin/2';

/* pza-skin/3 (Winamp "modern"/Wasabi usulü): tek sprite ATLASI + adlandırılmış
   PARÇALAR + katman kompozisyonu + tema FİLTRELERİ (Winamp gammagroup karşılığı)
   + GERÇEK düğme durumları. Gömülü yazı YOK — canlı kontrol üstte kalır. */
PZA.SKIN_FORMAT_V3 = 'pza-skin/3';

/* Bölge adı → DOM seçici (canlı kontrol: saat/hava/notlar…). */
PZA.PLATE_MAP = {
  clock:    '#flip-row',
  date:     '.dateline',
  weather:  '#weather-tile',
  notes:    '#btn-notes',
  theme:    '.theme-switch',
  settings: '#btn-settings',
  ezan:     '.ezan-ctl',
  pa:       '#pa-btn'
};

/* Güvenli sorgu — test ortamında `document.querySelector` olmayabilir. */
PZA.q1 = function (sel) {
  return (typeof document !== 'undefined' && document.querySelector) ? document.querySelector(sel) : null;
};

/* ── OTOMATİK SKİN (v1.20.0) ──────────────────────────────────
   Kullanıcı: "bir resim, bir renk ve benzeri çizimler; belirli doneler
   ve önerilerle bunu otomatikleştirmek." → Son kullanıcı bir RESİM + bir
   RENK verir; kontrol bölgeleri ÖN AYAR (dono) haritalarından gelir.
   (Winamp'taki "koordinatı elle yaz" derdi son kullanıcıdan alınır.) */
PZA.PLATE_LAYOUTS = {
  standart: {
    name: 'Standart', panel: 0.10,
    regions: {
      clock: { x: 256, y: 144, w: 428, h: 122 }, date: { x: 383, y: 32, w: 174, h: 24 },
      weather: { x: 36, y: 109, w: 202, h: 126 }, notes: { x: 702, y: 136, w: 202, h: 66 },
      theme: { x: 702, y: 218, w: 202, h: 56 }, settings: { x: 36, y: 251, w: 202, h: 50 },
      ezan: { x: 817, y: 366, w: 36, h: 32 }, pa: { x: 865, y: 369, w: 39, h: 26 }
    }
  },
  ferah: {
    name: 'Ferah (geniş)', panel: 0.12,
    regions: {
      clock: { x: 270, y: 150, w: 400, h: 120 }, date: { x: 383, y: 34, w: 174, h: 24 },
      weather: { x: 28, y: 96, w: 190, h: 150 }, notes: { x: 722, y: 120, w: 190, h: 74 },
      theme: { x: 722, y: 210, w: 190, h: 56 }, settings: { x: 28, y: 262, w: 190, h: 48 },
      ezan: { x: 815, y: 368, w: 36, h: 32 }, pa: { x: 863, y: 371, w: 39, h: 26 }
    }
  }
};

function yuvarlakKutu(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Resim + renk + düzen → plaka (WebP data URI). cb(err, plateDataUri, layout) */
PZA.autoPlate = function (imageUri, accent, layoutKey, panel, cb) {
  const L = PZA.PLATE_LAYOUTS[layoutKey] || PZA.PLATE_LAYOUTS.standart;
  const cv = { w: 940, h: 430 };
  const c = document.createElement('canvas'); c.width = cv.w; c.height = cv.h;
  const g = c.getContext('2d');
  const pc = PZA.parseColor(accent) || { hex: '#00f0ff' };
  const A = [parseInt(pc.hex.slice(1, 3), 16), parseInt(pc.hex.slice(3, 5), 16), parseInt(pc.hex.slice(5, 7), 16)].join(',');
  const panelA = (typeof panel === 'number') ? panel : L.panel;

  const ciz = () => {
    Object.keys(L.regions).forEach(k => {
      const r = L.regions[k];
      yuvarlakKutu(g, r.x, r.y, r.w, r.h, 12);
      g.fillStyle = 'rgba(' + A + ',' + panelA + ')'; g.fill();
      g.lineWidth = 1; g.strokeStyle = 'rgba(' + A + ',0.45)'; g.stroke();
    });
    let out;
    try { out = c.toDataURL('image/webp', 0.9); } catch (e) { out = c.toDataURL('image/png'); }
    cb(null, out, L);
  };

  const img = new Image();
  img.onload = () => {
    const s = Math.max(cv.w / img.naturalWidth, cv.h / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    g.drawImage(img, (cv.w - w) / 2, (cv.h - h) / 2, w, h);
    g.fillStyle = 'rgba(6,9,16,0.55)'; g.fillRect(0, 0, cv.w, cv.h);      // okunurluk için karart
    g.fillStyle = 'rgba(' + A + ',0.06)'; g.fillRect(0, 0, cv.w, cv.h);   // hafif renk tonu
    ciz();
  };
  img.onerror = () => cb('Resim açılamadı.');
  img.src = imageUri;
};

/** Otomatik skin nesnesi üret (kaydetmez). o = {plate,layoutKey,accent,name} */
PZA.autoSkin = function (o) {
  const L = PZA.PLATE_LAYOUTS[o.layoutKey] || PZA.PLATE_LAYOUTS.standart;
  const acc = PZA.parseColor(o.accent) || { hex: '#00f0ff', a: 1 };
  const koyu = PZA.luminance(acc.hex) < 0.65;
  return {
    format: PZA.SKIN_FORMAT_V2,
    id: PZA.newId(o.name || 'Otomatik'),
    name: String(o.name || 'Otomatik').slice(0, 24),
    author: 'Otomatik',
    canvas: { w: 940, h: 430 },
    plate: o.plate,
    regions: JSON.parse(JSON.stringify(L.regions)),
    tokens: {
      '--fg': '#eef3fa', '--fg-dim': '#a9b8cc', '--fg-mute': '#6b7c93',
      '--accent': acc.hex, '--accent-strong': acc.hex,
      '--on-accent': koyu ? '#04121a' : '#ffffff',
      '--warn': '#ffb703', '--ok': '#34d399'
    },
    fontUI: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontNum: "'Cascadia Mono', 'Consolas', monospace"
  };
};

/* ── Düzenlenebilir token kataloğu ─────────────────────────
   Sıra, stüdyodaki grup sırasıdır. Yeni token eklemek için
   buraya bir satır yazmak yeter — motor gerisini kendisi yapar. */
PZA.TOKENS = [
  { k: '--bg-1',         n: 'Üst zemin',          g: 'Zemin' },
  { k: '--bg-2',         n: 'Alt zemin',          g: 'Zemin' },

  { k: '--surface-1',    n: 'Kutucuk / buton',    g: 'Yüzey' },
  { k: '--surface-2',    n: 'Üzerine gelince',    g: 'Yüzey' },
  { k: '--surface-3',    n: 'Sessiz buton',       g: 'Yüzey' },
  { k: '--surface-bar',  n: 'Şerit zemini',       g: 'Yüzey' },
  { k: '--surface-panel',n: 'Açılır panel',       g: 'Yüzey' },
  { k: '--surface-sunk', n: 'Girdi alanı',        g: 'Yüzey' },
  { k: '--surface-chip', n: 'Çip / rozet',        g: 'Yüzey' },

  { k: '--edge',         n: 'Dış kenar',          g: 'Çizgi' },
  { k: '--edge-soft',    n: 'İç kenar',           g: 'Çizgi' },
  { k: '--border-ctl',   n: 'Kontrol çerçevesi',  g: 'Çizgi' },
  { k: '--divider',      n: 'Ayırıcı',            g: 'Çizgi' },

  { k: '--fg',           n: 'Ana metin',          g: 'Metin' },
  { k: '--fg-dim',       n: 'İkincil metin',      g: 'Metin' },
  { k: '--fg-mute',      n: 'Sessiz metin',       g: 'Metin' },

  { k: '--accent',       n: 'Vurgu',              g: 'Vurgu' },
  { k: '--accent-strong',n: 'Güçlü vurgu',        g: 'Vurgu' },
  { k: '--on-accent',    n: 'Vurgu üstü yazı',    g: 'Vurgu' },

  { k: '--flip-1',       n: 'Kart üst',           g: 'Flip kartı' },
  { k: '--flip-2',       n: 'Kart orta',          g: 'Flip kartı' },
  { k: '--flip-3',       n: 'Kart alt',           g: 'Flip kartı' },
  { k: '--flip-border',  n: 'Kart kenarı',        g: 'Flip kartı' },
  { k: '--pin',          n: 'Pim',                g: 'Flip kartı' },

  { k: '--warn',         n: 'Uyarı',              g: 'Anlamsal' },
  { k: '--ok',           n: 'Olumlu',             g: 'Anlamsal' },
  { k: '--pop',          n: 'Ek bilgi (yağış)',   g: 'Anlamsal' }
];

PZA.TOKEN_GROUPS = ['Zemin', 'Yüzey', 'Çizgi', 'Metin', 'Vurgu', 'Flip kartı', 'Anlamsal'];

/* Kullanıcının seçmediği, renklerden türeyen token'lar */
PZA.DERIVED = [
  '--accent-soft', '--accent-glow', '--today-bg', '--alert-bg', '--shadow',
  '--flip-seam', '--flip-seam-lip', '--flip-inset', '--divider-soft', '--border-ctl-soft'
];

/* ── Font listeleri (Windows'ta hazır bulunanlar) ─────────── */
PZA.FONTS = {
  ui: [
    ["'Segoe UI', system-ui, sans-serif", 'Segoe UI'],
    ['Bahnschrift, sans-serif',           'Bahnschrift'],
    ["'Trebuchet MS', sans-serif",        'Trebuchet MS'],
    ['Verdana, sans-serif',               'Verdana'],
    ['Tahoma, sans-serif',                'Tahoma'],
    ['Georgia, serif',                    'Georgia'],
    ['Arial, sans-serif',                 'Arial']
  ],
  num: [
    ["'Cascadia Mono', Consolas, monospace", 'Cascadia Mono'],
    ['Consolas, monospace',                  'Consolas'],
    ["'Courier New', monospace",             'Courier New'],
    ["'Lucida Console', monospace",          'Lucida Console'],
    ['Bahnschrift, sans-serif',              'Bahnschrift'],
    ["'Segoe UI', system-ui, sans-serif",    'Segoe UI'],
    ['Georgia, serif',                       'Georgia'],
    ['Impact, sans-serif',                   'Impact']
  ]
};

/* ══ HTML KAÇIŞI ═══════════════════════════════════════════
   DİKKAT: Bu dosyalar IIFE değil, klasik script'tir — `function esc`
   gibi bir üst düzey tanım GLOBAL olur ve notes.js'teki `const esc`
   ile çakışıp o dosyayı tamamen çökertir. Ortak yardımcılar bu
   yüzden tek bir yerde, PZA üzerinde durur.

   Skin adı/yapanı dışarıdan (dostun gönderdiği dosyadan) gelir;
   innerHTML'e ham yazılırsa `<img src=x onerror=…>` çalışır. */
PZA.escHtml = function (v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/* ══ RENK ARAÇLARI ═════════════════════════════════════════ */

function hex2rgb(h) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || '').trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgb2hex(r, g, b) {
  const p = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}

/** Herhangi bir CSS rengini {hex, a} yapar. Anlamazsa null. */
PZA.parseColor = function (v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s === 'transparent') return { hex: '#000000', a: 0 };

  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) { const c = m[1]; return { hex: ('#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toLowerCase(), a: 1 }; }

  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return { hex: ('#' + m[1]).toLowerCase(), a: 1 };

  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i.exec(s);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { hex: rgb2hex(+m[1], +m[2], +m[3]), a: Math.max(0, Math.min(1, isNaN(a) ? 1 : a)) };
  }
  return null;
};

/** {hex, a} → CSS metni. a=1 ise sade hex (daha okunur). */
PZA.toCss = function (c) {
  if (!c) return null;
  if (c.a >= 1) return c.hex;
  const { r, g, b } = hex2rgb(c.hex);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.round(c.a * 1000) / 1000 + ')';
};

/** Göreli parlaklık (0 = siyah, 1 = beyaz) — WCAG formülü */
PZA.luminance = function (hex) {
  const { r, g, b } = hex2rgb(hex);
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/* ══ TÜRETME ═══════════════════════════════════════════════
   Kullanıcı 27 rengi seçer; gölge/dikiş/yarı saydam vurgular
   buradan çıkar. Zemin koyuluğu tek ölçüt: açık zeminde koyu
   gölge, koyu zeminde siyah gölge gerekir. */
PZA.derive = function (colors) {
  const acc = PZA.parseColor(colors['--accent']) || { hex: '#06b6d4', a: 1 };
  const bg  = PZA.parseColor(colors['--bg-1'])  || { hex: '#101722', a: 1 };
  const A = hex2rgb(acc.hex);
  const dark = PZA.luminance(bg.hex) < 0.45;
  const rgbA = a => 'rgba(' + A.r + ', ' + A.g + ', ' + A.b + ', ' + a + ')';

  const out = {
    '--accent-soft':   rgbA(dark ? '.50' : '.40'),
    '--accent-glow':   dark ? rgbA('.35') : rgbA('.15'),
    '--today-bg':      rgbA('.06'),
    '--alert-bg':      rgbA('.09'),
    '--shadow':        dark ? 'rgba(0, 0, 0, .80)'       : 'rgba(22, 32, 46, .18)',
    '--flip-seam':     dark ? 'rgba(0, 0, 0, .85)'       : 'rgba(148, 163, 184, .55)',
    '--flip-seam-lip': dark ? 'rgba(255, 255, 255, .12)' : 'rgba(255, 255, 255, .95)',
    '--flip-inset':    dark ? 'rgba(255, 255, 255, .25)' : 'rgba(255, 255, 255, .95)'
  };

  const div = PZA.parseColor(colors['--divider']);
  if (div) { const d = hex2rgb(div.hex); out['--divider-soft'] = 'rgba(' + d.r + ', ' + d.g + ', ' + d.b + ', ' + Math.round(div.a * 70) / 100 + ')'; }
  const bc = PZA.parseColor(colors['--border-ctl']);
  if (bc)  { const d = hex2rgb(bc.hex);  out['--border-ctl-soft'] = 'rgba(' + d.r + ', ' + d.g + ', ' + d.b + ', ' + Math.round(bc.a * 67) / 100 + ')'; }

  return out;
};

/* ══ DEPO ══════════════════════════════════════════════════ */

const SKEY = 'pza.skins.v1';

PZA.customSkins = function () {
  try {
    const raw = localStorage.getItem(SKEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) { console.warn('skin listesi okunamadı', e); return []; }
};

function persist(list) {
  try { localStorage.setItem(SKEY, JSON.stringify(list)); return true; }
  catch (e) { console.warn('skin yazılamadı', e); return false; }
}

PZA.skinById = function (id) {
  return PZA.customSkins().find(s => s.id === id) || null;
};

PZA.saveSkin = function (skin) {
  const list = PZA.customSkins();
  const i = list.findIndex(s => s.id === skin.id);
  skin.format = PZA.SKIN_FORMAT;
  skin.updated = Date.now();
  if (i < 0) list.push(skin); else list[i] = skin;
  return persist(list);
};

PZA.deleteSkin = function (id) {
  return persist(PZA.customSkins().filter(s => s.id !== id));
};

/** Türkçe karakterleri sadeleştirip benzersiz bir kimlik üretir */
PZA.newId = function (name) {
  const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'İ': 'i' };
  const slug = String(name || 'skin').toLowerCase()
    .replace(/[çğıöşüÇİ]/g, c => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'skin';
  const have = {}; PZA.customSkins().forEach(s => { have[s.id] = 1; });
  let id = slug, n = 2;
  while (have[id]) id = slug + '-' + (n++);
  return id;
};

/** Skin kartı için küçük renk şeridi */
PZA.skinSwatch = function (skin) {
  const d = (skin && skin.dark) || {};
  return 'linear-gradient(135deg,' + (d['--bg-1'] || '#101722') + ' 0%,' +
         (d['--accent'] || '#06b6d4') + ' 100%)';
};

/* ══ DOM'DAN OKUMA ═════════════════════════════════════════
   "Bu görünümden başla" için: satır içi stilleri geçici olarak
   kaldırıp stylesheet'teki gerçek paleti okur. */
PZA.readColorsFromDom = function () {
  const w = document.getElementById('widget');
  if (!w) return null;
  const saved = w.getAttribute('style');
  w.removeAttribute('style');                 // geçici: saf stylesheet değerleri
  const cs = getComputedStyle(w);             // okuma zorunlu stil hesabı tetikler
  const out = {};
  PZA.TOKENS.forEach(t => {
    const c = PZA.parseColor(cs.getPropertyValue(t.k));
    out[t.k] = c ? PZA.toCss(c) : '#000000';
  });
  if (saved !== null) w.setAttribute('style', saved);
  return out;
};

/* ══ UYGULAMA ══════════════════════════════════════════════ */

let preview = null;        // stüdyo taslağı (kaydedilmemiş)
let previewTheme = null;   // stüdyoda seçili palet

PZA.setPreview = function (skin) { preview = skin; PZA.applySkin(); };
PZA.setPreviewTheme = function (t) { previewTheme = t; PZA.applySkin(); };
PZA.clearPreview = function () { preview = null; previewTheme = null; };
PZA.activeTheme = function () { return previewTheme || PZA.settings.theme; };

/** Şu an geçerli olan kullanıcı skini (taslak varsa o) */
PZA.activeSkin = function () {
  if (preview) return preview;
  const s = String(PZA.settings.skin || '');
  if (s.indexOf('user:') === 0) return PZA.skinById(s.slice(5));
  if (PZA.PLATE_SKINS && PZA.PLATE_SKINS[s]) return PZA.PLATE_SKINS[s];  // gömülü pza-skin/2
  return null;
};

/** Aktif skin bir pza-skin/2 (plaka) ise {w,h}; değilse null. */
PZA.plateSize = function () {
  const sk = PZA.activeSkin();
  if (sk && (sk.format === PZA.SKIN_FORMAT_V2 || sk.format === PZA.SKIN_FORMAT_V3) && sk.canvas) return sk.canvas;
  return null;
};

/* pza-skin/2: bölge + düğme kalıntılarını temizle. */
PZA.plateTemizle = function () {
  // pza-skin/3 katman kabını kaldır
  const lay = (typeof document !== 'undefined') ? document.getElementById('plate-layers') : null;
  if (lay && lay.parentNode) lay.parentNode.removeChild(lay);
  const els = [];
  Object.keys(PZA.PLATE_MAP).forEach(k => { const el = PZA.q1(PZA.PLATE_MAP[k]); if (el) els.push(el); });
  if (typeof document !== 'undefined' && document.querySelectorAll) {
    document.querySelectorAll('.widget .flip').forEach(el => els.push(el));
  }
  els.forEach(el => {
    el.removeAttribute('data-plate');
    el.removeAttribute('data-plate-btn');
    el.removeAttribute('data-plate-baked');
    ['position', 'left', 'top', 'width', 'height', 'transform',
     'backgroundImage', 'backgroundRepeat', 'backgroundSize', 'backgroundPosition'
    ].forEach(p => el.style.removeProperty(p));
    ['--btn-n', '--btn-h', '--btn-p'].forEach(v => el.style.removeProperty(v));
  });
};

/* Bir öğeye düğme dilimi resmi uygula (normal/hover/pressed). */
PZA.dugmeResmi = function (el, b) {
  el.setAttribute('data-plate-btn', '1');
  if (b.label) el.setAttribute('data-plate-baked', '1');   // etiket dilime basılı → canlı yazı gizlenir
  el.style.setProperty('--btn-n', 'url("' + b.normal + '")');
  if (b.hover)   el.style.setProperty('--btn-h', 'url("' + b.hover + '")');
  if (b.pressed) el.style.setProperty('--btn-p', 'url("' + b.pressed + '")');
  el.style.backgroundImage = 'var(--btn-n)';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = '100% 100%';
  el.style.backgroundPosition = 'center';
};

/* pza-skin/3: atlas + parça + katman → .plate-layers içine sprite yerleştir.
   Winamp <layer image x y> karşılığı; tema filtresi gammagroup gibi çalışır. */
PZA.plateKatmanlari = function (w, skin) {
  const A = skin.atlas || {};
  const P = skin.parts || {};
  if (!A.image) return;
  let cont = document.getElementById('plate-layers');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'plate-layers';
    cont.className = 'plate-layers';
    w.insertBefore(cont, w.firstChild);
  }
  const filt = (skin.filters || {})[PZA.activeTheme()];   // gammagroup karşılığı
  cont.style.filter = (filt && filt !== 'none') ? filt : '';
  cont.innerHTML = '';
  (skin.layers || []).forEach(L => {
    const part = P[L.part]; if (!part) return;
    const d = document.createElement('div');
    d.className = 'plate-part';
    d.style.left = (L.x || 0) + 'px';
    d.style.top = (L.y || 0) + 'px';
    d.style.width = (L.w || part.w) + 'px';
    d.style.height = (L.h || part.h) + 'px';
    d.style.backgroundImage = 'url("' + A.image + '")';
    d.style.backgroundPosition = (-part.x) + 'px ' + (-part.y) + 'px';
    d.style.backgroundSize = (A.w || part.w) + 'px ' + (A.h || part.h) + 'px';
    if (L.alpha != null) d.style.opacity = L.alpha;
    cont.appendChild(d);
  });
};

/** pza-skin/2 (plaka) ve pza-skin/3 (atlas+parça+katman) uygula. */
PZA.applyPlate = function (skin) {
  const w = document.getElementById('widget');
  if (!w) return;
  const cv = skin.canvas || { w: 940, h: 430 };

  Object.keys(skin.tokens || {}).forEach(k => {
    const c = PZA.parseColor(skin.tokens[k]);
    if (c) w.style.setProperty(k, PZA.toCss(c));
  });
  if (skin.fontUI)  w.style.setProperty('--font-ui', skin.fontUI);
  if (skin.fontNum) w.style.setProperty('--font-num', skin.fontNum);

  w.dataset.skin = 'plaka';
  if (w.classList) w.classList.add('plaka');
  w.style.setProperty('--plate-w', cv.w + 'px');
  w.style.setProperty('--plate-h', cv.h + 'px');
  if (skin.format !== PZA.SKIN_FORMAT_V3)
    w.style.setProperty('--plate-img', 'url("' + skin.plate + '")');

  // Önce tüm bölge/düğme kalıntılarını temizle (skin değişiminde kalmasın)
  PZA.plateTemizle();
  // pza-skin/3: atlas + parça + katman + tema filtresi (gammagroup)
  if (skin.format === PZA.SKIN_FORMAT_V3) PZA.plateKatmanlari(w, skin);
  // Bölgeleri yerleştir (yüzde → pencere ölçeklenince orantı korunur)
  const R = skin.regions || {};
  Object.keys(R).forEach(k => {
    const sel = PZA.PLATE_MAP[k], r = R[k]; if (!sel || !r) return;
    const el = document.querySelector(sel); if (!el) return;
    el.setAttribute('data-plate', k);
    if (k === 'clock') return;                       // saat özel işlenir (aşağıda)
    el.style.position = 'absolute';
    el.style.left   = (r.x * 100 / cv.w) + '%';
    el.style.top    = (r.y * 100 / cv.h) + '%';
    el.style.width  = (r.w * 100 / cv.w) + '%';
    el.style.height = (r.h * 100 / cv.h) + '%';
  });

  /* SAAT: bölgeye SIĞDIRILIR. Flip kartları sabit ölçülü olduğundan
     kutuya sığmaz; merkezi bölge merkezine konur ve ölçekle oturtulur. */
  if (R.clock) {
    const el = PZA.q1(PZA.PLATE_MAP.clock);
    if (el) {
      const r = R.clock;
      el.style.position = 'absolute';
      el.style.left = ((r.x + r.w / 2) * 100 / cv.w) + '%';
      el.style.top  = ((r.y + r.h / 2) * 100 / cv.h) + '%';
      el.style.width = ''; el.style.height = '';
      const nw = el.offsetWidth || 1, nh = el.offsetHeight || 1;
      const s = Math.min(r.w / nw, r.h / nh) * 0.94;   // hafif iç boşluk
      el.style.transform = 'translate(-50%, -50%) scale(' + (Math.round(s * 1000) / 1000) + ')';
    }
  }

  /* DÜĞME DİLİMLERİ (Winamp "playbut" mantığı): normal/hover/basılı resim.
     Canlı metin/ikon üstte kalır; arka plan resimden gelir. */
  const B = skin.buttons || {};
  Object.keys(B).forEach(k => {
    if (k === 'flip') return;
    const sel = PZA.PLATE_MAP[k]; if (!sel || !B[k] || !B[k].normal) return;
    const el = PZA.q1(sel); if (el) PZA.dugmeResmi(el, B[k]);
  });
  if (B.flip && B.flip.normal && typeof document !== 'undefined' && document.querySelectorAll) {
    document.querySelectorAll('.widget.plaka .flip').forEach(el => PZA.dugmeResmi(el, B.flip));
  }

  PZA.emit('skin', skin);
};

/** Plaka modundan çık (yerleşik token skinine dönerken). */
PZA.clearPlate = function () {
  const w = document.getElementById('widget');
  if (!w) return;
  if (w.classList) w.classList.remove('plaka');
  if (w.removeAttribute) w.removeAttribute('data-tauri-drag-region');
  ['--plate-w', '--plate-h', '--plate-img'].forEach(k => w.style.removeProperty(k));
  PZA.plateTemizle();
};

PZA.applySkin = function () {
  const w = document.getElementById('widget');
  if (!w) return;

  // Önce temizle — yerleşik skine dönüldüğünde kalıntı kalmasın
  PZA.TOKENS.forEach(t => w.style.removeProperty(t.k));
  PZA.DERIVED.forEach(k => w.style.removeProperty(k));
  ['--radius', '--font-ui', '--font-num'].forEach(k => w.style.removeProperty(k));

  const bgEl = document.getElementById('skin-bg');
  const skin = PZA.activeSkin();

  /* pza-skin/2 — KATMAN+BÖLGE (plaka). */
  if (skin && skin.format === PZA.SKIN_FORMAT_V2) {
    if (bgEl) { bgEl.style.backgroundImage = 'none'; bgEl.hidden = true; }
    PZA.applyPlate(skin);
    return;
  }
  PZA.clearPlate();

  if (!skin) {
    w.dataset.skin = String(PZA.settings.skin || 'halo').replace(/^user:.*/, 'halo');
    if (bgEl) { bgEl.style.backgroundImage = 'none'; bgEl.hidden = true; }
    return;
  }

  w.dataset.skin = 'ozel';

  // Seçili tema paleti; eksik token'lar karanlıktan tamamlanır
  const dark = skin.dark || {};
  const alt  = PZA.activeTheme() === 'light' ? skin.light : null;
  const colors = Object.assign({}, dark, alt || {});

  Object.keys(colors).forEach(k => { if (colors[k]) w.style.setProperty(k, colors[k]); });

  const d = PZA.derive(colors);
  Object.keys(d).forEach(k => w.style.setProperty(k, d[k]));

  if (skin.radius != null) w.style.setProperty('--radius', skin.radius + 'px');
  if (skin.fontUI)  w.style.setProperty('--font-ui', skin.fontUI);
  if (skin.fontNum) w.style.setProperty('--font-num', skin.fontNum);

  if (bgEl) {
    const bg = skin.bg || {};
    if (bg.image) {
      bgEl.hidden = false;
      bgEl.style.backgroundImage = 'url("' + bg.image + '")';
      bgEl.style.opacity = bg.opacity != null ? bg.opacity : 0.35;
      bgEl.style.backgroundSize = bg.fit === 'contain' ? 'contain' : (bg.fit === 'tile' ? 'auto' : 'cover');
      bgEl.style.backgroundRepeat = bg.fit === 'tile' ? 'repeat' : 'no-repeat';
      bgEl.style.backgroundPosition = 'center';
    } else {
      bgEl.style.backgroundImage = 'none';
      bgEl.hidden = true;
    }
  }

  PZA.emit('skin', skin);
};

/* ══ PAYLAŞIM: DIŞA / İÇE ══════════════════════════════════ */

PZA.exportSkin = function (skin) {
  return JSON.stringify(skin, null, 2);
};

/** Metni doğrular ve temiz bir skin nesnesi döndürür.
    { ok:true, skin } ya da { ok:false, err } */
PZA.importSkin = function (text) {
  let o;
  try { o = JSON.parse(String(text).trim()); }
  catch (e) { return { ok: false, err: 'Bu geçerli bir JSON değil.' }; }

  if (!o || typeof o !== 'object' || Array.isArray(o))
    return { ok: false, err: 'İçerik bir skin nesnesi değil.' };

  if (o.format && [PZA.SKIN_FORMAT, PZA.SKIN_FORMAT_V2, PZA.SKIN_FORMAT_V3].indexOf(o.format) < 0)
    return { ok: false, err: 'Biçim uyuşmuyor: ' + o.format };

  const known = {}; PZA.TOKENS.forEach(t => { known[t.k] = 1; });

  const cleanSet = src => {
    const out = {};
    if (src && typeof src === 'object') {
      Object.keys(src).forEach(k => { if (known[k] && PZA.parseColor(src[k])) out[k] = PZA.toCss(PZA.parseColor(src[k])); });
    }
    return out;
  };

  /* Tanınan bölgeleri (x,y,w,h sayı, PLATE_MAP içinde) süz. */
  const cleanRegions = src => {
    const regions = {};
    if (src && typeof src === 'object') {
      Object.keys(PZA.PLATE_MAP).forEach(k => {
        const r = src[k];
        if (r && ['x', 'y', 'w', 'h'].every(p => typeof r[p] === 'number'))
          regions[k] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
      });
    }
    return regions;
  };

  /* pza-skin/3 — ATLAS + PARÇA + KATMAN + tema filtreleri (Winamp "modern"). */
  if (o.format === PZA.SKIN_FORMAT_V3) {
    if (!(o.atlas && typeof o.atlas.image === 'string' && /^data:image\/(webp|png|jpeg|gif|svg\+xml);/i.test(o.atlas.image)))
      return { ok: false, err: 'pza-skin/3 için "atlas.image" bir data:image olmalı.' };
    const aw = Math.round(o.atlas.w || 0), ah = Math.round(o.atlas.h || 0);
    if (aw < 100 || ah < 60) return { ok: false, err: 'Geçersiz atlas ölçüsü (en az 100×60).' };
    const cv = (o.canvas && typeof o.canvas.w === 'number' && typeof o.canvas.h === 'number')
      ? { w: Math.round(o.canvas.w), h: Math.round(o.canvas.h) } : null;
    if (!cv || cv.w < 100 || cv.h < 60) return { ok: false, err: 'Geçersiz "canvas" (en az 100×60).' };
    const parts = {};
    if (o.parts && typeof o.parts === 'object') Object.keys(o.parts).forEach(k => {
      const p = o.parts[k];
      if (p && ['x', 'y', 'w', 'h'].every(q => typeof p[q] === 'number'))
        parts[k] = { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h) };
    });
    if (!Object.keys(parts).length)
      return { ok: false, err: 'pza-skin/3 için en az bir "parts" parçası gerekli.' };
    const layers = (Array.isArray(o.layers) ? o.layers : []).filter(L => L && parts[L.part]).map(L => ({
      part: L.part, x: Math.round(L.x || 0), y: Math.round(L.y || 0),
      w: (L.w != null) ? Math.round(L.w) : parts[L.part].w,
      h: (L.h != null) ? Math.round(L.h) : parts[L.part].h,
      alpha: (typeof L.alpha === 'number') ? L.alpha : undefined
    }));
    if (!layers.length)
      return { ok: false, err: 'pza-skin/3 için en az bir "layers" katmanı gerekli.' };
    const regions = cleanRegions(o.regions);
    if (!Object.keys(regions).length)
      return { ok: false, err: 'Tanınan bölge yok (clock/date/weather/notes/theme/settings/ezan/pa).' };
    const buttons = {};
    if (o.buttons && typeof o.buttons === 'object') Object.keys(o.buttons).forEach(k => {
      const b = o.buttons[k];
      if (b && typeof b.normal === 'string' && /^data:image\//i.test(b.normal))
        buttons[k] = { normal: b.normal, hover: typeof b.hover === 'string' ? b.hover : '', pressed: typeof b.pressed === 'string' ? b.pressed : '' };
    });
    const filters = (o.filters && typeof o.filters === 'object')
      ? { dark: String(o.filters.dark || ''), light: String(o.filters.light || '') } : {};
    const ad3 = String(o.name || 'İsimsiz').slice(0, 24);
    return { ok: true, skin: {
      format: PZA.SKIN_FORMAT_V3,
      id: PZA.newId(ad3), name: ad3,
      author: String(o.author || '').slice(0, 24),
      canvas: cv,
      atlas: { image: o.atlas.image, w: aw, h: ah },
      parts: parts, layers: layers, regions: regions, buttons: buttons, filters: filters,
      tokens: cleanSet(o.tokens),
      fontUI: typeof o.fontUI === 'string' ? o.fontUI.slice(0, 120) : '',
      fontNum: typeof o.fontNum === 'string' ? o.fontNum.slice(0, 120) : ''
    } };
  }

  /* pza-skin/2 — KATMAN+BÖLGE: statik plaka + bölgeler + token'lar. */
  if (o.format === PZA.SKIN_FORMAT_V2) {
    if (typeof o.plate !== 'string' || !/^data:image\/(webp|png|jpeg|gif);/i.test(o.plate))
      return { ok: false, err: 'pza-skin/2 için "plate" bir data:image (webp/png) olmalı.' };
    const cv = (o.canvas && typeof o.canvas.w === 'number' && typeof o.canvas.h === 'number')
      ? { w: Math.round(o.canvas.w), h: Math.round(o.canvas.h) } : null;
    if (!cv || cv.w < 100 || cv.h < 60) return { ok: false, err: 'Geçersiz "canvas" (en az 100×60).' };
    const regions = {};
    if (o.regions && typeof o.regions === 'object') {
      Object.keys(PZA.PLATE_MAP).forEach(k => {
        const r = o.regions[k];
        if (r && ['x', 'y', 'w', 'h'].every(p => typeof r[p] === 'number'))
          regions[k] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
      });
    }
    if (!Object.keys(regions).length)
      return { ok: false, err: 'Tanınan bölge yok (clock/date/weather/notes/theme/settings/ezan/pa).' };
    const ad2 = String(o.name || 'İsimsiz').slice(0, 24);
    return { ok: true, skin: {
      format: PZA.SKIN_FORMAT_V2,
      id: PZA.newId(ad2), name: ad2,
      author: String(o.author || '').slice(0, 24),
      canvas: cv, plate: o.plate, regions, tokens: cleanSet(o.tokens),
      fontUI: typeof o.fontUI === 'string' ? o.fontUI.slice(0, 120) : '',
      fontNum: typeof o.fontNum === 'string' ? o.fontNum.slice(0, 120) : ''
    } };
  }

  const dark = cleanSet(o.dark);
  if (!Object.keys(dark).length)
    return { ok: false, err: 'Tanınan renk bulunamadı ("dark" bölümü boş).' };

  const light = cleanSet(o.light);
  const bg = (o.bg && typeof o.bg.image === 'string' && /^data:image\//.test(o.bg.image)) ? {
    image: o.bg.image,
    opacity: typeof o.bg.opacity === 'number' ? Math.max(0, Math.min(1, o.bg.opacity)) : 0.35,
    fit: ['cover', 'contain', 'tile'].indexOf(o.bg.fit) >= 0 ? o.bg.fit : 'cover'
  } : null;

  const name = String(o.name || 'İsimsiz').slice(0, 24);

  return {
    ok: true,
    skin: {
      format: PZA.SKIN_FORMAT,
      id: PZA.newId(name),
      name: name,
      author: String(o.author || '').slice(0, 24),
      dark: dark,
      light: Object.keys(light).length ? light : null,
      bg: bg,
      radius: (typeof o.radius === 'number' && o.radius >= 0 && o.radius <= 40) ? Math.round(o.radius) : 16,
      fontUI: typeof o.fontUI === 'string' ? o.fontUI.slice(0, 120) : '',
      fontNum: typeof o.fontNum === 'string' ? o.fontNum.slice(0, 120) : ''
    }
  };
};

PZA.downloadSkin = function (skin) {
  try {
    const blob = new Blob([PZA.exportSkin(skin)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (skin.id || 'skin') + '.pzaskin.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { console.warn(e); return false; }
};

/** Panoya kopyala — Tauri/WebView2'de clipboard API'si olmayabilir */
PZA.copyText = function (text) {
  return new Promise(resolve => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => resolve(true), () => resolve(fallback(text)));
    } else resolve(fallback(text));
  });
  function fallback(t) {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;top:-1000px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
};

/* ══ GÖRSEL İŞLEME ═════════════════════════════════════════
   Görsel data URI olarak localStorage'a gömülür. Ham bir telefon
   fotoğrafı kotayı aşar; bu yüzden küçültüp sıkıştırıyoruz.
   Şeffaflık gerekiyorsa PNG, fotoğrafta JPEG kullanılır. */
PZA.readImage = function (file, cb) {
  if (!file || !/^image\//.test(file.type)) { cb('Bir görsel dosyası seçin.'); return; }

  const fr = new FileReader();
  fr.onerror = () => cb('Dosya okunamadı.');
  fr.onload = () => {
    const img = new Image();
    img.onerror = () => cb('Görsel açılamadı.');
    img.onload = () => {
      const keepAlpha = /png|webp|gif|svg/i.test(file.type);
      const LIMIT = 700 * 1024;                 // ~700 KB data URI

      const render = maxW => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (!keepAlpha) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
        g.drawImage(img, 0, 0, w, h);
        return c;
      };

      let out = null;
      try {
        const c1 = render(1920);
        out = keepAlpha ? c1.toDataURL('image/png') : c1.toDataURL('image/jpeg', 0.82);
        if (out.length > LIMIT) out = c1.toDataURL('image/jpeg', 0.66);
        if (out.length > LIMIT) out = render(1280).toDataURL('image/jpeg', 0.72);
        if (out.length > LIMIT) out = render(900).toDataURL('image/jpeg', 0.7);
      } catch (e) {
        cb('Görsel işlenemedi (dosya bozuk olabilir).');
        return;
      }
      if (out.length > LIMIT * 1.6) { cb('Görsel hâlâ çok büyük — daha küçük bir dosya seçin.'); return; }
      cb(null, out);
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
};
