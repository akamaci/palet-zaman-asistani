/* ezan.js — namaz vakti (ezan) modülü
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim
   ══════════════════════════════════════════════════════════════
   API: https://ezanvakti.emushaf.net (açık, anahtarsız, Diyanet tabanlı).
   Konum: hava durumu şehriyle PAYLAŞILIR (ayrı yerelleştirme yok);
   emushaf il/ilçe ID ile çalışır (Ayarlar → EZAN'dan seçilir, ön-seçili).
   Vakitler AYLIK çekilir, önbelleğe alınır; çevrimdışıysa son önbellek kullanılır.
   Ses: Sabah (İmsak) → Sabah-Ezan.mp3 · diğer 4 vakit → Ezan.mp3 · Güneş → yok.
   TEK ana anahtar (settings.ezan) — vakit bazlı aç/kapa YOK (kullanıcı kararı).
   ══════════════════════════════════════════════════════════════ */
window.PZA = window.PZA || {};

const EZAN_API = 'https://ezanvakti.emushaf.net';
const EZAN_MP3 = 'https://raw.githubusercontent.com/akamaci/palet-zaman-asistani/main/assets/ezan/';
const EZAN_DEPO = 'pza.ezan.';                 // vakit önbelleği anahtar ön eki

/* ── Saf mantık (test edilebilir) ─────────────────────────── */

/** Vakit → mp3 dosyası. Güneş'te ezan okunmaz (null). */
PZA.ezanDosya = function (vakit) {
  if (vakit === 'Imsak') return 'Sabah-Ezan.mp3';                 // Sabah farklı
  if (vakit === 'Ogle' || vakit === 'Ikindi' || vakit === 'Aksam' || vakit === 'Yatsi')
    return 'Ezan.mp3';
  return null;                                                    // Gunes → yok
};

/** Bugünün vakit satırını bul. `tarih` = "GG.AA.YYYY" (emushaf biçimi). */
PZA.ezanBugun = function (liste, tarih) {
  if (!Array.isArray(liste)) return null;
  return liste.find(x => x && x.MiladiTarihKisa === tarih) || null;
};

/** Bugün anahtarı "GG.AA.YYYY" (emushaf MiladiTarihKisa ile birebir). */
PZA.ezanBugunAnahtar = function (d) {
  const p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
};

/** Ezan çalınacak 5 vakit (Güneş hariç), sırayla. */
PZA.EZAN_VAKITLER = ['Imsak', 'Ogle', 'Ikindi', 'Aksam', 'Yatsi'];

/** Vakitlerin Türkçe adları — ana panelin vakit listesinde kullanılır. */
PZA.EZAN_ADLAR = { Imsak: 'İmsak', Gunes: 'Güneş', Ogle: 'Öğle', Ikindi: 'İkindi', Aksam: 'Akşam', Yatsi: 'Yatsı' };

/** Bugünün vakit satırı (ana panel dropdown çizelgesi için). Liste yoksa null. */
PZA.ezanBugunVakitler = function () {
  if (!PZA.__ezanListe) return null;
  return PZA.ezanBugun(PZA.__ezanListe, PZA.ezanBugunAnahtar(new Date()));
};

/* ── Önbellek (localStorage) ─────────────────────────────── */
function ezanOku(anahtar) {
  try { const r = localStorage.getItem(EZAN_DEPO + anahtar); return r ? JSON.parse(r) : null; }
  catch (e) { return null; }
}
function ezanYaz(anahtar, veri) {
  try { localStorage.setItem(EZAN_DEPO + anahtar, JSON.stringify(veri)); } catch (e) {}
}

/** İl listesi (Türkiye = ulkeId 2). */
PZA.ezanSehirler = async function (ulkeId) {
  const r = await fetch(EZAN_API + '/sehirler/' + (ulkeId || 2), { cache: 'no-store' });
  if (!r.ok) throw new Error('şehirler HTTP ' + r.status);
  return r.json();
};

/** Bir ilin ilçeleri. */
PZA.ezanIlceler = async function (sehirId) {
  const r = await fetch(EZAN_API + '/ilceler/' + sehirId, { cache: 'no-store' });
  if (!r.ok) throw new Error('ilçeler HTTP ' + r.status);
  return r.json();
};

