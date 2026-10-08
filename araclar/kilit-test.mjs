/* kilit-test.mjs — yeri kilitle (sağ üst köşe) + sürümün tek kaynağı
   Palet Zaman Asistanı · GPL-3.0

   Kullanıcı isteği: "sağ üst köşeye kilit ikonu koyarsan olduğu yere
   kilitleyelim, yerinden yanlışlıkla oynamasın."

   Kilit Rust tarafında DEĞİL, DOM'da uygulanır: Tauri'de pencereyi
   taşıyan tek mekanizma `data-tauri-drag-region` özniteliğidir.
   Bu test üç şeyi kanıtlar:
     • öznitelik gerçekten kaldırılıyor (kilit tutuyor)
     • kilidi açınca GERİ KONUYOR — konmazsa widget bir daha taşınamaz,
       sessiz ve kalıcı bir kilitlenme olur
     • seçim kalıcı: yeniden yüklendiğinde kilitli kalıyor

   Çalıştırma:  npm run test        */
import fs from 'fs';
import path from 'path';

const KOK = path.join(import.meta.dirname, '..', 'src', 'js') + path.sep;
const src = f => fs.readFileSync(KOK + f, 'utf8');

let bad = 0, iyi = 0;
const ok = m => { iyi++; console.log('  OK   ' + m); };
const bad_ = m => { bad++; console.log('  X    ' + m); };
const esit = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b))
  ? ok(m + ' = ' + JSON.stringify(a))
  : bad_(m + ' → beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a));
const dogru = (c, m) => c ? ok(m) : bad_(m);

/* ── Sahte DOM ───────────────────────────────────────── */
function mkEl(id) {
  const attrs = new Map();
  const cls = new Set();
  return {
    id, textContent: '', innerHTML: '', hidden: false, value: '', checked: false,
    disabled: false, dataset: {}, style: {},
    setAttribute: (k, v) => attrs.set(k, String(v)),
    removeAttribute: k => attrs.delete(k),
    hasAttribute: k => attrs.has(k),
    getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
    _attrs: attrs,
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }
    }
  };
}

let els, tasima, store;

function kur(kayitli) {
  els = new Map();
  store = new Map();
  if (kayitli) store.set('pza.settings.v1', JSON.stringify(kayitli));
  /* Taşıma bölgeleri — HTML'deki üç öğenin karşılığı, ikisi de
     `data-drag` işaretli ve `data-tauri-drag-region` etkin. */
  tasima = ['bar-top', 'weather-tile', 'group-center'].map(id => {
    const e = mkEl(id);
    e.dataset.drag = '1';
    e.setAttribute('data-tauri-drag-region', '');
    return e;
  });
  const g = globalThis;
  g.window = g;
  g.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  g.document = {
    getElementById: id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
    querySelector: () => null,
    querySelectorAll: sel => (sel === '[data-drag]' ? tasima : []),
    addEventListener() {}
  };
  delete g.PZA;
  new Function(src('settings.js'))();
  const PZA = g.PZA;
  /* Ayarlar panelinin geri kalanı bu testin konusu değil; apply()'ın
     ihtiyaç duyduğu iki skin yardımcısı sahtelenir. */
  PZA.customSkins = () => [];
  PZA.skinById = () => null;
  PZA.escHtml = s => String(s);      // notes.js yüklü değil
  return PZA;
}
const attrVar = () => tasima.filter(e => e.hasAttribute('data-tauri-drag-region')).length;

console.log('\n1 · Varsayılan: kilit kapalı, widget taşınabilir');
let PZA = kur();
esit(PZA.settings.locked, false, 'varsayılan kilit durumu');
esit(attrVar(), 3, 'üç taşıma bölgesi de etkin');
esit(PZA.applyLock(), false, 'applyLock() → false');
esit(attrVar(), 3, 'kilit kapalıyken hepsi taşınabilir');
esit(els.get('widget').classList.contains('locked'), false, 'widget.locked sınıfı YOK (temiz durum)');
{
  const b = els.get('btn-lock');
  esit(b.classList.contains('on'), false, 'düğme işaretsiz');
  esit(b.getAttribute('aria-pressed'), 'false', 'aria-pressed');
  dogru(b.title.includes('Yerine kilitle'), 'ipucu: kilitle → "' + b.title + '"');
}

console.log('\n2 · Kilit açık: taşıma bölgeleri kapanır');
PZA.settings.locked = true;
esit(PZA.applyLock(), true, 'applyLock() → true');
esit(attrVar(), 0, 'üç öznitelik de KALDIRILDI → pencere taşınamaz');
esit(els.get('widget').classList.contains('locked'), true, 'widget.locked sınıfı eklendi');
{
  const b = els.get('btn-lock');
  esit(b.classList.contains('on'), true, 'düğme işaretli');
  esit(b.getAttribute('aria-pressed'), 'true', 'aria-pressed');
  dogru(b.title.includes('Kilit açık'), 'ipucu: kilidi aç → "' + b.title + '"');
}

console.log('\n3 · Kilit açılınca GERİ KONUR (asıl tuzak)');
PZA.settings.locked = false;
PZA.applyLock();
esit(attrVar(), 3, 'üç öznitelik de geri geldi → widget yine taşınabilir');
esit(els.get('widget').classList.contains('locked'), false, 'widget.locked sınıfı kaldırıldı');
esit(els.get('btn-lock').classList.contains('on'), false, 'düğme işareti kalktı');
// Arka arkaya aç/kapa — öznitelik yıpranmamalı
for (let i = 0; i < 5; i++) { PZA.settings.locked = !PZA.settings.locked; PZA.applyLock(); }
esit(attrVar(), 0, 'tek sayıda tur sonrası kilitli');
PZA.settings.locked = false; PZA.applyLock();
esit(attrVar(), 3, 'beş tur aç/kapa sonrası hâlâ geri geliyor');

console.log('\n4 · Seçim kalıcı — yeniden açılışta kilitli');
PZA.settings.locked = true;
PZA.save();
PZA = kur({ locked: true });        // uygulama yeniden açıldı
esit(PZA.settings.locked, true, 'depodan kilitli okundu');
PZA.apply();
esit(attrVar(), 0, 'açılışta PZA.apply() kilidi uyguladı');
esit(els.get('btn-lock').classList.contains('on'), true, 'düğme açılışta işaretli');

console.log('\n5 · Sürüm tek kaynak: PZA.SURUM → panel alt yazısı');
dogru(/^\d+\.\d+\.\d+$/.test(PZA.SURUM), 'PZA.SURUM biçimi → ' + PZA.SURUM);
esit(els.get('set-ver').textContent, PZA.SURUM, 'alt yazı PZA.SURUM\'dan geliyor');
dogru(fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'index.html'), 'utf8')
  .includes('id="set-ver"'), 'index.html alt yazıyı JS\'ten besliyor');

console.log('\n6 · Kilit Rust tarafı istemez (kapsam denetimi)');
{
  const mainRs = fs.readFileSync(path.join(import.meta.dirname, '..', 'src-tauri', 'src', 'main.rs'), 'utf8');
  dogru(!/kilit|lock/i.test(mainRs.replace(/\/\/.*$/gm, '')),
    'main.rs\'te kilit komutu yok — DOM yeterli, yeni yetki gerekmez');
  dogru(/data-tauri-drag-region/.test(src('settings.js')) || /data-drag/.test(src('settings.js')),
    'taşıma bölgeleri DOM\'dan yönetiliyor');
}

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
