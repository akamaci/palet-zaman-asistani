/* bar-mode-testi.mjs — BAR (çubuk) modu davranışı · Palet Zaman Asistanı
   KULLANICI (2026-10-19, 4. tur): "yaptığımız en stabil sürüm bunu notlara
   ilave etmeli; yalnızca Aurora çubuk çalışmıyor ama menü 1/2 1/3 1/4
   çalışıyor."

   KÖK NEDEN (v1.36.7'a kadar): bar modunda PLAKA yerleşimi hâlâ
   uygulanıyordu → `.widget.plaka` (940×320'lik tuval) widget'ı 800×272'ye
   sabitliyor, `position: relative` ile `[data-size="bar"]`ın `fixed`ini
   eziyor, `.bar-top` `display: contents` kalıyordu. Kullanıcıya ince
   çubuk YERİNE 272px'lik plaka dilimi gösteriliyordu.

   Bu test GERÇEK `skins.js` kodunu sahte DOM'da çalıştırır (kopya
   DEĞİL) → bozulursa test düşer. CSS düzeyindeki eşleme
   `gorsel-dogrula.mjs` (BAR sözleşmesi) içinde.

   Çalıştırma: node araclar/bar-mode-testi.mjs */
import { sahteDomKur, betikleriYukle } from './sahte-dom.mjs';

let iyi = 0, kotu = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const x = m => { kotu++; console.log('  X    ' + m); };

console.log('\n═══ BAR (çubuk) modu — plaka skini barı KULLANMAZ ═══\n');

const ortam = sahteDomKur({ hazir: 'complete' });   // 'complete': sayfa hazırken
const yukleme = betikleriYukle(ortam);
for (const s of yukleme) {
  if (s.hata) x('yüklenirken HATA: ' + s.dosya + ' → ' +
    (s.hata && s.hata.message ? s.hata.message : String(s.hata)));
}
if (!ortam.pencere.PZA) { x('PZA tanımsız — test yarıda'); process.exit(1); }

const PZA = ortam.pencere.PZA;
const w = ortam.belge.getElementById('widget');
const B = '38e8c8';   // Aurora aksanı (skins-builtin.js)

/* ── BAR + plaka skini (Aurora, pza-skin/3) ────────────────────────── */
PZA.settings.skin = 'aurora';
PZA.settings.size = 'bar';
PZA.applySkin();

if (!w.classList.contains('plaka')) ok('bar: widget\'a `plaka` sınıfı EKLENMİYOR (çubuk düzeni korunur)');
else x('bar: widget `plaka` sınıfı taşıyor → 800×272 plaka dilimi çizilir ("çubuk çalışmıyor")');

if (PZA.plateSize() === null) ok('bar: plateSize() NULL dönüyor (plaka YOK → fitBar ince çubuk ölçer)');
else x('bar: plateSize() ' + JSON.stringify(PZA.plateSize()) + ' dönüyor → çubuk plaka yüksekliğine çıkar');

const plateW = w.style.getPropertyValue('--plate-w') || '';
if (plateW === '') ok('bar: `--plate-w` temiz (tuval ölçüsü sabitlenmiyor)');
else x('bar: `--plate-w` = ' + plateW + ' (widget plaka ölçüsüne sabitleniyor)');

const kokPlaka = (ortam.belge.documentElement.style.getPropertyValue('--plaka-h') || '');
if (kokPlaka === '') ok('bar: kökte `--plaka-h` temiz (kaplama menü plakayı örtmez)');
else x('bar: kökte `--plaka-h` = ' + kokPlaka + ' (menü yanlış yerden başlar)');

if ((w.style.getPropertyValue('--accent') || '').toLowerCase().endsWith(B))
  ok('bar: Aurora RENK token\'ı uygulanıyor (--accent #' + B + ')');
else x('bar: Aurora renkleri uygulanmıyor (çubuk varsayılan skine döner)');

