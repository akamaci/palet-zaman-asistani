/* notlar-test.mjs — notlar, takvim ve saat başı okuma mandalı
   Palet Zaman Asistanı · GPL-3.0

   Gerçek kaynak dosyalar (settings.js, clock.js, notes.js) sahte bir DOM
   üzerinde çalıştırılır. Statik tarama değil DAVRANIŞ testidir: "çağrı var"
   değil "işe yarıyor" der.

   Bu dosya gerçek hatalardan doğdu:
     • Takvim tarih matematiği — ay/yıl taşması, Pazartesi başlangıcı
     • Notun SEÇİLİ güne yazılması — eskiden ekleme/silme/yıldızlama üçü de
       todayKey()'e sabitti ve başka güne not girmek imkânsızdı
     • Gece yarısı devri — bugünü izleyen taşınır, başka güne bakanın seçimi korunur
     • Saat başı okuma mandalı — eski şart `seconds === 0` idi; setInterval
       kaydığında ya da pencere gizlendiğinde o tek saniye kaçıyordu

   Çalıştırma:  npm run test        */
import fs from 'fs';
import path from 'path';

const KOK = path.join(import.meta.dirname, '..', 'src', 'js') + path.sep;
const src = f => fs.readFileSync(KOK + f, 'utf8');

let bad = 0, iyi = 0;
const ok  = m => { iyi++; console.log('  OK   ' + m); };
const bad_ = m => { bad++; console.log('  X    ' + m); };
const esit = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b)) ? ok(m + ' = ' + JSON.stringify(a)) : bad_(m + ' → beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a));

/* ── Sahte ortam ─────────────────────────────────────── */
const store = new Map();
function mkEl(id) {
  const cls = new Set();
  return {
    id, textContent: '', innerHTML: '', hidden: false, disabled: false,
    dataset: {}, style: {}, value: '',
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      contains: c => cls.has(c),
      toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); },
      _set: cls
    },
    setAttribute() {}, getAttribute() { return null; },
    focus() {}, querySelector: () => null, closest: () => null
  };
}
const els = new Map();
const el = id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };

const g = globalThis;
g.window = g;
g.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
g.document = {
  getElementById: id => el(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}, body: { classList: mkEl('body').classList }
};
g.confirm = () => true;

new Function(src('settings.js') + '\n' + src('clock.js') + '\n' + src('notes.js'))();
const PZA = g.PZA;

console.log('\n1 · Takvim tarih matematiği');
esit(PZA.isoOf(2026, 12, 1), '2027-01-01', 'isoOf ay taşması (Ara→Oca)');
esit(PZA.isoOf(2026, 9, 32), '2026-11-01', 'isoOf gün taşması (31→1)');
esit(PZA.isoOf(2026, -1, 1), '2025-12-01', 'isoOf negatif ay');
esit(PZA.dayMeta('2026-10-09'), { y: 2026, m: 10, d: 9, ay: 'Ekim', gun: 'Cuma' }, 'dayMeta 09 Ekim 2026');
esit(PZA.dayMeta('2026-10-01').gun, 'Perşembe', 'dayMeta 01 Ekim 2026');

console.log('\n2 · Takvim ızgarası (Ekim 2026)');
for (const h of ['cal-grid', 'cal-title']) el(h).innerHTML = '';
const isoGrid = () => [...el('cal-grid').innerHTML.matchAll(/data-day="([\d-]+)"/g)].map(m => m[1]);
PZA.activeDay = '2026-10-09';
PZA.openCal(true);
const grid = isoGrid();
esit(grid.length, 42, 'hücre sayısı');
// 1 Ekim 2026 Perşembe → ızgara Pazartesi 28 Eylül'de başlamalı
esit(grid[0], '2026-09-28', 'ızgara ilk hücre (Pazartesi)');
esit(grid[3], '2026-10-01', '1 Ekim konumu (Perşembe = 4. sütun)');
const gunler = grid.filter(x => x.startsWith('2026-10'));
esit(gunler.length, 31, 'Ekim günleri eksiksiz');
esit(gunler[0] + '|' + gunler[30], '2026-10-01|2026-10-31', 'ayın ilk/son günü');
ok('ızgara 7 sütun × 6 satır');

