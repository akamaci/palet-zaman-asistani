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

head('10 · Saat basi takvim supurmesi saate BAGLI mi (tur 16)');
{
  /* Kullanıcı isteği: takvime ekleme düğmeye basılmadan kendiliğinden
     olsun. `gcal.js` saat başı süpürmeyi tanımlıyor ama onu ÇAĞIRAN
     bir yer olmazsa özellik ölü koddur — testler onu elle çağırdığı
     için yeşil kalır, uygulamada hiç çalışmaz. Bu kontrol bağı ölçer. */
  const clock = src('clock.js');
  const gcal = src('gcal.js');
  if (!/PZA\.gcalSaatBasi\s*=\s*function/.test(gcal))
    fail('gcal.js: PZA.gcalSaatBasi tanimli degil (saat basi supurmesi yok)');
  else ok('gcal.js saat basi supurmesini tanimliyor');
  if (!/PZA\.gcalSaatBasi\?\.\(/.test(clock))
    fail('clock.js: PZA.tick saat basi supurmesini CAGRMIYOR (olu ozellik)');
  else ok('clock.js her saniye cagiriyor (mandal gcal.js icinde)');
  /* Mandal olmadan bu, saniyede bir takvim istegi demekti. */
  if (!/gcalSaatBasiSon\s*===\s*damga/.test(gcal))
    fail('gcal.js: saat basi mandali yok — saniyede bir esitleme istegi gider');
  else ok('mandal var: is saatte bir, cagri saniyede bir');
}

/* ── 11. Üst bar ortalama kuralı ─────────────────────────
   Tur 17 (kullanici bildirimi, hata 4): "hava durumu ve saat solda
   birlesmisken sagda baya bosluk var, ortalayalim." Kok neden, yan
   gruplara `flex: 1 1 0` verilmesiydi: matematiksel olarak simetrik
   ama GORSEL olarak degil — sol grup bos kalirken sag grup sag kenara
   yaslaniyor, tasan pay saatin IKI YANINDA birikiyordu.

   Bu kural geri gelirse hata da geri gelir ve gozle gorulur. Statik
   test duzeni olcemez, ama YANLIS KURALI yakalar. */
head('11 · Ust bar ortalamasi (tur 17)');
{
  const top = css.slice(css.indexOf('.bar-top {'), css.indexOf('.tile {'));
  const gl = (top.match(/\.group-left\s*\{[^}]*\}/) || [''])[0];
  const gr = (top.match(/\.group-right\s*\{[^}]*\}/) || [''])[0];
  const bt = (top.match(/\.bar-top\s*\{[^}]*\}/g) || []).join(' ');
  if (!/justify-content:\s*center/.test(bt))
    fail('.bar-top justify-content:center degil — icerik kumesi ortalanmaz');
  else ok('.bar-top icerik kumesini ortalıyor');
  for (const [ad, blok] of [['group-left', gl], ['group-right', gr]]) {
    if (/flex:\s*1\s+1\s+0/.test(blok))
      fail('.' + ad + ': flex 1 1 0 geri gelmis — olu bosluk saatin yanina birikir (hata 4)');
    else if (!/flex:\s*0\s+1\s+auto/.test(blok))
      fail('.' + ad + ': flex 0 1 auto degil — icerik kadar yer kaplamali');
    else ok('.' + ad + ': icerik kadar yer kapliyor (flex 0 1 auto)');
  }
}

