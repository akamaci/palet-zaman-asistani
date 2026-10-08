/* dogrula.mjs — kod tabanı bekçisi
   Palet Zaman Asistanı · GPL-3.0
   ──────────────────────────────────────────────────────────
   Çalıştır:  npm run dogrula

   Neyi yakalar:
   1. JS sözdizimi hataları
   2. Bozuk JSON
   3. HTML ↔ JS kimlik uyuşmazlıkları, tekrar eden id
   4. ÜST DÜZEY GLOBAL AD ÇAKIŞMASI — bu proje klasik script
      kullanıyor (IIFE değil), yani her dosyanın üst düzey
      `function foo` / `const bar` tanımı GLOBAL olur. İki dosya
      aynı adı tanımlarsa ikincisi sessizce SyntaxError verir ve
      o dosya hiç çalışmaz. Bu hata bir kez yaşandı (esc), bir
      daha yaşanmasın.
   5. Skin token kataloğu ile CSS :root arasındaki tutarsızlık
   6. innerHTML'e ham giden kullanıcı/dış veri (XSS)
   7. Kaçışın GERÇEKTEN çalıştığı: düşmanca bir skin dosyası içe
      aktarılır, üretilen HTML'in kırılmadığı kanıtlanır. Statik
      tarama "çağrı var" der; bu test "işe yarıyor" der. */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = path.join(root, 'src', 'js');
const HTML = path.join(root, 'src', 'index.html');
const CSS = path.join(root, 'src', 'styles', 'widget.css');

let bad = 0, warn = 0;
const ok   = m => console.log('  \x1b[32mOK\x1b[0m  ' + m);
const fail = m => { bad++;  console.log('  \x1b[31mX\x1b[0m   ' + m); };
const note = m => { warn++; console.log('  \x1b[33m!\x1b[0m   ' + m); };
const head = m => console.log('\n\x1b[1m' + m + '\x1b[0m');

const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort();
const src = f => fs.readFileSync(path.join(JS_DIR, f), 'utf8');

/* ── 1. Sözdizimi ──────────────────────────────────────── */
head('1 · JS sozdizimi');
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ['--check', path.join(JS_DIR, f)], { stdio: 'pipe' }); ok(f); }
  catch (e) { fail(f + ' → ' + String(e.stderr).trim().split('\n').slice(0, 2).join(' | ')); }
}

/* ── 2. JSON ───────────────────────────────────────────── */
head('2 · JSON');
for (const p of ['src-tauri/tauri.conf.json', 'src-tauri/capabilities/default.json', 'package.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); ok(p); }
  catch (e) { fail(p + ' → ' + e.message); }
}

/* ── 3. HTML ↔ JS kimlikleri ───────────────────────────── */
head('3 · HTML <-> JS kimlikleri');
const html = fs.readFileSync(HTML, 'utf8');
const all = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const ids = new Set(all);
const dup = all.filter((v, i) => all.indexOf(v) !== i);
if (dup.length) fail('tekrar eden id: ' + [...new Set(dup)].join(', '));
else ok(all.length + ' kimlik, tekrarsiz');

let refs = 0;
for (const f of jsFiles) {
  const seen = new Set([...src(f).matchAll(/(?:\$|getElementById)\(\s*'([^']+)'\s*\)/g)].map(m => m[1]));
  for (const id of seen) { refs++; if (!ids.has(id)) fail(f + ' → #' + id + ' HTML\'de yok'); }
}
ok(refs + ' JS referansi kontrol edildi');

/* ── 4. Global ad çakışması ────────────────────────────── */
head('4 · Ust duzey global ad cakismasi');
const owners = {};
for (const f of jsFiles) {
  const s = src(f);
  const iife = /^\s*\(function\s*\(/m.test(s.slice(0, 300));
  if (iife) { console.log('   [IIFE]   ' + f + ' — sizinti yok'); continue; }
  const names = [];
  for (const m of s.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm))
    names.push(m[1] || m[2]);
  console.log('   [GLOBAL] ' + f + ' — ' + names.join(', '));
  names.forEach(n => (owners[n] = owners[n] || []).push(f));
}
const clash = Object.entries(owners).filter(([, v]) => v.length > 1);
if (clash.length) clash.forEach(([n, v]) => fail('global ad cakismasi: "' + n + '" → ' + v.join(' + ') + '  (ikinci dosya hic calismaz)'));
else ok('global ad cakismasi yok');

/* ── 5. Token kataloğu ↔ CSS ───────────────────────────── */
head('5 · Skin token katalogu <-> CSS');
const css = fs.readFileSync(CSS, 'utf8');
const skins = src('skins.js');
const catalog = [...skins.matchAll(/\{\s*k:\s*'(--[a-z0-9-]+)'/g)].map(m => m[1]);
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('[data-skin="klasik"]'));
const missing = catalog.filter(k => !rootBlock.includes(k + ':'));
if (missing.length) fail(':root\'ta tanimsiz token: ' + missing.join(', '));
else ok(catalog.length + ' token, hepsi :root\'ta tanimli');

/* ── 6. innerHTML'e ham dış veri ───────────────────────── */
head('6 · innerHTML kacis kontrolu');
const RISKY = [
  [/\$\{[^}]*\b\w+\.(label|name)\b[^}]*\}/,        'dis API verisi (sehir adi)'],
  [/\$\{[^}]*\b\w+\.(author|note)\b[^}]*\}/,       'skin verisi (dosttan gelen dosya)'],
  [/\$\{[^}]*\b(n|note|item)\.(x|t)\b[^}]*\}/,     'kullanici notu']
];
let risky = 0;
for (const f of jsFiles) {
  const s = src(f);
  /* Kaçış yardımcısının bu dosyadaki adı (takma adlar dahil) */
  const names = ['escHtml', 'esc'];
  for (const m of s.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:PZA\.)?(?:escHtml|esc)\b/g)) names.push(m[1]);
  const safe = new RegExp('(?:' + names.join('|') + ')\\s*\\(');

  s.split('\n').forEach((line, i) => {
    if (!/\$\{/.test(line)) return;
    for (const [re, what] of RISKY) {
      if (re.test(line) && !safe.test(line)) { risky++; note(f + ':' + (i + 1) + ' → kaçışsız ' + what + ': ' + line.trim().slice(0, 88)); }
    }
  });
}
if (!risky) ok('innerHTML icindeki tum dis veri kacisli');

