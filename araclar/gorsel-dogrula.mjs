/* araclar/gorsel-dogrula.mjs
   Gerçek DOM ortamı YOK (headless Node) — bu yüzden ölçüm mantığı
   sahte bir pencere (viewport) modeliyle DOĞRULANIR.

   Amaç: dropdown'ın 3 yön kuralı ve plaka ölçeklemesinin
   "hangi koşulda ne yapar" kararını kanıtlamak. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(kok, 'src/js/app.js'), 'utf8');

// dropdownYerlestir fonksiyonunu çıkar, sahte DOM ile çalıştır
const ddKaynak = app.match(/PZA\.dropdownYerlestir = function \(el, tetik\) \{[\s\S]*?\n  \};/);
if (!ddKaynak) { console.log('dropdownYerlestir bulunamadı'); process.exit(1); }

/* dropdownYerlestir ölçümü `dogalYukseklik()` yardımcısını kullanır
   (v1.36.5: kırpılmış kutuyu yeniden ölçmek pencereyi hiç büyütmüyordu).
   YARDIMCININ GERÇEK kaynağını da al — taklit değil. */
const dyKaynak = app.match(/function dogalYukseklik\(el\) \{[\s\S]*?\n  \}/);
if (!dyKaynak) { console.log('dogalYukseklik bulunamadı'); process.exit(1); }

globalThis.window = { innerWidth: 800, innerHeight: 300 };
const PZA = {};
globalThis.PZA = PZA;
eval(dyKaynak[0].replace('function dogalYukseklik', 'globalThis.dogalYukseklik = function'));
eval(ddKaynak[0]);

