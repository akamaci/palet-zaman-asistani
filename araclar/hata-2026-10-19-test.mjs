/* araclar/hata-2026-10-19-test.mjs
   Kullanıcı bildirimi (2026-10-19):
   1) Açılır menülerin ÜST YARISI görünmüyor.
   2) Aurora (plaka) skin'i klasik moddan ÇOK BÜYÜK.

   Bu dosya YALNIZ bu iki hatanın regresyon testidir. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const oku = y => readFileSync(join(kok, y), 'utf8');

const app = oku('src/js/app.js');
const skins = oku('src/js/skins.js');
const settings = oku('src/js/settings.js');

let gecti = 0, kaldi = 0;
const kontrol = (baslik, kosul) => {
  if (kosul) { console.log('  OK   ' + baslik); gecti++; }
  else { console.log('  FAIL ' + baslik); kaldi++; }
};

console.log('\n1 · Açılır menü kırpılması (ezan menüsü / güncelleme popup)\n');
{
  // fit() dropdown'ları ölçüyor mu? (asıl hata: ölçmüyordu)
  const fitBlok = app.slice(app.indexOf('const fit = async'), app.indexOf('if (window.ResizeObserver)'));
  kontrol('fit() açık dropdown YÜKSEKLİĞİNİ hesaba katıyor',
    /ezan-menu/.test(fitBlok) && /pa-modal/.test(fitBlok));
  kontrol('dropdown yüksekliği pencereye EKLENİYOR (istenenH = h + ekH)',
    /const istenenH = h \+ ekH/.test(fitBlok));
  // KRİTİK (2. tur): ekH, titremeyi önleyen erken çıkıştan ÖNCE ölçülmeli.
  // Aksi halde menü açılınca `h` değişmediği için fit() erken çıkıyor,
  // pencere büyümüyor ve menü saati örtüyor.
  kontrol('ekH erken çıkıştan ÖNCE ölçülüyor (menü saati örtüyordu)',
    /let ekH = 0;[\s\S]*?const istenenH = h \+ ekH;/.test(fitBlok));
  // Yorum satırlarını temizle ki açıklama metni eşleşmesin
  const fitKod = fitBlok.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  kontrol('erken çıkış istenenH ile karşılaştırıyor (h değil)',
    /Math\.abs\(istenenH - sonH\) < 3/.test(fitKod)
    && !/Math\.abs\(h - sonH\) < 3/.test(fitKod));
  kontrol('pencere yüksekliği istenenH kullanıyor',
    /const hh = alan\.boy \? Math\.min\(istenenH/.test(fitBlok));

  // Menüler OPAK olmalı (yarı saydamdı, arkasından saat rakamları görünüyordu)
  const cssT = oku('src/styles/widget.css').replace(/\/\*[\s\S]*?\*\//g, '');
  kontrol('ezan menüsü OPAK zemin (saydamdı)',
    /\.ezan-menu \{[\s\S]{0,400}?background:\s*var\(--menu-bg/.test(cssT));
  kontrol('PA kutusu OPAK zemin (saydamdı)',
    /\.pa-box \{[\s\S]{0,400}?background:\s*var\(--menu-bg/.test(cssT));
  kontrol('açık temada menü açık renk (okunabilirlik)',
    /\[data-theme="light"\] \.ezan-menu/.test(cssT) && /\[data-theme="light"\] \.pa-box/.test(cssT));
  kontrol('pa-modal perdesi tıklamayı yutmuyor (pointer-events:none)',
    /\.pa-modal \{[\s\S]{0,220}?pointer-events:\s*none/.test(cssT)
    && /\.pa-modal > \.pa-box \{ pointer-events: auto/.test(cssT));
  kontrol('PA kutusu dışına tıklayınca kapanıyor (perde hedef olamıyor)',
    /!kutu\.contains\(e\.target\) && !paBtn\?\.contains\(e\.target\)/.test(app));

  // dropdownYerlestir üç kuralı
  const dd = app.slice(app.indexOf('PZA.dropdownYerlestir = function'), app.indexOf('PZA.ezanMenuYerlestir = function'));
  kontrol('dropdown: altta yer varsa AŞAĞI açıyor', /if \(alta >= mh \+ 12\)/.test(dd));
  kontrol('dropdown: yukarı dalı da SINIRLI (eskiden sınırsızdı)', /else if \(uste >= mh \+ 12\)/.test(dd));
  kontrol('dropdown: hiçbir yön sığmıyorsa KAYDIRMA (kırpma değil)',
    /overflowY = 'auto'/.test(dd));
  kontrol('dropdown: `top` piksel olarak veriliyor, `bottom` karışmıyor',
    /el\.style\.top = Math\.round/.test(dd) && !/el\.style\.bottom = Math\.round/.test(dd));

  /* sıra: ÖNCE pencereyi büyüt (fit) SONRA konumlandır.
     `fit` `if (TAURI) {}` BLOĞU içinde tanımlı; dışarıdan çağrılabilmesi
     için `PZA._fit`e bağlanır. Çıplak `fit()` çağrısı ReferenceError
     verir (2026-10-19 canlı hatası) — bu yüzden aşağıdaki desenler
     `PZA._fit?.()` bekler. */
  kontrol('ezan düğmesi: açarken ÖNCE pencere fit SONRA konumlandırma',
    /PZA\._fit\?\.\(\);\s*\n\s*PZA\.ezanMenuYerlestir\(\)/.test(app));
  kontrol('PA düğmesi: açarken ÖNCE pencere fit SONRA konumlandırma',
    /PZA\._fit\?\.\(\);\s*\n\s*paYerlestir\(\)/.test(app));
  kontrol('blok içindeki fit() dışarıya bağlanıyor (çıplak fit() ReferenceError)',
    /PZA\._fit = fit;/.test(app));
  kontrol('pencere boyutlandıktan sonra dropdown YENİDEN konumlanıyor',
    /dropdownYerlestir\?\./.test(app));

  // kalıntı temizliği
  kontrol('menü kapanınca maxHeight/overflowY KALINTISI bırakılmıyor',
    (app.match(/maxHeight', 'overflowY'/g) || []).length >= 2);

  // bar modu hâlâ çalışıyor (regresyon)
  kontrol('bar modu (fitBar) bozulmadı — ezanVar dalı duruyor',
    /ezanVar/.test(app));
}

console.log('\n2 · Aurora (plaka) boyutu — klasikle aynı olmalı\n');
{
  kontrol('plaka genişlik sabitleri tanımlı (800/700/430 = 1/2,1/3,1/4)',
    /PLAKA_GENISLIK\s*=\s*\{\s*'2':\s*800,\s*'3':\s*700,\s*'4':\s*430\s*\}/.test(skins));

  // Ölçekleme hesabını gerçekten çalıştır
  globalThis.window = globalThis;
  const PZA = {
    settings: { size: '2' },
    SKIN_FORMAT_V2: 'pza-skin/2', SKIN_FORMAT_V3: 'pza-skin/3',
    activeSkin: () => ({ format: 'pza-skin/3', canvas: { w: 940, h: 320 } }),
    parseColor: () => null, luminance: () => .5, toCss: c => c, newId: () => 'x',
  };
  globalThis.PZA = PZA;
  const parca = skins.match(/PZA\.PLAKA_GENISLIK[\s\S]*?PZA\.plateSize = function[\s\S]*?\n};/);
  if (!parca) { kontrol('plakaOlcek/plateSize kodu bulundu', false); }
  else {
    kontrol('plakaOlcek/plateSize kodu bulundu', true);
    eval(parca[0]);
    PZA.activeSkin = () => ({ format: 'pza-skin/3', canvas: { w: 940, h: 320 } });
    const bekle = { 2: 800, 3: 700, 4: 430 };
    for (const s of ['2','3','4']) {
      PZA.settings.size = s;
      const r = PZA.plateSize();
      kontrol(`Aurora 1/${s} → ${bekle[s]}px (klasikle aynı)`, r && r.w === bekle[s]);
    }
    PZA.settings.size = '2';
    const r = PZA.plateSize();
    kontrol('ORAAN KORUNUYOR (800/940 ≈ 0.851)', Math.abs(r.oran - 800/940) < 0.01);
    kontrol('yükseklik orantılı (940x320 → 800x272)', Math.abs(r.h - 272) <= 1);
    PZA.settings.size = '4';
    kontrol('1/4 430px — eskiden 940\'da sabitti', PZA.plateSize().w === 430);
    PZA.settings.size = '2';
    PZA.activeSkin = () => ({ format: 'pza-skin/3', canvas: { w: 400, h: 200 } });
    kontrol('küçük canvas BÜYÜTÜLMÜYOR (400px korunur)', PZA.plateSize().w === 400);
  }

  // bölgeler/katmanlar ölçekleniyor mu?
  kontrol('SAAT ölçeği ekrandaki (ölçeklenmiş) ölçüyü kullanıyor',
    /const gw = r\.w \* ol\.oran, gh = r\.h \* ol\.oran/.test(skins));
  kontrol('atanlam sprite pozisyonu ölçekleniyor',
    /backgroundPosition = \(-p\.x \* ol\.oran\)/.test(skins));
  kontrol('animasyon keyframe pozisyonu ölçekleniyor',
    /\(-p\.x \* ol\.oran\) \+ 'px ' \+ \(-p\.y \* ol\.oran\)/.test(skins));
  kontrol('statik katman kutusu ölçekleniyor (px() yardımcısı)',
    /d\.style\.left = px\(L\.x\)/.test(skins));

  // boyut değişince yeniden uygulanıyor mu?
  kontrol('PZA.apply() boyut değişince applySkin() çağırıyor',
    /if \(PZA\.applySkin\) PZA\.applySkin\(\);/.test(settings));
  kontrol('fit() bayat hedefte erken çıkmıyor (plaka ölçüsü farkı sıfırlanıyor)',
    /sonH = -1; sonG = -1;/.test(app));
  kontrol('clearPlate yeni CSS değişkenlerini de temizliyor',
    /--plate-olan/.test(skins));
}

console.log('\n3 · Aurora\'da Notlar paneli: okunmuyor + kapanmıyor\n');
{
  const notes = oku('src/js/notes.js');
  const css = oku('src/styles/widget.css');

  // panel plakada position:fixed + opak zemin alıyor mu?
  kontrol('plakada .panel-notes position:fixed',
    /\.widget\.plaka > \.panel-notes[\s\S]*?position:\s*fixed/.test(css));
  kontrol('plakada panel OPAK zemin alıyor (yarı saydam metni gizliyordu)',
    /\.widget\.plaka > \.panel-notes[\s\S]*?background:\s*var\(--bg-1/.test(css));
  // Not: kural yorum satırı içinde olduğu için CSS yorumlarını temizle
  const cssTemiz = css.replace(/\/\*[\s\S]*?\*\//g, '');
  kontrol('plaka görseli panel açıkken kapatılıyor (metin okunur olsun)',
    /\.widget\.plaka:has\(>\s*\.panel-notes:not\(\[hidden\]\)\),[\s\S]{0,90}?\.widget\.plaka:has\(>\s*\.panel-weather:not\(\[hidden\]\)\)\s*\{[^}]*background:\s*var\(--bg-1/.test(cssTemiz));
  kontrol('panel açıkken alt/üst bar GİZLENİYOR (metin saati biniyordu)',
    /\.widget\.plaka:has\(> \.panel-notes:not\(\[hidden\]\)\) \.bar-bottom/.test(css));
  kontrol('panel yukarı yaslandığında yukarı çıkıyor (klasikle aynı)',
    /\.widget\.plaka\.yukari > \.panel-notes/.test(css));
  kontrol('hava paneli de aynı kuralları alıyor',
    /\.widget\.plaka > \.panel-weather/.test(css));

  // KAPANMA YOLLARI (kapanmıyordu)
  kontrol('Escape ile Notlar paneli kapanıyor',
    /ev\.key !== 'Escape'/.test(notes) && /PZA\.closeNotes\(\)/.test(notes));
  kontrol('panel DIŞINA tıklayınca kapanıyor',
    /const dokun = ev =>/.test(notes) && /PZA\.closeNotes\(\);/.test(notes));
  kontrol('panel başlığına KAPAT düğmesi ekleniyor',
    /panel-kapat/.test(notes) && /aria-label/.test(notes));
  kontrol('kapatma sadece panel içindeki tıklamada TETİKLENMİYOR (yoksa anında kapanır)',
    /const icinde = el =>[\s\S]{0,120}el\.contains\(hedef\)/.test(notes));
  kontrol('takvim katmanı açıkken Escape önce takvimi kapatıyor',
    /PZA\.calOpen\(\)[\s\S]*?PZA\.closeCal\(\)/.test(notes));
  kontrol('hava paneli de kapanabiliyor',
    /PZA\.closeWeather\?\.\(\)/.test(notes));
}

console.log(`\nSONUC: ${kaldi === 0 ? 'temiz' : kaldi + ' basarisiz'} — ${gecti} kontrol`);
process.exit(kaldi === 0 ? 0 : 1);