/* araclar/test-dogrulama.mjs
   Regresyon testlerinin GERÇEKTEN hatayı yakaladığını kanıtlar.
   Bilinen bir hatayı yapay olarak geri getirir, ilgili testin DÜŞMESİ
   gerektiğini gösterir, sonra düzeltmeyi geri koyar.

   Kural (kullanıcı isteği): "hatayı geri koyduğumda test geçiyorsa o
   test işe yaramaz". Bir senaryo hedef deseni tutmuyorsa burada
   UYARI olarak bildirilir, sessizce atlanmaz.

   Çalıştırma:  npm run test:guvenilirlik                          */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const yol = f => join(kok, f);

/* Testleri bu süreçte değil, AYRI süreçte çalıştır (dosya bozukken
   modül önbelleği karışmasın). */
const calistir = (test) => {
  try {
    execFileSync(process.execPath, [yol(test)], { cwd: kok, encoding: 'utf8', stdio: 'pipe' });
    return { kod: 0 };
  } catch (e) {
    return { kod: e.status ?? 1, cikti: (e.stdout || '') + (e.stderr || '') };
  }
};

/* ── Hedef parçalar (KODUN GERÇEK YAPISINA dayanır) ─────────────── */
const H = {
  'src/js/app.js': {
    gerekliH: /const gerekliH = \(\) => \{[\s\S]*?\n    \};/,
    gerekliG: /const gerekliG = \(\) => \{[\s\S]*?\n    \};/,
    ezanOlcum: /if \(acikMi\('ezan-menu'\)\) \{[\s\S]{0,200}?\n      \}/,
    paOlcum: /if \(acikMi\('pa-modal'\)\) \{[\s\S]{0,320}?\n      \}/,
    erkenCikis: /if \(!istenenH \|\|[\s\S]{0,120}?\) return;\n      sonH = istenenH; sonG = g;/,
    /* PA ve ezan düğmeleri blok içindeki `fit`i çıplak çağırıyordu:
       "Uncaught ReferenceError: fit is not defined" → pencere büyümüyor. */
    paFitCagrisi: /    PZA\._fit\?\.\(\);\n    paYerlestir\(\);/,
    /* `paBtn` hiç tanımlı değildi → PA popup'ı dışına tıklayınca kapanmıyordu. */
    paBtnTanimi: /    const paBtn = \$\(.pa-btn.\);\n/
  },
  'src/js/notes.js': {
    /* v1.36.3'te CANLIYA GİDEN yazım hatası: dosyanın geri kalanını
       (takvim + openCal/closeCal/renderCal) tanımsız bıraktı. */
    yazimHatasi: /if \(yukleniyor && dinleyebilir\) document\.addEventListener\('DOMContentLoaded', calistir\);/,
    tetikGuard: /    let d = hedef;\n    while \(d\) \{\n      if \(typeof d\.getAttribute === 'function'\n          && d\.getAttribute\('data-panel-tetik'\) !== null\) return;\n      d = d\.parentElement \|\| null;\n    \}/
  },
  'src/js/settings.js': {
    tiklanirKurali: /    const tiklanir = TIKLANIR\.has\(el\.tagName\) \|\|\n      \(el\.hasAttribute && el\.hasAttribute\('contenteditable'\)\);\n    if \(kilitli \|\| tiklanir\) el\.removeAttribute\('data-tauri-drag-region'\);\n    else el\.setAttribute\('data-tauri-drag-region', ''\);/
  },
  'src/index.html': {
    notlarTetik: /<button id="btn-notes" class="btn-notes" aria-expanded="false" data-panel-tetik="1">/,
    havaDugmesi: /<button id="weather-tile" class="tile" data-panel-tetik="1">/
  }
};