if (w.style.getPropertyValue('--flip-1')) ok('bar: flip kart rengi uygulanıyor (skin görünür kalır)');
else x('bar: flip kart rengi yok (skin sadece plakada çiziliyor)');

if (w.dataset.skin === 'plaka') ok('bar: `data-skin="plaka"` korunur (Ayarlar listesi doğru)');
else x('bar: data-skin="' + w.dataset.skin + '" (skin adı eşleşmiyor)');

/* ── BAR + klasik (tokens) skini — daha önce de çalışıyordu, kırılmasın ─ */
PZA.settings.skin = 'klasik';
PZA.applySkin();
if (!w.classList.contains('plaka')) ok('bar + klasik: `plaka` sınıfı yok (normal ince çubuk)');
else x('bar + klasik: plaka sınıfı taşıyor (beklenmeyen dönüşüm)');
if (PZA.plateSize() === null) ok('bar + klasik: plateSize() NULL (değişmedi)');
else x('bar + klasik: plateSize() null değil');

/* ── Gerçek boyutlar (1/2, 1/3, 1/4) — plaka devreye giriyor ───────── */
const SONUC = { '2': 800, '3': 700, '4': 430 };
for (const b of Object.keys(SONUC)) {
  PZA.settings.skin = 'aurora';
  PZA.settings.size = b;
  PZA.applySkin();
  const ps = PZA.plateSize();
  const beklenen = SONUC[b];
  if (w.classList.contains('plaka')) ok('boyut ' + b + ': `plaka` sınıfı var (plaka çizilir)');
  else x('boyut ' + b + ': `plaka` sınıfı YOK → plaka çizilemez');
  if (ps && ps.w === beklenen) ok('boyut ' + b + ': plateSize() = ' + ps.w + '×' + ps.h + ' (doğru)');
  else x('boyut ' + b + ': plateSize() = ' + (ps ? ps.w + '×' + ps.h : 'null') + ' → beklenen ' + beklenen);
}

/* ── Boyut değişimi 2 ↔ bar: plaka sınıfı/gizkenler TEMİZLENİYOR mu? ─ */
PZA.settings.size = '2'; PZA.applySkin();
const onceVar = w.classList.contains('plaka');
PZA.settings.size = 'bar'; PZA.applySkin();
const sonraTemiz = !w.classList.contains('plaka') && !(w.style.getPropertyValue('--plate-w') || '');
PZA.settings.size = '4'; PZA.applySkin();
const geriVar = w.classList.contains('plaka') && !!PZA.plateSize();
if (onceVar && sonraTemiz) ok('2 → bar: plaka sınıfı/değişkenleri temizleniyor (iki yanda sızıntı yok)');
else x('2 → bar: kalıntı var (sınıf=' + onceVar + ' temiz=' + sonraTemiz + ')');
if (geriVar) ok('bar → 4: plaka GERİ yükleniyor (eski boyut da çalışıyor)');
else x('bar → 4: plaka yüklenemiyor (geçiş kırık)');

/* ── `fitBar` penceresi ölçüsü (app.js) — bar yüksekliği PLAKA'dan değil */
/* Gerçek kaynak blok: kapasitesi `Math.max(46, gerekliH())` olmalı. */
import fs from 'fs';
import path from 'path';
const KOK = path.join(import.meta.dirname, '..') + path.sep;
const app = fs.readFileSync(KOK + path.join('src', 'js', 'app.js'), 'utf8');
const barH = /H = acik \? Math\.max\(46, gerekliH\(\)\) : 15;/.test(app);
if (barH) ok('app.js: fitBar bar yüksekliği = max(46, gerekliH()) (plaka payı YOK)');
else x('app.js: fitBar bar yüksekliği gerekliH()\'den FARKLI ölçüyor (plaka çarpması olabilir)');

console.log('\n  Sonuç: ' + iyi + ' OK, ' + kotu + ' hata\n');
process.exit(kotu ? 1 : 0);
