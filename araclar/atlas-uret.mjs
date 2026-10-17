/* atlas-uret.mjs — pza-skin/3 ("atlas + parça + katman") örnek skin üreteci.
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim

   Winamp "modern" (Wasabi/freeform) skin mantığının Web karşılığını üretir:
     • ATLAS  : tek görsel (burada SVG — hafif, çözünürlükten bağımsız).
     • PARÇA  : atlas içindeki dikdörtgenler (sprite) — <bitmap id x y w h>.
     • KATMAN : parçalardan kompozisyon (z: alttan üste) — <layer image x y>.
     • FİLTRE : tema başına renk dönüşümü — gammagroup karşılığı.
     • DÜĞME  : normal/hover/basılı GERÇEK durum görselleri (parlaklık taklidi DEĞİL);
                gömülü yazı YOK (canlı <text> üstte kalır — çift yazı olmaz).

   Çıktı: src/js/skins-builtin.js  (PZA.PLATE_SKINS = { ... })

   Kullanım:  node araclar/atlas-uret.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CW = 940, CH = 430;                 // kanvas (pencere) ölçüsü
const AH = CH + 40;                       // atlas yüksekliği (animasyon kareleri için alt pay)

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const svgUri = s => 'data:image/svg+xml;base64,' + b64(s);

/* ── Kanvas (şasi) SVG'i ────────────────────────────────────────────
   Yalnız DEKOR: gövde, çerçeve, pod zeminleri, köşe kelepçeleri, ızgara.
   Dinamik yazı (saat/tarih/derece) YOK. */
function bodySvg(accent) {
  const A = accent;
  const pod = (x, y, w, h, r = 12) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${A}" fill-opacity="0.05" stroke="${A}" stroke-opacity="0.35"/>`;
  const bracket = (x, y, sx, sy) =>
    `<path d="M${x} ${y + sy * 22} L${x} ${y} L${x + sx * 22} ${y}" fill="none" stroke="${A}" stroke-opacity="0.85" stroke-width="2"/>`;
  // Animasyon kareleri (Winamp AnimatedLayer): parlaklığı artan 3 LED
  const led = (cx, op) =>
    `<circle cx="${cx}" cy="${CH + 22}" r="6" fill="${A}" fill-opacity="${op}"/>`;

  let grid = '';
  for (let gx = 40; gx < CW - 40; gx += 40)
    grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${CH}" stroke="${A}" stroke-opacity="0.04"/>`;
  for (let gy = 40; gy < CH - 40; gy += 40)
    grid += `<line x1="0" y1="${gy}" x2="${CW}" y2="${gy}" stroke="${A}" stroke-opacity="0.04"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${AH}" viewBox="0 0 ${CW} ${AH}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1526"/>
      <stop offset="1" stop-color="#05080f"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${CW}" height="${CH}" rx="18" fill="url(#bg)"/>
  <rect x="1" y="1" width="${CW - 2}" height="${CH - 2}" rx="17" fill="none" stroke="${A}" stroke-opacity="0.55" stroke-width="2"/>
  <rect x="7" y="7" width="${CW - 14}" height="${CH - 14}" rx="13" fill="none" stroke="${A}" stroke-opacity="0.18"/>
  ${grid}
  ${pod(256, 144, 428, 122, 14)}          <!-- saat pod'u -->
  ${pod(36, 109, 202, 126, 12)}           <!-- hava -->
  ${pod(702, 136, 202, 66, 12)}           <!-- günün notları -->
  ${pod(702, 218, 202, 56, 12)}           <!-- tema -->
  ${pod(36, 251, 202, 50, 12)}            <!-- ayarlar -->
  <path d="M40 30 H200" stroke="${A}" stroke-opacity="0.5"/>
  ${bracket(16, 16, 1, 1)}${bracket(CW - 16, 16, -1, 1)}
  ${bracket(16, CH - 16, 1, -1)}${bracket(CW - 16, CH - 16, -1, -1)}
  <text x="470" y="70" fill="${A}" fill-opacity="0.5" font-family="monospace" font-size="12" text-anchor="middle" letter-spacing="6">SYS // ONLINE</text>
  ${led(12, 0.25)}${led(32, 0.6)}${led(52, 1)}
</svg>`;
}

