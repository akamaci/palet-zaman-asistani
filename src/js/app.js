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

  /* ── Tauri: pencere yüksekliğini içeriğe uydur ─────────
     Notlar/hava paneli açılınca widget uzar. Sabit pencere
     yüksekliği paneli kırpardı. Yalnızca YÜKSEKLİK değiştirilir;
     genişliğe dokunmak pencere↔içerik geri besleme döngüsü kurar. */
  if (TAURI) {
    let sonH = 0;

    /* Gereken yükseklik = widget VEYA açık olan kaplama paneli
       (Ayarlar / Stüdyo). Bu ikisi #widget'ın KARDEŞİ ve
       `position: fixed`: widget'ı büyütmedikleri için tek başına
       ResizeObserver yetmez — 430px'lik pencerede kırpılırlardı. */
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

    const fit = async () => {
      let h = gerekliH();
      if (!h || Math.abs(h - sonH) < 3) return;   // titremeyi önle
      sonH = h;
      try {
        const win = window.__TAURI__.window;
        const w = win.getCurrentWindow();
        // Ayarlar paneli ekrandan uzun olabilir (Stüdyo özellikle).
        // Monitöre sığdır; panel kendi içinde kaydırılır.
        try {
          const mon = await win.currentMonitor();
          if (mon && mon.size && mon.size.height) {
            const enFazla = Math.round(mon.size.height / (mon.scaleFactor || 1)) - 60;
            if (enFazla > 240) h = Math.min(h, enFazla);
          }
        } catch (e) { /* monitör bilgisi alınamadı */ }
        await w.setSize(new win.LogicalSize(document.documentElement.clientWidth, h));
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
    'opt-speech': 'speech', 'opt-ontop': 'alwaysOnTop', 'opt-autostart': 'autostart'
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
    noteSave.textContent = 'Eklendi ✓';            // kısa onay
    noteSave.classList.add('ok');
    saveTimer = setTimeout(() => {
      noteSave.textContent = 'Ekle';
      noteSave.classList.remove('ok');
      saveTimer = null;
    }, 1400);
  });
  noteText?.addEventListener('keydown', e => { if (e.key === 'Enter') noteSave.click(); });

  /* ── Takvim ─────────────────────────────────────────── */
  $('notes-day-btn')?.addEventListener('click', () => PZA.openCal());
  $('cal-close')?.addEventListener('click', () => PZA.closeCal());
  $('cal-today')?.addEventListener('click', () => PZA.selectDay(PZA.todayKey()));
  $('cal-prev')?.addEventListener('click', () => PZA.calShift(-1));
  $('cal-next')?.addEventListener('click', () => PZA.calShift(1));
  $('notes-today')?.addEventListener('click', () => PZA.selectDay(PZA.todayKey()));
  $('cal-grid')?.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (b) PZA.selectDay(b.dataset.day);
  });

  /* ── Okuyucu sesi (kadın / erkek) ────────────────────── */
  $('voice-seg')?.addEventListener('click', e => {
    const b = e.target.closest('[data-voice]');
    if (!b) return;
    PZA.set('voice', b.dataset.voice);
    PZA.sayNow?.();                    // seçimi hemen duyur — karşılaştırmak için
  });
  $('btn-say-test')?.addEventListener('click', () => PZA.sayNow?.());

  /* Sesler gecikmeli yüklenirse etiketi tazele */
  PZA.on('speech:voices', () => {
    const el = $('voice-name');
    if (el) el.textContent = PZA.voiceLabel ? PZA.voiceLabel(PZA.settings.voice) : '—';
  });

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

  /* ── Google Takvim (Yol B) ──────────────────────────── */
  $('btn-gcal')?.addEventListener('click', async () => {
    const st = $('gcal-state');
    st.textContent = 'Google Cloud Console OAuth istemcisi bekleniyor…';
    const r = await invoke('gcal_connect');
    if (!TAURI) st.textContent = 'Tarayıcı önizlemesinde takvim bağlanamaz — uygulamada çalışır.';
    else if (r) st.textContent = 'Bağlandı ✓';
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
