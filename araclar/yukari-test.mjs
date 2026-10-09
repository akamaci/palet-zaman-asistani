/* yukari-test.mjs — panel aşağı sığmazsa yukarı açılsın
   Palet Zaman Asistanı · GPL-3.0

   KULLANICI BİLDİRİMİ (tur 4): "Eksiler veya eksikler: eğer saat
   windows'un en altına alınırsa pencere yönünün yukarı açılması
   lazım ki okuna bilsin yada seçile bilsin."

   NEDEN AYRI BİR TEST: bu mantık `app.js` içinde, bir IIFE'nin
   kapanışında yaşıyor ve Tauri pencere API'sine bağlı — ne birim
   testinden ne de tarayıcı önizlemesinden geçirilebiliyordu. Burada
   sahte bir Tauri penceresi (konum, boyut, iş alanı) kurulup
   `fit()` gerçekten çalıştırılıyor; sonra ÖLÇÜLEN ŞEY, kullanıcının
   şikâyetiyle aynı: SAATİN EKRANDAKİ YERİ değişiyor mu?

   Çalıştırma:  npm run test        */
import fs from 'fs';
import path from 'path';

const KOK = path.join(import.meta.dirname, '..', 'src', 'js') + path.sep;
const src = f => fs.readFileSync(KOK + f, 'utf8');
const CSS = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'styles', 'widget.css'), 'utf8');

let bad = 0, iyi = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const bad_ = m => { bad++; console.log('  X    ' + m); };
const esit = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b))
  ? ok(m + ' = ' + JSON.stringify(a))
  : bad_(m + ' → beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a));
const dogru = (c, m) => c ? ok(m) : bad_(m);

/* ── Sahte ortam ──────────────────────────────────────── */
const g = globalThis;

/* Widget içeriğinin yüksekliği: saatin bulunduğu blok + açık paneller.
   Gerçek `getBoundingClientRect()` yerine bu sabitler kullanılır. */
const TEMEL = 120;                 // bar-top + not önizleme şeridi + alt bar
const PANEL = { 'panel-notes': 428, 'panel-weather': 300 };
const AYARLAR_H = 1125;            // ölçülmüş ayarlar paneli içeriği

let els, pencere, kayitlar, fit, ekran, panelIc, depo, tasindi;
let dinlenmeY = null;      // panel açılmadan önceki pencere konumu

function mkEl(id) {
  const cls = new Set();
  const e = {
    id, hidden: true, textContent: '', innerHTML: '', value: '', disabled: false,
    dataset: {}, style: {}, scrollHeight: id === 'settings' ? AYARLAR_H : 0,
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    addEventListener() {}, focus() {}, closest: () => null, querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }
    },
    _cls: cls
  };
  e.getBoundingClientRect = () => ({ height: boy(e), width: 940, top: 0, left: 0 });
  return e;
}

function boy(e) {
  if (e.id === 'widget') {
    let h = TEMEL;
    for (const id of Object.keys(PANEL)) if (els.get(id) && !els.get(id).hidden) h += PANEL[id];
    return h;
  }
  if (e.id === 'settings') return e.hidden ? 0 : AYARLAR_H;
  if (e.id === 'studio') return 0;
  return PANEL[e.id] || 0;
}

const el = id => {
  if (!els.has(id)) els.set(id, mkEl(id));
  return els.get(id);
};

