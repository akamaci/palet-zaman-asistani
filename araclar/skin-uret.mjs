/* skin-uret.mjs — "Aurora" görünümü üreteci (pza-skin/3).
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim

   Kullanıcı: "istediğim skin tasarımı nerede? bana YENİ bir görünüm yap."
   → Sıfırdan YENİ bir tasarım dili: koyu uzay zemini üzerinde BLUR'lu AURORA
   (kutup ışığı) bulutları + BUZLU CAM (glassmorphism) kartlar + neon accent.
   Kompozisyon da yeni: saat TAM GENİŞLİK üst panel, altında 4 cam kart.
   Üretir: src/js/skins-builtin.js  ·  Çalıştır: node araclar/skin-uret.mjs */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CW = 940, CH = 430, AH = CH + 40;
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const svgUri = s => 'data:image/svg+xml;base64,' + b64(s);

const REGIONS = {
  date:     { x: 40,  y: 20,  w: 760, h: 22  },
  clock:    { x: 40,  y: 50,  w: 760, h: 164 },
  ezan:     { x: 866, y: 20,  w: 50,  h: 30  },
  pa:       { x: 866, y: 54,  w: 50,  h: 26  },
  weather:  { x: 40,  y: 236, w: 272, h: 160 },
  notes:    { x: 324, y: 236, w: 272, h: 160 },
  theme:    { x: 608, y: 236, w: 296, h: 76  },
  settings: { x: 608, y: 318, w: 296, h: 78  }
};
const A = { c1: '#2ee6c8', c2: '#8b5cf6', c3: '#ff5ea8', ink: '#eaefff', dim: '#a7b0d8', accent: '#38e8c8' };

function glass(x, y, w, h, r) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff" fill-opacity="0.055" stroke="#ffffff" stroke-opacity="0.16"/>
  <path d="M${x + r} ${y + 1} H${x + w - r}" stroke="#ffffff" stroke-opacity="0.28"/>`;
}
function atlas() {
  let cards = '';
  for (const k of Object.keys(REGIONS)) {
    if (k === 'ezan' || k === 'pa') continue;
    const r = REGIONS[k];
    cards += glass(r.x - 6, r.y - 6, r.w + 12, r.h + 12, k === 'clock' ? 24 : 18);
  }
  let stars = '';
  for (let i = 0; i < 70; i++) {
    const x = (i * 137) % CW, y = (i * 79) % CH;
    stars += `<circle cx="${x}" cy="${y}" r="${(i % 3) ? 0.8 : 1.4}" fill="#ffffff" fill-opacity="0.20"/>`;
  }
  const led = (cx, op) => `<circle cx="${cx}" cy="${CH + 22}" r="6" fill="${A.accent}" fill-opacity="${op}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${AH}" viewBox="0 0 ${CW} ${AH}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0f1f"/><stop offset="1" stop-color="#131a34"/>
    </linearGradient>
    <filter id="blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="58"/></filter>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${A.c1}"/><stop offset="0.5" stop-color="${A.c2}"/><stop offset="1" stop-color="${A.c3}"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="${CW - 12}" height="${CH - 12}" rx="28" fill="url(#sky)" stroke="#ffffff" stroke-opacity="0.10"/>
  <g filter="url(#blur)">
    <ellipse cx="240" cy="40" rx="330" ry="150" fill="${A.c1}" fill-opacity="0.55"/>
    <ellipse cx="720" cy="30" rx="300" ry="140" fill="${A.c2}" fill-opacity="0.50"/>
    <ellipse cx="470" cy="330" rx="380" ry="170" fill="${A.c3}" fill-opacity="0.26"/>
  </g>
  <rect x="6" y="6" width="${CW - 12}" height="${CH - 12}" rx="28" fill="#060a16" fill-opacity="0.42"/>
  ${stars}
  ${cards}
  <rect x="60" y="224" width="720" height="4" rx="2" fill="url(#line)"/>
  ${led(12, 0.3)}${led(32, 0.65)}${led(52, 1)}
</svg>`;
}
function buttons() {
  const out = {};
  for (const k of Object.keys(REGIONS)) {
    if (k === 'clock' || k === 'date') continue;
    const r = REGIONS[k], rad = Math.min(16, (r.h - 3) / 2);
    const st = m => {
      const pressed = m === 'pressed', hov = m === 'hover';
      const fo = pressed ? 0.26 : hov ? 0.16 : 0.05;
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="0 0 ${r.w} ${r.h}">
      <rect x="1.5" y="1.5" width="${r.w - 3}" height="${r.h - 3}" rx="${rad}" fill="${A.accent}" fill-opacity="${fo}" stroke="#ffffff" stroke-opacity="${pressed ? 0.4 : hov ? 0.5 : 0.18}"/>
      <path d="M${1.5 + rad} ${2.2} H${r.w - 1.5 - rad}" stroke="#ffffff" stroke-opacity="${hov ? 0.45 : 0.25}"/></svg>`);
    };
    out[k] = { normal: st('normal'), hover: st('hover'), pressed: st('pressed') };
  }
  return out;
}
function skin() {
  return {
    format: 'pza-skin/3', id: 'aurora', name: 'Aurora', author: 'Paletweb',
    canvas: { w: CW, h: CH },
    atlas: { image: svgUri(atlas()), w: CW, h: AH },
    parts: { body: { x: 0, y: 0, w: CW, h: CH }, led0: { x: 6, y: CH + 16, w: 12, h: 12 }, led1: { x: 26, y: CH + 16, w: 12, h: 12 }, led2: { x: 46, y: CH + 16, w: 12, h: 12 } },
    layers: [{ part: 'body', x: 0, y: 0, w: CW, h: CH }, { frames: ['led0', 'led1', 'led2'], fps: 1.4, x: 812, y: 30, w: 12, h: 12 }],
    regions: REGIONS,
    buttons: buttons(),
    filters: { dark: 'none', light: 'none' },
    colorthemes: [
      { id: 'aurora', name: 'Aurora', filter: 'none', accent: '#38e8c8' },
      { id: 'neon',   name: 'Neon',   filter: 'hue-rotate(250deg) saturate(1.3)', accent: '#ff5ea8' },
      { id: 'buz',    name: 'Buz',    filter: 'hue-rotate(60deg) saturate(1.1)', accent: '#5aa0ff' }
    ],
    tokens: {
      '--fg': A.ink, '--fg-dim': A.dim, '--fg-mute': '#7784ad',
      '--accent': A.accent, '--accent-strong': A.accent, '--on-accent': '#04121a',
      '--warn': '#ffd166', '--ok': '#4be08a',
      '--flip-1': '#0e1730', '--flip-2': '#0b1226', '--flip-3': '#0e1730', '--flip-border': '#243056', '--pin': A.accent
    },
    fontUI: "'Segoe UI', system-ui, sans-serif", fontNum: "'Cascadia Mono', Consolas, monospace"
  };
}
const header = `/* skins-builtin.js — gömülü plaka (pza-skin) skinleri.
   OTOMATİK üretilir: araclar/skin-uret.mjs -> buraya. */
window.PZA = window.PZA || {};
PZA.PLATE_SKINS = `;
const body = JSON.stringify({ aurora: skin() }, null, 1);
fs.writeFileSync(path.join(root, 'src', 'js', 'skins-builtin.js'), header + body + ';\n', 'utf8');
console.log('yazıldı: src/js/skins-builtin.js');