/* ── 7. Kaçış GERÇEKTEN çalışıyor mu ─────────────────────
   Statik tarama "kaçış çağrılmış" der; burada düşmanca bir skin
   dosyası içe aktarılıp üretilen HTML'in gerçekten kırılmadığı
   kanıtlanır. Skin dosyaları dosttan geldiği için dış veridir. */
head('7 · Kacis davranis testi (dusmanca skin dosyasi)');
{
  const store = new Map();
  const g = globalThis;
  const keep = { window: g.window, localStorage: g.localStorage, document: g.document };
  g.window = g;
  g.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  g.document = { getElementById: () => null, createElement: () => ({ style: {} }) };
  try {
    new Function(src('skins.js'))();
    const PZA = g.PZA, E = PZA.escHtml;

    const kotu = JSON.stringify({
      format: 'pza-skin/1',
      name: '<img src=x onerror="alert(1)">',
      author: '"><script>alert(2)</script>',
      dark: { '--bg-1': '#112233', '--accent': '#ff0000', '--fg': 'red; } body { background: url(javascript:alert(3)) } .x {' }
    });
    const r = PZA.importSkin(kotu);
    if (!r.ok) fail('kotu skin ice aktarilamadi: ' + r.err);
    else {
      /* Yalnızca VERİDEN gelen parçalar sınanır — şablonun kendi
         <span>/title=" markup'ı testin konusu değil. */
      const parcalar = [E(r.skin.name), E(r.skin.author), E(r.skin.dark['--fg'])];
      const kacak = parcalar.filter(p => {
        const ham = String(p).replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, '');
        return /[<>"']/.test(ham);
      });
      if (kacak.length) fail('kacistan sizan ham karakter: ' + JSON.stringify(kacak));
      else ok('HTML/sozdizimi enjeksiyonu etkisiz (etiketsiz, tirnaksiz)');

      if (r.skin.dark['--fg'] !== undefined) fail('gecersiz renk degeri palete sizdi: ' + r.skin.dark['--fg']);
      else ok('gecersiz renk degeri (CSS enjeksiyonu) atildi');

      const jsv = PZA.importSkin(JSON.stringify({ format: 'pza-skin/1', name: 'x', dark: { '--bg-1': '#000' }, bg: { image: 'javascript:alert(1)' } }));
      if (jsv.ok && jsv.skin.bg !== null) fail('data:image/ disi arka plan kabul edildi');
      else ok('javascript: arka plan URI\'si reddedildi');

      if (PZA.importSkin('{"format":"winamp-skin/9"}').ok) fail('yabanci bicim kabul edildi');
      else ok('yabanci bicim reddedildi');
    }
  } catch (e) {
    fail('kacis testi calistirilamadi: ' + e.message);
  } finally {
    g.window = keep.window; g.localStorage = keep.localStorage; g.document = keep.document;
    delete g.PZA;
  }
}

