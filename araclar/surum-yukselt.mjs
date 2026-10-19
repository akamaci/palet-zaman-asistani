/* surum-yukselt.mjs — sürümü 4 dosyada BOM'suz günceller
   (PowerShell Set-Content UTF8 BOM ekliyor ve JSON'u bozuyordu) */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const yeni = process.argv[2];
if (!yeni) { console.error('kullanım: node araclar/surum-yukselt.mjs 1.36.2'); process.exit(1); }

const eski = process.argv[3] || '1.36.1';

const dosyalar = [
  'package.json',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.toml',
  'src/js/settings.js',
];

for (const d of dosyalar) {
  const y = join(kok, d);
  const ic = readFileSync(y, 'utf8').replace(/^\uFEFF/, '');
  const yeniIc = ic.replaceAll(eski, yeni);
  writeFileSync(y, yeniIc, 'utf8');       // BOMSUZ
  const n = (ic.match(new RegExp(eski.replace(/\./g, '\\.'), 'g')) || []).length;
  console.log(`  ${d}: ${n} değiştirildi`);
}

// Cargo.lock: paket bloğunda hedefli
const cl = join(kok, 'src-tauri/Cargo.lock');
const cli = readFileSync(cl, 'utf8');
const yeniCl = cli.replace(
  new RegExp(`(name = "palet-zaman-asistani"\\r?\\nversion = ")${eski.replace(/\./g, '\\.')}`),
  `$1${yeni}`
);
writeFileSync(cl, yeniCl, 'utf8');
console.log('  src-tauri/Cargo.lock: paket sürümü güncellendi');