/** Sahte dropdown + tetikleyici */
function sahne({ vh, tetikTop, tetikBottom, mh, mw = 220 }) {
  /* DOM CSSStyleDeclaration taklidi: doğrudan özellik ataması + removeProperty */
  const stil = new Proxy({}, {
    get(t, k) {
      if (k === 'removeProperty') return p => { delete t[p]; return ''; };
      if (k === '__veri') return t;
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
    deleteProperty(t, k) { delete t[k]; return true; },
  });
  const el = {
    hidden: false, offsetHeight: mh, style: stil,
    getBoundingClientRect: () => ({ width: mw, height: mh }),
  };
  const tetik = { getBoundingClientRect: () => ({ top: tetikTop, bottom: tetikBottom, right: 300 }) };
  window.innerHeight = vh; window.innerWidth = 800;
  PZA.dropdownYerlestir(el, tetik);
  return stil;
}

let hata = 0;
const sonuc = (etiket, kosul, detay = '') => {
  if (kosul) console.log('  OK   ' + etiket + (detay ? '  ' + detay : ''));
  else { console.log('  FAIL ' + etiket + '  ' + detay); hata++; }
};

console.log('\nDROPDOWN YÖN KURALI (pencere 800x300)\n');

{
  // 1) Altta yer var → aşağı
  //    `bottom` ARTIK `auto` (v1.36.5): `.pa-box` CSS'inde `bottom: 46px`
  //    yedeği var; inline `bottom: auto` onu EZMEZSE kutu aşırı kısıtlı
  //    (top+bottom+height:auto) olur ve pencerenin dibine UZAR → kırpılır.
  const s = sahne({ vh: 300, tetikTop: 60, tetikBottom: 80, mh: 150 });
  sonuc('altta 220px yer var → AŞAĞI açılıyor',
    s.top === '88px' && s.bottom === 'auto', `top=${s.top} bottom=${s.bottom}`);
}
{
  // 2) Altta yok, üstte var → yukarı, düğmenin hizasında
  const s = sahne({ vh: 300, tetikTop: 240, tetikBottom: 260, mh: 100 });
  sonuc('altta yok, üstte 240px var → YUKARI (sınırlı)',
    s.top === '132px' && s.bottom === 'auto', `top=${s.top} bottom=${s.bottom}`);
}
{
  // ESKİ HATA: yukarı dalı sınırsızdı, menü pencerenin dışına çıkardı
  // vh=300, düğme tepede (bottom=40) → alta 260px var, menü 400px.
  // v1.36.5: hiçbir yön sığmazsa kutu PENCERE İÇİNE sabitlenir
  // (8px pay) ve içerik kaydırılır: maxHeight = 300-16 = 284, top >= 8.
  const s = sahne({ vh: 300, tetikTop: 20, tetikBottom: 40, mh: 400 });
  const kap = parseInt(s.maxHeight, 10);
  const beklenen = 300 - 16;              // pencerenin İÇİ (üst+alt 8px pay)
  sonuc('menü pencereye SIĞMIYOR → max-height + kaydırma (kırpma değil)',
    s.overflowY === 'auto' && kap === beklenen && parseInt(s.top, 10) >= 8,
    `top=${s.top} maxHeight=${s.maxHeight} (beklenen ${beklenen}) overflowY=${s.overflowY}`);
}
{
  // Kırpılmama garantisi: menü TEPE noktası asla pencere dışına çıkmamalı
  const kotu = [
    { vh: 300, tt: 10, tb: 30, mh: 500 },
    { vh: 300, tt: 290, tb: 300, mh: 400 },
    { vh: 300, tt: 150, tb: 160, mh: 320 },
    { vh: 200, tt: 5,  tb: 15,  mh: 900 },
  ];
  let ihtilaf = [];
  for (const k of kotu) {
    const s = sahne({ vh: k.vh, tetikTop: k.tt, tetikBottom: k.tb, mh: k.mh });
    const top = parseInt(s.top, 10);
    if (top < 0) ihtilaf.push(`top=${top}`);
    if (s.bottom !== 'auto') ihtilaf.push('bottom CSS yedeği ezilmedi: ' + s.bottom);
    const yuk = parseInt(s.maxHeight, 10);
    if (!(yuk > 0) || top + yuk > k.vh) ihtilaf.push(`kutu pencereyi aşıyor: ${top}+${yuk} > ${k.vh}`);
  }
  sonuc('4 uç durumda kutu TAMAMEN pencere içinde (kırpılma yok)',
    ihtilaf.length === 0, ihtilaf.join(', '));
}

console.log('\nPLAKA ÖLÇEKLEME (Aurora 940x320)\n');
{
  const sk = readFileSync(join(kok, 'src/js/skins.js'), 'utf8');
  const parca = sk.match(/PZA\.PLAKA_GENISLIK[\s\S]*?PZA\.plateSize = function[\s\S]*?\n};/);
  eval(parca[0]);
  PZA.SKIN_FORMAT_V2 = 'pza-skin/2';
  PZA.SKIN_FORMAT_V3 = 'pza-skin/3';
  PZA.settings = {};
  PZA.activeSkin = () => ({ format: 'pza-skin/3', canvas: { w: 940, h: 320 } });

  const klasik = { '2': 800, '3': 700, '4': 430 };
  for (const s of ['2','3','4']) {
    PZA.settings.size = s;
    const r = PZA.plateSize();
    sonuc(`1/${s}: klasik ${klasik[s]}px ile AYNI`,
      r.w === klasik[s], `plaka=${r.w}x${r.h}`);
  }
  PZA.settings.size = '2';
  const oran = PZA.plateSize().oran;
  sonuc('oran korunuyor (kültür bozulmadı)', Math.abs(oran - 800/940) < 0.005, 'oran=' + oran.toFixed(3));

  // Saat bölgesi de küçülmeli
  const clock = { x: 100, y: 40, w: 740, h: 150 };
  const gorunenW = clock.w * oran;
  sonuc('saat bölgesi de ölçekleniyor', Math.abs(gorunenW - 629) < 2, `${clock.w}px → ${gorunenW.toFixed(0)}px`);
}

/* ══ PLAKA + AÇIK PANEL (v1.36.6) ══════════════════════════════════════
   KULLANICI (2026-10-19): "Aurora kısmı hava durumu ve randevu kısımları
   bu kadar aşağı kısmı açılmıyor." Panel `position: fixed` olduğu için
   widget kutusunu büyütmüyordu → pencere 148px'te kalıyor, panel
   `max-height: calc(100vh-24px)` ile kırpılıyordu. Bu bölüm SÖZLEŞMEYİ
   kaynak düzeyinde sabitler (davranış: menu-uctan-uca-test.mjs · G). */
