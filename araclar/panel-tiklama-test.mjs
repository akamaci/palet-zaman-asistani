/* panel-tiklama-test.mjs — "tıklayınca gerçekten açılıyor mu?" testi
   Palet Zaman Asistanı · GPL-3.0

   Kullanıcı bildirimi (2026-10-19, v1.36.3):
     "hava durumu bölümü hala çalışmıyor"
     "randevu kaydı butonu tıklanmıyor"
     "Aurora'da hiçbiri tıklanmıyor, sadece ezan menüsü çalışıyor"

   İki AYRI gerçek hata vardı:

   A) KENDİ KENDİNİ KAPATMA (v1.36.1'de eklenen kapatma yolları yaptı)
      `#btn-notes` / `#weather-tile` panelin DIŞINDADIR. Tıklama düğmede
      paneli açıyor, sonra `document`e köpürüyor; oradaki "panel dışına
      tıklandı" kuralı paneli AYNI tıklamada kapatıyordu. Kullanıcı bir an
      açılıp kapanan bir panel görüyordu → "hiçbir şey olmuyor".
      Çözüm: `data-panel-tetik` işaretli öğelerden gelen tıklamalar yok
      sayılır (notes.js → dokun).

   B) `#weather-tile` DÜĞMESİ TAŞIMA BÖLGESİYDİ (`data-tauri-drag-region`).
      Tauri 2 taşıma bölgesini `composedPath`te arar; kendi kutusuna
      tıklanan düğme tıklama yerine PENCEREYİ SÜRÜKLER → "tıklanmıyor".
      Çözüm: düğmeye taşıma bölgesi konmaz (settings.js → applyLock).

   Bu test GERÇEK olay köpürmesiyle (sahte-dom.mjs) ölçer.
   Çalıştırma:  npm run test                              */
import { sahteDomKur, betikleriYukle } from './sahte-dom.mjs';

let iyi = 0, kotu = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const x = m => { kotu++; console.log('  X    ' + m); };
const esit = (gelen, beklenen, m) =>
  gelen === beklenen ? ok(m + ' = ' + String(gelen))
                     : x(m + ' → beklenen ' + String(beklenen) + ', gelen ' + String(gelen));

console.log('\n═══ Panel tıklama testi (aç / kapa / köpürme) ═══');

const ortam = sahteDomKur();
const yukleme = betikleriYukle(ortam);
const hata = yukleme.filter(s => s.hata);
if (hata.length) hata.forEach(s => x('yükleme hatası ' + s.dosya + ': ' + (s.hata.message || s.hata)));
else ok('tüm betikler hatasız yüklendi (' + yukleme.length + ' dosya)');

const { belge } = ortam;
const PZA = ortam.pencere.PZA;
PZA.settings.weather = false;      // testte ağ isteği olmasın

/* app.js tetikleyicileri bağladı mı? */
function tikla(el) {
  try { return el.olay('click'); }
  catch (e) { x('tıklama sırasında HATA (' + (el.id || el.tagName) + '): ' + e.message); return null; }
}

/* ── 1) NOTLAR: düğme paneli açar ve AÇIK KALIR ───────────────── */
{
  const p = belge.getElementById('panel-notes');
  const b = belge.getElementById('btn-notes');
  p.hidden = true;
  tikla(b);
  esit(p.hidden, false, 'notlar düğmesine tıklayınca panel açık kalıyor');
  /* Kullanıcı düğmenin YAZISINA (iç <span>) tıklarsa da açık kalmalı:
     guard ebeveyn zincirini yürür, yalnız düğmenin kendisini değil. */
  p.hidden = true;
  const span = belge.createElement('span');
  span.className = 'etiket';
  b.appendChild(span);
  tikla(span);
  esit(p.hidden, false, 'düğmenin iç yazısına tıklayınca da panel açık kalıyor');
  /* Dışına tıklama kapatmalı (v1.36.1 kazanımı korunuyor mu?) */
  tikla(belge.body);
  esit(p.hidden, true, 'panel dışına tıklayınca kapanıyor');
  /* Aynı düğmeye ikinci tıklama kapatmalı */
  tikla(b);
  tikla(b);
  esit(p.hidden, true, 'düğmeye ikinci kez tıklayınca kapanıyor');
}

/* ── 2) HAVA: panel açılır + VERİ YÜKLEMESİ BAŞLAR ─────────────
   `toggleWeather` içinde `PZA.closeNotes()` çağrısı hata verirse
   `PZA.loadWeather()` satırına HİÇ gelinmez: panel açılır ama bomboş
   kalır — kullanıcının "hava durumu çalışmıyor" dediği hâl budur. */
{
  const p = belge.getElementById('panel-weather');
  const b = belge.getElementById('weather-tile');
  let yuklemeSayaci = 0;
  const gercek = PZA.loadWeather;
  PZA.loadWeather = function () { yuklemeSayaci++; return gercek.apply(this, arguments); };
  p.hidden = true;
  tikla(b);
  esit(p.hidden, false, 'hava düğmesine tıklayınca panel açılıyor');
  esit(yuklemeSayaci, 1, 'hava verisi yüklemesi başlatıldı (loadWeather çağrıldı)');
  tikla(belge.body);
  esit(p.hidden, true, 'hava paneli dışına tıklayınca kapanıyor');
  PZA.loadWeather = gercek;
}