function kur(ayar = {}) {
  els = new Map();
  kayitlar = [];
  ekran = {
    availTop: ayar.ust || 0,
    availHeight: ayar.boy !== undefined ? ayar.boy : 1040,
    availWidth: ayar.en || 1920,
    width: ayar.en || 1920
  };
  pencere = { x: 100, y: ayar.y || 100, w: 940, h: 430 };
  panelIc = ayar.ic || null;      // 'panel-notes' | 'settings' | null
  tasindi = null;

  g.window = g;
  /* Depo gerçek gibi davranır: konum kalıcılığı testi kaydedilen değeri
     geri okuyabilmeli (tur 6). `ayar.depo` ile önceden tohumlanır. */
  depo = Object.assign({}, ayar.depo || {});
  g.localStorage = {
    getItem: k => (k in depo ? depo[k] : null),
    setItem: (k, v) => { depo[k] = String(v); },
    removeItem: k => { delete depo[k]; }
  };
  g.getComputedStyle = () => ({ maxWidth: '940px' });
  g.screen = ekran;

  g.document = {
    body: mkEl('body'),
    getElementById: id => el(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    hidden: false
  };
  // Panel açıksa görünür yap (ölçüm bunun üzerinden yapılıyor)
  for (const e of els.values()) e.hidden = true;
  if (panelIc) el(panelIc).hidden = false;

  const w = {
    scaleFactor: async () => 1,
    outerPosition: async () => ({ x: pencere.x, y: pencere.y }),
    outerSize: async () => ({ width: pencere.w, height: pencere.h }),
    currentMonitor: async () => null,
    onMoved: fn => { tasindi = fn; },   // taşıma olayı (konum kalıcılığı, tur 6)
    setSize: async s => { pencere.w = s.width; pencere.h = s.height; kayitlar.push(['boyut', s.width, s.height]); },
    setPosition: async p => { pencere.x = p.x; pencere.y = p.y; kayitlar.push(['konum', p.x, p.y]); }
  };
  g.__TAURI__ = {
    window: {
      getCurrentWindow: () => w,
      LogicalSize: class { constructor(width, height) { this.width = width; this.height = height; } },
      LogicalPosition: class { constructor(x, y) { this.x = x; this.y = y; } }
    },
    core: { invoke: async () => null }
  };

  // fit() yalnızca 'load' ve gözlemciler üzerinden tetikleniyor; yakala.
  fit = null;
  g.addEventListener = (ev, fn) => { if (ev === 'load') fit = fn; };
  g.ResizeObserver = class { constructor(cb) { g.__ro = cb; } observe() {} };
  g.MutationObserver = class { constructor(cb) { g.__mo = cb; } observe() {} };

  /* app.js IIFE'sinin dışına hiçbir şey vermez; `PZA` sahtelenir.
     Bu testin konusu yalnızca pencere yerleşimi. */
  delete g.PZA;
  g.PZA = new Proxy({ settings: {}, escHtml: s => String(s) }, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true; }
  });

  new Function(src('app.js'))();
  return { el, w };
}

/** Panel aç/kapa ve yerleşimi yeniden hesapla — gerçekte olduğu gibi. */
async function panelDegistir(id, acik) {
  el(id).hidden = !acik;
  await fit();
}

/* Saatin ekrandaki üst kenarı: panel yukarıdaysa pencerenin tepesinden
   panelin yüksekliği kadar aşağıda, değilse pencerenin tepesinde. */
const saatTepesi = () => pencere.y + (el('widget')._cls.has('yukari') ? PANEL['panel-notes'] : 0);
const sonKonum = () => { const k = kayitlar.filter(r => r[0] === 'konum'); return k.length ? k[k.length - 1].slice(1) : null; };

/* ══════════════════════════════════════════════════════════ */
console.log('\n1 · Aşağıda yer VAR — panel aşağı açılır, saat oynamaz');
{
  kur({ y: 100 });
  await fit();
  esit([pencere.y, pencere.h], [100, TEMEL], 'açılışta pencere içeriğe uyduruldu');
  await panelDegistir('panel-notes', true);
  esit(el('widget')._cls.has('yukari'), false, 'panel aşağıda (yukari YOK)');
  esit(pencere.h, TEMEL + PANEL['panel-notes'], 'pencere panel kadar büyüdü');
  esit(pencere.y, 100, 'konum DEĞİŞMEDİ — saat yerinde');
  esit(sonKonum(), null, 'gereksiz konum çağrısı yapılmadı');
}