const senaryolar = [
  {
    ad: 'v1.36.2 hatası: gerekliH() plakada erken çıkıyor',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'gerekliH',
      yeni: `const gerekliH = () => {
      const ps = PZA.plateSize && PZA.plateSize();
      if (ps) return Math.ceil(ps.h);
      let h = 0;
      const w = document.getElementById('widget');
      if (w) h = w.getBoundingClientRect().height;
      for (const id of ['settings', 'studio']) {
        const el = document.getElementById(id);
        if (el && !el.hidden) h = Math.max(h, el.scrollHeight + 24);
      }
      return Math.ceil(h);
    };`
    }]
  },
  {
    ad: 'gerekliG() plakada erken çıkıyor (Stüdyo 470px kırpılır)',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'gerekliG',
      yeni: `const gerekliG = () => {
      const ps = PZA.plateSize && PZA.plateSize();
      if (ps) return Math.ceil(ps.w);
      let g = 0;
      const w = document.getElementById('widget');
      if (w) {
        const m = parseFloat(getComputedStyle(w).maxWidth);
        if (isFinite(m) && m > 0) g = m;
      }
      for (const id of ['settings', 'studio']) {
        const el = document.getElementById(id);
        if (el && !el.hidden) {
          const r = el.getBoundingClientRect().width;
          if (r > 0) g = Math.max(g, r);
        }
      }
      return Math.ceil(g);
    };`
    }]
  },
  {
    ad: 'ezan menüsü ölçülmüyor (ekH = 0)',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'ezanOlcum',
      yeni: `if (false) {
        const em = document.getElementById('ezan-menu');
        if (em) ekH = Math.max(ekH, em.offsetHeight || em.scrollHeight || 0);
      }`
    }]
  },
  {
    ad: 'PA kutusu ölçülmüyor',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'paOlcum',
      yeni: `if (false) {
        const pm = document.getElementById('pa-modal');
        const kutu = pm && pm.querySelector ? pm.querySelector('.pa-box') : null;
        const o = kutu || pm;
        if (o) ekH = Math.max(ekH, o.offsetHeight || o.scrollHeight || 0);
      }`
    }]
  },
  {
    ad: 'v1.36.1 hatası: erken çıkış `h` ile karşılaştırıyor (ekH yok sayılıyor)',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'erkenCikis',
      yeni: `if (!istenenH || (Math.abs(istenenH - ekH - sonH) < 3 && Math.abs(g - sonG) < 3)) return;
      sonH = istenenH; sonG = g;`
    }]
  },
  {
    ad: 'v1.36.3 CANLI hatası: notes.js yazım hatası → takvim/hava API\'leri hiç tanımlanmıyor',
    test: 'araclar/yukleme-testi.mjs',
    degisiklikler: [{
      dosya: 'src/js/notes.js', hedef: 'yazimHatasi',
      yeni: `if (yukleniyor && dinlenebilir) document.addEventListener('DOMContentLoaded', calistir);`
    }]
  },
  {
    ad: 'v1.36.3 CANLI hatası: panel kendi tetikleyicisinin tıklamasıyla kapanıyor',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/notes.js', hedef: 'tetikGuard',
      yeni: '    let d = hedef;'
    }]
  },
  {
    ad: 'Açan düğme `data-panel-tetik` işaretini kaybediyor',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [{
      dosya: 'src/index.html', hedef: 'notlarTetik',
      yeni: '<button id="btn-notes" class="btn-notes" aria-expanded="false">'
    }]
  },
  {
    ad: 'Hava düğmesi yeniden TAŞIMA BÖLGESİ yapılıyor (Tauri tıklamayı sürükler)',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [
      {
        dosya: 'src/index.html', hedef: 'havaDugmesi',
        yeni: '<button id="weather-tile" class="tile" data-drag="1" data-panel-tetik="1">'
      },
      {
        dosya: 'src/js/settings.js', hedef: 'tiklanirKurali',
        yeni: `    if (kilitli) el.removeAttribute('data-tauri-drag-region');
    else el.setAttribute('data-tauri-drag-region', '');`
      }
    ]
  },
  {
    ad: 'v1.36.3 CANLI hatası: PA düğmesi blok dışındaki `fit()`i çağırıyor (ReferenceError)',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'paFitCagrisi',
      yeni: '    fit();\n    paYerlestir();'
    }]
  },
  {
    ad: 'v1.36.3 CANLI hatası: `paBtn` tanımsız → PA popup dışına tıklayınca kapanmıyor',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [
      { dosya: 'src/js/app.js', hedef: 'paBtnTanimi', yeni: '' }
    ]
  }
];

