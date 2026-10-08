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
  return s.indexOf('user:') === 0 ? PZA.skinById(s.slice(5)) : null;
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

  if (o.format && o.format !== PZA.SKIN_FORMAT)
    return { ok: false, err: 'Biçim uyuşmuyor: ' + o.format };

  const known = {}; PZA.TOKENS.forEach(t => { known[t.k] = 1; });

  const cleanSet = src => {
    const out = {};
    if (src && typeof src === 'object') {
      Object.keys(src).forEach(k => { if (known[k] && PZA.parseColor(src[k])) out[k] = PZA.toCss(PZA.parseColor(src[k])); });
    }
    return out;
  };

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
