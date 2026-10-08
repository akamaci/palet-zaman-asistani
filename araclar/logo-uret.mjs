/* logo-uret.mjs — yer tutucu uygulama ikonu üretir
   Palet Zaman Asistanı · GPL-3.0
   ──────────────────────────────────────────────────────────
   Çalıştır:  node araclar/logo-uret.mjs
   Çıktı:     assets/logo.png  (1024×1024, şeffaf köşeli)

   Neden elle PNG: proje sıfır bağımlılıkla çalışıyor ve derleme
   için bir ikon şart (tauri.conf.json icons/* bekliyor). Bu, gerçek
   logonun YER TUTUCUSUDUR — kendi logonuzu assets/logo.png olarak
   koyup `npm run icon` çalıştırın.

   PNG kodlayıcı: yalnız Node çekirdeği (zlib). 2× çizip küçültür,
   böylece kenarlar yumuşak çıkar. */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'logo.png');
const SIZE = 1024;      // nihai boyut
const SS = 2;           // süper örnekleme
const R = SIZE * SS;

/* ── Renkler (uygulamanın karanlık paleti) ──────────────── */
const BG_TOP = [0x16, 0x20, 0x2e];
const BG_BOT = [0x0a, 0x0f, 0x16];
const CARD_TOP = [0x22, 0xd3, 0xee];
const CARD_BOT = [0x08, 0x91, 0xb2];
const DARK = [0x0a, 0x0f, 0x16];

const mix = (a, b, t) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/** Nokta, yuvarlatılmış dikdörtgenin içinde mi? */
function inRound(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/* ── Geometri (R biriminde) ─────────────────────────────── */
const PAD = R * 0.02;                        // kenarda nefes payı
const SHELL = { x0: PAD, y0: PAD, x1: R - PAD, y1: R - PAD, r: R * 0.175 };

const CW = R * 0.54, CH = R * 0.40;          // kart
const CX = R / 2, CY = R / 2;
const CARD = { x0: CX - CW / 2, y0: CY - CH / 2, x1: CX + CW / 2, y1: CY + CH / 2, r: R * 0.105 };

const SEAM = R * 0.020;                      // dikiş kalınlığı
const PIN_R = R * 0.017;

/* ── Çiz ────────────────────────────────────────────────── */
const buf = new Uint8Array(R * R * 4);

for (let y = 0; y < R; y++) {
  for (let x = 0; x < R; x++) {
    const px = x + 0.5, py = y + 0.5;
    let col = null;

    // 1) Gövde: yuvarlatılmış kare, dikey degrade
    if (inRound(px, py, SHELL.x0, SHELL.y0, SHELL.x1, SHELL.y1, SHELL.r)) {
      col = mix(BG_TOP, BG_BOT, clamp01((py - SHELL.y0) / (SHELL.y1 - SHELL.y0)));
    }

    // 2) Flip kartı
    if (inRound(px, py, CARD.x0, CARD.y0, CARD.x1, CARD.y1, CARD.r)) {
      col = mix(CARD_TOP, CARD_BOT, clamp01((py - CARD.y0) / (CARD.y1 - CARD.y0)));

      // Dikiş: kartı ikiye bölen koyu bant + altına ince ışık çizgisi
      const d = Math.abs(py - CY);
      if (d < SEAM / 2) col = DARK;
      else if (d < SEAM / 2 + R * 0.004) col = mix(col, [0xff, 0xff, 0xff], 0.35);

      // Pimler: sol ve sağ kenarda küçük koyu daireler
      if (inCircle(px, py, CARD.x0 + R * 0.075, CY, PIN_R) ||
          inCircle(px, py, CARD.x1 - R * 0.075, CY, PIN_R)) col = DARK;
    }

    const o = (y * R + x) * 4;
    if (col) { buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = 255; }
    // değilse şeffaf kalır (köşeler)
  }
}

/* ── 2×2 kutu filtresiyle küçült (kenar yumuşatma) ──────── */
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) {
      for (let dx = 0; dx < SS; dx++) {
        const o = ((y * SS + dy) * R + (x * SS + dx)) * 4;
        const al = buf[o + 3] / 255;
        r += buf[o] * al; g += buf[o + 1] * al; b += buf[o + 2] * al; a += buf[o + 3];
      }
    }
    const n = SS * SS, aAvg = a / n;
    const o = (y * SIZE + x) * 4;
    if (aAvg > 0) {                       // ön çarpılmış alfa → düz renk
      const w = a / 255;
      out[o] = Math.round(r / w); out[o + 1] = Math.round(g / w); out[o + 2] = Math.round(b / w);
    }
    out[o + 3] = Math.round(aAvg);
  }
}

/* ── Minimal PNG kodlayıcı ──────────────────────────────── */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return b => { let c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bit, RGBA

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;                                          // filtre: none
  out.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log('  yazıldı: ' + OUT);
console.log('  ' + SIZE + '×' + SIZE + ' · ' + (png.length / 1024).toFixed(1) + ' KB');
console.log('  Bu bir YER TUTUCUDUR — gerçek logonuzu assets/logo.png yapıp `npm run icon` çalıştırın.');