console.log('\n3 · Ay gezinme');
esit([PZA.calY, PZA.calM], [2026, 9], 'açılışta seçili ay');
PZA.calShift(1);  esit([PZA.calY, PZA.calM], [2026, 10], 'ileri → Kasım');
PZA.calShift(3);  esit([PZA.calY, PZA.calM], [2027, 1],  'ileri ×3 → Şubat 2027 (yıl devri)');
PZA.calShift(-6); esit([PZA.calY, PZA.calM], [2026, 7],  'geri ×6 → Ağustos 2026');
esit(el('cal-title').textContent, 'Ağustos 2026', 'başlık metni');

console.log('\n4 · Notlar seçili güne yazılır (eskiden hep bugüne yazıyordu)');
const bugun = PZA.todayKey();
PZA.selectDay('2026-10-09');
esit(PZA.activeDay, '2026-10-09', 'seçili gün');
PZA.addNote('09:30', 'Diş kontrolü');
PZA.addNote('14:00', 'Toplantı');
esit((PZA.notes['2026-10-09'] || []).length, 2, 'notlar seçili güne eklendi');
esit(PZA.notes[bugun] || [], [], 'bugüne sızma yok');
esit(PZA.dayNotes().map(n => n.t), ['09:30', '14:00'], 'saate göre sıralı');
esit(el('notes-count').textContent, 2, 'kayıt sayacı');
esit(el('notes-date').textContent, '9', 'başlık: gün');
esit(el('notes-weekday').textContent, 'Cuma', 'başlık: hafta günü');
esit(el('notes-month').textContent, 'Ekim 2026', 'başlık: ay');
esit(el('notes-today').hidden, false, '"Bugüne dön" görünür');
esit(JSON.stringify(PZA.notes[bugun] || []), '[]', 'depo hâlâ temiz');

PZA.toggleStar('09:30', 'Diş kontrolü');
esit(PZA.notes['2026-10-09'][0].star, true, 'yıldız seçili güne işlendi');
PZA.removeNote('14:00', 'Toplantı');
esit(PZA.notes['2026-10-09'].length, 1, 'silme seçili güne işlendi');

PZA.selectDay(bugun);
esit(el('notes-today').hidden, true, 'bugüne dönünce "Bugüne dön" gizlenir');
esit(el('notes-date').textContent, String(new Date().getDate()), 'başlık bugüne döndü');
ok('takvim seçim sonrası kapandı: ' + (el('cal').hidden === true));

console.log('\n5 · Gece yarısı devri');
const gercekToday = PZA.todayKey;
PZA._gun = '2026-10-08'; PZA.activeDay = '2026-10-08';
PZA.todayKey = () => '2026-10-09';
PZA.checkRollover();
esit(PZA.activeDay, '2026-10-09', 'bugünü izleyen kullanıcı yeni güne taşındı');
PZA.activeDay = '2026-10-05'; PZA._gun = '2026-10-09';
PZA.todayKey = () => '2026-10-10';
PZA.checkRollover();
esit(PZA.activeDay, '2026-10-05', 'başka güne bakan kullanıcının seçimi korundu');
PZA.todayKey = gercekToday;
PZA.selectDay(gercekToday);

console.log('\n6 · Saat başı okuma mandalı (eski şart: seconds === 0)');
const GercekDate = g.Date;
let anonslar = [];
PZA.settings.speech = true;
PZA.say = (h, m) => { anonslar.push(h + ':' + m); return true; };

function saatKur(h, m, s) {
  const t = new GercekDate(2026, 9, 9, h, m, s);
  g.Date = class { constructor() { return t; } static now() { return t.getTime(); } };
}
const adet = () => anonslar.length;

saatKur(15, 0, 3);   // dakika 00, saniye 03 → ESKİ KOD BURADA SESSİZ KALIRDI
PZA.tick();
esit(adet(), 1, 'dakika 00 / saniye 03 → okundu (eski kod kaçırıyordu)');
PZA.tick();
esit(adet(), 1, 'aynı saat içinde tekrar okumadı');

saatKur(15, 0, 45);
PZA.tick();
esit(adet(), 1, 'dakika 00 boyunca ikinci anons yok');

saatKur(15, 1, 0);
PZA.tick();
esit(adet(), 1, 'dakika 01 → okuma yok');

saatKur(16, 0, 0);
PZA.tick();
esit(adet(), 2, 'yeni saat başı → okundu');
esit(anonslar, ['15:0', '16:0'], 'okunan saatler');

PZA.settings.speech = false;
saatKur(17, 0, 0);
PZA.tick();
esit(adet(), 2, 'ayar kapalıyken okuma yok');

g.Date = GercekDate;

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