/** Aylık vakitler — önbellekli; ağ yoksa son önbelleğe düşer. */
PZA.ezanVakitler = async function (ilceId) {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const anahtar = ilceId + '-' + d.getFullYear() + '-' + p(d.getMonth() + 1);
  const onbellek = ezanOku(anahtar);
  if (onbellek) return onbellek;
  try {
    const r = await fetch(EZAN_API + '/vakitler/' + ilceId, { cache: 'no-store' });
    if (!r.ok) throw new Error('vakitler HTTP ' + r.status);
    const v = await r.json();
    ezanYaz(anahtar, v);
    return v;
  } catch (e) {
    /* Çevrimdışı yedek: bu ilçe için kayıtlı herhangi bir ay (bugünü içerebilir). */
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k === EZAN_DEPO + ilceId + '-' || k.indexOf(EZAN_DEPO + ilceId + '-') === 0) {
          const c = ezanOku(k.slice(EZAN_DEPO.length));
          if (c) return c;
        }
      }
    } catch (e2) { /* localStorage yok */ }
    throw e;
  }
};

/* ── Çalma ───────────────────────────────────────────────── */
const ezanSesOnbellek = new Map();     // dosya → objectURL
PZA.__ezanAudio = null;

async function ezanMp3Url(dosya) {
  if (ezanSesOnbellek.has(dosya)) return ezanSesOnbellek.get(dosya);
  const r = await fetch(EZAN_MP3 + dosya, { cache: 'force-cache' });
  if (!r.ok) throw new Error('mp3 HTTP ' + r.status);
  const url = URL.createObjectURL(await r.blob());
  ezanSesOnbellek.set(dosya, url);
  return url;
}

/** Ezanı çal (dosya adı verilir). Ayarlardaki ses seviyesi kullanılır. */
PZA.ezanCal = async function (dosya, ses) {
  /* v1.18.0 — SESSİZ mod: ana `ezan` açık ama kullanıcı ana paneldeki
     düğmeyle sesi kapatmış. Sesi hiç çalmayız (mp3 de indirilmez); vakit
     kaçmaz, yalnız duyulmaz. Kullanıcı isteği: "ezan sesini kısıp açacak buton". */
  if (PZA.settings && PZA.settings.ezanSessiz === true) {
    PZA.logYaz?.('bilgi', 'Ezan sessiz modda (çalınmadı): ' + dosya);
    return false;
  }
  try {
    const url = await ezanMp3Url(dosya);
    PZA.ezanDurdur();                                    // önceki çalanı durdur
    const a = new Audio(url);
    const v = (typeof ses === 'number') ? ses
      : ((PZA.settings && typeof PZA.settings.ezanSes === 'number') ? PZA.settings.ezanSes : 0.8);
    a.volume = Math.max(0, Math.min(1, v));
    PZA.__ezanAudio = a;
    a.onended = () => { if (PZA.__ezanAudio === a) PZA.__ezanAudio = null; };
    await a.play();
    PZA.logYaz?.('bilgi', 'Ezan çalındı: ' + dosya);
    return true;
  } catch (e) {
    PZA.logYaz?.('uyari', 'Ezan çalınamadı', { hata: String(e).slice(0, 120) });
    return false;
  }
};

/** ÇALAN ezanı DURDUR. KULLANICI BİLDİRİMİ (2026-10-16): "ezan okunurken
    sesi kıs dediğimizde ses kapanmıyor ya da çalma duraklamıyor."
    Kök neden: 'Sessiz' düğmesi yalnız `settings.ezanSessiz`'i değiştiriyordu;
    çalmakta olan Audio nesnesine dokunmuyordu. Bu fonksiyon çalan sesi
    duraklatır ve referansı temizler; sesi kısma düğmesi buna bağlanır. */
PZA.ezanDurdur = function () {
  if (!PZA.__ezanAudio) return false;
  try { PZA.__ezanAudio.pause(); } catch (e) {}
  PZA.__ezanAudio = null;
  PZA.logYaz?.('bilgi', 'Çalan ezan durduruldu (ses kısıldı)');
  return true;
};

/** Bugünün BİR SONRAKİ vakit zamanı (epoch ms). Bugün vakit kalmadıysa
    yarının İmsak'ı. `liste` yoksa null. */
function ezanSonrakiVakitMs(liste) {
  const d = new Date();
  const bugun = PZA.ezanBugun(liste, PZA.ezanBugunAnahtar(d));
  if (!bugun) return null;
  const now = d.getTime();
  let en = null;
  for (const v of PZA.EZAN_VAKITLER) {
    const t = bugun[v]; if (!t) continue;
    const [hh, mm] = String(t).split(':').map(Number);
    const dt = new Date(d); dt.setHours(hh || 0, mm || 0, 0, 0);
    const ms = dt.getTime();
    if (ms > now && (en === null || ms < en)) en = ms;
  }
  if (en === null) {                                  // bugün kalmadı → yarın İmsak
    const t = bugun['Imsak']; if (!t) return null;
    const [hh, mm] = String(t).split(':').map(Number);
    const dt = new Date(d); dt.setHours(hh || 0, mm || 0, 0, 0); dt.setDate(dt.getDate() + 1);
    en = dt.getTime();
  }
  return en;
}

