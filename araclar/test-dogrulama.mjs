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
    paBtnTanimi: /    const paBtn = \$\(.pa-btn.\);\n/,
    /* v1.36.3 CANLI hatası: PA düğmesi blok içindeki `fit`i ÇIPLAK çağırıyordu
       ("Uncaught ReferenceError: fit is not defined") → pencere büyümüyor,
       menü kırpılıyor. Doğrusu: `PZA._fit?.()` (opsiyonel zincir). */
    paFitCagrisi: /    const s = PZA\._fit\?\.\(\);\n/,
    /* v1.36.4 CANLI hatası: `.pa-box` CSS'inde `bottom: 46px` YEDEĞİ var.
       JS yalnız inline `top` yazıp inline `bottom`'u silerse kutu AŞIRI
       KISITLI olur (`top`+`bottom`+`height:auto`) → pencere dibine uzar,
       `offsetHeight` ~200px yerine ~28px ölçülür → pencere büyümez,
       kutu 148px'lik pencerede kırpılır ("menü açılmıyor"). */
    paBottom: /\n    el\.style\.bottom = 'auto';\n/,
    /* v1.36.6 CANLI hatası: plakada paneller `position: fixed` → widget
       kutusunu BÜYÜTMEZ. `gerekliH()` paneli saymazsa hedef yükseklik
       değişmez → `fit()` erken çıkar → pencere 148px'te kalır ve panel
       `max-height: calc(100vh-24px)` ile kırpılır
       ("Aurora'da hava durumu ve randevu bu kadar açılmıyor"). */
    panelOlcum: /      if \(plakaMi\) \{\n        for \(const id of \['panel-notes', 'panel-weather'\]\) \{[\s\S]*?\n        \}\n      \}/,
    /* v1.36.7 CANLI hatası: plakada Ayarlar/Stüdyo menüsü plakayı örtüyordu
       ("menü saatin üstünde açılıyor; plaka kayboluyor"). Menü plakanın
       ALTINA açılmalı → yükseklik TEMELE EKLENİR. */
    ayarOlcum: /      for \(const id of \['settings', 'studio'\]\) \{\n        const el = document\.getElementById\(id\);\n        if \(!el \|\| el\.hidden\) continue;\n        h = Math\.max\(h, plakaMi \? plakaTemel \+ el\.scrollHeight : el\.scrollHeight \+ 24\);\n      \}/,
    /* v1.36.7 CANLI hatası: menü açılınca pencere iş alanının dibine
       iniyordu ("menü yaklaşık 5 cm aşağıda açılıyor"). Plakada plaka
       EKRANDAKİ YERİNİ korumalı. */
    kapKarar: /\} else if \(kapVar\) \{[\s\S]*?\n        \}/,
    /* v1.36.7: menü plakanın altına yerleşsin diye gövdeye `kap-acik`. */
    kapSinif: /      document\.body\.classList\.toggle\('kap-acik',\n        plakaMi && \(acikMi\('settings'\) \|\| acikMi\('studio'\)\)\);/
  },
  'src/js/skins.js': {
    /* v1.36.7: `--plaka-h` widget'a değil KÖKE yazılmalı — Ayarlar/Stüdyo
       `#widget`ın kardeşi (`position: fixed`), değeri miras alamaz. */
    plakaVar: /  if \(typeof document !== 'undefined' && document\.documentElement\)\n    document\.documentElement\.style\.setProperty\('--plaka-h', ol\.h \+ 'px'\);/
  },
  'src/styles/widget.css': {
    /* v1.36.6 CANLI hatası: panel açıkken pencere plaka + panel kadar büyür
       ama `body:has(.widget.plaka) { align-items: center !important }`
       plakayı pencerenin ORTASINDA bırakır → plaka panelin arkasına girer,
       üstte boş koyu şerit olur. Panel varken üste/alta yaslanmalı. */
    plakaYaslama: /body:has\(\.widget\.plaka\)\.panel-acik \{[\s\S]*?align-items: flex-end !important; \}/,
    /* v1.36.7 — panel açıkken saat/düğmeler gizleniyordu ("menü açılınca
       saat üstünde logolar siliniyor") ve plaka görseli düz renge
       çevriliyordu. Bu iki yamanın GERİ KOYULDUĞU yer: yaslama kuralının
       hemen altı (senaryolar buraya eski kuralları enjekte eder). */
    panelYaslamaUst: /body:has\(\.widget\.plaka\)\.panel-acik \{ align-items: flex-start !important; \}/
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
  'src/js/i18n.js': {
    /* v1.36.4 CANLI hatası: sözlük boşken `t(anahtar, null)` HAM ANAHTARI
       ekrana yazıyordu ("pa_kapat", "pa_baslik"). */
    uygula: /    uygula: function \(\) \{[\s\S]*?\n    \},/
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
      yeni: '    const s = fit();\n'
    }]
  },
  {
    ad: 'v1.36.3 CANLI hatası: `paBtn` tanımsız → PA popup dışına tıklayınca kapanmıyor',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [
      { dosya: 'src/js/app.js', hedef: 'paBtnTanimi', yeni: '' }
    ]
  },
  {
    ad: 'v1.36.4 CANLI hatası: CSS `bottom` yedeği ezilmiyor → PA kutusu uzuyor/kırpılıyor',
    test: 'araclar/panel-tiklama-test.mjs',
    degisiklikler: [
      { dosya: 'src/js/app.js', hedef: 'paBottom', yeni: '\n' }
    ]
  },
  {
    ad: 'v1.36.4 CANLI hatası: kutu geometrisi pencere dışına çıkıyor (görsel doğrulama)',
    test: 'araclar/gorsel-dogrula.mjs',
    degisiklikler: [
      { dosya: 'src/js/app.js', hedef: 'paBottom', yeni: '\n' }
    ]
  },
  {
    ad: 'v1.36.6 CANLI hatası: plakada panel ölçülmüyor (Aurora hava/randevu kırpılıyor)',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [
      { dosya: 'src/js/app.js', hedef: 'panelOlcum',
        yeni: '      /* v1.36.5 durumu: plakada panel ölçümü YOK (hata) */' }
    ]
  },
  {
    ad: 'v1.36.6 CANLI hatası: plaka panel açıkken ortalanıyor (panel plakayı örtüyor)',
    test: 'araclar/gorsel-dogrula.mjs',
    degisiklikler: [
      { dosya: 'src/styles/widget.css', hedef: 'plakaYaslama',
        yeni: '/* v1.36.5 durumu: yaslama kuralı YOK (hata) */' }
    ]
  },
  {
    ad: 'v1.36.4 CANLI hatası: sözlük boşken ekrana HAM ANAHTAR yazılıyor',
    test: 'araclar/i18n-yedek-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/i18n.js', hedef: 'uygula',
      yeni: `    uygula: function () {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = PZA.i18n.t(el.getAttribute('data-i18n'), null);
        if (v != null) el.textContent = v;
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const v = PZA.i18n.t(el.getAttribute('data-i18n-html'), null);
        if (v != null) el.innerHTML = v;
      });
      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const v = PZA.i18n.t(el.getAttribute('data-i18n-ph'), null);
        if (v != null) el.setAttribute('placeholder', v);
      });
      const sel = document.getElementById('lang-select');
      if (sel) sel.value = PZA.i18n.kod();
      document.documentElement.lang = PZA.i18n.aktif;
      PZA.emit && PZA.emit('dil', PZA.i18n.aktif);
    },`
    }]
  },
  {
    ad: 'v1.36.7 CANLI hatası: panel açıkken saat/düğmeler gizleniyor ("logolar kayboluyor")',
    test: 'araclar/gorsel-dogrula.mjs',
    degisiklikler: [{
      dosya: 'src/styles/widget.css', hedef: 'panelYaslamaUst',
      yeni: `body:has(.widget.plaka).panel-acik { align-items: flex-start !important; }
.widget.plaka:has(> .panel-notes:not([hidden])) .bar-top,
.widget.plaka:has(> .panel-notes:not([hidden])) .bar-bottom,
.widget.plaka:has(> .panel-notes:not([hidden])) .plate-drag,
.widget.plaka:has(> .panel-weather:not([hidden])) .bar-top,
.widget.plaka:has(> .panel-weather:not([hidden])) .bar-bottom { display: none; }`
    }]
  },
  {
    ad: 'v1.36.7 CANLI hatası: panel açıkken plaka görseli düz renge çevriliyor',
    test: 'araclar/gorsel-dogrula.mjs',
    degisiklikler: [{
      dosya: 'src/styles/widget.css', hedef: 'panelYaslamaUst',
      yeni: `body:has(.widget.plaka).panel-acik { align-items: flex-start !important; }
.widget.plaka:has(> .panel-notes:not([hidden])),
.widget.plaka:has(> .panel-weather:not([hidden])) { background: var(--bg-1, #0a1020); }`
    }]
  },
  {
    ad: 'v1.36.7 CANLI hatası: plakada Ayarlar menüsü plakayı örtüyor (plaka kayboluyor)',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'ayarOlcum',
      yeni: `      for (const id of ['settings', 'studio']) {
        const el = document.getElementById(id);
        if (el && !el.hidden) h = Math.max(h, el.scrollHeight + 24);
      }`
    }]
  },
  {
    ad: 'v1.36.7 CANLI hatası: menü açılınca pencere iş alanının dibine iniyor ("5 cm aşağıda")',
    test: 'araclar/menu-uctan-uca-test.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'kapKarar',
      yeni: `} else if (kapVar) {
          if (temelY === null) temelY = y;
          hedefY = Math.max(alan.ust, alt - hh - 8);
        }`
    }]
  },
  {
    ad: 'v1.36.7: kaplama menü sınıfı gövdeye yazılmıyor (menü plakanın altına inmez)',
    test: 'araclar/gorsel-dogrula.mjs',
    degisiklikler: [{
      dosya: 'src/js/app.js', hedef: 'kapSinif',
      yeni: '      /* kap-acik sinifi YOK (hata) */'
    }]
  },
  {
    ad: 'v1.36.7: plaka yüksekliği köke yazılmıyor (menü plakayı örter)',
    test: 'araclar/gorsel-dogrula.mjs',
    degisiklikler: [{
      dosya: 'src/js/skins.js', hedef: 'plakaVar',
      yeni: '  /* --plaka-h yazilmiyor (hata) */'
    }]
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
