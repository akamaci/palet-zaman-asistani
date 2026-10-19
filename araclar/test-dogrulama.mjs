/* araclar/test-dogrulama.mjs
   Regresyon testinin GERÇEKTEN hatayı yakaladığını kanıtlar.
   Bilinen bir hatayı yapay olarak geri getirir, testin DÜŞMESİ
   gerektiğini gösterir, sonra düzeltmeyi geri koyar. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const hedef = join(kok, 'src/js/app.js');
const orijinal = readFileSync(hedef, 'utf8');
writeFileSync(join(kok, '.app-yedek.js'), orijinal, 'utf8');

const calistir = () => {
  try {
    execFileSync(process.execPath, [join(kok, 'araclar/menu-uctan-uca-test.mjs')],
      { cwd: kok, encoding: 'utf8', stdio: 'pipe' });
    return { kod: 0 };
  } catch (e) {
    return { kod: e.status ?? 1, cikti: (e.stdout || '') + (e.stderr || '') };
  }
};

/* Bozma desenleri KODUN GERÇEK YAPISINA dayanır. Önce hedef
   parçanın var olduğunu doğrula; yoksa desen sessizce tutmaz
   (2026-10-19: 4 senaryodan 1'i ancak tutuyordu, 3'ü boştu —
   test "yeşil" görünüyordu ama hiçbir şey doğrulamıyordu). */
const hedefler = {
  gerekliH: /const gerekliH = \(\) => \{[\s\S]*?\n    \};/,
  gerekliG: /const gerekliG = \(\) => \{[\s\S]*?\n    \};/,
  ezanOlcum: /if \(acikMi\('ezan-menu'\)\) \{[\s\S]{0,200}?\n      \}/,
  paOlcum: /if \(acikMi\('pa-modal'\)\) \{[\s\S]{0,320}?\n      \}/,
  erkenCikis: /if \(!istenenH \|\|[\s\S]{0,120}?\) return;\n      sonH = istenenH; sonG = g;/,
};

const senaryolar = [
  {
    ad: 'v1.36.2 hatası: gerekliH() plakada erken çıkıyor',
    anahtar: 'gerekliH',
    boz: s => s.replace(hedefler.gerekliH,
      `const gerekliH = () => {
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
    };`),
  },
  {
    ad: 'gerekliG() plakada erken çıkıyor (Stüdyo 470px kırpılır)',
    anahtar: 'gerekliG',
    boz: s => s.replace(hedefler.gerekliG,
      `const gerekliG = () => {
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
    };`),
  },
  {
    ad: 'ezan menüsü ölçülmüyor (ekH = 0)',
    anahtar: 'ezanOlcum',
    boz: s => s.replace(hedefler.ezanOlcum,
      `if (false) {
        const em = document.getElementById('ezan-menu');
        if (em) ekH = Math.max(ekH, em.offsetHeight || em.scrollHeight || 0);
      }`),
  },
  {
    ad: 'PA kutusu ölçülmüyor',
    anahtar: 'paOlcum',
    boz: s => s.replace(hedefler.paOlcum,
      `if (false) {
        const pm = document.getElementById('pa-modal');
        const kutu = pm && pm.querySelector ? pm.querySelector('.pa-box') : null;
        const o = kutu || pm;
        if (o) ekH = Math.max(ekH, o.offsetHeight || o.scrollHeight || 0);
      }`),
  },
  {
    ad: 'v1.36.1 hatası: erken çıkış `h` ile karşılaştırıyor (ekH yok sayılıyor)',
    anahtar: 'erkenCikis',
    boz: s => s.replace(hedefler.erkenCikis,
      `if (!istenenH || (Math.abs(istenenH - ekH - sonH) < 3 && Math.abs(g - sonG) < 3)) return;
      sonH = istenenH; sonG = g;`),
  },
];

console.log('\nTEST DOĞRULAMA — test gerçekten hatayı yakalıyor mu?\n');

let yakalayan = 0;
try {
  for (const s of senaryolar) {
    // Önce hedef parça kodda VARMI diye bak — yoksa senaryo anlamsızdır
    if (!hedefler[s.anahtar].test(orijinal)) {
      console.log(`  ⚠  ${s.ad}\n     HEDEF KOD BULUNAMADI ("${s.anahtar}") — desen geçersiz`);
      continue;
    }
    const bozuk = s.boz(orijinal);
    if (bozuk === orijinal) {
      console.log(`  ⚠  ${s.ad}\n     BOZMA DESENİ TUTMADI (test anlamlı değil)`);
      continue;
    }
    writeFileSync(hedef, bozuk, 'utf8');
    const r = calistir();
    const dustu = r.kod !== 0;
    if (dustu) {
      yakalayan++;
      const satirlar = (r.cikti || '').split('\n').filter(l => l.includes('FAIL')).map(l => l.trim());
      console.log(`  ✓  ${s.ad}`);
      console.log(`     → TEST DÜŞTÜ (${satirlar.length} kontrol)`);
      satirlar.slice(0, 3).forEach(x => console.log('       ' + x));
    } else {
      console.log(`  ✗  ${s.ad}`);
      console.log('     → TEST GEÇTİ! Bu hata testle yakalanamıyor — test yetersiz');
    }
  }
} finally {
  writeFileSync(hedef, orijinal, 'utf8');
}

console.log(`\n${yakalayan}/${senaryolar.length} yapay hata yakalandı`);
console.log(yakalayan === senaryolar.length
  ? 'SONUC: test güvenilir — bilinen hataları kaçırmıyor\n'
  : 'SONUC: TEST EKSİK — bazı hatalar kaçıyor\n');
process.exit(yakalayan === senaryolar.length ? 0 : 1);