/* ── 3) RANDEVU KAYDI: gün düğmesi takvimi açar ──────────────── */
{
  const cal = belge.getElementById('cal');
  const g = belge.getElementById('notes-day-btn');
  /* Panel açıkken takvim katmanı açılır (app.js → PZA.openCal). */
  const p = belge.getElementById('panel-notes');
  p.hidden = true;
  tikla(belge.getElementById('btn-notes'));
  cal.hidden = true;
  tikla(g);
  esit(cal.hidden, false, 'gün düğmesine tıklayınca randevu/takvim katmanı açılıyor');
  /* Katman açıkken takvim hücresine tıklamak katmanı KAPATMAMALI
     (gün seçimi + saat aynı yerde belirleniyor). */
  tikla(belge.getElementById('cal-grid'));
  esit(cal.hidden, false, 'takvim hücresine tıklayınca katman açık kalıyor');
}

/* ── 5) PA POPUP + EZAN MENÜSÜ: tıklama HATA VERMEMELİ ─────────
   v1.36.3'te iki ReferenceError canlıya gitti:
     • `fit is not defined`  → PA ve ezan düğmeleri pencereyi büyütemiyordu
     • `paBtn is not defined` → PA popup'ı dışına tıklayınca KAPANMIYORDU
   Tıklama sessizce yarıda kesildiği için ekranda "hiçbir şey olmuyor"
   gibi görünüyordu. */
{
  const pa = belge.getElementById('pa-modal');
  const paDugme = belge.getElementById('pa-btn');
  const ezanDugme = belge.getElementById('ezan-ses-btn');
  const ezanMenu = belge.getElementById('ezan-menu');

  pa.hidden = true;
  const e1 = tikla(paDugme);
  if (e1 && !e1._hata) ok('PA düğmesine tıklama hata vermedi');
  esit(pa.hidden, false, 'PA düğmesine tıklayınca sürüm/güncelleme popup\'ı açılıyor');

  /* KÖK NEDEN (2026-10-19, v1.36.4 bildirimi "güncelleme menüsü açılmıyor"):
     `.pa-box` CSS'inde YEDEK olarak `bottom: 46px` var. JS yalnız inline
     `top` yazıp inline `bottom`'u SİLİYORSA (removeProperty) CSS kuralı
     geçerli kalır → kutu `top`+`bottom`+`height:auto` ile AŞIRI KISITLI
     olur → pencere dibine UZAR, içerik tepede kalır, `offsetHeight`
     anlamsızlaşır (~200px yerine ~28px) → pencere büyümez, kutu kırpılır.
     Çözüm: inline `bottom: auto` (CSS'i EZER). */
  const paKutu = pa.querySelector('.pa-box');
  if (paKutu) {
    esit(paKutu.style.bottom, 'auto',
      'PA kutusu CSS `bottom` yedeğini inline `auto` ile EZİYOR (aşırı kısıt = kırpılma)');
    if (/^\d+px$/.test(String(paKutu.style.top))) ok('PA kutusu `top` değeri piksel cinsinden');
    else x('PA kutusu `top` piksel değil: ' + paKutu.style.top);
  } else x('PA kutusu (.pa-box) bulunamadı');

  const e2 = tikla(belge.body);          // kutu dışına tıklama
  if (e2 && !e2._hata) ok('PA açıkken dışına tıklama hata vermedi');
  esit(pa.hidden, true, 'PA popup\'ı kutu dışına tıklayınca kapanıyor');

  ezanMenu.hidden = true;
  const e3 = tikla(ezanDugme);
  if (e3 && !e3._hata) ok('ezan düğmesine tıklama hata vermedi');
  esit(ezanMenu.hidden, false, 'ezan menüsü açılıyor');
  ezanMenu.hidden = true;
}

/* ── 6) TAŞIMA BÖLGESİ: düğmeye KONMAZ, şeride KONUR ─────────── */
{
  const serit = ortam.dugum('plate-drag');
  const hava = belge.getElementById('weather-tile');
  PZA.settings.locked = false;
  PZA.applyLock();
  esit(serit.hasAttribute('data-tauri-drag-region'), true,
    'kilit açıkken üst şerit pencereyi taşır');
  esit(hava.hasAttribute('data-tauri-drag-region'), false,
    'hava düğmesi taşıma bölgesi DEĞİL (yoksa tıklama pencereyi sürükler)');

  /* Kural: tıklanabilir öğeye taşıma bölgesi konmaz. */
  const notlar = belge.getElementById('btn-notes');
  notlar.setAttribute('data-drag', '1');
  PZA.applyLock();
  esit(notlar.hasAttribute('data-tauri-drag-region'), false,
    'düğmeye işaret konsa bile taşıma bölgesi uygulanmaz');

  PZA.settings.locked = true;
  PZA.applyLock();
  esit(serit.hasAttribute('data-tauri-drag-region'), false,
    'kilit kapalıyken hiçbir şey taşımaz (yerine kilit çalışıyor)');
  PZA.settings.locked = false;
  PZA.applyLock();
}

console.log('\n  Sonuç: ' + iyi + ' OK, ' + kotu + ' hata\n');
process.exit(kotu ? 1 : 0);
