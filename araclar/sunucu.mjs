/* sunucu.mjs — arayüz önizlemesi için minik statik sunucu
   Palet Zaman Asistanı · GPL-3.0
   ──────────────────────────────────────────────────────────
   Neden gerekli: `file://` ile açılan sayfada tarayıcılar
   localStorage'ı çoğu zaman engeller (SecurityError). O zaman
   ayarlar ve kullanıcı skinleri kaydedilmez — stüdyo çalışıyor
   görünür ama hiçbir şey saklanmaz. http://localhost üzerinden
   açınca sorun kalmaz.

   Çalıştır:  npm run web
   Bağımlılık yok — yalnız Node çekirdek modülleri. */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  // Dizin dışına çıkma denemesi (../../) — kökün içinde kal
  const file = path.resolve(root, '.' + rel);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end('403');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı: ' + rel); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'          // geliştirmede eski dosya kalmasın
    }).end(buf);
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' dolu. Başka port deneyin:  set PORT=5174 && npm run web\n');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + PORT + '/';
  console.log('\n  Palet Zaman Asistanı — tarayıcı önizlemesi');
  console.log('  ' + url);
  console.log('  (Tauri komutları çalışmaz: Google Takvim, otomatik başlatma, pencere boyutu)');
  console.log('  Kapatmak için Ctrl+C\n');
  // Varsayılan tarayıcıda aç
  execFile('cmd', ['/c', 'start', '', url], () => {});
});
