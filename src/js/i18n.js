/* i18n.js — arayüz dili (gömülü tr/en + sistem diline göre GitHub'dan indirme)
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim
   ══════════════════════════════════════════════════════════════
   Davranış (kullanıcı isteği, 2026-10-13):
   • Türkçe ve İngilizce PAKETE GÖMÜLÜDÜR (çevrimdışı çalışır).
   • Sistem dili tr/en değilse, o dilin dosyası GitHub'dan OTOMATİK indirilir
     (src/lang/<kod>.txt, main dalı) ve önbelleğe alınır → sonra çevrimdışı.
   • Dil, Ayarlar'dan seçilebilir (Otomatik / Türkçe / English / indirilmişler).
   Biçim: `anahtar = çeviri` satırları (# = yorum).
   ══════════════════════════════════════════════════════════════ */
window.PZA = window.PZA || {};

(function () {
  const GOMULU = ['tr', 'en'];
  const DEPO = 'pza.lang.';                       // önbellek anahtarı ön eki
  const URL = kod => 'https://raw.githubusercontent.com/akamaci/palet-zaman-asistani/' +
                     'main/src/lang/' + kod + '.txt';

  /** `anahtar = çeviri` metnini sözlüğe çevirir. */
  function coz(txt) {
    const o = {};
    String(txt || '').split(/\r?\n/).forEach(satir => {
      const s = satir.trim();
      if (!s || s[0] === '#') return;
      const i = s.indexOf('=');
      if (i < 0) return;
      o[s.slice(0, i).trim()] = s.slice(i + 1).trim();
    });
    return o;
  }

  /** Gömülü dil (pakette). tr/en dışındakiler için null döner. */
  async function gomuluOku(kod) {
    if (GOMULU.indexOf(kod) < 0) return null;
    try {
      const r = await fetch('lang/' + kod + '.txt', { cache: 'no-store' });
      if (!r.ok) return null;
      return coz(await r.text());
    } catch (e) { return null; }
  }

  PZA.i18n = {
    sozluk: {},
    aktif: 'tr',
    gomulu: GOMULU,

    /** Geçerli dil kodu: ayardan (dil) ya da sistemden. */
    kod: function () {
      const ayar = (PZA.settings && PZA.settings.dil) || 'auto';
      if (ayar !== 'auto') return String(ayar).toLowerCase();
      const l = String((navigator.language) || 'tr').toLowerCase();
      if (l.indexOf('tr') === 0) return 'tr';
      if (l.indexOf('en') === 0) return 'en';
      return l.split('-')[0];
    },

    /** Çeviri: anahtar yoksa `varsayilan` (verilmezse anahtar) döner. */
    t: function (anahtar, varsayilan) {
      const v = PZA.i18n.sozluk[anahtar];
      return (v != null) ? v : (varsayilan != null ? varsayilan : anahtar);
    },

    /** data-i18n / data-i18n-html / data-i18n-ph taşıyan DOM'u doldurur.
        ÖNEMLİ (2026-10-19, v1.36.5): sözlükte anahtar YOKSA elemanın HTML
        yedek metni OLDUĞU GİBİ kalır. Eskiden `t(anahtar, null)` çağrılıyor
        ve anahtar bulunamayınca HAM ANAHTAR yazılıyordu → paket içinde
        `lang/*.txt` okunamadığında (CSP `connect-src` içinde 'self' yoktu)
        arayüzde "pa_kapat", "pa_baslik" gibi anahtarlar görünüyordu.
        Kullanıcı bildirimi: "güncelleme menüsü" içinde ham anahtarlar. */
    uygula: function () {
      const yaz = (el, attr, nasil) => {
        const k = el.getAttribute(attr);
        const v = PZA.i18n.sozluk[k];
        if (v == null) return;               // yedek (HTML) metin kalsın
        if (nasil === 'html') el.innerHTML = v;
        else if (nasil === 'ph') el.setAttribute('placeholder', v);
        else el.textContent = v;
      };
      document.querySelectorAll('[data-i18n]').forEach(el => yaz(el, 'data-i18n', 'text'));
      document.querySelectorAll('[data-i18n-html]').forEach(el => yaz(el, 'data-i18n-html', 'html'));
      document.querySelectorAll('[data-i18n-ph]').forEach(el => yaz(el, 'data-i18n-ph', 'ph'));
      const sel = document.getElementById('lang-select');
      if (sel) sel.value = PZA.i18n.kod();
      document.documentElement.lang = PZA.i18n.aktif;
      PZA.emit && PZA.emit('dil', PZA.i18n.aktif);
    },

    /** Dili yükle: gömülü → yoksa GitHub'dan indir → yoksa Türkçe'ye düş. */
    hazir: async function () {
      const istenen = PZA.i18n.kod();
      let d = await gomuluOku(istenen);
      let gercek = istenen;

      if (!d) {
        /* Önbellek? */
        try {
          const c = localStorage.getItem(DEPO + istenen);
          if (c) d = coz(c);
        } catch (e) { /* yok say */ }
      }
      if (!d) {
        /* GitHub'dan otomatik indir */
        try {
          const r = await fetch(URL(istenen), { cache: 'no-store' });
          if (r.ok) {
            const txt = await r.text();
            try { localStorage.setItem(DEPO + istenen, txt); } catch (e) {}
            d = coz(txt);
          }
        } catch (e) { /* ağ yok */ }
      }
      if (!d) {
        /* İndirilemedi → gömülü Türkçe (sessiz kalma) */
        d = (await gomuluOku('tr')) || {};
        gercek = 'tr';
        PZA.logYaz && PZA.logYaz('uyari', 'Çeviri indirilemedi, Türkçe kullanılıyor: ' + istenen);
      }

      PZA.i18n.sozluk = d || {};
      PZA.i18n.aktif = gercek;
      PZA.i18n.uygula();
      return gercek;
    },

    /** Ayarlardan dil değiştir → kaydet → yükle. */
    sec: async function (kod) {
      PZA.set('dil', kod);
      await PZA.i18n.hazir();
    }
  };
})();
