/* ezan-test.mjs — ezan modülü (vakit → mp3, mandal, gün) saf mantık testi
   Palet Zaman Asistanı · GPL-3.0
   Gerçek ağ/mp3 gerekmez: çalma stub'lanır, yalnız KARARLAR ölçülür.
   Çalıştırma: npm run test */
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

const g = globalThis;
g.window = g;
const store = new Map();
g.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  key: i => [...store.keys()][i],
  get length() { return store.size; }
};

function yukle() {
  delete g.PZA; store.clear();
  new Function(src('ezan.js'))();
  const P = g.PZA;
  P.logYaz = () => {};
  P.emit = () => {};
  return P;
}

console.log('\n1 · Vakit → mp3 eşlemesi');
let PZA = yukle();
esit(PZA.ezanDosya('Imsak'),  'Sabah-Ezan.mp3', 'İmsak/Sabah → Sabah-Ezan.mp3');
esit(PZA.ezanDosya('Ogle'),   'Ezan.mp3',       'Öğle → Ezan.mp3');
esit(PZA.ezanDosya('Ikindi'), 'Ezan.mp3',       'İkindi → Ezan.mp3');
esit(PZA.ezanDosya('Aksam'),  'Ezan.mp3',       'Akşam → Ezan.mp3');
esit(PZA.ezanDosya('Yatsi'),  'Ezan.mp3',       'Yatsı → Ezan.mp3');
esit(PZA.ezanDosya('Gunes'),  null,             'Güneş → ezan yok');

console.log('\n2 · Gün anahtarı + bugünün satırı');
esit(PZA.ezanBugunAnahtar(new Date(2026, 9, 10)), '10.10.2026', 'tarih biçimi GG.AA.YYYY');
const liste = [{ MiladiTarihKisa: '10.10.2026', Imsak: '05:24', Gunes: '06:46',
                 Ogle: '12:41', Ikindi: '15:51', Aksam: '18:25', Yatsi: '19:43' }];
esit(PZA.ezanBugun(liste, '10.10.2026').Ogle, '12:41', 'bugünün satırı bulundu');
esit(PZA.ezanBugun(liste, '11.10.2026'), null, 'olmayan gün → null');

console.log('\n3 · Tick + günlük mandal');
let calinan = [];
PZA.settings = { ezan: true, ezanIlce: 9206, ezanSes: 0.8 };
PZA.ezanCal = d => { calinan.push(d); return true; };
PZA.__ezanListe = liste;

PZA.ezanTick(new Date(2026, 9, 10, 12, 41));        // Öğle
esit(calinan, ['Ezan.mp3'], 'Öğle vaktinde çalındı');
PZA.ezanTick(new Date(2026, 9, 10, 12, 41, 30));    // aynı dakika, tekrar
esit(calinan.length, 1, 'aynı vakit ikinci kez ÇALINMAZ (mandal)');
PZA.ezanTick(new Date(2026, 9, 10, 5, 24));         // İmsak
esit(calinan, ['Ezan.mp3', 'Sabah-Ezan.mp3'], 'İmsak → Sabah sesi');
PZA.ezanTick(new Date(2026, 9, 10, 6, 46));         // Güneş
esit(calinan.length, 2, 'Güneş vaktinde ezan yok');

console.log('\n4 · Ana anahtar + il/ilçe yokluğu');
PZA.settings.ezan = false;
PZA.ezanTick(new Date(2026, 9, 10, 18, 25));        // Akşam (kapalı)
esit(calinan.length, 2, 'ana anahtar KAPALI → çalmaz (hepsi susar)');
PZA.settings.ezan = true; PZA.settings.ezanIlce = null;
PZA.ezanTick(new Date(2026, 9, 10, 18, 25));
esit(calinan.length, 2, 'ilçe seçilmemişse çalmaz');

console.log('\n5 · Gün değişince mandal sıfırlanır');
PZA.settings.ezanIlce = 9206;
calinan = [];
PZA.ezanTick(new Date(2026, 9, 10, 18, 25));
PZA.ezanTick(new Date(2026, 9, 11, 18, 25));        // ertesi gün (liste bugünü içermez → çalmaz)
esit(calinan.length, 1, 'gün değişince mandal temizlenir');

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