console.log('\nTEST DOĞRULAMA — testler gerçekten hataları yakalıyor mu?\n');

const yedek = new Map();
for (const f of Object.keys(H)) yedek.set(f, readFileSync(yol(f), 'utf8'));

let yakalayan = 0, anlamsiz = 0;
try {
  for (const s of senaryolar) {
    /* 1) Hedef parçalar gerçekten var mı? */
    let desenSorunu = null;
    for (const d of s.degisiklikler) {
      const kaynak = yedek.get(d.dosya);
      if (!kaynak) { desenSorunu = `${d.dosya} okunamadı`; break; }
      if (!H[d.dosya] || !H[d.dosya][d.hedef]) { desenSorunu = `"${d.hedef}" deseni tanımsız`; break; }
      if (!H[d.dosya][d.hedef].test(kaynak)) { desenSorunu = `HEDEF KOD BULUNAMADI ("${d.hedef}" — desen geçersiz)`; break; }
    }
    if (desenSorunu) {
      anlamsiz++;
      console.log(`  ⚠  ${s.ad}\n     ${desenSorunu}`);
      continue;
    }

    /* 2) Hatayı geri koy (aynı dosyaya birden çok değişiklik KÜMÜLATİF
       uygulanır — ikincisi birincinin sonucunu ezmesin). */
    const mevcut = new Map(yedek);
    for (const d of s.degisiklikler) {
      const onceki = mevcut.get(d.dosya);
      const sonrasi = onceki.replace(H[d.dosya][d.hedef], d.yeni);
      if (sonrasi === onceki) {
        desenSorunu = `BOZMA DESENİ TUTMADI (${d.hedef})`;
        break;
      }
      mevcut.set(d.dosya, sonrasi);
    }
    if (desenSorunu) {
      anlamsiz++;
      console.log(`  ⚠  ${s.ad}\n     ${desenSorunu}`);
      yedek.forEach((icerik, f) => writeFileSync(yol(f), icerik, 'utf8'));
      continue;
    }
    mevcut.forEach((icerik, f) => writeFileSync(yol(f), icerik, 'utf8'));

    /* 3) İlgili test DÜŞMELİ */
    const r = calistir(s.test);
    yedek.forEach((icerik, f) => writeFileSync(yol(f), icerik, 'utf8'));

    if (r.kod !== 0) {
      yakalayan++;
      const satirlar = (r.cikti || '').split('\n')
        .filter(l => l.includes('FAIL') || /^\s+X\s/.test(l)).map(l => l.trim());
      console.log(`  ✓  ${s.ad}`);
      console.log(`     → TEST DÜŞTÜ (${satirlar.length} kontrol) · ${s.test}`);
      satirlar.slice(0, 3).forEach(z => console.log('       ' + z));
    } else {
      console.log(`  ✗  ${s.ad}`);
      console.log(`     → ${s.test} GEÇTİ! Bu hata yakalanamıyor — test yetersiz`);
    }
  }
} finally {
  yedek.forEach((icerik, f) => writeFileSync(yol(f), icerik, 'utf8'));
}

console.log(`\n${yakalayan}/${senaryolar.length} yapay hata yakalandı`
  + (anlamsiz ? ` (${anlamsiz} senaryo anlamsız: desen tutmadı)` : ''));
console.log((yakalayan === senaryolar.length && !anlamsiz)
  ? 'SONUC: testler güvenilir — bilinen hataları kaçırmıyor\n'
  : 'SONUC: TEST EKSİK — bazı hatalar kaçıyor\n');
process.exit((yakalayan === senaryolar.length && !anlamsiz) ? 0 : 1);
