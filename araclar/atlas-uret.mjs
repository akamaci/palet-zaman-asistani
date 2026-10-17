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

  let grid = '';
  for (let gx = 40; gx < CW - 40; gx += 40)
    grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${CH}" stroke="${A}" stroke-opacity="0.04"/>`;
  for (let gy = 40; gy < CH - 40; gy += 40)
    grid += `<line x1="0" y1="${gy}" x2="${CW}" y2="${gy}" stroke="${A}" stroke-opacity="0.04"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
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
    atlas: { image: svgUri(atlas), w: CW, h: CH },
    parts: { body: { x: 0, y: 0, w: CW, h: CH } },
    layers: [{ part: 'body', x: 0, y: 0, w: CW, h: CH }],
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

const header = `/* skins-builtin.js — gömülü plaka (pza-skin) skinleri.
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim
   OTOMATİK üretilir: araclar/atlas-uret.mjs -> .pzaskin.json -> buraya.
   Biçim + ajan tarifi: repo kökü SKIN-TARIFI.md
   Eski orbital/halo-hud (pza-skin/2) KALDIRILDI (git tarihinde). */
window.PZA = window.PZA || {};
PZA.PLATE_SKINS = `;

const body = JSON.stringify({ nebula: cyan, 'nebula-amber': amber }, null, 1);

fs.writeFileSync(path.join(root, 'src', 'js', 'skins-builtin.js'), header + body + ';\n', 'utf8');
console.log('yazıldı: src/js/skins-builtin.js (' + (header.length + body.length) + ' bayt)');