console.log('\n2 · Saat en altta — panel YUKARI açılır, saat yine oynamaz');
{
  kur({ y: 600 });                       // 600 + 548 = 1148 > 1040 → sığmaz
  await fit();
  const onceki = pencere.y;
  dinlenmeY = onceki;
  await panelDegistir('panel-notes', true);
  esit(el('widget')._cls.has('yukari'), true, 'yukari sınıfı eklendi');
  esit(g.document.body._cls.has('yukari'), true, 'gövde de işaretlendi (alttan hizalama)');
  esit(pencere.h, TEMEL + PANEL['panel-notes'], 'pencere panel kadar büyüdü');
  esit(pencere.y, onceki - PANEL['panel-notes'], 'pencere panel kadar YUKARI kaydı');
  esit(pencere.y + PANEL['panel-notes'], onceki, 'saatin tepesi değişmedi (asıl ölçüt)');
  esit(pencere.y + pencere.h, onceki + TEMEL, 'pencerenin alt kenarı saatin alt kenarında kaldı');
  dogru(pencere.y + pencere.h <= ekran.availTop + ekran.availHeight, 'alt kenar iş alanının içinde');
  dogru(pencere.y >= ekran.availTop, 'pencere iş alanının dışına çıkmadı');
  esit(sonKonum(), [100, 172], 'yalnızca bir kez konumlandırıldı');
}

console.log('\n3 · Panel kapanınca her şey eski yerine döner');
{
  await panelDegistir('panel-notes', false);
  esit(el('widget')._cls.has('yukari'), false, 'yukari sınıfı kaldırıldı');
  esit(g.document.body._cls.has('yukari'), false, 'gövde işareti kaldırıldı');
  esit(pencere.h, TEMEL, 'pencere eski yüksekliğe indi');
  esit(pencere.y, dinlenmeY, 'saat tam eski yerine döndü (600)');
}

console.log('\n4 · Ayarlar paneli — iş alanına sığar, kapanınca döner');
{
  kur({ y: 300 });
  await fit();
  await panelDegistir('settings', true);
  esit(pencere.h, ekran.availHeight - 8, 'pencere iş alanına kırpıldı (görev çubuğunu aşmaz)');
  dogru(pencere.y + pencere.h <= ekran.availHeight, 'alt kenar görev çubuğunu aşmıyor');
  dogru(ekran.availHeight - (pencere.y + pencere.h) <= 12, 'görev çubuğuna yalnızca ince bir pay kalıyor');
  esit(el('widget')._cls.has('yukari'), false, 'kaplama panel widget paneli değil');
  await panelDegistir('settings', false);
  esit([pencere.y, pencere.h], [300, TEMEL], 'kapanınca eski konum ve boyut');
}

console.log('\n5 · Hiçbir yere sığmayan panel — saat yine görünür kalır');
{
  kur({ y: 200, boy: 400 });             // iş alanı 400px, panel tek başına 428px
  await fit();
  await panelDegistir('panel-notes', true);
  esit(el('widget')._cls.has('yukari'), true, 'yukari seçildi');
  esit(pencere.y, ekran.availTop, 'pencere iş alanının tepesine yanaştı (taşmıyor)');
  esit(pencere.h, 400 - 8, 'yükseklik iş alanına kırpıldı');
  esit(g.document.body._cls.has('yukari'), true,
    'gövde alttan hizalı → kırpılan kısım panelin üstü olur, saat görünür kalır');
}

console.log('\n6 · Küçük ekranda ayarlar paneli de taşmıyor');
{
  kur({ y: 500, boy: 700 });
  await fit();
  await panelDegistir('settings', true);
  dogru(pencere.y >= ekran.availTop, 'üst kenar iş alanının dışına çıkmadı');
  dogru(pencere.y + pencere.h <= ekran.availTop + ekran.availHeight, 'alt kenar görev çubuğunu aşmadı');
}

