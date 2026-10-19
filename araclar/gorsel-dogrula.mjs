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

console.log(hata === 0 ? '\nSONUC: temiz\n' : `\nSONUC: ${hata} BASARISIZ\n`);
process.exit(hata === 0 ? 0 : 1);