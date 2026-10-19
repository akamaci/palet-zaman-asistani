/* yukleme-testi.mjs — "dosyalar gerçekten ÇALIŞIYOR mu?" testi
   Palet Zaman Asistanı · GPL-3.0

   Neden: 2026-10-19'da kullanıcı "hava durumu bölümü çalışmıyor",
   "randevu kaydı butonu tıklanmıyor" dedi. Kök neden `src/js/notes.js`
   içindeki TEK HARFLİK bir yazım hatasıydı:

       const dinleyebilir = ...;
       if (yukleniyor && dinlenebilir) ...   ← ReferenceError

   Bu hata dosyanın GERİ KALANINI çalıştırmadı: `PZA.openCal`,
   `PZA.closeCal`, `PZA.renderCal`, `PZA.calShift`, `PZA.simdiSaat`
   hiç tanımlanmadı. Sonuç: takvim açılmıyor, not paneli listesi
   dolmuyor, hava paneli tıklanınca veri yüklemiyordu.

   DİKKAT — neden iki durum deneniyor: `a && b` ifadesinde `a` yanlışsa
   `b` hiç değerlendirilmez. Tarayıcıda betikler sayfa yüklenirken
   çalıştığı için (`readyState = 'loading'`) hatalı satır İŞLER; test
   ortamı 'complete' olsaydı aynı hata sessizce saklanırdı.
   Bu yüzden her iki durum da ölçülür.

   Çalıştırma:  npm run test                                  */
import fs from 'fs';
import path from 'path';
import { sahteDomKur, betikleriYukle, SIRA } from './sahte-dom.mjs';

const KOK = path.join(import.meta.dirname, '..') + path.sep;

let iyi = 0, kotu = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const x = m => { kotu++; console.log('  X    ' + m); };

console.log('\n═══ Yükleme testi (dosyalar gerçekten çalışıyor mu?) ═══');

/* ── 1) index.html'deki her betik diskte olmalı ─────────────── */
for (const f of SIRA) {
  const tam = KOK + 'src' + path.sep + f.split('/').join(path.sep);
  if (fs.existsSync(tam)) ok('dosya var: ' + f);
  else x('DOSYA YOK: ' + f + ' (index.html çağırıyor ama diskte yok!)');
}

/* Kritik API'ler: her satır kullanıcının görebildiği bir özellik;
   biri kaybolursa ilgili dosya sessizce yarıda kesilmiş demektir. */
const API = [
  ['PZA.toggleNotes',   'notlar panelini aç/kapa (GÜNÜN NOTLARI düğmesi)'],
  ['PZA.closeNotes',    'notlar panelini kapat'],
  ['PZA.renderNotes',   'not listesini çiz'],
  ['PZA.addNote',       'randevu/not ekle'],
  ['PZA.openCal',       'gün+saat seçme katmanını aç (randevu kaydı)'],
  ['PZA.closeCal',      'takvimi kapat'],
  ['PZA.renderCal',     'takvimi çiz'],
  ['PZA.calShift',      'takvimde ay ileri/geri'],
  ['PZA.calOpen',       'takvim açık mı'],
  ['PZA.simdiSaat',     'şimdiki saati yuvarla'],
  ['PZA.toggleWeather', 'hava panelini aç/kapa (hava düğmesi)'],
  ['PZA.closeWeather',  'hava panelini kapat'],
  ['PZA.loadWeather',   'hava verisini yükle'],
  ['PZA.applyLock',     'yerine kilit (taşıma bölgesi)'],
  ['PZA.dropdownYerlestir', 'düşen yüzey yön/seçimi']
];

function kontrol(etiket, hazir) {
  console.log('\n  ── ' + etiket + ' ──');
  const ortam = sahteDomKur({ hazir });
  const sonuc = betikleriYukle(ortam);
  for (const s of sonuc) {
    const ayrinti = s.hata && s.hata.message ? s.hata.message : String(s.hata);
    if (s.hata) x('yüklenirken HATA: ' + s.dosya + ' → ' + ayrinti);
    else ok('yüklendi: ' + s.dosya);
  }

  /* DOMContentLoaded'ı da ateşle: notes.js kapat düğmelerini o an kurar
     (tarayıcıda gerçek akış budur). */
  if (hazir === 'loading') {
    const ev = ortam.belge.yay('DOMContentLoaded');
    if (ev._hata) x('DOMContentLoaded sırasında HATA: ' + ev._hata.message);
    else ok('DOMContentLoaded sorunsuz işlendi');
    const p = ortam.belge.getElementById('panel-notes');
    if (p.querySelector('.panel-kapat')) ok('panel kapat düğmesi kuruldu');
    else x('panel kapat düğmesi KURULMADI (kapatma yolu eksik kalır)');
  }

  const PZA = ortam.pencere.PZA || {};
  for (const [yol, aciklama] of API) {
    let v = PZA;
    for (const p of yol.split('.').slice(1)) v = v ? v[p] : undefined;
    if (typeof v === 'function') ok(yol + ' → ' + aciklama);
    else x(yol + ' TANIMSIZ → ' + aciklama + ' (dosya yarıda kesilmiş olabilir)');
  }

  /* Takvim uçtan uca: aç → çiz → kapat */
  try {
    const cal = ortam.belge.getElementById('cal');
    cal.hidden = true;
    PZA.openCal();
    if (!cal.hidden) ok('PZA.openCal() takvimi açtı');
    else x('PZA.openCal() takvimi AÇMADI');
    const hucre = (ortam.belge.getElementById('cal-grid').innerHTML || '').length;
    if (hucre > 0) ok('takvim ızgarası çizildi (' + hucre + ' karakter)');
    else x('takvim ızgarası BOŞ — renderCal çalışmadı');
    PZA.closeCal();
    if (cal.hidden) ok('PZA.closeCal() takvimi kapattı');
    else x('PZA.closeCal() takvimi KAPATMADI');
  } catch (e) {
    x('takvim aç/kapa sırasında HATA: ' + e.message);
  }

  /* Notlar paneli: çizim gerçekten doluyor mu? (closeCal hatası
     buraya kadar gelinmesini engelliyordu) */
  try {
    PZA.settings.weather = false;               // testte ağ isteği olmasın
    const panel = ortam.belge.getElementById('panel-notes');
    const liste = ortam.belge.getElementById('notes-list');
    liste.innerHTML = '';
    panel.hidden = true;
    PZA.toggleNotes(true);
    if (!panel.hidden) ok('PZA.toggleNotes(true) paneli açtı');
    else x('PZA.toggleNotes(true) paneli AÇMADI');
    if ((liste.innerHTML || '').length > 0) ok('not ızgarası çizildi (' + liste.innerHTML.length + ' karakter)');
    else x('not ızgarası BOŞ — renderNotes çalışmadı (closeCal hatası olabilir)');
  } catch (e) {
    x('notlar paneli açılırken HATA: ' + e.message);
  }
}

kontrol("SAYFA YÜKLENİRKEN (readyState='loading' — tarayıcının GERÇEK durumu)", 'loading');
kontrol("SAYFA HAZIRKEN (readyState='complete')", 'complete');

console.log('\n  Sonuç: ' + iyi + ' OK, ' + kotu + ' hata\n');
process.exit(kotu ? 1 : 0);