/** Sesi kıs — ÇALAR SAATİ KAPATIR GİBİ (kullanıcı, 2026-10-16):
    "en azından bir dahaki ezana kadar durmalı … çalar saat gibi düşünelim."
    Yapılan: ① çalan ezanı DURDUR ② sesi kapat ③ **bir sonraki vakit anına
    kadar** kapalı kal (o an gelince `ezanTick` kendiliğinden geri açar). */
PZA.ezanSustur = function () {
  PZA.ezanDurdur();
  const ms = PZA.__ezanListe ? ezanSonrakiVakitMs(PZA.__ezanListe) : null;
  const s = PZA.settings || (PZA.settings = {});
  s.ezanSessiz = true;
  s.ezanSessizKadar = ms || (Date.now() + 30 * 60 * 1000);   // liste yoksa 30 dk sonra dene
  PZA.save?.();
  if (PZA.ezanMenuCiz) PZA.ezanMenuCiz();
  PZA.apply?.();
  PZA.logYaz?.('bilgi', 'Ezan susturuldu — ' +
    new Date(s.ezanSessizKadar).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) +
    ' (sonraki vakit) sonrası yeniden açılacak');
  return true;
};

/** Ses kısma mandalını AÇ (kullanıcı düğmeye tekrar bastı ya da süre doldu). */
PZA.ezanSesiAc = function () {
  const s = PZA.settings || (PZA.settings = {});
  s.ezanSessiz = false;
  s.ezanSessizKadar = null;
  PZA.save?.();
  if (PZA.ezanMenuCiz) PZA.ezanMenuCiz();
  PZA.apply?.();
  return true;
};

/** Ayarlardaki "▶ Ezanı dene" — normal ezanı çalar. */
PZA.ezanTest = function () { return PZA.ezanCal('Ezan.mp3'); };

/* ── Vakit yükleme + saat başı kontrol ───────────────────── */
PZA.__ezanListe = null;

PZA.ezanYukle = async function () {
  const s = PZA.settings || {};
  if (!s.ezanIlce) { PZA.__ezanListe = null; return null; }
  try {
    const v = await PZA.ezanVakitler(s.ezanIlce);
    PZA.__ezanListe = v;
    PZA.emit?.('ezan:vakitler', v);
    return v;
  } catch (e) {
    PZA.logYaz?.('uyari', 'Ezan vakitleri alınamadı', { hata: String(e).slice(0, 120) });
    return null;
  }
};

let ezanGun = null;
let ezanCalinan = new Set();           // "GG.AA.YYYY|vakit" — günlük mandal

/** Her saniye `clock.js` çağırır. Vakit saati geldiyse ezanı çalar. */
PZA.ezanTick = function (d) {
  let s = PZA.settings || {};
  /* SÜRELİ SUSTURMA (kullanıcı, 2026-10-16): "çalar saat gibi" — panel
     düğmesiyle susturulduysa, BİR SONRAKİ VAKİT anı gelince sesi
     kendiliğinden geri aç (kalıcı kapatma Ayarlar'daki ana anahtarla). */
  if (s.ezanSessiz === true && typeof s.ezanSessizKadar === 'number' &&
      Date.now() >= s.ezanSessizKadar) {
    PZA.ezanSesiAc();
    s = PZA.settings || {};
  }
  if (!s.ezan || !s.ezanIlce) return;
  const gun = PZA.ezanBugunAnahtar(d);
  if (ezanGun !== gun) { ezanCalinan = new Set(); ezanGun = gun; }   // gün değişti
  const liste = PZA.__ezanListe;
  if (!liste) return;                                   // henüz yüklenmedi
  const bugun = PZA.ezanBugun(liste, gun);
  if (!bugun) return;
  const hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  for (const vakit of PZA.EZAN_VAKITLER) {
    if (bugun[vakit] !== hhmm) continue;
    const k = gun + '|' + vakit;
    if (ezanCalinan.has(k)) continue;                   // aynı vakit iki kez çalmasın
    ezanCalinan.add(k);
    const dosya = PZA.ezanDosya(vakit);
    if (dosya) PZA.ezanCal(dosya);
  }
};