/* ── Düğme durum SVG'i (normal/hover/basılı) — gerçek art, gömülü yazı YOK. */
function btnSvg(w, h, accent, state) {
  const a = state === 'hover' ? 0.9 : state === 'pressed' ? 0.55 : 0.65;
  const fill = state === 'pressed' ? accent : '#0c1a2e';
  const fo = state === 'normal' ? 0.10 : state === 'hover' ? 0.20 : 0.30;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="9" fill="${fill}" fill-opacity="${fo}" stroke="${accent}" stroke-opacity="${a}"/>
</svg>`);
}

const REGIONS = {
  clock:    { x: 256, y: 144, w: 428, h: 122 },
  date:     { x: 383, y: 32,  w: 174, h: 24  },
  weather:  { x: 36,  y: 109, w: 202, h: 126 },
  notes:    { x: 702, y: 136, w: 202, h: 66  },
  theme:    { x: 702, y: 218, w: 202, h: 56  },
  settings: { x: 36,  y: 251, w: 202, h: 50  },
  ezan:     { x: 817, y: 366, w: 36,  h: 32  },
  pa:       { x: 865, y: 369, w: 39,  h: 26  }
};

/* Her düğme bölgesi için 3 GERÇEK durum görseli. */
function buttonsFor(accent) {
  const out = {};
  for (const k of ['settings', 'notes', 'theme', 'weather']) {
    const r = REGIONS[k];
    out[k] = { normal: btnSvg(r.w, r.h, accent, 'normal'), hover: btnSvg(r.w, r.h, accent, 'hover'), pressed: btnSvg(r.w, r.h, accent, 'pressed') };
  }
  out.ezan = { normal: btnSvg(REGIONS.ezan.w, REGIONS.ezan.h, accent, 'normal'), hover: btnSvg(REGIONS.ezan.w, REGIONS.ezan.h, accent, 'hover'), pressed: btnSvg(REGIONS.ezan.w, REGIONS.ezan.h, accent, 'pressed') };
  out.pa   = { normal: btnSvg(REGIONS.pa.w, REGIONS.pa.h, accent, 'normal'), hover: btnSvg(REGIONS.pa.w, REGIONS.pa.h, accent, 'hover'), pressed: btnSvg(REGIONS.pa.w, REGIONS.pa.h, accent, 'pressed') };
  return out;
}

function skin(id, name, accent, filters) {
  const atlas = bodySvg(accent);
  return {
    format: 'pza-skin/3',
    id, name, author: 'Paletweb',
    canvas: { w: CW, h: CH },
    atlas: { image: svgUri(atlas), w: CW, h: AH },
    parts: {
      body: { x: 0, y: 0, w: CW, h: CH },
      led0: { x: 6,  y: CH + 16, w: 12, h: 12 },
      led1: { x: 26, y: CH + 16, w: 12, h: 12 },
      led2: { x: 46, y: CH + 16, w: 12, h: 12 }
    },
    layers: [
      { part: 'body', x: 0, y: 0, w: CW, h: CH },
      { frames: ['led0', 'led1', 'led2'], fps: 2, x: 906, y: 22, w: 12, h: 12 }   // AnimatedLayer
    ],
    regions: JSON.parse(JSON.stringify(REGIONS)),
    buttons: buttonsFor(accent),
    filters,                                  // { dark, light } → CSS filter (gammagroup)
    tokens: {
      '--fg': '#e6f7ff', '--fg-dim': '#8fb0c7', '--fg-mute': '#5a7c96',
      '--accent': accent, '--accent-strong': accent, '--on-accent': '#04121a',
      '--warn': '#ffb703', '--ok': '#34d399'
    },
    fontUI: "'Segoe UI', system-ui, sans-serif",
    fontNum: "'Cascadia Mono', 'Consolas', monospace"
  };
}

const cyan = skin('nebula', 'Nebula (Cyan)', '#00f0ff', { dark: 'none', light: 'invert(.9) hue-rotate(180deg) saturate(1.15)' });
const amber = skin('nebula-amber', 'Nebula (Amber)', '#ffb703', { dark: 'hue-rotate(150deg) saturate(1.35) brightness(1.05)', light: 'invert(.9) hue-rotate(30deg) saturate(1.2)' });

/* Winamp "ColorThemes"/gammagroup karşılığı: aynı atlas, farklı renk ön ayarları.
   (Yalnız `nebula` skini çok temalıdır; `nebula-amber` tek filtreyle gelir.) */
cyan.colorthemes = [
  { id: 'cyan',   name: 'Cyan',   filter: 'none',                                               accent: '#00f0ff' },
  { id: 'amber',  name: 'Amber',  filter: 'hue-rotate(-140deg) saturate(1.35) brightness(1.05)', accent: '#ffb703' },
  { id: 'violet', name: 'Violet', filter: 'hue-rotate(90deg) saturate(1.25)',                    accent: '#b57bff' },
  { id: 'mono',   name: 'Mono',   filter: 'grayscale(1) brightness(1.15)',                       accent: '#cbd5e1' }
];

/* ── İLK TASARIMLARI YENİDEN KURGULA (v2 → v3, "yeni bilgilere göre") ─────────
   Eski `pza-skin/2` tasarımlarını (Orbital HUD · Halo Uzay) yalnız taşımakla
   kalma; v3 kurallarıyla YENİDEN kur:
     • Taban plaka → atlasın `body` parçası (DEKOR; gömülü yazı YOK).
     • Eski gömülü-etiketli düğme dilimleri ATILIR → yerine gömülü yazısız
       GERÇEK durum katmanları (normal=şeffaf, hover/pressed=parıltı). Etiket
       artık CANLI `<text>` — dil/tema ile uyumlu (çift yazı olmaz).
     • gammagroup karşılığı `colorthemes` + `filters`.
     • AnimatedLayer: atlasın alt payında yanıp sönen LED.
   Taban plaka (özel WebP) atlas içine SVG `<image>` ile gömülür. */
const KURGU = {
  'orbital-hud': {
    accent: '#00f0ff',
    themes: [
      { id: 'cyan',   name: 'Cyan',   filter: 'none',                                              accent: '#00f0ff' },
      { id: 'amber',  name: 'Amber',  filter: 'hue-rotate(-140deg) saturate(1.35) brightness(1.05)', accent: '#ffb703' },
      { id: 'violet', name: 'Violet', filter: 'hue-rotate(90deg) saturate(1.25)',                    accent: '#b57bff' }
    ]
  },
  'halo-hud': {
    accent: '#7aa2ff',
    themes: [
      { id: 'blue',  name: 'Blue',  filter: 'none',                                       accent: '#7aa2ff' },
      { id: 'cyan',  name: 'Cyan',  filter: 'hue-rotate(-30deg) saturate(1.15)',           accent: '#00f0ff' },
      { id: 'amber', name: 'Amber', filter: 'hue-rotate(120deg) saturate(1.25) brightness(1.05)', accent: '#ffb703' },
      { id: 'mono',  name: 'Mono',  filter: 'grayscale(1) brightness(1.1)',                 accent: '#cbd5e1' }
    ]
  }
};

function kurgu(o, key) {
  const cfg = KURGU[key] || { accent: '#00f0ff', themes: [] };
  const cw = o.canvas.w, ch = o.canvas.h, AH = ch + 40;
  const led = (cx, op) => `<circle cx="${cx}" cy="${ch + 22}" r="6" fill="${cfg.accent}" fill-opacity="${op}"/>`;
  // atlas = gövde görseli (SVG <image>) + LED kareleri
  const atlas = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${AH}" viewBox="0 0 ${cw} ${AH}">
  <image href="${o.plate}" x="0" y="0" width="${cw}" height="${ch}"/>
  ${led(12, 0.25)}${led(32, 0.6)}${led(52, 1)}
</svg>`);
  // gerçek düğme durumları — gömülü YAZI YOK, NÖTR parıltı (renk temasından bağımsız)
  const btns = {};
  Object.keys(o.regions || {}).forEach(k => {
    if (k === 'clock' || k === 'date') return;
    const r = o.regions[k];
    const st = (fo, a) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="0 0 ${r.w} ${r.h}"><rect x="1" y="1" width="${Math.max(0, r.w - 2)}" height="${Math.max(0, r.h - 2)}" rx="9" fill="#ffffff" fill-opacity="${fo}" stroke="#ffffff" stroke-opacity="${a}"/></svg>`);
    btns[k] = { normal: st(0, 0), hover: st(0.12, 0.5), pressed: st(0.22, 0.85) };
  });
  return {
    format: 'pza-skin/3',
    id: key,
    name: o.name,
    author: o.author || 'Paletweb',
    canvas: { w: cw, h: ch },
    atlas: { image: atlas, w: cw, h: AH },
    parts: {
      body: { x: 0, y: 0, w: cw, h: ch },
      led0: { x: 6,  y: ch + 16, w: 12, h: 12 },
      led1: { x: 26, y: ch + 16, w: 12, h: 12 },
      led2: { x: 46, y: ch + 16, w: 12, h: 12 }
    },
    layers: [
      { part: 'body', x: 0, y: 0, w: cw, h: ch },
      { frames: ['led0', 'led1', 'led2'], fps: 2, x: cw - 48, y: 14, w: 12, h: 12 }   // AnimatedLayer
    ],
    regions: o.regions,
    buttons: btns,
    filters: { dark: 'none', light: 'invert(.9) hue-rotate(180deg) saturate(1.15)' },
    colorthemes: cfg.themes,
    tokens: Object.assign({}, o.tokens, { '--accent': cfg.accent, '--accent-strong': cfg.accent }),
    fontUI: o.fontUI || '', fontNum: o.fontNum || ''
  };
}

const ekSkins = {};
const ornekDir = path.join(root, 'araclar', 'ornek-skinler');
if (fs.existsSync(ornekDir)) {
  for (const f of fs.readdirSync(ornekDir).filter(n => n.endsWith('.pzaskin.json'))) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(ornekDir, f), 'utf8'));
      if (o.format === 'pza-skin/2' && o.plate && o.canvas) ekSkins[o.id] = kurgu(o, o.id);
    } catch (e) { console.warn('ornek skin okunamadi: ' + f + ' - ' + e.message); }
  }
}

/* ── WINAMP GÖRÜNÜMLERİ (klasik · modern · bento) ─────────────────────────────
   Kullanıcı (2026-10-17): "Winamp klasik / modern / bento görsellerine BENZER
   tasarımlar istiyorum." Klasik Winamp estetiği: METALİK KABARTMA çerçeve +
   GÖMME (sunken) LCD alanlar + KABARTMA düğmeler. Doku: BMP değil SVG (hafif).
   Tüm bölgeler LCD (koyu) → canlı yazı açık renk (okunur). */
const WINAMP_PALETTES = {
  'winamp-klasik': {
    name: 'Winamp Klasik',
    metal1: '#ececec', metal2: '#c9c9c9', metal3: '#9b9b9b', dark: '#6a6a6a', light: '#ffffff',
    title: '#00007a', lcd1: '#0a1016', lcd2: '#06121f', accent: '#26ff9c',
    text: '#c9ffe2', dim: '#7fbf9f', on: '#04160c', flip: '#0a1016'
  },
  'winamp-modern': {
    name: 'Winamp Modern',
    metal1: '#9aa3b0', metal2: '#6f7887', metal3: '#48505c', dark: '#2a303a', light: '#d4dbe6',
    title: '#123a63', lcd1: '#0a1522', lcd2: '#061423', accent: '#49b7ff',
    text: '#d7ecff', dim: '#8fb2cf', on: '#04121f', flip: '#0a1522'
  },
  'bento': {
    name: 'Bento',
    metal1: '#41474d', metal2: '#2c3136', metal3: '#1b1f22', dark: '#0d0f11', light: '#6a737d',
    title: '#23282c', lcd1: '#111417', lcd2: '#0c0f12', accent: '#ff8c00',
    text: '#ffe6cc', dim: '#c79a6b', on: '#1a0f04', flip: '#111417'
  }
};

function wled(cx, op, p) { return `<circle cx="${cx}" cy="${CH + 22}" r="6" fill="${p.accent}" fill-opacity="${op}"/>`; }
function sunkenWell(x, y, w, h, p, clock) {
  let g = '';
  if (clock) {
    for (let gx = x + 16; gx < x + w - 8; gx += 22) g += `<line x1="${gx}" y1="${y + 4}" x2="${gx}" y2="${y + h - 4}" stroke="${p.accent}" stroke-opacity="0.05"/>`;
    for (let gy = y + 16; gy < y + h - 8; gy += 22) g += `<line x1="${x + 4}" y1="${gy}" x2="${x + w - 4}" y2="${gy}" stroke="${p.accent}" stroke-opacity="0.05"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${p.lcd1}" stroke="${p.dark}"/>
  <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="5" fill="${clock ? p.lcd2 : 'none'}" fill-opacity="${clock ? 1 : 0}"/>
  <path d="M${x + 6} ${y + 1.5} H${x + w - 6}" stroke="${p.dark}"/>
  <path d="M${x + 1.5} ${y + 6} V${y + h - 6}" stroke="${p.dark}"/>
  <path d="M${x + 6} ${y + h - 1.5} H${x + w - 6}" stroke="${p.light}" stroke-opacity="0.22"/>
  <path d="M${x + w - 1.5} ${y + 6} V${y + h - 6}" stroke="${p.light}" stroke-opacity="0.22"/>
  ${g}`;
}
function winampAtlas(p) {
  let wells = '';
  for (const k of Object.keys(REGIONS)) {
    const r = REGIONS[k];
    wells += sunkenWell(r.x - 5, r.y - 5, r.w + 10, r.h + 10, p, k === 'clock');
  }
  const titleBar = `<rect x="8" y="7" width="${CW - 16}" height="19" rx="3" fill="${p.title}" stroke="${p.dark}"/>
  <rect x="8" y="7" width="${CW - 16}" height="9" rx="3" fill="#ffffff" fill-opacity="0.10"/>`;
  const screws = [[15, CH - 15], [CW - 15, CH - 15], [15, 15], [CW - 15, 15]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${p.metal2}" stroke="${p.dark}"/><path d="M${x - 2.4} ${y - 1.6} L${x + 2.4} ${y + 1.6}" stroke="${p.light}" stroke-opacity="0.6"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${AH}" viewBox="0 0 ${CW} ${AH}">
  <defs>
    <linearGradient id="cmp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.metal1}"/><stop offset="0.46" stop-color="${p.metal2}"/>
      <stop offset="0.54" stop-color="${p.metal2}"/><stop offset="1" stop-color="${p.metal3}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${CW - 1}" height="${CH - 1}" rx="10" fill="url(#cmp)" stroke="${p.dark}"/>
  <rect x="1.5" y="1.5" width="${CW - 3}" height="${CH - 3}" rx="9" fill="none" stroke="${p.light}" stroke-opacity="0.7"/>
  <rect x="3.5" y="3.5" width="${CW - 7}" height="${CH - 7}" rx="8" fill="none" stroke="${p.dark}" stroke-opacity="0.5"/>
  ${wells}${titleBar}${screws}
  ${wled(12, 0.3, p)}${wled(32, 0.65, p)}${wled(52, 1, p)}
</svg>`;
}
function winampButtons(p) {
  const out = {};
  for (const k of Object.keys(REGIONS)) {
    if (k === 'clock' || k === 'date') continue;
    const r = REGIONS[k];
    const st = mode => {
      const light = mode === 'pressed' ? p.dark : p.light;
      const dark = mode === 'pressed' ? p.light : p.dark;
      const fo = mode === 'hover' ? 0.20 : 0;
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="0 0 ${r.w} ${r.h}">
      <rect x="1.5" y="1.5" width="${r.w - 3}" height="${r.h - 3}" rx="5" fill="${p.accent}" fill-opacity="${fo}" stroke="${dark}"/>
      <path d="M${6} ${2} H${r.w - 6}" stroke="${light}" stroke-opacity="0.75"/>
      <path d="M${2} ${6} V${r.h - 6}" stroke="${light}" stroke-opacity="0.75"/>
      <path d="M${6} ${r.h - 2} H${r.w - 6}" stroke="${dark}"/>
      <path d="M${r.w - 2} ${6} V${r.h - 6}" stroke="${dark}"/></svg>`);
    };
    out[k] = { normal: st('normal'), hover: st('hover'), pressed: st('pressed') };
  }
  return out;
}
function winampSkin(key, p) {
  return {
    format: 'pza-skin/3', id: key, name: p.name, author: 'Paletweb',
    canvas: { w: CW, h: CH },
    atlas: { image: svgUri(winampAtlas(p)), w: CW, h: AH },
    parts: {
      body: { x: 0, y: 0, w: CW, h: CH },
      led0: { x: 6, y: CH + 16, w: 12, h: 12 }, led1: { x: 26, y: CH + 16, w: 12, h: 12 }, led2: { x: 46, y: CH + 16, w: 12, h: 12 }
    },
    layers: [
      { part: 'body', x: 0, y: 0, w: CW, h: CH },
      { frames: ['led0', 'led1', 'led2'], fps: 1.5, x: CW - 48, y: 12, w: 12, h: 12 }
    ],
    regions: JSON.parse(JSON.stringify(REGIONS)),
    buttons: winampButtons(p),
    filters: { dark: 'none', light: 'none' },
    tokens: {
      '--fg': p.text, '--fg-dim': p.dim, '--fg-mute': p.dim,
      '--accent': p.accent, '--accent-strong': p.accent, '--on-accent': p.on,
      '--warn': '#ffd75e', '--ok': '#57e08a',
      '--flip-1': p.flip, '--flip-2': p.flip, '--flip-3': p.flip, '--flip-border': p.dark, '--pin': p.accent
    },
    fontUI: "'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif",
    fontNum: "'Consolas', 'Lucida Console', monospace"
  };
}
const winampSkins = {};
for (const k of Object.keys(WINAMP_PALETTES)) winampSkins[k] = winampSkin(k, WINAMP_PALETTES[k]);

/* ── AQUA / GEL görünümü (futuristik, camsı) ─────────────────────────────────
   Kullanıcı (2026-10-17): "futuristik, camsı/gel (aqua) bir skin." Yuvarlak
   JEL gövde + cam parıltısı (gloss) + iç tech deseni + GÖMME cam paneller +
   JEL düğmeler. Köşeler SAYDAM → pencere arkası görünür (organik biçim). */
function gelWell(x, y, w, h, clock) {
  let g = '';
  if (clock) {
    for (let gx = x + 18; gx < x + w - 8; gx += 24) g += `<line x1="${gx}" y1="${y + 6}" x2="${gx}" y2="${y + h - 6}" stroke="#8fe9ff" stroke-opacity="0.05"/>`;
    for (let gy = y + 18; gy < y + h - 8; gy += 24) g += `<line x1="${x + 6}" y1="${gy}" x2="${x + w - 6}" y2="${gy}" stroke="#8fe9ff" stroke-opacity="0.05"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(28, h / 2)}" fill="url(#gelwell)" stroke="#0a3550"/>
  <path d="M${x + 12} ${y + 1.6} H${x + w - 12}" stroke="#7fd0f5" stroke-opacity="0.35"/>
  <path d="M${x + 1.6} ${y + 12} V${y + h - 12}" stroke="#7fd0f5" stroke-opacity="0.22"/>
  <path d="M${x + 12} ${y + h - 1.6} H${x + w - 12}" stroke="#02121a"/>
  ${g}`;
}
function gelButtons() {
  const out = {};
  for (const k of Object.keys(REGIONS)) {
    if (k === 'clock' || k === 'date') continue;
    const r = REGIONS[k], rad = Math.min(18, (r.h - 3) / 2);
    const st = mode => {
      const pressed = mode === 'pressed', fo = mode === 'hover' ? 0.28 : 0;
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="0 0 ${r.w} ${r.h}">
      <rect x="1.5" y="1.5" width="${r.w - 3}" height="${r.h - 3}" rx="${rad}" fill="#0a2c40" fill-opacity="${pressed ? 0.9 : 0.5}" stroke="#8fe9ff" stroke-opacity="${pressed ? 0.5 : 0.8}"/>
      <rect x="3" y="2.5" width="${r.w - 6}" height="${(r.h - 6) / 2}" rx="${Math.max(6, rad - 4)}" fill="#ffffff" fill-opacity="${pressed ? 0.06 : 0.20}"/>
      <rect x="1.5" y="1.5" width="${r.w - 3}" height="${r.h - 3}" rx="${rad}" fill="#ffffff" fill-opacity="${fo}"/></svg>`);
    };
    out[k] = { normal: st('normal'), hover: st('hover'), pressed: st('pressed') };
  }
  return out;
}
function gelAtlas() {
  const r = 54;
  let swirl = '';
  for (let i = 0; i < 5; i++) swirl += `<circle cx="${CW * 0.42}" cy="${CH * 0.5}" r="${120 + i * 70}" fill="none" stroke="#ffffff" stroke-opacity="0.05"/>`;
  let wells = '';
  for (const k of Object.keys(REGIONS)) { const rr = REGIONS[k]; wells += gelWell(rr.x - 6, rr.y - 6, rr.w + 12, rr.h + 12, k === 'clock'); }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${AH}" viewBox="0 0 ${CW} ${AH}">
  <defs>
    <linearGradient id="gel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="0.45" stop-color="#a7d7f4"/><stop offset="1" stop-color="#4f93cf"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.12" r="0.95"><stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="gelwell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08283c"/><stop offset="1" stop-color="#04161f"/></linearGradient>
  </defs>
  <rect x="10" y="10" width="${CW - 20}" height="${CH - 20}" rx="${r}" fill="url(#gel)" stroke="#2c6ba3" stroke-width="3"/>
  <rect x="10" y="10" width="${CW - 20}" height="${CH - 20}" rx="${r}" fill="url(#glow)"/>
  <rect x="16" y="16" width="${CW - 32}" height="${CH - 32}" rx="${r - 6}" fill="none" stroke="#ffffff" stroke-opacity="0.45"/>
  ${swirl}${wells}
  <circle cx="12" cy="${CH + 22}" r="6" fill="#8fe9ff" fill-opacity="0.3"/>
  <circle cx="32" cy="${CH + 22}" r="6" fill="#8fe9ff" fill-opacity="0.65"/>
  <circle cx="52" cy="${CH + 22}" r="6" fill="#8fe9ff"/>
</svg>`;
}
function gelSkin() {
  return {
    format: 'pza-skin/3', id: 'aqua', name: 'Aqua (Gel)', author: 'Paletweb',
    canvas: { w: CW, h: CH },
    atlas: { image: svgUri(gelAtlas()), w: CW, h: AH },
    parts: { body: { x: 0, y: 0, w: CW, h: CH }, led0: { x: 6, y: CH + 16, w: 12, h: 12 }, led1: { x: 26, y: CH + 16, w: 12, h: 12 }, led2: { x: 46, y: CH + 16, w: 12, h: 12 } },
    layers: [{ part: 'body', x: 0, y: 0, w: CW, h: CH }, { frames: ['led0', 'led1', 'led2'], fps: 1.6, x: CW - 50, y: 16, w: 12, h: 12 }],
    regions: JSON.parse(JSON.stringify(REGIONS)),
    buttons: gelButtons(),
    filters: { dark: 'none', light: 'none' },
    tokens: { '--fg': '#e6f8ff', '--fg-dim': '#9dc6dd', '--fg-mute': '#7fa6bd', '--accent': '#8fe9ff', '--accent-strong': '#8fe9ff', '--on-accent': '#062430', '--warn': '#ffd75e', '--ok': '#5ce0a8', '--flip-1': '#072232', '--flip-2': '#072232', '--flip-3': '#072232', '--flip-border': '#0a3550', '--pin': '#8fe9ff' },
    fontUI: "'Segoe UI', system-ui, sans-serif", fontNum: "'Consolas', monospace"
  };
}
const gelSkins = { aqua: gelSkin() };

const header = `/* skins-builtin.js — gömülü plaka (pza-skin) skinleri.
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim
   OTOMATİK üretilir: araclar/atlas-uret.mjs -> .pzaskin.json -> buraya.
   Biçim + ajan tarifi: repo kökü SKIN-TARIFI.md
   Eski orbital/halo-hud (pza-skin/2) KALDIRILDI (git tarihinde). */
window.PZA = window.PZA || {};
PZA.PLATE_SKINS = `;

const body = JSON.stringify(Object.assign({ nebula: cyan, 'nebula-amber': amber }, ekSkins, winampSkins, gelSkins), null, 1);

fs.writeFileSync(path.join(root, 'src', 'js', 'skins-builtin.js'), header + body + ';\n', 'utf8');
console.log('yazıldı: src/js/skins-builtin.js (' + (header.length + body.length) + ' bayt)');
