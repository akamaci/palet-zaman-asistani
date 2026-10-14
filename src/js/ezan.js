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
  try {
    const url = await ezanMp3Url(dosya);
    if (PZA.__ezanAudio) { try { PZA.__ezanAudio.pause(); } catch (e) {} PZA.__ezanAudio = null; }
    const a = new Audio(url);
    const v = (typeof ses === 'number') ? ses
      : ((PZA.settings && typeof PZA.settings.ezanSes === 'number') ? PZA.settings.ezanSes : 0.8);
    a.volume = Math.max(0, Math.min(1, v));
    PZA.__ezanAudio = a;
    await a.play();
    PZA.logYaz?.('bilgi', 'Ezan çalındı: ' + dosya);
    return true;
  } catch (e) {
    PZA.logYaz?.('uyari', 'Ezan çalınamadı', { hata: String(e).slice(0, 120) });
    return false;
  }
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
  const s = PZA.settings || {};
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