console.log('\n7 · CSS karşılığı gerçekten var mı (app.js sınıf koyar, CSS uygular)');
{
  const duz = CSS.replace(/\/\*[\s\S]*?\*\//g, '');   // yorumları at
  dogru(/\.widget\.yukari\s*\{[^}]*flex-direction:\s*column/.test(duz),
    '.widget.yukari sütun akışına çeviriyor');
  dogru(/\.widget\.yukari\s*>\s*\.panel[^{]*\{[^}]*order:\s*-1/.test(duz),
    'açık panel `order: -1` ile saatin üstüne alınıyor');
  dogru(/body\.tauri\.yukari\s*\{[^}]*align-items:\s*flex-end/.test(duz),
    'gövde alttan hizalı (kırpılınca saat görünür kalsın)');
  dogru(/\.widget\.yukari\s*>\s*\.panel[^{]*\{[^}]*border-top:\s*0/.test(duz),
    'dikiş çizgisi saatin üstünde kalıyor (yatay çizgi yukarıda değil)');
}

console.log('\n8 · Pencere konumu kalıcı mı (tur 6)');
{
  /* KULLANICI BİLDİRİMİ: "dün ekranın sağ üst köşesine sabitleyip
     kilitlediğim saat bu gün açıldığında ekranın ortasındaydı."
     Kök neden: `tauri.conf.json` `"center": true` + konum hiç kaydedilmiyordu.
     Bu test, ÖLÇÜTÜ kullanıcının cümlesinden alır: uygulama kapanıp
     açıldığında pencere bıraktığı yerde mi? */

  // Elle taşıma → depoya yazılmalı (paneller kapalıyken)
  kur({ y: 100 });
  await fit();
  pencere.x = 1500; pencere.y = 40;        // kullanıcı sağ üste taşıdı
  dogru(!!tasindi, 'taşıma olayı (onMoved) dinleniyor');
  tasindi();
  await new Promise(r => setTimeout(r, 600));   // 500ms gecikme + pay
  esit(JSON.parse(depo['pza.pencere.v1']), { x: 1500, y: 40 },
    'kullanıcının bıraktığı konum diske yazıldı');

  // Panel açıkken taşıma KAYDEDİLMEMELİ (fit penceresini geçici kaydırır)
  kayitlar = [];
  pencere.x = 1000; pencere.y = 500;
  el('settings').hidden = false;
  tasindi();
  await new Promise(r => setTimeout(r, 600));
  esit(JSON.parse(depo['pza.pencere.v1']), { x: 1500, y: 40 },
    'kaplama panel açıkken taşıma KAYDEDİLMEDİ (yanlış yeri hatırlamasın)');

  // Yeniden açılış → kayıtlı konum geri yüklenmeli, `center` yok
  kur({ depo: { 'pza.pencere.v1': JSON.stringify({ x: 1500, y: 40 }) }, y: 999 });
  await fit();
  esit([pencere.x, pencere.y], [1500, 40],
    'açılışta kayıtlı konum geri yüklendi (ortada açılmıyor)');

  // Kayıt yoksa hiçbir şey dayatılmaz (ilk açılış)
  kur({ y: 260 });
  await fit();
  esit(pencere.y, 260, 'kayıt yokken konum dayatılmıyor (ilk açılış)');

  // Monitör değişmiş: kayıtlı konum ekran dışındaysa görünür alana kırpılır
  kur({ depo: { 'pza.pencere.v1': JSON.stringify({ x: 5000, y: 4000 }) } });
  await fit();
  dogru(pencere.x <= ekran.availWidth - 80, 'ekran dışı x görünür alana kırpıldı');
  dogru(pencere.y <= ekran.availHeight - 60, 'ekran dışı y görünür alana kırpıldı');

  // `center: true` gerçekten kaldırıldı mı (kök neden)
  const CONF = JSON.parse(fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src-tauri', 'tauri.conf.json'), 'utf8'));
  esit(CONF.app.windows[0].center, undefined,
    'tauri.conf.json `center` KALDIRILDI (her açılışta ortalama yok)');
  const CAP = JSON.parse(fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src-tauri', 'capabilities', 'default.json'), 'utf8'));
  dogru(CAP.permissions.includes('core:window:allow-set-position'),
    'set-position yetkisi var (konum geri yüklenebilir)');
  dogru(CAP.permissions.includes('core:window:allow-outer-position'),
    'outer-position yetkisi var (konum okunabilir)');
}

console.log('\n' + (bad ? `SONUC: ${bad} hata, ${iyi} basarili` : `SONUC: temiz — ${iyi} kontrol`));
process.exit(bad ? 1 : 0);