/* ── 8. Sürüm numarası tek kaynak mı ─────────────────────
   `PZA.SURUM` ile package.json / Cargo.toml / tauri.conf.json aynı
   numarayı taşımalı. Ayrışırsa kurulum paketi kendi sürümünü yanlış
   bildirir ve kullanıcı hangi sürümü kurduğunu bilemez: v1.1.0
   yayımlandığı hâlde ayarlar panelinde "v1.0" yazıyordu, çünkü sürüm
   elle yazılmıştı. Bu kontrol yükseltmeyi unutturmaz. */
head('8 · Surum numarasi tek kaynak mi');
{
  const surumler = {};
  const m = src('settings.js').match(/PZA\.SURUM\s*=\s*'([^']+)'/);
  surumler['settings.js'] = m ? m[1] : null;
  const oku = (p, yol) => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
      return yol.reduce((o, k) => (o ? o[k] : null), j);
    } catch (e) { return null; }
  };
  surumler['package.json']     = oku('package.json', ['version']);
  surumler['tauri.conf.json']  = oku('src-tauri/tauri.conf.json', ['version']);
  const cargo = fs.readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf8');
  // Yalnız [package] bloğu — bağımlılıkların `version = "2"` satırları karışmasın
  const paket = cargo.split(/^\[/m)[1] || '';
  const cm = paket.match(/version\s*=\s*"([^"]+)"/);
  surumler['Cargo.toml'] = cm ? cm[1] : null;

  const degerler = Object.values(surumler);
  if (degerler.some(v => !v)) fail('surum okunamadi: ' + JSON.stringify(surumler));
  else if (new Set(degerler).size > 1) {
    fail('surumler ayrismis → ' + Object.entries(surumler).map(([k, v]) => k + '=' + v).join(' · '));
  } else ok('4 dosyada da ayni: v' + degerler[0]);

  /* Panelin alt yazısı sürümü ELLE yazmamalı — PZA.SURUM'dan gelir. */
  if (/Palet Zaman Asistanı v\d/.test(html)) fail('index.html surumu elle yaziyor (PZA.SURUM kullanilmali)');
  else ok('index.html surumu elle yazmiyor');
}

/* ── 9. Taşıma bölgeleri işaretli mi ─────────────────────
   Kilit (settings.js → PZA.applyLock) yalnız `[data-drag]` işaretli
   öğelerde `data-tauri-drag-region` özniteliğini kaldırıp geri koyar.
   İşaretsiz bir taşıma bölgesi kilidi açarken geri kazanılamaz ve
   widget bir daha taşınamaz — sessiz ve kalıcı bir kilitlenme. */
head('9 · Tasma bolgeleri isaretli mi');
{
  // Yorumlar ayıklanır: açıklama metninde geçen öznitelik adı etiket
  // sanılıp yanlış alarm üretiyordu.
  const govde = html.replace(/<!--[\s\S]*?-->/g, '');
  const tasiyan = [...govde.matchAll(/<[^>]*data-tauri-drag-region[^>]*>/g)].map(m => m[0]);
  const isaretsiz = tasiyan.filter(t => !/\bdata-drag=/.test(t));
  if (isaretsiz.length) fail('data-drag isareti olmayan tasima bolgesi: ' + isaretsiz.join(' | '));
  else ok(tasiyan.length + ' tasima bolgesi, hepsi data-drag isaretli');

  const isaretli = [...govde.matchAll(/<[^>]*\bdata-drag=[^>]*>/g)].map(m => m[0]);
  const olu = isaretli.filter(t => !/data-tauri-drag-region/.test(t));
  if (olu.length) note('data-drag var ama tasima yok (olu isaret): ' + olu.join(' | '));
  else ok(isaretli.length + ' data-drag isareti, hepsi tasima bolgesi');
}

/* ── Sonuç ─────────────────────────────────────────────── */
console.log('');
if (bad) { console.log('\x1b[31mSONUC: ' + bad + ' SORUN' + (warn ? ' · ' + warn + ' uyari' : '') + '\x1b[0m'); process.exit(1); }
console.log('\x1b[32mSONUC: temiz' + (warn ? ' · ' + warn + ' uyari' : '') + '\x1b[0m');
