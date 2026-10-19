/* araclar/menu-uctan-uca-test.mjs
   Ezan menüsü + güncelleme popup'ı için UÇTAN UCA test.

   v1.36.1 ve v1.36.2'de bu iki menü iki kez bozuldu:
     - v1.36.1: `ekH` erken çıkıştan SONRA hesaplanıyordu → pencere büyümüyordu
     - v1.36.2: `gerekliH()` plakada erken çıkıyordu → kaplama panel ölçülmüyordu

   Bu test o TÜM boyutlandırma yollarını sahte bir pencere modeliyle
   ÇALIŞTIRIR ve karar zincirinin sonucunu doğrular.
   Regex denetimi değil, gerçek hesap. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(kok, 'src/js/app.js'), 'utf8');

let gecti = 0, kaldi = 0;
const k = (et, kosul, det = '') => {
  if (kosul) { console.log('  OK   ' + et + (det ? '  ' + det : '')); gecti++; }
  else { console.log('  FAIL ' + et + '  ' + det); kaldi++; }
};

/* ── Sahte pencere ortamı ───────────────────────────────── */
function ortam({ plaka = null, widgetH = 236, widgetG = 800,
                 settingsH = 1125, settingsG = 412, settingsAcik = false,
                 ezanH = 210, ezanAcik = false, paH = 300, paAcik = false,
                 alanBoy = 1040, alanUst = 0, y = 700 } = {}) {
  const st = { hidden: !settingsAcik, scrollHeight: settingsH,
               getBoundingClientRect: () => ({ width: settingsG, height: settingsH }) };
  const em = { hidden: !ezanAcik, offsetHeight: ezanH, scrollHeight: ezanH,
               getBoundingClientRect: () => ({ width: 190, height: ezanH }) };
  const kutu = { hidden: !paAcik, offsetHeight: paH, scrollHeight: paH,
                 getBoundingClientRect: () => ({ width: 330, height: paH }) };
  const pa = { hidden: !paAcik, querySelector: s => (s === '.pa-box' ? kutu : null) };
  return { st, em, kutu, pa, y, alan: { ust: alanUst, boy: alanBoy },
           widgetH, widgetG, plaka };
}

/* `gerekliH` / `gerekliG` kaynağını çıkar, sahte DOM ile çalıştır */
function olcut(ortam) {
  const acilanMi = id => {
    if (id === 'ezan-menu') return !ortam.em.hidden;
    if (id === 'pa-modal') return !ortam.pa.hidden;
    return false;
  };
  globalThis.window = { innerWidth: ortam.widgetG, innerHeight: ortam.widgetH };
  globalThis.document = {
    getElementById: id => (id === 'widget' ? { getBoundingClientRect: () => ({ height: ortam.widgetH, width: ortam.widgetG }) }
      : id === 'settings' ? ortam.st
      : id === 'studio' ? null
      : id === 'ezan-menu' ? ortam.em
      : id === 'pa-modal' ? ortam.pa : null),
    querySelector: () => null,
    readyState: 'complete',
    addEventListener: () => {},
  };
  globalThis.getComputedStyle = () => ({ maxWidth: ortam.widgetG + 'px' });
  globalThis.getBoundingClientRect = () => ({ width: 0, height: 0 });

  const PZA = {
    settings: {}, plateSize: () => ortam.plaka, activeSkin: () => null,
  };
  globalThis.PZA = PZA;

  const hh = app.match(/const gerekliH = \(\) => \{[\s\S]*?\n    \};/)[0];
  const gg = app.match(/const gerekliG = \(\) => \{[\s\S]*?\n    \};/)[0];
  const gerekliH = eval('(' + hh.replace(/^const gerekliH = /, '').replace(/;$/, '') + ')');
  const gerekliG = eval('(' + gg.replace(/^const gerekliG = /, '').replace(/;$/, '') + ')');
  return { gH: gerekliH(), gG: gerekliG() };
}