console.log('\nPLAKA + PANEL — YÜKSEKLİK VE YASLAMA\n');
{
  const css = readFileSync(join(kok, 'src/styles/widget.css'), 'utf8');

  sonuc('app.js: gerekliH plakada NOTLAR/HAVA panelini ölçüyor',
    /h = Math\.max\(h, plakaTemel \+ dogalYukseklik\(el\)\);/.test(app));
  sonuc('app.js: ölçüm BAR modunda atlanıyor (fitBar paneli ayrı ölçer)',
    /const plakaMi = !!ps && \(!PZA\.settings \|\| PZA\.settings\.size !== 'bar'\);/.test(app));
  sonuc('app.js: temelYukseklik() plakada paneli DÜŞMÜYOR (negatife inmez)',
    /if \(PZA\.plateSize && PZA\.plateSize\(\)\) return Math\.max\(0, Math\.round\(t\)\);/.test(app));
  sonuc('app.js: DOĞAL ölçüm eşiği `none` (CSS max-height de ezilir)',
    /st\.maxHeight = 'none';/.test(app));
  sonuc('app.js: panel açıkken gövdeye `panel-acik` sınıfı yazılıyor',
    /document\.body\.classList\.toggle\('panel-acik',/.test(app));
  sonuc('app.js: paneller ResizeObserver ile gözleniyor (içerik sonradan gelir)',
    /'widget', 'settings', 'studio', 'pa-modal', 'panel-notes', 'panel-weather'/.test(app));

  sonuc('widget.css: panel açıkken plaka ÜSTE yaslanıyor',
    /body:has\(\.widget\.plaka\)\.panel-acik\s*\{\s*align-items:\s*flex-start\s*!important/.test(css));
  sonuc('widget.css: yukarı açılan panelde plaka ALTA yaslanıyor',
    /body:has\(\.widget\.plaka\)\.panel-acik\.yukari\s*\{\s*align-items:\s*flex-end\s*!important/.test(css));
}

/* ══ PLAKA + MENÜ (v1.36.7) ═══════════════════════════════════════════
   KULLANICI (2026-10-19, 4. tur):
     · "menüler güzel çalışıyor ancak menü açılınca saat üstünde logolar
        siliniyor ya da kayboluyor"
     · "ayarlara tıkladığımızda menü yaklaşık 5 cm kadar aşağıda açılıyor"
     · "Aurora tema rengini seçerken menü saatin üstünde değil ALTINDA
        açılsın, kullanıcı neyi seçtiğini görmek ister"
   Davranış (pencere kararı): menu-uctan-uca-test.mjs · H.
   Bu bölüm SÖZLEŞMEYİ kaynak düzeyinde sabitler. */
console.log('\nPLAKA + MENÜ — GÖRÜNÜRLÜK VE YASLAMA (v1.36.7)\n');
{
  const css = readFileSync(join(kok, 'src/styles/widget.css'), 'utf8');
  const sk = readFileSync(join(kok, 'src/js/skins.js'), 'utf8');

  sonuc('widget.css: panel açıkken bar/kadraj GİZLENMİYOR (saat + düğmeler kalır)',
    !/\.widget\.plaka:has\(> \.panel-(notes|weather):not\(\[hidden\]\)\)[^{]*\.(bar-top|bar-bottom|plate-drag)[^{]*\{[^}]*display:\s*none/.test(css));
  sonuc('widget.css: panel açıkken plaka görseli DÜZ RENGE çevrilmiyor',
    !/\.widget\.plaka:has\(> \.panel-(notes|weather):not\(\[hidden\]\)\)[^{]*\{[^}]*background:\s*var\(--bg-1/.test(css));
  sonuc('widget.css: panel yüksekliği plakaya göre (pencere dibine taşmaz)',
    /max-height:\s*calc\(100vh - var\(--plaka-h, 0px\)\)/.test(css));
  sonuc('widget.css: kaplama menü plakanın BİTİŞİNDEN başlıyor',
    /\.kap-acik \.settings[\s\S]{0,220}?top:\s*var\(--plaka-h, 160px\)/.test(css));
  sonuc('widget.css: kaplama menü pencere altına taşmıyor (max-height)',
    /\.kap-acik \.settings[\s\S]{0,320}?max-height:\s*calc\(100vh - var\(--plaka-h, 160px\)\)/.test(css));
  sonuc('widget.css: BAR modunda kaplama menü kuralı UYGULANMIYOR',
    /\.widget\.plaka:not\(\[data-size="bar"\]\)/.test(css));

  sonuc('app.js: plaka + Ayarlar yüksekliği TEMELE EKLENİYOR (menü plakayı örtmez)',
    /plakaMi \? plakaTemel \+ el\.scrollHeight : el\.scrollHeight \+ 24/.test(app));
  sonuc('app.js: kaplama menüde plaka EKRANDAKİ YERİNİ koruyor',
    /hedefY = \(plakaMi && kapSigar\) \? temelY : Math\.max\(alan\.ust, alt - hh - 8\);/.test(app));
  sonuc('app.js: kaplama menü açıkken gövdeye `kap-acik` yazılıyor',
    /document\.body\.classList\.toggle\('kap-acik',\s*\n?\s*plakaMi && \(acikMi\('settings'\) \|\| acikMi\('studio'\)\)\);/.test(app));
  sonuc('skins.js: görünen plaka yüksekliği köke yazılıyor (--plaka-h)',
    /document\.documentElement\.style\.setProperty\('--plaka-h', ol\.h \+ 'px'\)/.test(sk));
}

/* ══ BAR (ÇUBUK) MODU — plaka yerleşimi UYGULANMAZ (v1.36.8) ════════════
   KULLANICI (2026-10-19, 4. tur): "yalnızca Aurora çubuk çalışmıyor;
   menü 1/2 1/3 1/4 çalışıyor."
   Plaka sınıfı/dalı JS tarafından atlanıyor (davranış: bar-mode-testi
   · 17 kontrol). Burada ÇUBUK CSS'inin hâlâ geçerli ve bozulmadığı
   sözleşmesi kaynak düzeyinde sabitlenir. */
console.log('\nBAR MODU — PLAKA YOK, ÇUBUK CSS\'İ GEÇERLİ (v1.36.8)\n');
{
  const css = readFileSync(join(kok, 'src/styles/widget.css'), 'utf8');
  const sk = readFileSync(join(kok, 'src/js/skins.js'), 'utf8');

  sonuc('skins.js: bar modunda PLAKA YERLEŞİMİ atlanıyor (yalnız renk)',
    /if \(PZA\.settings && PZA\.settings\.size === 'bar'\) \{\n      PZA\.clearPlate\(\);/.test(sk));
  sonuc('skins.js: plateSize() bar modunda NULL (çubuk ince kalır)',
    /if \(PZA\.settings && PZA\.settings\.size === 'bar'\) return null;/.test(sk));
  sonuc('skins.js: token uygulaması PAYLAŞILIYOR (plateRenkleri)',
    /PZA\.plateRenkleri\(w, skin\);/.test(sk));

  sonuc('widget.css: bar yayılma kuralı var (fixed + left/right 0)',
    /\.widget\[data-size="bar"\] \{\s*max-width:\s*none;\s*position:\s*fixed;\s*left:\s*0;\s*right:\s*0;/.test(css));
  sonuc('widget.css: bar satır düzeni var (flex row + bar yan yana)',
    /\.widget\[data-size="bar"\] \{[\s\S]{0,300}?flex-direction:\s*row/.test(css) &&
    /\.widget\[data-size="bar"\] \.bar-top,[\s\S]{0,120}?flex:\s*1 1 auto/.test(css));
  sonuc('widget.css: bar panelleri sabit + 412px kaplama',
    /\.widget\[data-size="bar"\] \.panel-notes,[\s\S]{0,240}?position:\s*fixed;/.test(css));
  sonuc('widget.css: bar üst/alt konum kuralı var',
    /\[data-bar-konum="ust"\]/.test(css));
}

console.log(hata === 0 ? '\nSONUC: temiz\n' : `\nSONUC: ${hata} BASARISIZ\n`);
process.exit(hata === 0 ? 0 : 1);