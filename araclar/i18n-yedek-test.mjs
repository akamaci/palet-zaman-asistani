/* araclar/i18n-yedek-test.mjs
   Palet Zaman Asistanı · GPL-3.0

   Kullanıcı bildirimi (2026-10-19, v1.36.4):
     "güncelleme menüsü açılmıyor" — ve kutuda "pa_baslik", "pa_kurulu",
     "pa_kapat" gibi HAM ANAHTARLAR görünüyordu.

   KÖK NEDEN: paket içindeki `lang/*.txt` dosyası `fetch('lang/tr.txt')` ile
   okunuyor; `tauri.conf.json` → `app.security.csp` içinde `connect-src`
   listesinde `'self'` YOKTU. Bu yüzden aynı-köken fetch CSP tarafından
   engelleniyor, GitHub yedeği de başarısız olunca sözlük BOŞ kalıyordu.
   `i18n.uygula()` da anahtar bulunamayınca `t(anahtar, null)` çağırıp
   elemana HAM ANAHTARI yazıyordu.

   Bu test iki şeyi kilitler:
     1) Sözlük boşken arayüzde ham anahtar GÖRÜNMEZ (HTML yedek metni kalır).
     2) Sözlük yüklendiğinde çeviri UYGULANIR.
   Çalıştırma: npm run test:i18n                                    */
import { sahteDomKur, betikleriYukle } from './sahte-dom.mjs';

let iyi = 0, kotu = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const x = m => { kotu++; console.log('  X    ' + m); };
const esit = (gelen, beklenen, m) =>
  gelen === beklenen ? ok(m + ' = ' + String(gelen))
                     : x(m + ' → beklenen ' + String(beklenen) + ', gelen ' + String(gelen));

console.log('\n═══ Dil (i18n) yedek metin testi — ham anahtar gösterilmemeli ═══\n');

const ortam = sahteDomKur();
const yukleme = betikleriYukle(ortam);
const hata = yukleme.filter(s => s.hata);
if (hata.length) hata.forEach(s => x('yükleme hatası ' + s.dosya + ': ' + (s.hata.message || s.hata)));
else ok('tüm betikler hatasız yüklendi (' + yukleme.length + ' dosya)');

const { belge, pencere } = ortam;
const PZA = pencere.PZA;

/* index.html'deki `data-i18n` öğeleri (HTML yedek metinleriyle) hazırla. */
const YEDEK = { 'pa-bas': 'Sürüm Durumu', 'pa-kapat': 'Kapat', 'gunc-metin': 'Güncelleme' };
const YEDEKLER = Object.keys(YEDEK).map(id => {
  const el = belge.getElementById(id);
  el.textContent = YEDEK[id];
  return el;
});

/* ── 1) Sözlük HİÇ yüklenemiyor (CSP paket fetch'ini engelliyor + ağ yok) ── */
pencere.fetch = () => Promise.reject(new Error('CSP: connect-src self engelli'));
PZA.settings.dil = 'de';
await PZA.i18n.hazir();
const bosSozluk = Object.keys(PZA.i18n.sozluk || {}).length;
esit(bosSozluk, 0, 'sözlük gerçekten boş kaldı (senaryo kuruldu)');
YEDEKLER.forEach(el => {
  const ham = el.getAttribute('data-i18n');
  if (el.textContent !== ham) ok('sözlük boşken ' + el.id + ' ham anahtar YAZMIYOR (HTML yedeği: "' + el.textContent + '")');
  else x('sözlük boşken ' + el.id + ' ekranına HAM ANAHTAR yazıldı: ' + ham);
});

/* ── 2) Sözlük yükleniyor → çeviri uygulanıyor ─────────────────────────── */
const SOZLUK = 'pa_baslik = SÜRÜM DURUMU\npa_kapat = Kapat\n';
pencere.fetch = async () => ({ ok: true, text: async () => SOZLUK });
PZA.settings.dil = 'tr';
await PZA.i18n.hazir();
esit(belge.getElementById('pa-bas').textContent, 'SÜRÜM DURUMU',
  'sözlük yüklenince çeviri uygulanıyor (pa_baslik)');
esit(belge.getElementById('pa-kapat').textContent, 'Kapat',
  'sözlük yüklenince çeviri uygulanıyor (pa_kapat)');
esit(belge.getElementById('gunc-metin').textContent, 'Güncelleme',
  'sözlükte OLMAYAN anahtarın HTML yedeği korunuyor (gunc-metin)');

/* ── 3) JS çağrıları için `t()` sözleşmesi bozulmadı ───────────────────── */
esit(PZA.i18n.t('yok_boyle_anahtar', 'Yedek Metin'), 'Yedek Metin',
  't(anahtar, yedek) yedek metni döndürüyor');
esit(PZA.i18n.t('pa_baslik'), 'SÜRÜM DURUMU', 't(anahtar) sözlükten okuyor');

console.log('\n  Sonuç: ' + iyi + ' OK, ' + kotu + ' hata\n');
process.exit(kotu ? 1 : 0);
