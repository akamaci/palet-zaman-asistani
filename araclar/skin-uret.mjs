/* skin-uret.mjs — "Gündüz" görünümü üreteci (pza-skin/3).
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim

   Kullanıcı (2026-10-17): "gözle görünür FARKLI bir skin yap; öncesinde test et."
   Neden farklı: (1) AÇIK/light tema (diğerleri koyuydu), (2) FARKLI KOMPOZİSYON
   (büyük saat ÜSTTE, altında kart sırası) — sadece renk değil, iskelet de değişik.
   Üretir: src/js/skins-builtin.js  ·  Çalıştır: node araclar/skin-uret.mjs */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CW = 940, CH = 430, AH = CH + 40;
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const svgUri = s => 'data:image/svg+xml;base64,' + b64(s);

/* FARKLI KOMPOZİSYON: saat üstte büyük; hava/notlar/tema/ayarlar alt sırada. */
const REGIONS = {
  date:     { x: 350, y: 22,  w: 240, h: 22  },
  clock:    { x: 210, y: 52,  w: 520, h: 168 },
  weather:  { x: 40,  y: 248, w: 270, h: 144 },
  notes:    { x: 335, y: 248, w: 270, h: 144 },
  theme:    { x: 630, y: 248, w: 270, h: 66  },
  settings: { x: 630, y: 322, w: 270, h: 70  },
  ezan:     { x: 862, y: 26,  w: 48,  h: 30  },
  pa:       { x: 862, y: 62,  w: 48,  h: 26  }
};
const P = { bg: '#f4efe6', card: '#ffffff', line: '#e4dccf', ink: '#2a2622', dim: '#6b625a', accent: '#ff6b3d', on: '#ffffff' };

const card = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${P.card}" stroke="${P.line}"/>`;
function atlas() {
  let cards = '';
  for (const k of Object.keys(REGIONS)) {
    if (k === 'ezan' || k === 'pa') continue;
    const r = REGIONS[k];
    cards += card(r.x - 6, r.y - 6, r.w + 12, r.h + 12, k === 'clock' ? 22 : 16);
  }
  let dots = '';
  for (let x = 26; x < CW - 26; x += 26) for (let y = 24; y < CH - 24; y += 26) dots += `<circle cx="${x}" cy="${y}" r="1" fill="${P.line}"/>`;
  const led = (cx, op) => `<circle cx="${cx}" cy="${CH + 22}" r="6" fill="${P.accent}" fill-opacity="${op}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${AH}" viewBox="0 0 ${CW} ${AH}">
  <rect x="6" y="6" width="${CW - 12}" height="${CH - 12}" rx="26" fill="${P.bg}" stroke="${P.line}"/>
  ${dots}
  ${cards}
  <rect x="230" y="232" width="480" height="5" rx="2.5" fill="${P.accent}"/>
  ${led(12, 0.3)}${led(32, 0.65)}${led(52, 1)}
</svg>`;
}
function buttons() {
  const out = {};
  for (const k of Object.keys(REGIONS)) {
    if (k === 'clock' || k === 'date') continue;
    const r = REGIONS[k], rad = Math.min(14, (r.h - 3) / 2);
    const st = m => {
      const pressed = m === 'pressed', hov = m === 'hover';
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="0 0 ${r.w} ${r.h}">
      <rect x="1.5" y="1.5" width="${r.w - 3}" height="${r.h - 3}" rx="${rad}" fill="${P.accent}" fill-opacity="${pressed ? 0.30 : hov ? 0.15 : 0}" stroke="${P.line}" stroke-opacity="${pressed ? 0.25 : 1}"/></svg>`);
    };
    out[k] = { normal: st('normal'), hover: st('hover'), pressed: st('pressed') };
  }
  return out;
}
function skin() {
  return {
    format: 'pza-skin/3', id: 'gunduz', name: 'Gündüz', author: 'Paletweb',
    canvas: { w: CW, h: CH },
    atlas: { image: svgUri(atlas()), w: CW, h: AH },
    parts: { body: { x: 0, y: 0, w: CW, h: CH }, led0: { x: 6, y: CH + 16, w: 12, h: 12 }, led1: { x: 26, y: CH + 16, w: 12, h: 12 }, led2: { x: 46, y: CH + 16, w: 12, h: 12 } },
    layers: [{ part: 'body', x: 0, y: 0, w: CW, h: CH }, { frames: ['led0', 'led1', 'led2'], fps: 1.4, x: 748, y: 30, w: 12, h: 12 }],
    regions: REGIONS,
    buttons: buttons(),
    filters: { dark: 'none', light: 'none' },
    colorthemes: [
      { id: 'mercan',  name: 'Mercan',  filter: 'none', accent: '#ff6b3d' },
      { id: 'okyanus', name: 'Okyanus', filter: 'hue-rotate(180deg) saturate(1.1)', accent: '#2f8fd6' },
      { id: 'orman',   name: 'Orman',   filter: 'hue-rotate(100deg) saturate(1.05)', accent: '#33a35a' }
    ],
    tokens: {
      '--fg': P.ink, '--fg-dim': P.dim, '--fg-mute': '#9a9086',
      '--accent': P.accent, '--accent-strong': P.accent, '--on-accent': P.on,
      '--warn': '#e0902a', '--ok': '#2f9e5a',
      '--flip-1': '#ffffff', '--flip-2': '#ffffff', '--flip-3': '#ffffff', '--flip-border': P.line, '--pin': P.accent
    },
    fontUI: "'Segoe UI', system-ui, sans-serif", fontNum: "'Cascadia Mono', Consolas, monospace"
  };
}
const header = `/* skins-builtin.js — gömülü plaka (pza-skin) skinleri.
   OTOMATİK üretilir: araclar/skin-uret.mjs -> buraya. */
window.PZA = window.PZA || {};
PZA.PLATE_SKINS = `;
const body = JSON.stringify({ gunduz: skin() }, null, 1);
fs.writeFileSync(path.join(root, 'src', 'js', 'skins-builtin.js'), header + body + ';\n', 'utf8');
console.log('yazıldı: src/js/skins-builtin.js');
