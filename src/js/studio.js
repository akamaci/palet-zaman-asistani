/* studio.js — Skin Stüdyosu arayüzü
   Palet Zaman Asistanı · GPL-3.0 · © 2026 Paletweb Bilişim
   ──────────────────────────────────────────────────────────
   Kullanıcı 27 rengi, arka plan görselini, köşeyi ve fontu
   seçer. Her değişiklik ANINDA gerçek widget'a uygulanır
   (PZA.setPreview) ve içerideki minik önizleme aynı inline
   stilleri kopyaladığı için birebir aynı görünür.
   ══════════════════════════════════════════════════════════ */
(function () {
  const $ = id => document.getElementById(id);

  let draft = null;         // düzenlenen skin nesnesi (kopya)
  let target = 'dark';      // hangi palet düzenleniyor
  let isNew = false;

  /* ── Yardımcılar ─────────────────────────────────────── */
  const clone = o => JSON.parse(JSON.stringify(o));

  function msg(text, err) {
    const el = $('st-msg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('err', !!err);
  }

  function setColor(k, hex, a) {
    const set = draft[target] || (draft[target] = {});
    set[k] = PZA.toCss({ hex: hex, a: a });
  }

  /* ── Token satırlarını bir kez kur ───────────────────── */
  function buildTokens() {
    const box = $('st-tokens');
    if (!box || box.dataset.built) return;
    let html = '';
    PZA.TOKEN_GROUPS.forEach(g => {
      html += '<div class="st-group">' + g.toLocaleUpperCase('tr') + '</div>';
      PZA.TOKENS.filter(t => t.g === g).forEach(t => {
        html += '<div class="st-row">' +
          '<span class="st-lbl" title="' + t.k + '">' + t.n + '</span>' +
          '<input type="color" class="st-color" data-k="' + t.k + '" aria-label="' + t.n + '">' +
          '<input type="range" class="st-alpha" data-k="' + t.k + '" min="0" max="100" step="1" aria-label="' + t.n + ' saydamlık">' +
          '<b class="st-av">100</b>' +
          '</div>';
      });
    });
    box.innerHTML = html;
    box.dataset.built = '1';
  }

  /** draft[target] değerlerini satırlara yaz */
  function syncTokens() {
    const box = $('st-tokens');
    if (!box) return;
    const set = draft[target] || {};
    PZA.TOKENS.forEach(t => {
      const row = box.querySelector('[data-k="' + t.k + '"]');
      if (!row) return;
      const r = row.closest('.st-row');
      const c = PZA.parseColor(set[t.k]) || { hex: '#000000', a: 1 };
      r.querySelector('.st-color').value = c.hex;
      r.querySelector('.st-alpha').value = Math.round(c.a * 100);
      r.querySelector('.st-av').textContent = Math.round(c.a * 100);
      // Tamamen saydam bir renk seçilemez — kullanıcıyı uyar
      r.classList.toggle('caution', c.a < 0.06);
    });
  }

  /* ── Biçim / arka plan denetimleri ───────────────────── */
  function buildFonts() {
    const fill = (sel, list) => {
      if (!sel || sel.dataset.built) return;
      sel.innerHTML = list.map(f => '<option value="' + f[0].replace(/"/g, '&quot;') + '">' + f[1] + '</option>').join('');
      sel.dataset.built = '1';
    };
    fill($('st-font-ui'), PZA.FONTS.ui);
    fill($('st-font-num'), PZA.FONTS.num);
  }

  function syncChrome() {
    const r = $('st-radius');
    if (r) { r.value = draft.radius != null ? draft.radius : 16; $('st-radius-v').textContent = r.value + 'px'; }

    const fu = $('st-font-ui'), fn = $('st-font-num');
    if (fu && draft.fontUI) fu.value = draft.fontUI;
    if (fn && draft.fontNum) fn.value = draft.fontNum;

    const bg = draft.bg || { image: null, opacity: 0.35, fit: 'cover' };
    const op = $('st-bg-op');
    if (op) { op.value = Math.round((bg.opacity != null ? bg.opacity : 0.35) * 100); $('st-bg-op-v').textContent = op.value + '%'; }
    document.querySelectorAll('#st-bg-fit button').forEach(b =>
      b.classList.toggle('on', b.dataset.fit === (bg.fit || 'cover')));

    const has = !!bg.image;
    $('st-bg-clear')?.toggleAttribute('disabled', !has);
    document.querySelector('.st-bg')?.classList.toggle('has', has);
    $('st-file-name').textContent = has ? 'Görsel yüklü ✓' : 'Görsel seçilmedi';
  }

  /** Denetimlerdeki değerleri draft'a yaz */
  function readChrome() {
    draft.radius = +($('st-radius')?.value || 16);
    draft.fontUI = $('st-font-ui')?.value || '';
    draft.fontNum = $('st-font-num')?.value || '';
    draft.bg = draft.bg || { image: null, opacity: 0.35, fit: 'cover' };
    draft.bg.opacity = (+($('st-bg-op')?.value || 35)) / 100;
  }

  /* ── Canlı uygulama ──────────────────────────────────── */
  function applyDraft() {
    readChrome();
    PZA.setPreview(draft);
    mirror();
    PZA.emit('skin', draft);
  }

  /** Gerçek widget'ın inline stillerini önizlemeye kopyala.
      Böylece önizleme ayrı bir "tahmin" değil, birebir aynı sonuç. */
  function mirror() {
    const w = $('widget'), p = $('sp-widget');
    if (!w || !p) return;
    p.setAttribute('style', w.getAttribute('style') || '');
    p.dataset.theme = w.dataset.theme || 'dark';
    p.dataset.skin = w.dataset.skin || 'halo';

    const wb = $('skin-bg'), pb = $('sp-bg');
    if (wb && pb) {
      pb.style.backgroundImage = wb.hidden ? 'none' : (wb.style.backgroundImage || 'none');
      pb.style.opacity = wb.style.opacity || 0.35;
      pb.style.backgroundSize = wb.style.backgroundSize || 'cover';
      pb.style.backgroundRepeat = wb.style.backgroundRepeat || 'no-repeat';
    }
  }

  /* ── Palet sekmeleri ─────────────────────────────────── */
  function setTarget(t) {
    target = t;
    if (t === 'light' && !draft.light) {
      // Aydınlık palet yoksa karanlıktan devral — kullanıcı sıfırdan başlamasın
      draft.light = Object.assign({}, draft.dark);
    }
    document.querySelectorAll('#st-target button').forEach(b =>
      b.classList.toggle('on', b.dataset.stTarget === t));
    $('st-target-hint').textContent = t === 'light'
      ? 'Aydınlık tema seçiliyken kullanılacak renkler.'
      : 'Karanlık tema seçiliyken kullanılacak renkler.';

    PZA.setPreviewTheme(t);
    const w = $('widget');
    if (w) w.dataset.theme = t;             // önizleme teması (kaydedilmez)
    syncTokens();
    mirror();
  }

  /* ── Aç / kapat ──────────────────────────────────────── */
  function openStudio(skin, fresh) {
    buildTokens();
    buildFonts();

    /* Yeni skin, EKRANDA GÖRÜNEN paletten başlar.
       Dikkat: zaten bir kullanıcı skini aktifse `data-skin="ozel"`tir ve
       ona ait bir CSS bloğu yoktur — saf DOM okuması varsayılana düşerdi.
       Bu yüzden önce DOM'dan temel alıp üstüne aktif skini bindiriyoruz:
       eksik token'lar temelden tamamlanır, mevcut olanlar korunur. */
    const activeSkin = skin ? null : PZA.activeSkin();
    draft = skin ? clone(skin) : {
      format: PZA.SKIN_FORMAT, id: null, name: '', author: '',
      dark: Object.assign({}, PZA.readColorsFromDom() || {}, (activeSkin && activeSkin.dark) || {}),
      light: (activeSkin && activeSkin.light) ? clone(activeSkin.light) : null,
      bg: (activeSkin && activeSkin.bg) ? clone(activeSkin.bg) : { image: null, opacity: 0.35, fit: 'cover' },
      radius: (activeSkin && activeSkin.radius != null) ? activeSkin.radius : 16,
      fontUI: (activeSkin && activeSkin.fontUI) || '',
      fontNum: (activeSkin && activeSkin.fontNum) || ''
    };
    if (!draft.bg) draft.bg = { image: null, opacity: 0.35, fit: 'cover' };
    isNew = !!fresh;

    $('st-name').value = draft.name || '';
    $('st-author').value = draft.author || '';
    $('st-foot').textContent = fresh ? 'Yeni skin' : ('Düzenleniyor: ' + (draft.name || '—'));
    $('st-del').textContent = fresh ? 'Vazgeç' : 'Sil';

    msg(fresh ? 'Renkleri değiştirin — widget anında güncellenir.' : '');
    $('studio').hidden = false;

    setTarget('dark');
    syncChrome();
    applyDraft();
  }

  function closeStudio() {
    PZA.clearPreview();
    const w = $('widget');
    if (w) w.dataset.theme = PZA.settings.theme;   // stüdyo temasını geri al
    PZA.apply();                                    // gerçek skini yeniden uygula
    PZA.emit('skins-changed');
    $('studio').hidden = true;
    draft = null;
  }

  /* ── Kaydet / sil ────────────────────────────────────── */
  function save() {
    readChrome();
    draft.name = ($('st-name').value || '').trim().slice(0, 24) || 'İsimsiz';
    draft.author = ($('st-author').value || '').trim().slice(0, 24);
    if (!draft.bg.image) draft.bg = null;
    if (!draft.id) draft.id = PZA.newId(draft.name);

    if (!PZA.saveSkin(draft)) {
      msg('Kaydedilemedi — tarayıcı deposu dolu olabilir. Arka plan görselini küçültmeyi deneyin.', true);
      return;
    }

    /* Ayarı doğrudan yazıyoruz, PZA.set() ÇAĞIRMIYORUZ: set() → apply()
       zinciri stüdyonun tema önizlemesini (açık/karanlık sekmesi)
       sıfırlar ve kullanıcı yanlış paleti düzenlediğini sanır.
       Önizleme zaten kaydettiğimiz değerleri gösteriyor; tazeleme
       işini closeStudio() yapar. */
    PZA.settings.skin = 'user:' + draft.id;
    PZA.save();
    PZA.emit('skins-changed');
    mirror();
    $('st-foot').textContent = 'Düzenleniyor: ' + draft.name;
    $('st-del').textContent = 'Sil';
    isNew = false;
    msg('Kaydedildi ve uygulandı ✓');
    PZA.emit('skins-changed');
  }

  function del() {
    if (isNew || !draft.id) { closeStudio(); return; }
    if (!confirm('"' + draft.name + '" skini silinsin mi? Bu geri alınamaz.')) return;
    const id = draft.id;
    PZA.deleteSkin(id);
    PZA.clearPreview();
    if (PZA.settings.skin === 'user:' + id) PZA.set('skin', 'halo');
    else PZA.apply();
    $('studio').hidden = true;
    draft = null;
    PZA.emit('skins-changed');
  }

  /* ── Dışa / içe aktarma ──────────────────────────────── */
  async function copyOut() {
    readChrome();
    const ok = await PZA.copyText(PZA.exportSkin(Object.assign({}, draft, { id: draft.id || PZA.newId(draft.name) })));
    msg(ok ? 'Skin kodu kopyalandı — dosta gönderebilirsiniz.' : 'Kopyalanamadı. "Dosya indir" seçeneğini deneyin.', !ok);
  }

  function pasteIn() {
    const box = $('st-paste-box');
    box.hidden = !box.hidden;
    if (!box.hidden) $('st-paste-text').focus();
  }

  function doImport() {
    const r = PZA.importSkin($('st-paste-text').value);
    if (!r.ok) { msg('İçe aktarılamadı: ' + r.err, true); return; }
    PZA.saveSkin(r.skin);
    $('st-paste-text').value = '';
    $('st-paste-box').hidden = true;
    PZA.emit('skins-changed');
    openStudio(r.skin, false);           // içe aktarılanı hemen düzenlemeye aç
    msg('"' + r.skin.name + '" içe aktarıldı ✓');
  }

  function openFile() {
    const inp = $('st-open');
    if (!inp) return;
    inp.value = '';
    inp.click();
  }

  /* ── Olay bağlama ────────────────────────────────────── */
  function wire() {
    $('studio-close')?.addEventListener('click', closeStudio);
    $('st-save')?.addEventListener('click', save);
    $('st-del')?.addEventListener('click', del);
    $('st-copy')?.addEventListener('click', copyOut);
    $('st-paste')?.addEventListener('click', pasteIn);
    $('st-paste-go')?.addEventListener('click', doImport);
    $('st-down')?.addEventListener('click', () => {
      readChrome();
      const ok = PZA.downloadSkin(Object.assign({}, draft, { id: draft.id || PZA.newId(draft.name) }));
      msg(ok ? 'Dosya indirildi.' : 'İndirilemedi.', !ok);
    });
    $('st-open-btn')?.addEventListener('click', openFile);

    $('st-open')?.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        const r = PZA.importSkin(fr.result);
        if (!r.ok) { msg('Dosya okunamadı: ' + r.err, true); return; }
        PZA.saveSkin(r.skin);
        PZA.emit('skins-changed');
        openStudio(r.skin, false);
        msg('"' + r.skin.name + '" dosyadan alındı ✓');
      };
      fr.readAsText(f);
    });

    /* Palet sekmeleri */
    $('st-target')?.addEventListener('click', e => {
      const b = e.target.closest('[data-st-target]');
      if (b) setTarget(b.dataset.stTarget);
    });

    /* Token düzenleme (delegasyon) */
    $('st-tokens')?.addEventListener('input', e => {
      const k = e.target.dataset.k;
      if (!k || !draft) return;
      const row = e.target.closest('.st-row');
      const hex = row.querySelector('.st-color').value;
      const a = (+row.querySelector('.st-alpha').value) / 100;
      setColor(k, hex, a);
      row.querySelector('.st-av').textContent = Math.round(a * 100);
      row.classList.toggle('caution', a < 0.06);
      applyDraft();
    });

    /* Biçim denetimleri */
    ['st-radius', 'st-bg-op'].forEach(id => {
      $(id)?.addEventListener('input', () => {
        if (id === 'st-radius') $('st-radius-v').textContent = $('st-radius').value + 'px';
        if (id === 'st-bg-op')  $('st-bg-op-v').textContent = $('st-bg-op').value + '%';
        applyDraft();
      });
    });
    ['st-font-ui', 'st-font-num'].forEach(id =>
      $(id)?.addEventListener('change', applyDraft));

    $('st-bg-fit')?.addEventListener('click', e => {
      const b = e.target.closest('[data-fit]');
      if (!b) return;
      draft.bg = draft.bg || { image: null, opacity: 0.35, fit: 'cover' };
      draft.bg.fit = b.dataset.fit;
      syncChrome(); applyDraft();
    });

    /* Arka plan görseli */
    $('st-bg-clear')?.addEventListener('click', () => {
      draft.bg = { image: null, opacity: 0.35, fit: 'cover' };
      syncChrome(); applyDraft();
      msg('Arka plan görseli kaldırıldı.');
    });

    $('st-img')?.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      msg('Görsel işleniyor…');
      PZA.readImage(f, (err, dataUri) => {
        if (err) { msg(err, true); return; }
        draft.bg = draft.bg || { image: null, opacity: 0.35, fit: 'cover' };
        draft.bg.image = dataUri;
        syncChrome(); applyDraft();
        msg('Görsel eklendi (' + Math.round(dataUri.length / 1024) + ' KB).');
      });
    });

    /* Ad değişince altbilgi */
    $('st-name')?.addEventListener('input', () => {
      if (draft) draft.name = $('st-name').value;
      $('st-foot').textContent = (isNew ? 'Yeni skin — ' : 'Düzenleniyor: ') + ($('st-name').value || '—');
    });
    $('st-author')?.addEventListener('input', () => { if (draft) draft.author = $('st-author').value; });

    /* Dışına tıkla → kapat */
    $('studio')?.addEventListener('click', e => { if (e.target.id === 'studio') closeStudio(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('studio').hidden) { e.stopPropagation(); closeStudio(); }
    }, true);
  }

  /* ── Dışa açılan kapı ────────────────────────────────── */
  PZA.openStudio = function (skin) { openStudio(skin, !skin); };
  PZA.openStudioNew = function () { openStudio(null, true); };
  PZA.openStudioEdit = function (id) {
    const sk = PZA.skinById(id);
    if (sk) openStudio(sk, false);
  };
  PZA.studioOpen = function () { return !!(draft && !$('studio').hidden); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
