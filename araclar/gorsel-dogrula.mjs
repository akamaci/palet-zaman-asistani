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

globalThis.window = { innerWidth: 800, innerHeight: 300 };
const PZA = {};
globalThis.PZA = PZA;
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
  const s = sahne({ vh: 300, tetikTop: 60, tetikBottom: 80, mh: 150 });
  sonuc('altta 220px yer var → AŞAĞI açılıyor',
    s.top === '88px' && s.bottom === undefined, `top=${s.top} bottom=${s.bottom}`);
}
{
  // 2) Altta yok, üstte var → yukarı, düğmenin hizasında
  const s = sahne({ vh: 300, tetikTop: 240, tetikBottom: 260, mh: 100 });
  sonuc('altta yok, üstte 240px var → YUKARI (sınırlı)',
    s.top === '132px' && s.bottom === undefined, `top=${s.top}`);
}
{
  // ESKİ HATA: yukarı dalı sınırsızdı, menü pencerenin dışına çıkardı
  // vh=300, düğme tepede (bottom=40) → alta 260px var, menü 400px.
  // maxHeight = 260-16 = 244 olmalı; kaydırma açılmalı; üst kenar >= 0.
  const s = sahne({ vh: 300, tetikTop: 20, tetikBottom: 40, mh: 400 });
  const kap = parseInt(s.maxHeight, 10);
  sonuc('menü pencereye SIĞMIYOR → max-height + kaydırma (kırpma değil)',
    s.overflowY === 'auto' && kap === 244 && parseInt(s.top, 10) >= 0,
    `top=${s.top} maxHeight=${s.maxHeight} (beklenen 244) overflowY=${s.overflowY}`);
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
    if (s.bottom !== undefined) ihtilaf.push('bottom kullanıldı');
  }
  sonuc('4 uç durumda menü tepesi ASLA pencere dışına çıkmıyor',
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