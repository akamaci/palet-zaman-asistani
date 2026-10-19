/* app.js — başlatma ve olay bağlama
   Palet Zaman Asistanı · GPL-3.0 */
(function () {
  const $ = id => document.getElementById(id);

  /* Tauri içinde miyiz? (tarayıcı önizlemesinde de çalışır) */
  const TAURI = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  if (TAURI) document.body.classList.add('tauri');

  /* v1.12.0 — Arayüz dili. Gömmülü tr/en çevrimdışı çalışır; sistem dili
     başkaysa o dil GitHub'dan OTOMATİK indirilir. Dil seçici burada bağlanır.
     (Savunmacı: i18n.js yüklenmemişse sessizce atlanır.) */
  if (PZA.i18n && typeof PZA.i18n.hazir === 'function') PZA.i18n.hazir();
  $('lang-select')?.addEventListener('change', e => {
    if (PZA.i18n && typeof PZA.i18n.sec === 'function') PZA.i18n.sec(e.target.value);
  });

  async function invoke(cmd, args) {
    if (!TAURI) return null;
    try {
      const core = window.__TAURI__.core || window.__TAURI__;
      return await core.invoke(cmd, args);
    } catch (e) { console.warn('invoke ' + cmd, e); return null; }
  }

  /* Hatayı YUTMAYAN çağrı. Güncelleme akışı yutan `invoke` yüzünden
     "çalışmıyor" deyip SEBEBİNİ gösteremiyordu — bu çağrı hatayı
     çağırana yükseltir, arayüz gerçek mesajı yazabilir. */
  async function hamInvoke(cmd, args) {
    if (!TAURI) throw new Error('Tauri dışında çalışıyor');
    const core = window.__TAURI__.core || window.__TAURI__;
    return await core.invoke(cmd, args);
  }

  /* ── Tauri: pencereyi içeriğe uydur ────────────────────
     Notlar/hava paneli açılınca widget uzar. Sabit pencere
     yüksekliği paneli kırpardı.

     GENİŞLİK DE uydurulur. Eskiden yalnız yükseklik değişirdi ve
     pencere 960px'te kalırdı; widget 480px iken iki yanda ~240px
     görünmez şerit kalıyor, masaüstü tıklamalarını yutuyordu.
     Ölçülen şey widget'ın ÇİZGİLENMİŞ genişliği değil, CSS'teki
     `max-width`'i: çizilmiş genişlik pencereye bağlı olduğu için
     onu ölçmek pencere↔içerik geri besleme döngüsü kurar.
     `max-width` ise `data-size`'a bağlı sabit bir sayıdır. */
  if (TAURI) {
    let sonH = 0, sonG = 0;
    /* Son uyguladığımız pencere konumu ve o andaki panel düzeni.
       Panel açılıp kapansa da SAATİN EKRANDAKİ YERİ değişmemeli;
       bu üç değer o çıpayı hesaplamak için tutulur. */
    let sonY = null;          // pencere üst kenarı (ekran px)
    let sonYukari = false;    // o anda panel saatin üstünde miydi
    let sonPay = 0;           // o anda saatin üstünde duran panelin yüksekliği
    let temelY = null;        // kaplama panel (Ayarlar/Stüdyo) öncesi konum
    const EN_AZ_G = 320;      // alt sınır: bundan darı okunmaz
    const acikMi = id => {
      const el = document.getElementById(id);
      return !!(el && !el.hidden);
    };

    /* ── Pencere konumu kalıcı (tur 6) ─────────────────────
       KULLANICI BİLDİRİMİ: "dün ekranın sağ üst köşesine sabitleyip
       kilitlediğim saat bu gün açıldığında ekranın ortasındaydı."
       Kök neden: `tauri.conf.json`'da `"center": true` vardı — pencere
       HER açılışta ortalanıyordu ve konum hiçbir yere yazılmıyordu.
       `center` kaldırıldı; burada konum saklanır ve açılışta `fit()`
       çalışmadan ÖNCE geri yüklenir. Böylece kilitli widget, kapatılıp
       açıldığında bırakıldığı yerde durur. */
    const KONUMKEY = 'pza.pencere.v1';
    const winApi = window.__TAURI__.window;
    const w0 = winApi.getCurrentWindow();

    const konumYaz = async () => {
      try {
        const p = await w0.outerPosition();
        const sf = (await w0.scaleFactor()) || 1;
        localStorage.setItem(KONUMKEY, JSON.stringify({
          x: Math.round(p.x / sf), y: Math.round(p.y / sf)
        }));
      } catch (e) { /* konum okunamadı — önemli değil */ }
    };

    /* Kullanıcının elle bıraktığı konumu sakla. Panel açılınca `fit()`
       pencereyi geçici olarak kaydırır; o kaymalar KAYDEDİLMEZ, yoksa
       panel açıkken kapatılan uygulama yanlış yeri hatırlar. */
    let konumZaman = null;
    try {
      w0.onMoved(() => {
        if (acikMi('settings') || acikMi('studio') ||
            acikMi('panel-notes') || acikMi('panel-weather')) return;
        clearTimeout(konumZaman);
        konumZaman = setTimeout(konumYaz, 500);
      });
    } catch (e) { /* onMoved yoksa kalıcılık sessizce kapalı kalır */ }

    const konumGeriYukle = async () => {
      let k = null;
      try { k = JSON.parse(localStorage.getItem(KONUMKEY)); } catch (_) {}
      if (!k || !isFinite(k.x) || !isFinite(k.y)) return false;
      /* Monitör değişmiş olabilir: pencerenin bir parçası görünür kalsın
         diye iş alanına kırpılır (tamamen ekran dışında açılmasın). */
      const ek = window.screen || {};
      const gw = ek.availWidth || ek.width || 1920;
      const gh = ek.availHeight || ek.height || 1080;
      const x = Math.min(Math.max(k.x, 0), Math.max(0, gw - 80));
      const y = Math.min(Math.max(k.y, 0), Math.max(0, gh - 60));
      try {
        await w0.setPosition(new winApi.LogicalPosition(x, y));
        return true;
      } catch (e) { return false; }
    };

    /* Gereken yükseklik = widget VEYA açık olan kaplama paneli
       (Ayarlar / Stüdyo). Bu ikisi #widget'ın KARDEŞİ ve
       `position: fixed`: widget'ı büyütmedikleri için tek başına
       ResizeObserver yetmez — kırpılırlardı. */
    const gerekliH = () => {
      const ps = PZA.plateSize && PZA.plateSize();       // pza-skin/2: plaka tuvali
      if (ps) return Math.ceil(ps.h);
      let h = 0;
      const w = document.getElementById('widget');
      if (w) h = w.getBoundingClientRect().height;
      for (const id of ['settings', 'studio']) {
        const el = document.getElementById(id);
        if (el && !el.hidden) h = Math.max(h, el.scrollHeight + 24);
      }
      return Math.ceil(h);
    };

    /* Gereken genişlik = widget'ın ölçek sınırı veya açık panelin
       sabit genişliği (Ayarlar 412px, Stüdyo 470px). Paneller
       `position: fixed` ve genişlikleri sabit olduğundan bu sayı
       pencere boyutundan bağımsızdır — döngü kurmaz. */
    const gerekliG = () => {
      const ps = PZA.plateSize && PZA.plateSize();       // pza-skin/2: plaka tuvali
      if (ps) return Math.ceil(ps.w);
      let g = 0;
      const w = document.getElementById('widget');
      if (w) {
        const m = parseFloat(getComputedStyle(w).maxWidth);
        if (isFinite(m) && m > 0) g = m;
      }
      for (const id of ['settings', 'studio']) {
        const el = document.getElementById(id);
        if (el && !el.hidden) {
          const r = el.getBoundingClientRect().width;
          if (r > 0) g = Math.max(g, r);
        }
      }
      return Math.ceil(g);
    };

    /* ── İş alanı (görev çubuğu HARİÇ) ────────────────────
       Kullanıcı bildirimi (hata 1): "ayarlar menüsü aşağı çok uzuyor,
       windows barını bile geçiyor; ekran dışına taşınınca seçmek
       mümkün değil."
       Ölçüm: ayarlar panelinin içeriği 1125px, panel kendi içinde
       sorunsuz kaydırılıyordu — kırpılan şey PANEL DEĞİL PENCEREYDİ.
       Eski kod pencereyi monitörün TAM yüksekliğine kadar büyütüyordu
       (1080 − 60 = 1020px) ve Windows'ta SetWindowPos SOL ÜST köşeyi
       koruduğu için masaüstünün alt yarısına konmuş bir widget'ta
       pencerenin alt kısmı görev çubuğunun altında kalıyordu.
       Çözüm: yüksekliği İŞ ALANINA sığdır (availHeight zaten görev
       çubuğunu dışarıda bırakır) ve gerekiyorsa pencereyi yukarı çek. */
    const isAlani = async win => {
      const ek = window.screen || {};
      let ust = ek.availTop || 0;
      let boy = ek.availHeight || 0;
      if (!boy) {                       // WebView iş alanı vermediyse monitöre düş
        try {
          const mon = await win.currentMonitor();
          if (mon && mon.size && mon.size.height) {
            ust = 0;
            boy = Math.round(mon.size.height / (mon.scaleFactor || 1));
          }
        } catch (e) { /* monitör bilgisi alınamadı */ }
      }
      return { ust, boy };
    };

    /* Saat bloğunun yüksekliği — widget'tan AÇIK PANELLER düşülerek
       bulunur. Panelin saatin üstüne eklediği pay bu sayının
       farkından çıkar; pencereyi o kadar yukarı kaydırınca saat
       ekranda olduğu yerde kalır. */
    const temelYukseklik = () => {
      const el = document.getElementById('widget');
      if (!el) return 0;
      let t = el.getBoundingClientRect().height;
      for (const id of ['panel-notes', 'panel-weather']) {
        if (acikMi(id)) t -= document.getElementById(id).getBoundingClientRect().height;
      }
      return Math.max(0, Math.round(t));
    };

    /* Açılışta önce KAYITLI KONUM geri yüklenir, sonra `fit()` devam eder.
       Sıra önemli: `fit()` temel konumu `outerPosition()`ten okur; konum
       önce gelmezse pencere ortada açılıp orada kalırdı. Mandal, `fit`
       birden çok kez çağrıldığında (gözlemciler) yalnız bir kez yüklenir. */
    /* BAR MODU (v1.18.0): bar ekranın bir kenarına yayılır; otomatik gizlemede
       pencere TAM ORTADA küçücük bir ince oka küçülür — yalnız o ok tıklanır,
       böylece browser/öbür programların tıklamaları engellenmez. */
    let sonBar = '';
    const fitBar = async () => {
      try {
        const win = window.__TAURI__.window;
        const w = win.getCurrentWindow();
        const alan = await isAlani(win);
        const sw = window.screen.availWidth || 1920;
        const ust = PZA.settings.barKonum === 'ust';
        const acik = PZA.settings.barGizli !== true || PZA.__barAcik === true;
        document.getElementById('widget')?.classList.toggle('bar-kapali',
          PZA.settings.barGizli === true && PZA.__barAcik !== true);

        const kapVar   = acikMi('settings') || acikMi('studio');   // kaplamalar
        const panelVar = acikMi('panel-notes') || acikMi('panel-weather');
        const ezanVar  = acikMi('ezan-menu');   // bar modunda ezan dropdown'ı (fixed)

        let W, H, x, y;
        if (kapVar) {
          /* Ayarlar/Stüdyo: `position: fixed`, `max-height: calc(100vh-10px)`.
             İnce pencerede max-height kırpılıyordu → en alt seçenekler görünmüyor,
             kaydırma sona inmiyordu. Çözüm: pencere İŞ ALANINI doldurur. */
          W = sw; H = Math.max(240, alan.boy - 4); x = 0; y = alan.ust;
        } else if (panelVar) {
          /* Not/Hava: bar + panel yüksekliği kadar pencere; panel barın yanına açılır. */
          const barH = Math.max(46, gerekliH());
          let ph = 0;
          for (const id of ['panel-notes', 'panel-weather']) {
            const el = document.getElementById(id);
            if (el && !el.hidden) ph = Math.max(ph, el.scrollHeight);
          }
          /* Pencere, panelin 72vh'lik kaydırma sınırından fazla büyümesin —
             aksi hâlde panel tavanına takılır, altında boş koyu şerit kalırdı. */
          ph = Math.min(ph, Math.round(alan.boy * 0.72));
          W = sw; H = Math.min(alan.boy - 4, barH + ph + 16); x = 0;
          y = ust ? alan.ust : Math.max(alan.ust, alan.ust + alan.boy - H);
        } else if (ezanVar) {
          /* Ezan dropdown'ı da barın DIŞINA taşar (fixed) → pencere, menünün
             sığacağı kadar bar yönünde büyür (üst bar: aşağı, alt bar: yukarı). */
          const barH = Math.max(46, gerekliH());
          const em = document.getElementById('ezan-menu');
          const eh = Math.max(60, em ? em.scrollHeight : 60);
          W = sw; H = Math.min(alan.boy - 4, barH + eh + 16); x = 0;
          y = ust ? alan.ust : Math.max(alan.ust, alan.ust + alan.boy - H);
        } else {
          W = acik ? sw : 84;                                   // kapalı: yalnız ince tutamak
          H = acik ? Math.max(46, gerekliH()) : 15;
          x = acik ? 0 : Math.round((sw - W) / 2);
          y = ust ? alan.ust : (alan.ust + alan.boy - H);
        }
        const anahtar = W + 'x' + H + '@' + x + ',' + y;
        if (anahtar === sonBar) return;                         // titremeyi önle
        sonBar = anahtar;
        await w.setSize(new win.LogicalSize(W, H));
        await w.setPosition(new win.LogicalPosition(x, y));
        sonG = W; sonH = H; sonY = y;
        PZA.ezanMenuYerlestir?.();                              // menü düğmeye hizalanır
      } catch (e) { /* yetki yoksa sessiz */ }
    };

    let konumYuklendi = false;
    const fit = async () => {
      if (PZA.settings && PZA.settings.size === 'bar') { await fitBar(); return; }
      if (!konumYuklendi) { konumYuklendi = true; await konumGeriYukle(); }
      /* Boyut/skin DEĞİŞTİYSE ölçüm bayatlamış olabilir → yeniden ölç.
         (2026-10-19: Aurora'da 1/2→1/4 geçişi `sonG`'deki eski değerle
         karşılaştırıldığı için `fit()` erken çıkıyor, pencere eski
         genişlikte kalıyordu.) */
      const beklenenG = PZA.plateSize ? (PZA.plateSize() || {}).w : 0;
      if (beklenenG && Math.abs(beklenenG - sonG) > 0.5) { sonH = -1; sonG = -1; }
      /* DÜŞEN YÜZEY YÜKSEKLİĞİ ÖNCE HESAPLANMALI (kritik düzeltme).
         Hata (2026-10-19, 2. tur bildirimi): `ekH` hesabı titremeyi önleyen
         erken çıkıştan SONRA yapılıyordu. Dropdown açılınca widget'ın kendi
         yüksekliği `h` DEĞİŞMİYOR → `Math.abs(h - sonH) < 3` tutuyor →
         `fit()` erken çıkıyor → pencere hiç büyümüyor → menü `position: fixed`
         olduğu için saati ÜSTÜNE biniyor (ekran görüntüsü: ezan menüsü ve
         PA kutusu saatin üstünde yarı saydam).

         Düzeltme: dropdown yüksekliği ÖNCE ölçülür, `istenenH = h + ekH`
         karşılaştırmaya girer. */
      let ekH = 0;
      if (acikMi('ezan-menu')) {
        const em = document.getElementById('ezan-menu');
        if (em) ekH = Math.max(ekH, em.offsetHeight || em.scrollHeight || 0);
      }
      if (acikMi('pa-modal')) {
        const pm = document.getElementById('pa-modal');
        const kutu = pm && pm.querySelector ? pm.querySelector('.pa-box') : null;
        const o = kutu || pm;
        if (o) ekH = Math.max(ekH, o.offsetHeight || o.scrollHeight || 0);
      }
      /* Açıkken ek yükseklik: menü düğmeye hizalanıp PENCERENİN ALTINDA
         açılacağı için widget'ın altına eklenir. */
      const h = gerekliH();
      const istenenH = h + ekH;
      const g = Math.max(EN_AZ_G, gerekliG());
      // Titremeyi önle: hedef DEĞİŞMEDİYSE dokunma.
      if (!istenenH || (Math.abs(istenenH - sonH) < 3 && Math.abs(g - sonG) < 3)) return;
      sonH = istenenH; sonG = g;
      try {
        const win = window.__TAURI__.window;
        const w = win.getCurrentWindow();
        const alan = await isAlani(win);
        const sf = (await w.scaleFactor()) || 1;
        const p = await w.outerPosition();
        if (!p) return;
        const y = p.y / sf;
        const alt = alan.ust + alan.boy;

        const icVar = acikMi('panel-notes') || acikMi('panel-weather');
        const kapVar = acikMi('settings') || acikMi('studio');

        /* `ekH` yukarıda (titremeyi önleyen erken çıkıştan ÖNCE) ölçüldü. */
        // Panel iş alanından uzun olabilir (Ayarlar/Stüdyo). Kırp:
        // panel kendi içinde kaydırılır, pencere ekrandan taşmaz.
        const hh = alan.boy ? Math.min(istenenH, Math.max(240, alan.boy - 8)) : istenenH;

        /* Saatin ekrandaki üst kenarı. Panel saatin üstünde duruyorsa
           saat, pencere tepesinden panelin yüksekliği kadar aşağıdadır.
           Bu değer fit() turları boyunca SABİT kalmalı. */
        const saatTepesi = sonY === null ? y : sonY + (sonYukari ? sonPay : 0);

        let yukari = false;
        let pay = 0;              // panelin saatin üstüne eklediği yükseklik
        let hedefY = y;

        if (ekH > 0) {
          /* Açık DÜŞEN YÜZEY (ezan menüsü / güncelleme popup'ı): pencere
             `ekH` kadar büyüdü ama widget'ın EKRANDAKİ YERİ KORUNMALI.
             Konumu sabit tutarsak pencere AŞAĞI doğru büyür ve menü
             widget'ın ALTINDA (aşağıda yer olduğu için) tam görünür.
             Yukarıda kalmak yerine aşağıda açılması tercih edilir:
             ezan düğmesi barın ALTINDA olduğundan menü zaten oraya
             hizalanır ve tepedeki saat görünür kalır. */
          if (temelY === null) temelY = y;
          /* Altta yer yoksa (widget ekranın dibinde) → yukarı aç. */
          const sığar = (temelY + hh) <= alt;
          if (sığar) {
            yukari = false; pay = 0; hedefY = temelY;
          } else {
            yukari = true; pay = ekH;
            hedefY = Math.max(alan.ust, temelY - ekH);
          }
        } else if (kapVar) {
          /* Kaplama panel (Ayarlar/Stüdyo, `position: fixed`): pencere
             iş alanına sığsın diye gerekiyorsa yukarı çekilir; panel
             kapanınca temelY'ye dönülür. */
          if (temelY === null) temelY = y;
          hedefY = Math.max(alan.ust, alt - hh - 8);
        } else if (icVar) {
          /* Widget içi panel (Notlar/Hava). KULLANICI (2026-10-16): "1/4'te
             hava simgesine tıklayınca aşağı kayıyor; devam edersem başka yere
             kayıyor." KÖK NEDEN: yukarı açılan panelde (`.yukari`) pencere
             yukarı kaydırılıyordu ama DİNLENME konumu saklanmıyordu → kapanınca
             geri dönmüyor, her aç/kapada kayıyordu. Çözüm: panel açılırken
             TABAN konum (temelY) bir kez saklanır; kapanınca AYNEN dönülür. */
          if (temelY === null) temelY = y;                 // panel öncesi TABAN
          pay = Math.max(0, h - temelYukseklik());
          yukari = (temelY + hh) > alt;                    // altta yer yok → yukarı
          hedefY = yukari ? Math.max(alan.ust, temelY - pay) : temelY;
        } else {
          /* Panel yok → TABANA dön (kayma birikmez). */
          hedefY = (temelY !== null) ? temelY : y;
          temelY = null;
        }

        /* `yukari` hem widget'a hem gövdeye: gövdedeki sınıf widget'ı
           pencerenin ALTINA yaslar (bkz. widget.css), böylece pencere
           kırpıldığında taşan kısım panelin üstü olur, saat görünür kalır. */
        document.getElementById('widget')?.classList.toggle('yukari', yukari);
        document.body.classList.toggle('yukari', yukari);
        await w.setSize(new win.LogicalSize(g, hh));
        if (Math.abs(hedefY - y) > 0.5) {
          await w.setPosition(new win.LogicalPosition(p.x / sf, hedefY));
        }
        sonY = hedefY;
        sonYukari = yukari;
        sonPay = yukari ? pay : 0;
        /* Pencere boyutlandı → `vh` değişti. Dropdown'ın yön seçimi
           ESKİ `vh`'ye göre yapılmıştı; menüyü YENİDEN konumlandır
           (aksi hâlde kırpılmış konumda kalır). */
        if (ekH > 0) {
          PZA.dropdownYerlestir?.(document.getElementById('ezan-menu'), $('ezan-ses-btn'));
          PZA.dropdownYerlestir?.(document.getElementById('pa-modal'), $('pa-btn'));
        }
      } catch (e) { /* yetki yoksa sessizce geç */ }
    };

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ['widget', 'settings', 'studio', 'pa-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) ro.observe(el);
      });
    }
    // Ayarlar/Stüdyo açılıp kapandığında (hidden değişimi) yeniden ölç.
    new MutationObserver(fit).observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['hidden']
    });
    window.addEventListener('load', fit);
    window.addEventListener('bar-degisti', () => { sonH = sonG = -1; fit(); });
  }

  /* ── Başlat ─────────────────────────────────────────── */
  PZA.apply();
  PZA.renderNotes();
  PZA.startClock();
  if (PZA.settings.weather && PZA.settings.city) PZA.startWeatherRefresh();
  else if (PZA.settings.weather) PZA.loadWeather();

  /* ── Ayarlar aç/kapa ────────────────────────────────── */
  $('btn-settings')?.addEventListener('click', () => {
    $('settings').hidden = false;
    /* v1.18.0 — KULLANICI BİLDİRİMİ: "dün il/ilçeyi işaretledim, restart
       sonrası unutmuş; ayarlardan tekrar seçmek zorunda kaldım."
       KÖK NEDEN: `PZA.apply()` (yukarıda, ~satır 283) çalışırken
       `PZA.ezanAyarCiz` HENÜZ TANIMLI DEĞİL (aşağıda tanımlanıyor) → açılışta
       EZAN il/ilçe listeleri hiç doldurulmuyor, kayıtlı seçim geri
       yüklenmiyordu. Ayarlar her açıldığında yeniden çizerek telafi et. */
    PZA.ezanAyarCiz?.();
  });
  $('set-close')?.addEventListener('click', () => { $('settings').hidden = true; });
  $('settings')?.addEventListener('click', e => {
    if (e.target.id === 'settings') $('settings').hidden = true;   // dışına tıkla
  });

  /* ── Paneller ───────────────────────────────────────── */
  $('btn-notes')?.addEventListener('click', () => PZA.toggleNotes());
  $('weather-tile')?.addEventListener('click', () => PZA.toggleWeather());

  /* ── Tema ───────────────────────────────────────────── */
  $('btn-light')?.addEventListener('click', () => PZA.set('theme', 'light'));
  $('btn-dark')?.addEventListener('click', () => PZA.set('theme', 'dark'));

  /* ── BAR MODU (v1.18.0): konum (üst/alt) + otomatik gizleme + ortadaki ince ok.
     Kullanıcı: "tıklayınca açılsın; her yerine tıklanınca değil — browser ve
     öbür programlara engel olur." Bu yüzden bar'ın tamamı değil, yalnız ince
     ok tıklamayı alır. */
  $('bar-konum')?.addEventListener('change', e => PZA.set('barKonum', e.target.value));
  $('opt-bargizli')?.addEventListener('change', e => {
    PZA.__barAcik = !e.target.checked;         // gizleme kapalıysa bar hep açık
    PZA.set('barGizli', e.target.checked);
    window.dispatchEvent(new Event('bar-degisti'));
  });
  $('bar-tutamak')?.addEventListener('click', () => {
    PZA.__barAcik = !(PZA.__barAcik === true);
    PZA.apply();
    window.dispatchEvent(new Event('bar-degisti'));
  });

  /* ── Skin / görünürlük / boyut / tema (ayarlar paneli) ─ */
  /* v1.18.5 — Kullanıcı: "yeni skinler eklendikçe bir listeden seçilsin,
     tıpkı ses listesindeki Ece/Tolga gibi" + "+ yeni skin ekle". */
  $('skin-select')?.addEventListener('change', e => PZA.set('skin', e.target.value));
  $('skin-add')?.addEventListener('click', () => PZA.openStudioNew());
  // Winamp ColorThemes: plaka rengi teması seçimi
  $('skin-renk')?.addEventListener('change', e => PZA.set('plateTheme', e.target.value));

  /* Seçili kullanıcı skini: düzenle / sil */
  $('skin-edit')?.addEventListener('click', () => {
    const id = $('skin-bar')?.dataset.skinId;
    if (id) PZA.openStudioEdit(id);
  });
  $('skin-del')?.addEventListener('click', () => {
    const id = $('skin-bar')?.dataset.skinId;
    const sk = id && PZA.skinById(id);
    if (!sk) return;
    if (!confirm('"' + (sk.name || 'İsimsiz') + '" skini silinsin mi? Bu geri alınamaz.')) return;
    PZA.deleteSkin(id);
    if (PZA.settings.skin === 'user:' + id) PZA.set('skin', 'klasik');
    else PZA.apply();
  });

  /* Stüdyo bir skin kaydetti/sildiğinde yalnızca listeyi tazele.
     PZA.apply() çağrılmaz — stüdyonun tema önizlemesini bozardı. */
  PZA.on('skins-changed', () => { if (PZA.renderSkins) PZA.renderSkins(); });

  document.querySelectorAll('[data-theme-set]').forEach(b =>
    b.addEventListener('click', () => PZA.set('theme', b.dataset.themeSet)));

  const toggles = {
    'opt-weather': 'weather', 'opt-preview': 'preview', 'opt-seconds': 'seconds',
    'opt-speech': 'speech', 'opt-ontop': 'alwaysOnTop', 'opt-autostart': 'autostart',
    /* TUR 12 — sesli okuma üçe ayrıldı (saat başı / yarım saat / önemli
       kayıtlar). Kullanıcı isteği: "ayarlarda saat başı uyarı, her yarım
       saatte uyarı olsun". */
    'opt-saatbasi': 'saatBasi', 'opt-yarimsaat': 'yarimSaat', 'opt-onemli': 'onemliOku',
    'opt-log': 'log', 'opt-ezan': 'ezan'
  };
  Object.entries(toggles).forEach(([id, key]) => {
    $(id)?.addEventListener('change', async e => {
      PZA.set(key, e.target.checked);
      if (key === 'autostart') {
        const ok = await invoke('set_autostart', { enabled: e.target.checked });
        if (TAURI && ok === null) {           // komut başarısız → geri al
          e.target.checked = !e.target.checked;
          PZA.set('autostart', e.target.checked);
        }
      }
      if (key === 'alwaysOnTop') {
        const ok = await invoke('set_always_on_top', { enabled: e.target.checked });
        if (TAURI && ok === null) {           // komut başarısız → geri al
          e.target.checked = !e.target.checked;
          PZA.set('alwaysOnTop', e.target.checked);
        }
      }
      if (key === 'weather' && e.target.checked) PZA.loadWeather();
    });
  });

  /* Kayıtlı "her zaman üstte" değerini pencereye uygula */
  if (TAURI) invoke('set_always_on_top', { enabled: !!PZA.settings.alwaysOnTop });

  /* v1.10.5 — Autostart açılışta GÜVENCEYE ALINIR.
     Kullanıcı bildirimi: "Windows açılışta açılması gerekiyordu, açılmıyor."
     İki kök neden: (1) varsayılan kapalıydı; (2) uygulama güncellenince
     Run kaydı eski exe yoluna bakabiliyordu ve hiç tazelenmiyordu.
     Açılışta `set_autostart(true)` çağrısı İDEMPOTENTTİR: kaydı doğru
     exe yoluna tazeler. Ardından gerçek durum kutucuğa yansıtılır. */
  if (TAURI) (async () => {
    const istenen = PZA.settings.autostart !== false;   // varsayılan AÇIK
    if (istenen) await invoke('set_autostart', { enabled: true });
    const gercek = await invoke('get_autostart');
    const box = $('opt-autostart');
    if (box && gercek !== null) box.checked = gercek;
  })();

  /* v1.11.0 — Otomatik güncelleme denetimi (açılışta bir kez).
     Kullanıcı: "kurulu olan kişi yeni versiyon çıkınca neden yeniden
     indirsin ki? … 'güncelle' butonu bu işi otomatik çözecektir."
     Yeni sürüm varsa ayarların altındaki metin PARLAR ve "Güncelle"
     düğmesi görünür. Denetim başarısız olursa (ağ yok) günlüğe yazılır
     — sessiz başarısızlık yok. */
  /* ── Ses motoru artık TEK seçicide (v1.16.1) ──
     "voice-select" listesi hem "Ece (yerel kadın)" hem sistemde KURULU
     sesleri içerir; seçim aşağıdaki handler'da işlenir. Bulut "Emel"
     (Edge TTS + Python) v1.16.0'da tamamen kaldırıldı — KVKK. */

  /* ── Sürüm durumu + güncelleme (v1.14.0) ──────────────────
     KULLANICI (v1.11.0): *"kurulu olan kişi yeni versiyon çıkınca neden
     yeniden indirsin ki? Update uyarısı veya güncelle butonu …"*
     KULLANICI (v1.14.0): *"tasarımda PA yazısı var bunu butona çevirelim.
     Basıldığında 'sürümünüz güncel yada yeni sürüme güncellensin mi?' gibi
     bir popup olabilir. Yeni sürüm olunca parlayıp sönerek bir ışık efekti
     olabilir. Açılışta güncelleme sorabilir."*

     ÖNCEKİ TASARIMIN SORUNU: denetim yalnız açılışta bir kez çalışıyordu ve
     "Güncelle" düğmesi gizli kutunun içindeydi → kullanıcı "güncelleme uyarısı
     gelmedi, nereye bakmalıyım?" diye sordu. Şimdi:
       • PA düğmesi HER ZAMAN var, elle denetim tetikler.
       • Ayarlardaki güncelleme kutusu hep görünür (durumu yazar).
       • Denetim açılışta yapılır; yeni sürüm varsa PA ışık efektiyle parlar
         ve açılışta popup ile sorulur. */
  const surum = {
    durum: 'bilinmiyor',   /* bilinmiyor | guncel | yeni | hata */
    son: null,            /* sunucudaki sürüm */
    hata: null
  };

  /* "1.13.0" > "1.9.0" → metin karşılaştırması YANLIŞ ("1" > "9" string'de
     true). Sayısal parça karşılaştırması şart.
     DİKKAT: `.split(/[.+-]/)[0]` burada BUG çıkarır — nokta da bölücü olduğu
     için "1.14.0" → "1" kalır ve sadece ana sürüm karşılaştırılır. Doğrusu:
     ön ek `v` ve sürüm sonu eki (-beta / +build) atılır, noktalar KORUNUR. */
  function surumKarsil(a, b) {
    const parca = s => String(s || '').replace(/^v/i, '')
                       .replace(/[-+].*$/, '')
                       .split('.').map(n => parseInt(n, 10) || 0);
    const A = parca(a), B = parca(b);
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      const x = A[i] || 0, y = B[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  /* Denetimi yap ve arayüzü tara — `sessiz` çağrıda hata olursa da
     ekrana yansıt (eskiden yalnız günlüğe yazılıyordu, kullanıcı hiçbir
     şey görmüyordu; bu, "uyarı gelmedi" şikâyetinin ikinci sebebiydi). */
  async function surumKontrol() {
    const dur = PZA.surumDurumu = surum;
    if (!TAURI) { dur.durum = 'hata'; dur.hata = 'Tauri dışında'; return dur; }
    dur.durum = 'denetleniyor';
    surumGoster();
    try {
      const v = await invoke('guncelleme_kontrol');
      dur.son = v || null;
      dur.durum = (v && surumKarsil(v, PZA.SURUM) > 0) ? 'yeni' : 'guncel';
      if (dur.durum === 'yeni') {
        PZA.logYaz?.('bilgi', 'Yeni sürüm hazır: v' + v + ' (kurulu: v' + PZA.SURUM + ')');
        /* Açılışta sor — kullanıcı isteği: "Açılışta güncelleme sorabilir" */
        setTimeout(() => { if (!paModal.hidden) return; paAc(); }, 900);
      }
    } catch (e) {
      dur.durum = 'hata';
      dur.hata = String(e).slice(0, 120);
      PZA.logYaz?.('uyari', 'Güncelleme denetlenemedi', { hata: dur.hata });
    }
    surumGoster();
    return dur;
  }

  /* Durumu PA düğmesine + ayarlardaki kutuya yazar. */
  function surumGoster() {
    const yeni = surum.durum === 'yeni';
    const btn = $('pa-btn');
    if (btn) btn.classList.toggle('pa-yeni', yeni);
    if (btn) btn.title = yeni
      ? ('Sürüm ve güncelleme — yeni sürüm hazır: v' + surum.son)
      : 'Sürüm ve güncelleme';

    /* Ayarlardaki kutu artık hep görünür; yalnız metin değişir.
       Kullanıcı: "güncelleme yoksa buton pasif dursun, olabilirse ya da
       görünmesin" → düğme YALNIZ gerçekten yeni sürüm varken açılır.
       Elle denetim için ayrı yol var: PA düğmesi (her zaman görünür). */
    const kutu = $('gunc-kutu'), metin = $('gunc-metin'), gb = $('btn-guncelle');
    if (kutu) { kutu.hidden = false; kutu.classList.toggle('yeni', yeni); }
    if (metin) {
      metin.textContent =
        surum.durum === 'yeni'      ? ('Yeni sürüm hazır: v' + surum.son + '  →  Güncelle') :
        surum.durum === 'guncel'    ? ('v' + PZA.SURUM + ' · güncel') :
        surum.durum === 'denetleniyor' ? 'Güncelleme denetleniyor…' :
        ('Sürüm: v' + PZA.SURUM + ' · denetlenemedi');
    }
    if (gb) { gb.hidden = !yeni; gb.disabled = false; }

    /* Popup içindeki alanlar */
    if ($('pa-mevcut')) $('pa-mevcut').textContent = 'v' + PZA.SURUM;
    const sonEl = $('pa-son'), sonKutu = $('pa-son-kutu');
    if (sonEl) sonEl.textContent = surum.son ? ('v' + surum.son) : '—';
    if (sonKutu) sonKutu.classList.toggle('yeni', yeni);
    const notEl = $('pa-not'), yenile = $('pa-yenile');
    if (notEl) {
      notEl.textContent =
        surum.durum === 'yeni'   ? ('v' + surum.son + ' yayımlandı. Şimdi güncelleyebilirsiniz.') :
        surum.durum === 'guncel' ? 'Uygulamanız güncel. Yeni bir sürüm çıktığında burada bildirilecek.' :
        surum.durum === 'denetleniyor' ? 'Denetleniyor…' :
        ('Denetim yapılamadı' + (surum.hata ? ' (' + surum.hata + ')' : '') +
         '. İnternet bağlantısını kontrol edip tekrar deneyebilirsiniz.');
    }
    if (yenile) yenile.hidden = !yeni;
  }

  /* ── Popup aç/kapa — tetikleyiciye hizalı DROPDOWN; yön KONUMA göre ── */
  const paModal = $('pa-modal');
  function paYerlestir() {
    if (paModal && !paModal.hidden) PZA.dropdownYerlestir(paModal.querySelector('.pa-box'), $('pa-btn'));
  }
  function paAc() {
    if (!paModal) return;
    surumGoster();
    paModal.hidden = false;
    /* Ezan menüsüyle AYNI sorun (2026-10-19): pencere kutuya sığacak
       kadar BÜYÜMEDEN konumlandırma yapılırsa yanlış yön seçilir ve
       kutunun üst yarısı pencere kenarından kırpılır.
       Sıra: `fit()` (pencereyi büyüt) → `paYerlestir()` (yönü seç). */
    fit();
    paYerlestir();
    $('pa-kapat')?.focus();
  }
  function paKapa() {
    if (!paModal) return;
    paModal.hidden = true;
    const kutu = paModal.querySelector ? paModal.querySelector('.pa-box') : null;
    if (kutu) {
      ['maxHeight', 'overflowY', 'top', 'bottom', 'left', 'right']
        .forEach(k => kutu.style.removeProperty(k));
    }
  }

  $('pa-btn')?.addEventListener('click', () => {
    paAc();
    surumKontrol();          /* elle basınca ANINDA tazele (açılıştan bağımsız) */
  });
  $('pa-kapat')?.addEventListener('click', paKapa);
  $('pa-x')?.addEventListener('click', paKapa);
  /* Perde `pointer-events: none` olduğu için tıklamayı ALMAZ; kutu dışına
   tıklayınca kapanması için kutu DIŞINDAKİ tıklamaları dinle.
   (Eskiden `e.target === paModal` idi; perde artık hedef olamaz.) */
  if (paModal) {
    paModal.addEventListener('click', e => {
      const kutu = paModal.querySelector('.pa-box');
      if (e.target === paModal || (kutu && !kutu.contains(e.target))) paKapa();
    });
    // Perde tıklamaları geçirdiği için belge düzeyinde de yakala
    document.addEventListener('click', e => {
      if (!paModal || paModal.hidden) return;
      const kutu = paModal.querySelector('.pa-box');
      if (kutu && !kutu.contains(e.target) && !paBtn?.contains(e.target)) paKapa();
    });
  }
  window.addEventListener('resize', paYerlestir);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && paModal && !paModal.hidden) paKapa();
  });

  /* Açılışta bir kez denetle (PA'yı ilk anda doğru göstermek için) */
  surumKontrol();

  const guncMetin = $('gunc-metin'), guncBtn = $('btn-guncelle');
  const paYenile = $('pa-yenile');
  const paIlerleme = $('pa-ilerleme'), paBar = $('pa-bar'),
        paDolgu = $('pa-bar-dolgu'), paIlMetin = $('pa-ilerleme-metin');

  /* Rust `guncelleme-ilerleme` olayı → PA çubuğu + metin (yüzde). */
  (function ilerlemeDinle() {
    const ev = window.__TAURI__ && window.__TAURI__.event;
    if (!ev || typeof ev.listen !== 'function') return;
    ev.listen('guncelleme-ilerleme', e => {
      const p = (e && e.payload) || {};
      if (paBar) paBar.classList.remove('belirsiz');
      if (paDolgu && typeof p.yuzde === 'number') paDolgu.style.width = p.yuzde + '%';
      const t = (typeof p.yuzde === 'number') ? ('Güncelleniyor… %' + p.yuzde) : 'Güncelleniyor…';
      if (paIlMetin) paIlMetin.textContent = t;
      if (guncMetin) guncMetin.textContent = t;
    });
  })();

  /* Güncellemeyi uygula — hem ayarlardaki kutu hem PA popup'ı kullanır.
     Başarılıysa uygulama yeniden başlar (dönüş olmaz). Hata olursa GERÇEK
     sebep yazılır (hamInvoke; yutan invoke değil). İndirirken ilerleme
     çubuğu + yüzde gösterilir. */
  async function guncelleUygula(metinEl, btnEl) {
    if (btnEl) btnEl.disabled = true;
    if (paIlerleme) { paIlerleme.hidden = false; }
    if (paBar) paBar.classList.add('belirsiz');
    if (paDolgu) paDolgu.style.width = '0%';
    const yaz = t => { if (metinEl) metinEl.textContent = t; if (paIlMetin) paIlMetin.textContent = t; };
    yaz('Güncelleniyor… uygulama birazdan yeniden başlayacak.');
    try {
      const ok = await hamInvoke('guncelleme_yap');
      if (ok !== true) {                       // kurulduysa zaten yeniden başlar
        yaz('Yeni sürüm bulunamadı ya da güncelleme uygulanamadı.');
        if (btnEl) btnEl.disabled = false;
      }
    } catch (e) {
      const hata = String(e && e.message ? e.message : e).slice(0, 200);
      yaz('Güncelleme başarısız: ' + hata);
      if (btnEl) btnEl.disabled = false;
      PZA.logYaz?.('uyari', 'Güncelleme başarısız', { hata });
    }
  }

  guncBtn?.addEventListener('click', () => guncelleUygula(guncMetin, guncBtn));
  /* PA popup'taki "Güncelle" (id="pa-yenile"). v1.16.1'de bağlandı;
     v1.16.2'de ilerleme + gerçek hata mesajı eklendi. */
  paYenile?.addEventListener('click', () => guncelleUygula(null, paYenile));

  document.querySelectorAll('input[name="size"]').forEach(r =>
    r.addEventListener('change', () => { if (r.checked) PZA.set('size', r.value); }));

  /* ── Şehir arama ────────────────────────────────────── */
  let searchTimer = null;
  $('opt-city')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) return;
    searchTimer = setTimeout(async () => {
      try {
        const hits = await PZA.searchCity(q);
        const chips = $('city-chips');
        // h.label geocoding API'sinden gelir — dış veri, kaçış şart
        chips.innerHTML = hits.length
          ? hits.map((h, i) => `<button data-pick="${i}">${PZA.escHtml(h.label)}</button>`).join('')
          : '<span style="font-size:10px;color:var(--fg-mute)">Sonuç yok.</span>';
        chips._hits = hits;
      } catch (err) { console.warn(err); }
    }, 350);
  });

  $('city-chips')?.addEventListener('click', e => {
    const chips = $('city-chips');
    if (e.target.closest('[data-city-clear]')) {
      PZA.set('city', null);
      PZA.loadWeather();
      return;
    }
    const b = e.target.closest('[data-pick]');
    if (b && chips._hits) {
      const c = chips._hits[+b.dataset.pick];
      PZA.set('city', { name: c.name, lat: c.lat, lon: c.lon });
      $('opt-city').value = '';
      PZA.loadWeather(true);
      PZA.apply();
    }
  });

  /* ── Notlar: ekle / yıldızla / sil ───────────────────── */
  const noteText = $('note-text'), noteSave = $('note-save');
  let saveTimer = null;

  /* "Ekle" boşken soluk ve devre dışı — basıldı mı basılmadı mı
     belirsizliği biter. Metin girilince kendiliğinden aktifleşir. */
  const syncSave = () => {
    if (!noteSave) return;
    noteSave.disabled = !noteText || !noteText.value.trim();
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    noteSave.textContent = 'Ekle';
    noteSave.classList.remove('ok');
  };
  noteText?.addEventListener('input', syncSave);
  syncSave();

  noteSave?.addEventListener('click', () => {
    if (!noteText) return;
    const t = $('note-time').value || '12:00';
    const x = noteText.value;
    if (!PZA.addNote(t, x)) {                     // boş metin → görünür uyarı
      noteText.classList.add('err');
      setTimeout(() => noteText.classList.remove('err'), 700);
      noteText.focus();
      return;
    }
    noteText.value = '';
    syncSave();
    /* Katman kapanır: onay "Eklendi ✓" yazısı değil, notun az önce
       seçilen dilimde görünmesi. Katman açık kalsaydı kullanıcı
       sonucu göremezdi. */
    PZA.closeCal();
    noteSave.textContent = 'Eklendi ✓';            // kısa onay
    noteSave.classList.add('ok');
    saveTimer = setTimeout(() => {
      noteSave.textContent = 'Ekle';
      noteSave.classList.remove('ok');
      saveTimer = null;
    }, 1400);
  });
  noteText?.addEventListener('keydown', e => { if (e.key === 'Enter') noteSave.click(); });

  /* ── Takvim / gün+saat seçme katmanı ────────────────── */
  $('notes-day-btn')?.addEventListener('click', () => PZA.openCal());
  $('cal-close')?.addEventListener('click', () => PZA.closeCal());
  // Katman içindeki "Bugün" ve gün hücreleri SEÇİMİ değiştirir, katmanı
  // kapatmaz: kullanıcı tarih ile saati aynı yerde belirliyor.
  $('cal-today')?.addEventListener('click', () => PZA.secimGun(PZA.todayKey()));
  $('cal-prev')?.addEventListener('click', () => PZA.calShift(-1));
  $('cal-next')?.addEventListener('click', () => PZA.calShift(1));
  $('notes-today')?.addEventListener('click', () => PZA.selectDay(PZA.todayKey()));
  $('cal-grid')?.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (b) PZA.secimGun(b.dataset.day);
  });

  /* ── Okuyucu sesi (sistemde KURULU sesler) ───────────────
     Seçim sesin adıyla saklanır. Eskiden 'female'/'male' tutuluyordu
     ve iki uydurma "okuyucu" (Ece/Emre) tek Türkçe sesli sistemde
     aynı sesi veriyordu — kaldırıldı. */
  $('voice-select')?.addEventListener('change', e => {
    const v = e.target.value;
    if (v === '__ece') {               // yerel kadın ses (EMA Lightning klipleri)
      PZA.set('ses', 'ece');
    } else {                           // Windows'ta kurulu bir ses (ör. Tolga)
      PZA.set('ses', 'tolga');
      PZA.set('voiceName', v);
    }
    PZA.renderVoiceUi?.();             // etiketi tazele
    PZA.sayNow?.();                    // seçimi hemen duyur — karşılaştırmak için
  });
  $('btn-say-test')?.addEventListener('click', () => PZA.sayNow?.());

  /* ── EZAN (v1.17.0) ─────────────────────────────────────────
     TEK ana anahtar (`opt-ezan`) → hepsini açar/kapatır (vakit bazlı ayrı
     anahtar yok). Konum hava durumu şehriyle paylaşılır; burada yalnız
     emushaf il/ilçe ID'si seçilir (ön-seçili gelir). */
  PZA.__ezanIlDolu = false;

  PZA.ezanIlceDoldur = async function (sehirId) {
    const ilce = $('ezan-ilce'); if (!ilce || !sehirId) return;
    try {
      const ilceler = await PZA.ezanIlceler(sehirId);
      ilce.innerHTML = ilceler.map(x =>
        '<option value="' + x.IlceID + '">' + PZA.escHtml(x.IlceAdi) + '</option>').join('');
    } catch (e) { /* ağ yok — sessiz geç, vakit tick'i zaten bekler */ }
  };

  /* Ayarlar çizilince (settings.js → apply) çağrılır: il listesini bir kez
     doldurur, seçili il/ilçeyi geri yükler, gerekirse vakitleri yükler. */
  PZA.ezanAyarCiz = async function () {
    const s = PZA.settings;
    if (!s.ezan) return;                        // kapalıyken liste çekme
    const il = $('ezan-il'), ilce = $('ezan-ilce'), ses = $('ezan-ses');
    if (ses && document.activeElement !== ses) {
      ses.value = (typeof s.ezanSes === 'number') ? s.ezanSes : 0.8;
    }
    if (!il) return;
    if (!PZA.__ezanIlDolu) {
      try {
        const sehirler = await PZA.ezanSehirler(2);   // Türkiye
        il.innerHTML = sehirler.map(x =>
          '<option value="' + x.SehirID + '">' + PZA.escHtml(x.SehirAdi) + '</option>').join('');
        PZA.__ezanIlDolu = true;
      } catch (e) { return; }                   // internet yok
    }
    if (s.ezanSehir) il.value = s.ezanSehir;
    if (ilce && !ilce.options.length) await PZA.ezanIlceDoldur(il.value);
    if (s.ezanIlce && ilce) ilce.value = s.ezanIlce;
    /* İlk açılışta il/ilçe boşsa ilkini seç ve kaydet (kutudan çıksın çalışsın). */
    if (!s.ezanSehir && il.value) {
      s.ezanSehir = il.value; s.ezanSehirAd = il.options[il.selectedIndex]?.textContent || null; PZA.save();
    }
    if (!s.ezanIlce && ilce && ilce.value) {
      s.ezanIlce = ilce.value; s.ezanIlceAd = ilce.options[ilce.selectedIndex]?.textContent || null; PZA.save();
    }
    if (s.ezanIlce && (!PZA.__ezanListe || PZA.__ezanYuklenenIlce !== s.ezanIlce)) {
      PZA.__ezanYuklenenIlce = s.ezanIlce;
      PZA.ezanYukle();
    }
  };

  $('ezan-il')?.addEventListener('change', async e => {
    PZA.settings.ezanSehir = e.target.value;
    PZA.settings.ezanSehirAd = e.target.options[e.target.selectedIndex]?.textContent || null;
    PZA.settings.ezanIlce = null; PZA.settings.ezanIlceAd = null;
    PZA.save();
    await PZA.ezanIlceDoldur(e.target.value);
    const ilce = $('ezan-ilce');
    if (ilce && ilce.value) {
      PZA.settings.ezanIlce = ilce.value;
      PZA.settings.ezanIlceAd = ilce.options[ilce.selectedIndex]?.textContent || null;
      PZA.save();
      PZA.__ezanYuklenenIlce = null;
      PZA.ezanYukle();
    }
  });
  $('ezan-ilce')?.addEventListener('change', e => {
    PZA.settings.ezanIlce = e.target.value;
    PZA.settings.ezanIlceAd = e.target.options[e.target.selectedIndex]?.textContent || null;
    PZA.save();
    PZA.__ezanYuklenenIlce = null;
    PZA.ezanYukle();
  });
  let ezanSesZaman = null;
  $('ezan-ses')?.addEventListener('input', e => {
    clearTimeout(ezanSesZaman);
    const v = parseFloat(e.target.value);
    ezanSesZaman = setTimeout(() => { PZA.settings.ezanSes = v; PZA.save(); }, 200);
  });
  $('ezan-test')?.addEventListener('click', () => PZA.ezanTest?.());

  /* ── ANA PANEL: ezan ses düğmesi + günün vakitleri dropdown'ı (v1.18.0) ──
     KULLANICI: "1/2 boyutta tam ortadaki tema yazısı gereksiz; yerine ezan
     sesini kısıp/açacak buton (bayrak benzeri ay-yıldız, kuzeydoğuya apraz)
     ve onun altında o günkü namaz vakitleri KÜÇÜK bir liste." */
  PZA.ezanMenuCiz = function () {
    const kap = document.getElementById('ezan-vakit');
    if (!kap) return;
    const liste = PZA.__ezanListe;
    const bugun = liste ? PZA.ezanBugun(liste, PZA.ezanBugunAnahtar(new Date())) : null;
    if (!bugun) { kap.innerHTML = '<span class="vk bos">Vakitler yükleniyor…</span>'; return; }
    const adlar = PZA.EZAN_ADLAR || {};
    const sirali = ['Imsak', 'Gunes', 'Ogle', 'Ikindi', 'Aksam', 'Yatsi'];
    kap.innerHTML = sirali.map(v => {
      const sinif = v === 'Gunes' ? ' gunes' : '';                 // Güneş'te ezan yok
      return '<span class="vk' + sinif + '">' + (adlar[v] || v) + '</span>'
           + '<span class="vt' + sinif + '">' + PZA.escHtml(String(bugun[v] || '--:--')) + '</span>';
    }).join('');
  };
  PZA.on?.('ezan:vakitler', () => PZA.ezanMenuCiz());

  const ezanMenu = $('ezan-menu'), ezanBtn = $('ezan-ses-btn');
  function menuKapat() {
    if (ezanMenu) {
      ezanMenu.hidden = true;
      /* Sığmayınca verilen kaydırma/maxHeight kalıntısını temizle. */
      ['maxHeight', 'overflowY', 'top', 'bottom', 'left', 'right']
        .forEach(k => ezanMenu.style.removeProperty(k));
    }
    if (ezanBtn) ezanBtn.setAttribute('aria-expanded', 'false');
  }

  /* Bar modunda barın DIŞINA taşan menüler/paneller `position: fixed`'tir.
     KULLANICI BEKLENTİSİ (2026-10-16): "hava durumuna basınca HAVA yazan
     yerden, ezana basınca EZAN yerinden, notlara basınca NOTLAR yazan yerden
     açılsın." → her yüzeyi TETİKLEYEN öğeye YATAYDA hizala (dikey CSS'ten
     `data-bar-konum` yönetir). Bar modu değilse inline değerler temizlenir. */
  PZA.barYuzeyHizala = function (el, tetik, yon) {
    if (!el) return;
    const barMod = PZA.settings && PZA.settings.size === 'bar';
    if (!barMod || el.hidden || !tetik) {
      el.style.left = ''; el.style.right = ''; el.style.marginLeft = '';
      return;
    }
    const vw = window.innerWidth;
    const w = Math.round(el.getBoundingClientRect().width) || 412;
    const r = tetik.getBoundingClientRect();
    const enSol = 8, enSag = Math.max(enSol, vw - w - 8);
    if (yon === 'sol') {
      /* Tetikleyicinin SOLUNA hizala, ekrandan taşmasın */
      el.style.right = 'auto';
      el.style.marginLeft = '0';
      el.style.left = Math.round(Math.max(enSol, Math.min(r.left, enSag))) + 'px';
    } else {
      /* Tetikleyicinin SAĞINA hizala (sağ kenarlar çakışır) */
      el.style.left = 'auto';
      el.style.marginLeft = '0';
      el.style.right = Math.round(Math.max(enSol, Math.min(vw - r.right, enSag))) + 'px';
    }
  };

  /* Açılır yüzeyi (dropdown) TETİKLEYİCİYE hizala; YÖNÜ KONUMA GÖRE seç:
     tetikleyicinin ALTINDA yer varsa AŞAĞI, yoksa YUKARI açılır (kullanıcı 2026-10-17).
     Hem EZAN menüsü hem GÜNCELLEME popup'ı bu tek kuralı kullanır. */
  PZA.dropdownYerlestir = function (el, tetik) {
    if (!el || el.hidden) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const rb = (tetik || el).getBoundingClientRect();
    const mw = Math.round(el.getBoundingClientRect().width) || 220;
    const mh = el.offsetHeight || Math.round(el.getBoundingClientRect().height) || 220;
    el.style.left = 'auto';
    el.style.right = Math.round(Math.max(8, Math.min(vw - rb.right, vw - mw - 8))) + 'px';

    /* HATA DÜZELTMESİ (2026-10-19): eski hâli "aşağıda mh+12 yer varsa
       aşağı, YOKSA yukarı" idi ve yukarı dalı konumu hiç sınırlama
       yapmıyordu → menü pencerenin ÜST kenarının dışına kayıp üst
       yarısı kırpılıyordu (ekran görüntüsü).

       Yeni kural:
         1) Altta yer varsa → AŞAĞI (düğmenin altı).
         2) Altta yoksa AMA üstte varsa → YUKARI, DÜĞMENİN HIZASINDA.
         3) İki tarafta da yoksa → iç kaydırma aç, pencere yeterince
            büyüyene kadar AŞAĞI sabit tut (kırpma yerine kaydırma).
       `top` her zaman piksel olarak verilir; `bottom` kullanılmaz —
       iki yönlü kurulum birbirini geçersiz kılıyordu. */
    const alta = (vh - rb.bottom);
    const uste = rb.top;
    if (alta >= mh + 12) {
      el.style.top = Math.round(rb.bottom + 8) + 'px';
      el.style.removeProperty('bottom');
      el.style.maxHeight = '';
    } else if (uste >= mh + 12) {
      el.style.top = Math.round(Math.max(8, rb.top - mh - 8)) + 'px';
      el.style.removeProperty('bottom');
      el.style.maxHeight = '';
    } else {
      /* Hiçbir yön sığmıyor → sığdır + kendi içinde kaydır. */
      const kap = Math.max(80, alta - 16);
      el.style.top = Math.round(rb.bottom + 8) + 'px';
      el.style.removeProperty('bottom');
      el.style.maxHeight = kap + 'px';
      el.style.overflowY = 'auto';
    }
  };

  PZA.ezanMenuYerlestir = function () {
    /* Bar modunda HAVA/NOTLAR panelleri tetikleyiciye YATAYDA hizalanır. */
    PZA.barYuzeyHizala(document.getElementById('panel-weather'), $('weather-tile'), 'sol');
    PZA.barYuzeyHizala(document.getElementById('panel-notes'), $('btn-notes'), 'sag');
    if (!ezanMenu) return;
    if (ezanMenu.hidden) { ['top', 'bottom', 'left', 'right'].forEach(k => ezanMenu.style.removeProperty(k)); return; }
    PZA.dropdownYerlestir(ezanMenu, ezanBtn);
  };

  ezanBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!ezanMenu) return;
    const acikti = !ezanMenu.hidden;
    ezanMenu.hidden = acikti;
    ezanBtn.setAttribute('aria-expanded', acikti ? 'false' : 'true');
    if (!acikti) {
      PZA.ezanMenuCiz();
      /* Önce pencereyi büyüt, SONRA konumlandır. Sıra önemli:
         `dropdownYerlestir` `window.innerHeight` ölçer; pencere
         büyümeden yapılırsa yanlış yön seçilir ve menü kırpılır.
         `fit()` ölçümü yapıp menüyü konumlar; sonraki çağrı
         konumu ikinci kez doğrular (ödümlü, zararsız). */
      fit();
      PZA.ezanMenuYerlestir();
    } else {
      /* Kapandı: önceki "sığmayınca" durumundan kalan kaydırma
         ve maxHeight TEMİZLENMEZSE bir sonraki açılışta menü
         kaydırılabilir görünür. */
      ['maxHeight', 'overflowY'].forEach(k => ezanMenu.style.removeProperty(k));
      PZA.ezanMenuYerlestir();
    }
  });
  window.addEventListener('resize', () => PZA.ezanMenuYerlestir());
  document.addEventListener('click', e => {
    if (!ezanMenu || ezanMenu.hidden) return;
    if (!e.target.closest('#ezan-ctl')) menuKapat();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menuKapat(); });
  $('ezan-sessiz-btn')?.addEventListener('click', () => {
    /* KULLANICI (2026-10-16): "ezan okunurken sesi kıs → çalma durmuyor" ve
       "bir sonraki ezana kadar dursun, çalar saat gibi". Panel düğmesi:
       ÇALANI DURDUR + BİR SONRAKİ VAKTE KADAR sustur (kendiliğinden geri açılır).
       Kalıcı kapatma = Ayarlar'daki ana `ezan` anahtarı (kullanıcı: "okunmasını
       istemeyen zaten ayarlardan açmayacaktır"). */
    if (PZA.settings.ezanSessiz === true) PZA.ezanSesiAc?.();
    else PZA.ezanSustur?.();
  });
  let hizliZaman = null;
  $('ezan-hizli-ses')?.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    /* Kayarken ÇALAN ezanın sesini ANINDA güncelle (yoksa bir sonraki çalmaya
       kadar etkisiz kalıyordu). */
    if (PZA.__ezanAudio) { try { PZA.__ezanAudio.volume = Math.max(0, Math.min(1, v)); } catch (err) {} }
    clearTimeout(hizliZaman);
    hizliZaman = setTimeout(() => { PZA.set('ezanSes', v); }, 180);
  });

  /* Tanımlar tamam → açılışta BİR KEZ çiz: il/ilçe listelerini doldurur ve
     KAYITLI seçimi geri yükler (yukarıdaki sıra hatasının asıl telafisi). */
  PZA.ezanAyarCiz?.();
  PZA.ezanMenuCiz();

  /* Uyarı bloğundaki "yolunu kopyala" düğmesi — blok dinamik
     yazıldığı için delege edilir (düğme HTML'de yok). */
  $('voice-hint')?.addEventListener('click', async e => {
    const b = e.target.closest('[data-kopya]');
    if (!b) return;
    const uri = b.dataset.kopya;
    try {
      await navigator.clipboard.writeText(uri);
      b.textContent = 'Kopyalandı ✓ · Win + R ile çalıştırın';
    } catch (err) {
      // Pano izni yoksa yalan söyleme — yolu yaz.
      b.textContent = 'Kopyalanamadı — yolu elle yazın: ' + uri;
    }
  });

  /* ── Yerine kilit (sağ üst köşe) ─────────────────────── */
  $('btn-lock')?.addEventListener('click', () => PZA.set('locked', !PZA.settings.locked));

  $('notes-list')?.addEventListener('click', e => {
    const row = e.target.closest('.note-row');
    if (!row) return;
    const { t, x } = row.dataset;
    if (e.target.closest('.del')) PZA.removeNote(t, x);
    else if (e.target.closest('.star')) PZA.toggleStar(t, x);
  });

  $('notes-preview')?.addEventListener('click', e => {
    const item = e.target.closest('.np-item');
    if (!item) return;
    PZA.toggleNotes(true);
    const row = document.querySelector(`.note-row[data-t="${CSS.escape(item.dataset.t)}"][data-x="${CSS.escape(item.dataset.x)}"]`);
    row?.classList.add('flash');
    setTimeout(() => row?.classList.remove('flash'), 900);
  });

  /* ── Google Takvim (Yol B) ──────────────────────────────
     Akışın tamamı js/gcal.js içinde; burada yalnızca düğmeler
     bağlanır ve panel duruma göre tazelenir. */
  /* Mesaj yazma/tutma gcal.js'te: panel tazelemesi akışın yazdığı
     mesajı EZMEMELİ (bkz. gcal.js · TUR 5 HATASI). */
  const gcalYaz = (m, sinif) => PZA.gcalYaz(m, sinif);

  const gcalPanel = () => {
    const cid = PZA.gcalClientId();
    const sir = PZA.gcalClientSecret();
    const bagli = PZA.gcalBagliMi();
    /* TUR 6 HATASI: kullanıcı tur 5'te bir API anahtarı girdi; eski kod
       onu "Client ID var" sanıp kurulum kutusunu KALICI olarak gizledi
       (`kur.hidden = !!cid`). Bağlı olmadığı için "Bağlantıyı kes" de
       görünmüyordu → kullanıcının elinde kurtarma yolu kalmadı.
       Artık kutu yalnızca **geçerli** bir Client ID varsa gizlenir.

       TUR 14: kutu, Client ID **ve** istemci sırrı birlikte yerindeyken
       kapanır. Sır eksikken açık kalır çünkü Google masaüstü
       istemcilerinde sırrı zorunlu tutuyor (sırsız bağlanma
       "client_secret is missing" ile bitiyordu). Ayrıca son deneme sır
       yüzünden düştüyse (`sirHatasi`) kutu YİNE açık kalır: kullanıcı
       yanlış/eski sırrı düzeltebilsin — düzeltilecek alan görünmüyorsa
       kullanıcı çıkmazda kalır (tur 9 dersi). */
    const gecerli = PZA.gcalClientIdGecerliMi();
    const kur = $('gcal-kur');
    if (kur) kur.hidden = gecerli && !!sir && !PZA.gcal.sirHatasi;
    /* Geçersiz/kalıntı değer alanda duruyorsa kullanıcı görsün ki
       düzeltebilsin — geçerliyse yine gösterilir (düzenlenebilir). */
    const idAlani = $('gcal-id');
    if (idAlani && document.activeElement !== idAlani) idAlani.value = cid;
    const sirAlani = $('gcal-secret');
    if (sirAlani && document.activeElement !== sirAlani) sirAlani.value = sir;
    const sync = $('btn-gcal-sync');
    if (sync) sync.hidden = !bagli;
    const kes = $('gcal-kes');
    if (kes) kes.hidden = !bagli;
    const m = PZA.gcalVarsayilan(PZA.gcalOzet(), cid, gecerli);
    if (m !== null) gcalYaz(m);              // akış yazdıysa DOKUNMA
  };
  gcalPanel();

  /* TUR 12 — Açılışta bağlantı ÖLÇÜLÜR. Kullanıcı bildirimi: takvim
     "bağlı" görünüyordu ama hiçbir şey aktarılmıyordu; durum satırı
     saklanan anahtarın varlığından türetildiği için yalan söyleyebiliyordu.
     Artık gerçek bir API çağrısı yapılır ve ÖLÇÜLEN sonuç panele yazılır.
     Akış sürerken (`gcalSon` dolu) satıra dokunulmaz: `gcalPanel` zaten
     yalnız kendi türettiği mesajı yazar. */
  if (PZA.gcalBagliMi()) {
    PZA.gcalDogrula?.()
      .then(() => { PZA.gcalMesajTemizle?.(); gcalPanel(); })
      .catch(() => {});
  }

  /* Client ID yazıldıkça sakla: kullanıcı bağlanmadan önce panel
     kapanırsa yeniden yazmak zorunda kalmasın. */
  $('gcal-id')?.addEventListener('change', e => {
    PZA.gcal.clientId = e.target.value.trim();
    PZA.gcal.sirHatasi = 0;          // değer değişti: eski hatanın izi kalmasın
    PZA.gcalKaydet();
    PZA.gcalMesajTemizle();          // yeni Client ID → türetilen ipucu geri gelsin
    gcalPanel();
  });

  /* TUR 14 — istemci sırrı. Google masaüstü istemcilerinde bu alanı
     zorunlu tutuyor; eksikken bağlanma "client_secret is missing" ile
     bitiyordu. Değer yalnız bu makinede, takvim kaydının içinde durur. */
  $('gcal-secret')?.addEventListener('change', e => {
    PZA.gcal.clientSecret = e.target.value.trim();
    PZA.gcal.sirHatasi = 0;
    PZA.gcalKaydet();
    PZA.gcalMesajTemizle();
    gcalPanel();
  });

  $('btn-gcal')?.addEventListener('click', async () => {
    const b = $('btn-gcal');

    /* TUR 7: Google hesabı reddederse (403 / "uygulama test edilmektedir")
       yönlendirme HİÇ gelmez; akış üç dakika boyunca bekler. Bekleyen
       kullanıcının elinde çıkış yolu olmalı. Bu yüzden akış sürerken
       düğme "Vazgeç" olur ve DEVRE DIŞI BIRAKILMAZ — bırakılsaydı
       iptal düğmesinin kendisi ölü olurdu. */
    if (b && b.dataset.calisiyor === '1') {
      b.disabled = true;               // çift tıklama ikinci iptal göndermesin
      await PZA.gcalVazgec?.();
      return;                          // etiketi akışın `finally`'si geri koyar
    }

    const cid = ($('gcal-id')?.value || '').trim();
    if (cid) { PZA.gcal.clientId = cid; PZA.gcalKaydet(); }
    /* TUR 14: sır alanı da okunur. `change` olayı alandan çıkınca düşer;
       düğmeye basmak alanı bulanıklaştırdığı için sıra normalde doğrudur —
       ama kullanıcı yapıştırıp Enter'a basarsa ya da olay düşmezse değer
       kaydedilmeden akışa girilirdi. Boş değer YAZILMAZ: kullanıcı alanı
       temizlediyse silme işini `change` zaten yapmıştır. */
    const sir = ($('gcal-secret')?.value || '').trim();
    if (sir) { PZA.gcal.clientSecret = sir; PZA.gcal.sirHatasi = 0; PZA.gcalKaydet(); }
    if (b) { b.dataset.calisiyor = '1'; b.textContent = 'Vazgeç'; }
    PZA.gcalMesajTemizle();
    /* Gözlemci verilmez: akış mesajı doğrudan panele yazar ve
       `finally` içindeki tazeleme onu EZMEZ. */
    try { await PZA.gcalBaglan(); }
    catch (e) { gcalYaz('Bağlanma akışı çöktü: ' + (e && e.message || e), 'err'); }
    finally {
      if (b) {
        b.disabled = false;
        b.dataset.calisiyor = '';
        b.innerHTML = '<b>G</b> Hesap Bağla';
      }
      gcalPanel();
    }
  });

  /* Tarayıcı açılamadıysa adresi kopyala: kullanıcı kendi tarayıcısına
     yapıştırıp izin verir, dönüş yine uygulamaya düşer. */
  $('gcal-kopyala')?.addEventListener('click', async e => {
    const i = $('gcal-url');
    if (!i) return;
    const b = e.currentTarget;
    let tamam = false;
    try { await navigator.clipboard.writeText(i.value); tamam = true; }
    catch (_) {
      /* Pano izni yoksa eski yol: seç + kopyala. */
      i.removeAttribute('readonly');
      i.select();
      try { tamam = document.execCommand('copy'); } catch (_) {}
      i.setAttribute('readonly', '');
    }
    b.textContent = tamam ? 'Adres kopyalandı ✓' : 'Adresi elle seçin';
    setTimeout(() => { b.textContent = 'Adresi kopyala'; }, 2200);
  });

  $('btn-gcal-sync')?.addEventListener('click', async () => {
    const b = $('btn-gcal-sync');
    b.disabled = true;
    gcalYaz('Notlar takvime gönderiliyor…');
    try {
      /* TUR 12 — düğme artık BÜTÜN günleri gönderir. Eskiden yalnız
         ekranda seçili gün gönderiliyordu; kullanıcı "dün girdiğim
         veriler aktarılmadı" dediğinde düğmeye basmak da işe
         yaramıyordu. */
      const s = await PZA.gcalTumunuEsitle((i, n) => {
        if (n > 1) gcalYaz('Gönderiliyor… ' + i + '/' + n);
      });
      gcalYaz((s.atlanan ? 'Kısmen gönderildi · ' : 'Gönderildi ✓ · ')
              + PZA.gcalEsitlemeOzeti(s), s.atlanan ? 'err' : undefined);
    } catch (e) {
      gcalYaz('Eşitleme başarısız: ' + e.message, 'err');
      PZA.logYaz?.('hata', 'Elle eşitleme başarısız', { hata: String(e.message || e) });
    } finally { b.disabled = false; }
  });

  $('gcal-console')?.addEventListener('click', () => {
    // Konsol adresi sabittir; kullanıcı adres çubuğuna yazmak zorunda kalmasın.
    PZA.gcalKonsolAc?.();
  });

  /* v1.11.1 — kurulumu olabildiğince basit anlatmak için ayrıntılı wiki
     sayfasını aç. Başarısız olursa adres gösterilir (kopyalanabilir). */
  $('gcal-wiki')?.addEventListener('click', async () => {
    const oldu = await (PZA.gcalWikiAc?.() ?? Promise.resolve(false));
    if (!oldu) {
      PZA.gcalElle(PZA.GCAL?.WIKI, 'Ayrıntılı kurulum anlatımı (adresi kopyalayıp açın)');
      gcalYaz('Wiki adresi açılamadı — kutuya yazdım, kopyalayıp tarayıcınızda açın.', 'err');
    }
  });

  /* TUR 9 — kutudaki adresi aç. 403 sonrası bu adres, kullanıcının
     gitmesi gereken Konsol sayfasıdır; kopyala-yapıştır iki adımı
     kullanıcıyı yanlış Google ürününe sürükledi. Açma başarısız olursa
     kopyalama düğmesi zaten yanında duruyor — o yüzden hata mesajı
     yalnız o yolu hatırlatır, akışı bozmaz. */
  $('gcal-url-ac')?.addEventListener('click', async e => {
    const b = e.currentTarget;
    b.disabled = true;
    const oldu = await (PZA.gcalAdresAc?.() ?? Promise.resolve(false));
    b.textContent = oldu ? 'Tarayıcıda açıldı' : 'Açılamadı — kopyalayın';
    if (!oldu) gcalYaz('Adres açılamadı. ' + (PZA.GCAL?.ACILMADI || ''), 'err');
    setTimeout(() => { b.textContent = 'Tarayıcıda aç'; b.disabled = false; }, 2200);
  });

  $('gcal-kes')?.addEventListener('click', async () => {
    if (!confirm('Google Takvim bağlantısı kesilsin mi? Takvimdeki notlar silinmez.')) return;
    await PZA.gcalKes();
    PZA.gcalElle(null);
    PZA.gcalMesajTemizle();
    gcalPanel();
  });

  /* ── Günlük (tur 6) ─────────────────────────────────── */
  $('btn-log-kopyala')?.addEventListener('click', async () => {
    const b = $('btn-log-kopyala');
    let tamam = false;
    try { tamam = await PZA.logKopyala(); } catch (_) {}
    b.textContent = tamam ? 'Kopyalandı ✓' : 'Kopyalanamadı';
    setTimeout(() => { b.textContent = 'Günlüğü kopyala'; }, 2200);
  });

  /* ── Lisans ─────────────────────────────────────────── */
  $('btn-license')?.addEventListener('click', () => {
    alert(
      'Palet Zaman Asistanı\n' +
      'Copyright © 2026 Paletweb Bilişim\n\n' +
      'Bu program özgür yazılımdır: GNU Genel Kamu Lisansı (GPL-3.0) koşulları\n' +
      'altında yeniden dağıtabilir ve/veya değiştirebilirsiniz.\n\n' +
      'Bu program, yararlı olacağı umuduyla dağıtılmaktadır; ancak HİÇBİR\n' +
      'GARANTİ VERİLMEZ. Ayrıntı için LICENSE dosyasına bakın:\n' +
      'https://www.gnu.org/licenses/gpl-3.0.html\n\n' +
      'Kaynak kod: https://github.com/akamaci/palet-zaman-asistani'
    );
  });

  /* ── Klavye kısayolları ─────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('settings').hidden) $('settings').hidden = true;
      else if (PZA.calOpen?.()) PZA.closeCal();
      else { PZA.closeNotes(); PZA.closeWeather(); }
    }
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); PZA.toggleNotes(); }
  });

  /* Pencere geri geldiğinde hava verisini tazele */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && PZA.settings.weather && PZA.settings.city) PZA.loadWeather();
  });

  console.log('%cPalet Zaman Asistanı', 'color:#06b6d4;font-weight:700',
              TAURI ? '· Tauri' : '· tarayıcı önizlemesi');
})();
