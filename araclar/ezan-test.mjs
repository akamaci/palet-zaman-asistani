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

/* v1.18.0 — ana paneldeki ses düğmesi: SESSİZ mod + vakit adları + bugünün
   listesi. Gerçek mp3 indirilmez; fetch/Audio stub'lanır, yalnız KARAR ölçülür. */
console.log('\n6 · Sessiz mod + vakit adları/listesi (v1.18.0)');
PZA = yukle();
PZA.settings = { ezan: true, ezanIlce: 9206, ezanSes: 0.8, ezanSessiz: true };
let audioSay = 0;
g.fetch = async () => ({ ok: true, blob: async () => new Blob([]) });
g.Audio = function () { audioSay++; this.play = async () => {}; };
g.URL = { createObjectURL: () => 'blob:test' };
const r1 = await PZA.ezanCal('Ezan.mp3');
dogru(r1 === false, 'sessiz modda ezan ÇALINMAZ (false döner)');
dogru(audioSay === 0, 'sessiz modda Audio hiç oluşturulmaz (mp3 de inmez)');
PZA.settings.ezanSessiz = false;
const r2 = await PZA.ezanCal('Ezan.mp3');
dogru(r2 === true, 'sessiz kapatılınca ezan çalınır (true)');
dogru(audioSay === 1, 'ses açıkken Audio oluşturulur (1)');
esit(PZA.EZAN_ADLAR.Ogle, 'Öğle', 'vakit Türkçe adı Öğle');
esit(PZA.EZAN_ADLAR.Gunes, 'Güneş', 'vakit Türkçe adı Güneş');
esit(PZA.EZAN_ADLAR.Yatsi, 'Yatsı', 'vakit Türkçe adı Yatsı');
PZA.__ezanListe = [{ MiladiTarihKisa: PZA.ezanBugunAnahtar(new Date()),
  Imsak: '05:24', Gunes: '06:46', Ogle: '12:41', Ikindi: '15:51', Aksam: '18:25', Yatsi: '19:43' }];
esit(PZA.ezanBugunVakitler().Ogle, '12:41', 'ezanBugunVakitler bugünün satırını verir');

/* v1.18.6 — KULLANICI: "ezan okunurken sesi kıs → çalma durmuyor" +
   "bir sonraki ezana kadar dursun, çalar saat gibi". */
console.log('\n7 · Sustur / Durdur + süreli susturma (çalar saat) (v1.18.6)');
PZA = yukle();
let duraklatildi = 0;
g.fetch = async () => ({ ok: true, blob: async () => new Blob([]) });
g.URL = { createObjectURL: () => 'blob:test' };
g.Audio = function () { this.play = async () => {}; this.pause = () => { duraklatildi++; }; this.volume = 1; };
PZA.save = () => {}; PZA.apply = () => {}; PZA.logYaz = () => {};
PZA.settings = { ezan: true, ezanIlce: 9206, ezanSes: 0.8 };

await PZA.ezanCal('Ezan.mp3');
dogru(PZA.__ezanAudio !== null, 'çalan ses referansı tutuluyor');
dogru(PZA.ezanDurdur() === true, 'ezanDurdur → çalan ses durduruldu');
esit(duraklatildi, 1, 'Audio.pause çağrıldı (ses kısıldı)');
dogru(PZA.__ezanAudio === null, 'durdurunca referans temizlendi');
dogru(PZA.ezanDurdur() === false, 'çalan yokken ezanDurdur false döner (güvenli)');

await PZA.ezanCal('Ezan.mp3');
const bugunK = PZA.ezanBugunAnahtar(new Date());
PZA.__ezanListe = [{ MiladiTarihKisa: bugunK, Imsak: '00:01', Gunes: '00:02',
  Ogle: '00:03', Ikindi: '00:04', Aksam: '00:05', Yatsi: '23:59' }];
PZA.ezanSustur();
dogru(PZA.settings.ezanSessiz === true, 'sustur → ezanSessiz = true');
dogru(typeof PZA.settings.ezanSessizKadar === 'number', 'sustur → bitiş zamanı yazıldı (otomatik geri açılır)');
esit(duraklatildi, 2, 'sustur, çalan sesi de durdurdu (2. pause)');

PZA.settings.ezanSessizKadar = Date.now() - 1000;    // süre geçmiş → sonraki vakit geldi
PZA.ezanTick(new Date());
dogru(PZA.settings.ezanSessiz === false,
  'süre dolunca ezanTick sesi KENDİLİĞİNDEN açtı (çalar saat yeniden kuruldu)');

console.log('\n' + (bad ? bad + ' SORUN · ' + iyi + ' geçti' : 'TÜMÜ GEÇTİ · ' + iyi + ' kontrol'));
process.exit(bad ? 1 : 0);
