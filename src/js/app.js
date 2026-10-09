/* app.js — başlatma ve olay bağlama
   Palet Zaman Asistanı · GPL-3.0 */
(function () {
  const $ = id => document.getElementById(id);

  /* Tauri içinde miyiz? (tarayıcı önizlemesinde de çalışır) */
  const TAURI = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  if (TAURI) document.body.classList.add('tauri');

  async function invoke(cmd, args) {
    if (!TAURI) return null;
    try {
      const core = window.__TAURI__.core || window.__TAURI__;
      return await core.invoke(cmd, args);
    } catch (e) { console.warn('invoke ' + cmd, e); return null; }
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
    let konumYuklendi = false;
    const fit = async () => {
      if (!konumYuklendi) { konumYuklendi = true; await konumGeriYukle(); }
      const h = gerekliH();
      const g = Math.max(EN_AZ_G, gerekliG());
      // Titremeyi önle: hedef DEĞİŞMEDİYSE dokunma. Ölçülen pencere
      // boyutuyla karşılaştırılsaydı kullanıcının elle yeniden
      // boyutlandırması her turda geri alınırdı.
      if (!h || (Math.abs(h - sonH) < 3 && Math.abs(g - sonG) < 3)) return;
      sonH = h; sonG = g;
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

        // Panel iş alanından uzun olabilir (Ayarlar/Stüdyo). Kırp:
        // panel kendi içinde kaydırılır, pencere ekrandan taşmaz.
        const hh = alan.boy ? Math.min(h, Math.max(240, alan.boy - 8)) : h;

        /* Saatin ekrandaki üst kenarı. Panel saatin üstünde duruyorsa
           saat, pencere tepesinden panelin yüksekliği kadar aşağıdadır.
           Bu değer fit() turları boyunca SABİT kalmalı. */
        const saatTepesi = sonY === null ? y : sonY + (sonYukari ? sonPay : 0);

        let yukari = false;
        let pay = 0;              // panelin saatin üstüne eklediği yükseklik
        let hedefY = y;

        if (kapVar) {
          /* Kaplama panel (Ayarlar/Stüdyo, `position: fixed`): pencere
             iş alanına sığsın diye gerekiyorsa yukarı çekilir; panel
             kapanınca temelY'ye dönülür. */
          if (temelY === null && !icVar) temelY = y;
          hedefY = Math.max(alan.ust, alt - hh - 8);
        } else if (!icVar && temelY !== null) {
          /* Her şey kapandı → panel açılmadan önceki yere dön. */
          hedefY = temelY;
          temelY = null;
        } else {
          /* Widget içi panel (Notlar/Hava).
             KULLANICI BİLDİRİMİ: "saat windows'un en altına alınırsa
             pencere yönünün yukarı açılması lazım ki okuna bilsin."
             Aşağıda yer yoksa panel saatin ÜSTÜNE alınır (`.yukari`)
             ve pencere, saatin yeri değişmeyecek şekilde panelin
             eklediği pay kadar yukarı kaydırılır. */
          pay = Math.max(0, h - temelYukseklik());
          yukari = icVar && (saatTepesi + hh > alt);
          hedefY = yukari ? Math.max(alan.ust, saatTepesi - pay) : saatTepesi;
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
      } catch (e) { /* yetki yoksa sessizce geç */ }
    };

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ['widget', 'settings', 'studio'].forEach(id => {
        const el = document.getElementById(id);
        if (el) ro.observe(el);
      });
    }
    // Ayarlar/Stüdyo açılıp kapandığında (hidden değişimi) yeniden ölç.
    new MutationObserver(fit).observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['hidden']
    });
    window.addEventListener('load', fit);
  }

  /* ── Başlat ─────────────────────────────────────────── */
  PZA.apply();
  PZA.renderNotes();
  PZA.startClock();
  if (PZA.settings.weather && PZA.settings.city) PZA.startWeatherRefresh();
  else if (PZA.settings.weather) PZA.loadWeather();

  /* ── Ayarlar aç/kapa ────────────────────────────────── */
  $('btn-settings')?.addEventListener('click', () => { $('settings').hidden = false; });
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

  /* ── Skin / görünürlük / boyut / tema (ayarlar paneli) ─ */
  $('skin-list')?.addEventListener('click', e => {
    if (e.target.closest('[data-skin-new]')) { PZA.openStudioNew(); return; }
    const card = e.target.closest('[data-skin-set]');
    if (card) PZA.set('skin', card.dataset.skinSet);
  });

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
    if (PZA.settings.skin === 'user:' + id) PZA.set('skin', 'halo');
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
    'opt-log': 'log'
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
    PZA.set('voiceName', e.target.value);
    PZA.sayNow?.();                    // seçimi hemen duyur — karşılaştırmak için
  });
  $('btn-say-test')?.addEventListener('click', () => PZA.sayNow?.());

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
    const bagli = PZA.gcalBagliMi();
    /* TUR 6 HATASI: kullanıcı tur 5'te bir API anahtarı girdi; eski kod
       onu "Client ID var" sanıp kurulum kutusunu KALICI olarak gizledi
       (`kur.hidden = !!cid`). Bağlı olmadığı için "Bağlantıyı kes" de
       görünmüyordu → kullanıcının elinde kurtarma yolu kalmadı.
       Artık kutu yalnızca **geçerli** bir Client ID varsa gizlenir. */
    const gecerli = PZA.gcalClientIdGecerliMi();
    const kur = $('gcal-kur');
    if (kur) kur.hidden = gecerli;
    /* Geçersiz/kalıntı değer alanda duruyorsa kullanıcı görsün ki
       düzeltebilsin — geçerliyse yine gösterilir (düzenlenebilir). */
    const idAlani = $('gcal-id');
    if (idAlani && document.activeElement !== idAlani) idAlani.value = cid;
    const sync = $('btn-gcal-sync');
    if (sync) sync.hidden = !bagli;
    const kes = $('gcal-kes');
    if (kes) kes.hidden = !bagli;
    const m = PZA.gcalVarsayilan(PZA.gcalOzet(), cid, gecerli);
    if (m !== null) gcalYaz(m);              // akış yazdıysa DOKUNMA
  };
  gcalPanel();

  /* Client ID yazıldıkça sakla: kullanıcı bağlanmadan önce panel
     kapanırsa yeniden yazmak zorunda kalmasın. */
  $('gcal-id')?.addEventListener('change', e => {
    PZA.gcal.clientId = e.target.value.trim();
    PZA.gcalKaydet();
    PZA.gcalMesajTemizle();          // yeni Client ID → türetilen ipucu geri gelsin
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
      const s = await PZA.gcalEsitle(PZA.activeDay);
      gcalYaz('Gönderildi ✓ · ' + s.eklenen + ' yeni, ' + s.guncellenen +
              ' güncel, ' + s.silinen + ' silindi');
    } catch (e) {
      gcalYaz('Eşitleme başarısız: ' + e.message, 'err');
    } finally { b.disabled = false; }
  });

  $('gcal-console')?.addEventListener('click', () => {
    // Konsol adresi sabittir; kullanıcı adres çubuğuna yazmak zorunda kalmasın.
    PZA.gcalKonsolAc?.();
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