/* `fit()`'in boyut kararını taklit et (ekH'yi fit içinde hesaplar) */
function fitKarari(ortam) {
  const acilanMi = id => {
    if (id === 'ezan-menu') return !ortam.em.hidden;
    if (id === 'pa-modal') return !ortam.pa.hidden;
    if (id === 'settings' || id === 'studio') return !ortam.st.hidden;
    return false;
  };
  globalThis.document = {
    getElementById: id => (id === 'widget' ? { getBoundingClientRect: () => ({ height: ortam.widgetH, width: ortam.widgetG }) }
      : id === 'settings' ? ortam.st : id === 'studio' ? null
      : id === 'ezan-menu' ? ortam.em : id === 'pa-modal' ? ortam.pa : null),
    querySelector: s => (s === '.pa-box' ? ortam.kutu : null),
    readyState: 'complete', addEventListener: () => {},
  };
  globalThis.getComputedStyle = () => ({ maxWidth: ortam.widgetG + 'px' });
  globalThis.window = { innerWidth: ortam.widgetG, innerHeight: ortam.widgetH };
  globalThis.PZA = { settings: {}, plateSize: () => ortam.plaka, activeSkin: () => null };

  const hh = app.match(/const gerekliH = \(\) => \{[\s\S]*?\n    \};/)[0];
  const gerekliH = eval('(' + hh.replace(/^const gerekliH = /, '').replace(/;$/, '') + ')');

  /* ⚠ KRİTİK (2026-10-19): `ekH` hesabını TEST KODUNUN KENDİ kopyasından
     yapmak hatayı gizliyordu — kaynak koddaki ölçüm bozulsa bile test
     yeşil kalıyordu. `test-dogrulama.mjs` bunu ortaya çıkardı
     ("ezan menüsü ölçülmüyor" hatası testten KAÇTI).

     Artık blok KAYNAK KODDAN çıkarılır ve çalıştırılır; `if (false)`
     gibi bir bozulma testi DÜŞÜRÜR. */
  const ekBlok = app.match(/let ekH = 0;([\s\S]*?)\n      const h = gerekliH\(\);/);
  if (!ekBlok) { console.log('  FAIL ekH hesabı kaynak kodda bulunamadı — test geçersiz'); kaldi++; return { h: 0, ekH: 0, istenenH: 0, hh: 0, sığar: true, hedefY: 0 }; }
  /* Ölçüm artık `dogalYukseklik()` kullanıyor (kırpılmış kutu yeniden
     ölçülünce pencere hiç büyümüyordu) — YARDIMCININ GERÇEK kaynağını al. */
  const dyKaynak = app.match(/function dogalYukseklik\(el\) \{[\s\S]*?\n  \}/);
  if (!dyKaynak) { console.log('  FAIL dogalYukseklik kaynak kodda bulunamadı — test geçersiz'); kaldi++; return { h: 0, ekH: 0, istenenH: 0, hh: 0, sığar: true, hedefY: 0 }; }
  const dogalYukseklik = new Function('return (' +
    dyKaynak[0].replace('function dogalYukseklik', 'function') + ')')();
  const ekGovde = 'let ekH = 0;' + ekBlok[1].replace(/acikMi\(/g, 'acilanMi(');
  const ekH = new Function('acilanMi', 'document', 'PZA', 'dogalYukseklik',
    ekGovde + ' return ekH;')(acilanMi, globalThis.document, globalThis.PZA, dogalYukseklik);

  const h = gerekliH();
  const istenenH = h + ekH;
  const alt = ortam.alan.ust + ortam.alan.boy;
  const hh2 = ortam.alan.boy ? Math.min(istenenH, Math.max(240, ortam.alan.boy - 8)) : istenenH;
  const sığar = (ortam.y + hh2) <= alt;
  return { h, ekH, istenenH, hh: hh2, sığar, hedefY: sığar ? ortam.y : Math.max(ortam.alan.ust, ortam.y - ekH) };
}

console.log('\nA · KLASİK SKİN — ezan menüsü\n');
{
  // y=500: 500+446=946 <= 1040 → altta yer VAR
  const o = ortam({ widgetH: 236, widgetG: 800, y: 500 });
  o.em.hidden = false;
  const f = fitKarari(o);
  k('ezan açıkken pencere menüyü de içine alıyor',
    f.hh >= 236 + 210, `pencere=${f.hh}px (widget 236 + menü 210 = 446)`);
  k('menü widget üstüne BİNMEZ (pencere büyüdü)',
    f.hh > f.h, `ekH=${f.ekH} → pencere ${f.h}→${f.hh}`);
  k('altta yer varsa widget yerinde kalıyor',
    f.sığar && f.hedefY === o.y, `sığar=${f.sığar} hedefY=${f.hedefY} (widget ${o.y})`);
}
{
  // Ekranın dibinde widget → yukarı açılmalı
  const o = ortam({ widgetH: 236, widgetG: 800, y: 1000 });
  o.em.hidden = false;
  const f = fitKarari(o);
  k('ekran dibinde widget → yukarı kaydırılıyor',
    !f.sığar && f.hedefY < o.y, `sığar=${f.sığar} hedefY=${f.hedefY} (widget ${o.y})`);
  k('yukarı kaydırınca widget ekranda kalıyor',
    f.hedefY >= o.alan.ust, `hedefY=${f.hedefY} >= alan.ust=${o.alan.ust}`);
}

console.log('\nB · KLASİK SKİN — güncelleme popup\n');
{
  const o = ortam({ widgetH: 236, widgetG: 800, y: 600 });
  o.pa.hidden = false;
  const f = fitKarari(o);
  k('PA popup açıkken pencere büyüyor',
    f.hh >= 236 + 300, `pencere=${f.hh}px (widget 236 + kutu 300 = 536 gerekli)`);
}
{
  // PA kutu widget'tan KISA → pencere yine de widget+kutu olmalı, çünkü
  // menü düğmenin altına (widget'ın DIŞINA) yerleşir.
  const o = ortam({ widgetH: 400, widgetG: 800, y: 400 });
  o.pa.hidden = false; o.kutu.offsetHeight = 120;
  const f = fitKarari(o);
  k('kutu widget\'tan kısa olsa da aşağı yerleşeceği kadar büyür',
    f.hh === 520, `pencere=${f.hh} (400+120)`);
  k('kutu kısa iken saati örtmez (widget korunur)',
    f.hedefY === o.y, `hedefY=${f.hedefY}`);
}

console.log('\nC · AURORA (PLAKA) — gerekliH erken çıkışı\n');
{
  // v1.36.2'deki hata: plakada erken çıkış → panel ölçülmüyordu
  // alanBoy büyük olmalı ki kırpma devreye girmesin (paneli test ediyoruz)
  const o = ortam({ plaka: { w: 800, h: 272 }, settingsAcik: true,
                   settingsH: 1125, settingsG: 412, y: 300, alanBoy: 1200 });
  const f = fitKarari(o);
  k('AURORA\'da Ayarlar açıkken pencere panele göre büyüyor',
    f.hh >= 1149, `pencere=${f.hh}px (Ayarlar ${o.st.scrollHeight}+24 = 1149)`);
  k('sorun TEKRAR etmiyor (272\'de kalmıyor)', f.hh > 272, `272 değil → ${f.hh}`);

  const g = olcut(o);
  k('gerekliH() plakada paneli ÖLÇÜYOR (272 değil)',
    g.gH >= 1125, `gerekliH=${g.gH}`);
  k('gerekliG() plakada panel genişliğini hesaba katıyor',
    g.gG >= 412, `gerekliG=${g.gG}`);
}
{
  // Stüdyo 470px > plaka 430px (1/4) → genişlik de büyümeli
  const o = ortam({ plaka: { w: 430, h: 146 }, settingsAcik: true,
                   settingsH: 900, settingsG: 470, y: 400 });
  const g = olcut(o);
  k('1/4 plakada Stüdyo (470px) genişliği uygulanıyor',
    g.gG === 470, `gerekliG=${g.gG} (plaka 430, panel 470)`);
}
{
  // Panel kapalıyken plaka ölçüsü SADECE
  const o = ortam({ plaka: { w: 800, h: 272 }, settingsAcik: false, y: 500 });
  const g = olcut(o);
  k('panel kapalıyken plaka ölçüsü aynen kullanılıyor',
    g.gH === 272 && g.gG === 800, `gH=${g.gH} gG=${g.gG}`);
}

console.log('\nD · ezan + güncelleme AYNI ANDA\n');
{
  const o = ortam({ widgetH: 236, widgetG: 800, y: 500 });
  o.em.hidden = false; o.pa.hidden = false;
  const f = fitKarari(o);
  k('iki menü açıkken EN BÜYÜK yükseklik alınıyor',
    f.hh >= 236 + 300, `pencere=${f.hh}px (ezan 210, PA 300 → max 300)`);
  k('toplam iki kez eklenmiyor (tek ekH)', f.ekH === 300, `ekH=${f.ekH}`);
}

console.log('\nE · İŞ ALANI KIRPMASI\n');
{
  const o = ortam({ widgetH: 236, widgetG: 800, y: 100, alanBoy: 400 });
  o.em.hidden = false;
  const f = fitKarari(o);
  k('pencere iş alanını AŞMIYOR', f.hh <= 400 - 8, `pencere=${f.hh} <= 392`);
  k('kırpma olsa da makul bir taban korunuyor', f.hh >= 240, `pencere=${f.hh}`);
}

console.log('\nF · ERKEN ÇIKIŞ (titremeyi önleme)\n');
{
  // v1.36.1 hatası: erken çıkış `h` (ekH'siz) ile karşılaştırıyordu.
  // Dropdown açılınca `h` değişmediği için fit() erken çıkıyor,
  // pencere hiç büyümüyordu. Karar zincirinin TAMAMINI izleyerek
  // "pencere gerçekten büyür mü" sorusuna cevap veriyoruz.
  const fitMetni = app.match(/const fit = async[\s\S]*?\n    \};/)[0];
  const kodTemiz = fitMetni.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  k('erken çıkış ekH\'den türetilmiş hedefi kullanıyor',
    /istenenH/.test(kodTemiz.split('return;')[0]) || /istenenH - sonH/.test(kodTemiz));
  k('ekH ölçümü erken çıkıştan ÖNCE yapılıyor',
    kodTemiz.indexOf('let ekH = 0;') > -1
    && kodTemiz.indexOf('let ekH = 0;') < kodTemiz.indexOf('sonH = istenenH'));
  k('sonH ekH\'yi İÇERİR (menü açınca hedef değişir)',
    /sonH = istenenH/.test(kodTemiz) && /const istenenH = h \+ ekH/.test(kodTemiz));

  // Davranışsal: `h` sabitken ekH değişince pencere hedefi değişmeli
  const o = ortam({ widgetH: 236, widgetG: 800, y: 500 });
  o.em.hidden = false;
  const f = fitKarari(o);
  k('menü açınca pencere hedefi widget\'tan FARKLAŞIYOR (erken çıkış yakalamaz)',
    f.istenenH !== f.h, `istenenH=${f.istenenH} ≠ h=${f.h}`);
}

console.log(`\nSONUC: ${kaldi === 0 ? 'temiz' : kaldi + ' BASARISIZ'} — ${gecti} kontrol`);
process.exit(kaldi === 0 ? 0 : 1);