head('12 · EZAN il/ilce acilista geri yukleniyor mu (v1.18.0)');
{
  /* KULLANICI: "dun il/ilceyi isaretledim, restart sonrasi unutmus; ayarlardan
     tekrar secmek zorunda kaldim." KOK NEDEN: `PZA.apply()` (app.js BASI)
     `PZA.ezanAyarCiz` TANIMLANMADAN cagriliyordu → acilista il/ilce listeleri
     hic dolmuyor, kayitli secim geri yuklenmiyordu. En az IKI cagri olmali:
     (1) Ayarlar acilinca, (2) tanim biter bitmez acilista. Bu kural geri
     alinirsa hata da sessizce geri gelir → statik olarak baglariz. */
  const app = src('app.js');
  if (!/PZA\.ezanAyarCiz\s*=\s*(async\s*)?function/.test(app))
    fail('app.js: PZA.ezanAyarCiz tanimli degil');
  else ok('app.js: ezanAyarCiz tanimli');
  const cagri = (app.match(/PZA\.ezanAyarCiz\?\.\(\)/g) || []).length;
  if (cagri < 2) fail('app.js: ezanAyarCiz yalniz ' + cagri + ' kez cagriliyor (ayarlar + acilis olmali) → acilista il/ilce kaybolur');
  else ok('app.js: ezanAyarCiz ' + cagri + ' yerde cagriliyor (ayarlar + acilis)');
  if (!/btn-settings'\)\?\.addEventListener\([\s\S]*?ezanAyarCiz/.test(app))
    fail('app.js: Ayarlar acilinca ezanAyarCiz cagrilmiyor');
  else ok('app.js: Ayarlar acilinca EZAN listeleri tazeleniyor');

  /* Ana panel ezan düğmesi + vakit listesi bagli mi (v1.18.0). */
  for (const id of ['ezan-ses-btn', 'ezan-menu', 'ezan-vakit', 'ezan-sessiz-btn'])
    if (!html.includes('id="' + id + '"')) fail('index.html: #' + id + ' yok (ezan ses/vakit dropdown)');
  if (html.includes('id="theme-label"')) fail('index.html: #theme-label hala var (kaldirilmaliydi)');
  if (/getElementById\('theme-label'\)/.test(src('settings.js'))) fail('settings.js: #theme-label referansi kalmis');
  else ok('ana panel ezan dugmesi + vakit listesi bagli (theme-label kaldirildi)');
}

head('13 · BAR MODU bagli mi (v1.18.0)');
{
  /* Kullanıcı: "tek satırda tüm arayüz; üst/alt; otomatik gizlemede TAM ORTADA
     ince ok TIKLAYINCA açılsın (her yere tıklama browser/programlara engel
     olur)." Bu mekanik parçalardan biri koparsa özellik sessizce ölür. */
  let eksik = [];
  for (const id of ['bar-tutamak', 'bar-ayar', 'bar-konum', 'opt-bargizli'])
    if (!html.includes('id="' + id + '"')) eksik.push('#' + id);
  if (eksik.length) fail('index.html: bar modu ogeleri eksik → ' + eksik.join(', '));
  else ok('index.html: tutamak + konum/gizleme kontrolleri var');
  if (!/name="size"\s+value="bar"/.test(html)) fail('index.html: "Bar" boyut secenegi yok');
  else ok('index.html: "Bar" boyut secenegi var');

  const app = src('app.js');
  if (!/const fitBar\s*=/.test(app)) fail('app.js: fitBar tanimli degil (bar pencere boyut/konum)');
  else ok('app.js: fitBar tanimli');
  if (!/bar-tutamak'\)\?\.addEventListener/.test(app)) fail('app.js: ortadaki ince ok (bar-tutamak) baglanmamis');
  else ok('app.js: ortadaki ince ok bagli (tiklayinca acar)');
  if (!/bar-degisti/.test(app)) fail('app.js: bar-degisti yeniden-olcum yok');
  else ok('app.js: bar ac/kapa yeniden olcuyor');

  if (!/\[data-size="bar"\]/.test(css)) fail('widget.css: [data-size="bar"] stili yok');
  else ok('widget.css: bar (tek satir) duzeni var');
  if (!/\.widget\.bar-kapali/.test(css)) fail('widget.css: bar-kapali (yalniz ince ok) stili yok');
  else ok('widget.css: kapali bar (yalniz ince ok) stili var');
}

head('14 · BAR modu Not/Hava paneli + Ezan menusu (v1.18.4)');
{
  /* Kullanıcı bildirimi (2026-10-16): "hava durumu ve takvim ekran genisliginde
     buyuyor, arka plan saydamlasip okunamaz; ayarlar menusu genisliginde ve koyu
     modda okunakli olsun. Ayrica ezan menusu acilmiyor."
     Bu baglar koparsa iki hata da sessizce geri gelir. */
  const blk = (css.match(/\.widget\[data-size="bar"\] \.panel-notes[\s\S]*?\}/) || [''])[0];
  if (!/width:\s*412px/.test(blk)) fail('widget.css: bar paneli 412px degil → ekran genisligine yayilir');
  else ok('widget.css: bar paneli Ayarlar genisliginde (412px)');
  if (!/background:\s*linear-gradient\(135deg,\s*var\(--bg-1\)/.test(blk))
    fail('widget.css: bar paneli OPAK zemin degil → koyu modda masaustu gorunur, okunmaz');
  else ok('widget.css: bar paneli opak zemin (koyu modda okunur)');

  const em = (css.match(/\.widget\[data-size="bar"\] \.ezan-menu\s*\{[\s\S]*?\}/) || [''])[0];
  if (!/position:\s*fixed/.test(em))
    fail('widget.css: bar modunda ezan menusu fixed degil → overflow:hidden kirpar, acilmaz');
  else ok('widget.css: bar modunda ezan menusu fixed (kirpilmaz)');

  const app = src('app.js');
  if (!/PZA\.ezanMenuYerlestir\s*=/.test(app)) fail('app.js: ezanMenuYerlestir tanimli degil');
  else ok('app.js: ezanMenuYerlestir tanimli');
  if (!/ezanMenuYerlestir\?\.\(\)/.test(app))
    fail('app.js: ezanMenuYerlestir cagrilmiyor (olu kod → menu yanlis/gorunmez konumda)');
  else ok('app.js: menu acilinca + fit sirasinda dugmeye hizalaniyor');
  if (!/const ezanVar\s*=\s*acikMi\('ezan-menu'\)/.test(app))
    fail('app.js: fitBar ezan menusunu olcmuyor → pencere buyumez, menu kirpilir');
  else ok('app.js: fitBar ezan menusu acikken pencereyi buyutuyor');

  /* Kullanıcı beklentisi (2026-10-16): "hava durumuna basınca HAVA yazan yerden,
     ezana basınca EZAN yerinden, notlara basınca NOTLAR yazan yerden açılsın."
     → paneller tetikleyici öğeye hizalanmalı; bu bağ koparsa hepsi ortadan açar. */
  if (!/PZA\.barYuzeyHizala\s*=/.test(app)) fail('app.js: barYuzeyHizala tanimli degil (panel tetikleyiciye hizalanmaz)');
  else ok('app.js: barYuzeyHizala tanimli');
  if (!/barYuzeyHizala\(document\.getElementById\('panel-weather'\),\s*\$\('weather-tile'\),\s*'sol'\)/.test(app))
    fail('app.js: Hava paneli weather-tile\'a hizalanmiyor (kullanici: "hava notlardan aciliyor")');
  else ok('app.js: Hava paneli hava kutucuguna hizali');
  if (!/barYuzeyHizala\(document\.getElementById\('panel-notes'\),\s*\$\('btn-notes'\),\s*'sag'\)/.test(app))
    fail('app.js: Notlar paneli btn-notes\'a hizalanmiyor');
  else ok('app.js: Notlar paneli Notlar dugmesine hizali');
  if (!/barYuzeyHizala\(ezanMenu,\s*ezanBtn,\s*'sag'\)/.test(app))
    fail('app.js: Ezan menusu ezan dugmesine hizalanmiyor');
  else ok('app.js: Ezan menusu Ezan dugmesine hizali');
}

head('15 · Gorunum/skin LISTESI + "+" yeni (v1.18.5)');
{
  /* Kullanıcı: "yeni skin ekle butonu (+) koyalim; yeni skinler eklendikce
     bir listeden secilebilsin, tipki ses listesindeki Ece/Tolga gibi."
     Eski 4'lu kart izgarasi yerine <select> + "+". */
  const eksik = ['skin-select', 'skin-add', 'skin-bar'].filter(id => !html.includes('id="' + id + '"'));
  if (eksik.length) fail('index.html: gorunum listesi ogeleri eksik → ' + eksik.join(', '));
  else ok('index.html: gorunum <select> listesi + "+" dugmesi var');
  if (html.includes('id="skin-list"')) fail('index.html: eski #skin-list izgarasi hala var');
  else ok('index.html: eski kart izgarasi kaldirildi');

  const a = src('app.js');
  if (!/skin-select'\)\?\.addEventListener\('change'/.test(a)) fail('app.js: #skin-select change bagli degil');
  else ok('app.js: listeden secim bagli');
  if (!/skin-add'\)\?\.addEventListener/.test(a)) fail('app.js: "+" yeni skin bagli degil (studyo acilmaz)');
  else ok('app.js: "+" yeni skin (studyo) bagli');

  if (!/sel\.innerHTML\s*=\s*builtin\.concat\(custom\)/.test(src('settings.js')))
    fail('settings.js: yerlesik+kullanici skinleri listeye doldurulmuyor');
  else ok('settings.js: yerlesik+kullanici skinleri tek listede');

  if (!/select\.skin-sel/.test(css)) fail('widget.css: select.skin-sel stili yok (etiket satirdan duser)');
  else ok('widget.css: skin listesi stili var');
}

head('16 · Ezan "sustur" = calar saat gibi (v1.18.6)');
{
  /* Kullanıcı: "ezan okunurken sesi kıs → çalma durmuyor" + "bir sonraki
     ezana kadar dursun, çalar saat gibi". Kalıcı kapatma Ayarlar'daki ana
     anahtarda; panel düğmesi sureli susturma. */
  const e = src('ezan.js');
  if (!/PZA\.ezanDurdur\s*=/.test(e)) fail('ezan.js: ezanDurdur tanimli degil (calan ses durmaz)');
  else ok('ezan.js: ezanDurdur var (calani durdurur)');
  if (!/PZA\.ezanSustur\s*=/.test(e)) fail('ezan.js: ezanSustur tanimli degil');
  else ok('ezan.js: ezanSustur var (bir sonraki vakte kadar susturur)');
  if (!/PZA\.ezanSesiAc\s*=/.test(e)) fail('ezan.js: ezanSesiAc tanimli degil (geri acilmaz)');
  else ok('ezan.js: ezanSesiAc var');
  if (!/ezanSessizKadar/.test(e)) fail('ezan.js: sureli susturma bitisi (ezanSessizKadar) yok');
  else ok('ezan.js: sureli susturma bitisi tutuluyor');
  if (!/Date\.now\(\)\s*>=\s*s\.ezanSessizKadar/.test(e)) fail('ezan.js: tick sure dolunca sesi geri acmiyor');
  else ok('ezan.js: ezanTick sure dolunca sesi kendiliginden acar');

  const a = src('app.js');
  if (!/ezan-sessiz-btn'\)\?\.addEventListener[\s\S]{0,500}ezanSustur/.test(a))
    fail('app.js: sesi kis dugmesi ezanSustur cagirmiyor (eski davranis: yalniz ayar)');
  else ok('app.js: sesi kis dugmesi ezanSustur / ezanSesiAc cagiriyor');
}

head('17 · pza-skin/2 katman+bolge motoru + gomulu skin (v1.19.0)');
{
  /* Winamp usulu "katman + bolge" motoru; koparsa plaka skinleri calismaz. */
  const s = src('skins.js');
  for (const f of ['PZA.PLATE_MAP', 'PZA.applyPlate', 'PZA.clearPlate', 'PZA.plateSize'])
    if (!s.includes(f)) fail('skins.js: ' + f + ' yok'); else ok('skins.js: ' + f + ' var');
  if (!/PZA\.SKIN_FORMAT_V2\s*=\s*'pza-skin\/2'/.test(s)) fail("skins.js: 'pza-skin/2' bicimi tanimli degil");
  else ok("skins.js: 'pza-skin/2' bicimi tanimli");
  if (!/o\.format === PZA\.SKIN_FORMAT_V2/.test(s)) fail('skins.js: v2 ice-aktarma dogrulamasi yok');
  else ok('skins.js: v2 ice-aktarma dogrulamasi var');
  if (!/PZA\.plateSize && PZA\.plateSize\(\)/.test(src('app.js'))) fail('app.js: pencere plakayi olcmuyor');
  else ok('app.js: pencere plaka tuvaline gore boyutlanir');
  if (!/\.widget\.plaka/.test(css)) fail('widget.css: .widget.plaka stili yok');
  else ok('widget.css: plaka stili var');
  if (!/PLATE_SKINS/.test(src('skins-builtin.js'))) fail('skins-builtin.js: gomulu plaka skini yok');
  else {
    try {
      const txt = src('skins-builtin.js');
      const m = txt.match(/PZA\.PLATE_SKINS\s*=\s*(\{[\s\S]*\});/);
      const o = JSON.parse(m[1]); const sk = o[Object.keys(o)[0]];
      if (sk.format !== 'pza-skin/2') fail('gomulu skin bicimi pza-skin/2 degil');
      else ok('gomulu skin bicimi pza-skin/2');
      if (!(typeof sk.plate === 'string' && sk.plate.indexOf('data:image/') === 0))
        fail('gomulu skin plakasi data:image degil');
      else ok('gomulu skin plakasi data:image gomulu');
      if (!(sk.canvas && sk.canvas.w >= 100 && sk.canvas.h >= 60)) fail('gomulu skin tuvali gecersiz');
      else ok('gomulu skin tuvali gecerli (' + sk.canvas.w + 'x' + sk.canvas.h + ')');
      const rc = sk.regions ? Object.keys(sk.regions).length : 0;
      if (rc < 1) fail('gomulu skin bolgeleri yok'); else ok('gomulu skin bolgeleri var (' + rc + ')');
    } catch (e) { fail('skins-builtin.js JSON cozulemedi: ' + e.message); }
  }
}

head('18 · Guncelleme kapanma izni + plaka tam ekran + ezan menusu (v1.19.1)');
{
  /* Kullanıcı (2026-10-16): "tepsi ikonu kapatilamadigindan guncelleme takiliyor"
     + "ezan tiklaninca ust kismi kayip" + "orbital skin bozuk". */
  const main = fs.readFileSync(path.join(root, 'src-tauri/src/main.rs'), 'utf8');
  if (!/static GUNCELLEME/.test(main)) fail('main.rs: GUNCELLEME kapanma izni yok (guncelleme takilir)');
  else ok('main.rs: guncelleme kapanma izni tanimli');
  if (!/GUNCELLEME\.store\(true/.test(main)) fail('main.rs: guncelleme bayragi kurulum oncesi set edilmiyor');
  else ok('main.rs: guncelleme bayragi kurulum oncesi set ediliyor');
  if (!/GUNCELLEME\.load\(Ordering::SeqCst\)/.test(main)) fail('main.rs: CloseRequested guncelleme iznini kullanmiyor');
  else ok('main.rs: kapatma istegi guncelleme sirasinda cikisa izin veriyor');

  if (!/width:\s*100vw/.test(css)) fail('widget.css: plaka pencereyi doldurmuyor (100vw) → bosluk/tasma');
  else ok('widget.css: plaka pencereyi tam doldurur');
  if (!/max-height:\s*min\(58vh/.test(css)) fail('widget.css: ezan menusu yukseklik siniri yok (ust kisim kirpilir)');
  else ok('widget.css: ezan menusu yukseklik siniri + kaydirma var');
}

/* ── Sonuç ─────────────────────────────────────────────── */
console.log('');
if (bad) { console.log('\x1b[31mSONUC: ' + bad + ' SORUN' + (warn ? ' · ' + warn + ' uyari' : '') + '\x1b[0m'); process.exit(1); }
console.log('\x1b[32mSONUC: temiz' + (warn ? ' · ' + warn + ' uyari' : '') + '\x1b[0m');
