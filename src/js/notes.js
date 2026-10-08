/* notes.js — günün notları: depo, önizleme şeridi, açılır panel
   Palet Zaman Asistanı · GPL-3.0
   Depo biçimi: { "2026-10-08": [ { t:"09:00", x:"Toplantı", star:false } ] } */
window.PZA = window.PZA || {};

const NKEY = 'pza.notes.v1';

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NKEY)) || {}; }
  catch { return {}; }
}

PZA.notes = loadNotes();

PZA.saveNotes = function () {
  try { localStorage.setItem(NKEY, JSON.stringify(PZA.notes)); }
  catch (e) { console.warn('not yazılamadı', e); }
};

/* ── Seçili gün ──────────────────────────────────────────
   Panel artık TEK bir güne sabit değil. `activeDay` hangi gün
   görüntüleniyorsa odur; ekleme/silme/yıldızlama hep oraya
   yazar. Eskiden üçü de PZA.todayKey()'e sabitlenmişti, bu
   yüzden takvimden başka bir güne not girmek imkânsızdı. */
PZA.activeDay = PZA.todayKey();
PZA._gun = PZA.activeDay;      // gün dönüşü takibi (bkz. checkRollover)
PZA.calY = null;               // takvimin gösterdiği ay/yıl
PZA.calM = null;

/** Bir günün notları — saate göre sıralı */
PZA.dayNotes = function (key) {
  const k = key || PZA.activeDay || PZA.todayKey();
  const list = PZA.notes[k] || [];
  return [...list].sort((a, b) => a.t.localeCompare(b.t));
};

/** ISO anahtarı → görünen parçalar: "2026-10-09" → { d:9, ay:'Ekim', … } */
PZA.dayMeta = function (key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { y, m, d, ay: PZA.AYLAR[m - 1], gun: PZA.GUNLER[dt.getDay()] };
};

/** (y, ay, gün) → ISO anahtarı. Ay taşmalarını Date normalize eder. */
PZA.isoOf = function (y, m, d) {
  const dt = new Date(y, m, d);
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

/** Başka bir güne geç — katmanı KAPATIR (başlıktaki ↩ ve dış çağrılar) */
PZA.selectDay = function (key) {
  PZA.activeDay = key || PZA.todayKey();
  PZA.closeCal();
  PZA.renderNotes();
  PZA.emit('day:changed', PZA.activeDay);
};

/** Gün + saat seçme katmanı AÇIKKEN gün değiştir — katman açık kalır.
    Kullanıcı taslağı "saat ve tarih tek seferde seçilir" diyor;
    `selectDay` katmanı kapatıp saati seçtirmezdi. */
PZA.secimGun = function (key) {
  PZA.activeDay = key || PZA.todayKey();
  PZA.renderNotes();
  PZA.renderCal();          // seçili hücre işaretlensin
  PZA.emit('day:changed', PZA.activeDay);
};

PZA.addNote = function (t, x) {
  if (!x || !x.trim()) return false;
  const key = PZA.activeDay || PZA.todayKey();
  (PZA.notes[key] = PZA.notes[key] || []).push({ t, x: x.trim(), star: false });
  PZA.saveNotes(); PZA.renderNotes();
  PZA.emit('notes:changed');
  PZA.gcalPush?.({ t, x: x.trim(), date: key });   // takvim bağlıysa gönder
  return true;
};

PZA.removeNote = function (t, x) {
  const key = PZA.activeDay || PZA.todayKey();
  const list = PZA.notes[key] || [];
  const i = list.findIndex(n => n.t === t && n.x === x);
  if (i < 0) return;
  list.splice(i, 1);
  PZA.saveNotes(); PZA.renderNotes();
  PZA.emit('notes:changed');
};

PZA.toggleStar = function (t, x) {
  const key = PZA.activeDay || PZA.todayKey();
  const n = (PZA.notes[key] || []).find(n => n.t === t && n.x === x);
  if (!n) return;
  n.star = !n.star;
  PZA.saveNotes(); PZA.renderNotes();
  PZA.emit('notes:changed');
};

/* ── Çizim ───────────────────────────────────────────── */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAR = `<span class="star"><svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg></span>`;

/** Üst şerit: ilk 5 not başlığı */
PZA.renderPreview = function () {
  const bar = document.getElementById('notes-preview');
  if (!bar) return;
  const list = PZA.dayNotes();

  if (!list.length) {
    const bugun = (PZA.activeDay || PZA.todayKey()) === PZA.todayKey();
    const m = PZA.dayMeta(PZA.activeDay || PZA.todayKey());
    const kim = bugun ? 'Bugün' : `${m.d} ${m.ay}`;
    bar.innerHTML = `<span style="color:var(--fg-mute);font-size:11px">${kim} için not yok — notlar düğmesinden ekleyin.</span>`;
    return;
  }

  const shown = list.slice(0, 5);
  const parts = shown.map(n => `
    <span class="np-item ${n.star ? 'starred' : ''}" data-t="${esc(n.t)}" data-x="${esc(n.x)}">
      ${n.star ? STAR.replace('class="star"', 'class="star on"') : ''}
      <span class="np-time">${esc(n.t)}</span>
      <span class="np-text">${esc(n.x)}</span>
    </span>`);

  bar.innerHTML = parts.join('<span class="np-sep"></span>')
    + (list.length > 5 ? `<span class="np-more">+${list.length - 5}</span>` : '');
};

/** Sol sütunun başlığı: gün numarası, haftanın günü, ay + kayıt sayısı.
    Saat çizelgesinden AYRILDI: clock.js artık her saniye buraya yazmıyor,
    yoksa takvimden seçilen gün anında "bugün"e geri dönerdi. */
PZA.renderDayHead = function () {
  const key = PZA.activeDay || PZA.todayKey();
  const m = PZA.dayMeta(key);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('notes-date', String(m.d));
  set('notes-weekday', m.gun);
  set('notes-month', m.ay + ' ' + m.y);

  const bugun = key === PZA.todayKey();
  document.getElementById('notes-day-btn')?.classList.toggle('other', !bugun);
  const geri = document.getElementById('notes-today');
  if (geri) geri.hidden = bugun;
};

/** Gece yarısı geçildiyse başlığı tazele. Kullanıcı "bugün"ü
    görüntülüyorsa o da yeni güne taşınır; başka bir güne bakıyorsa
    baktığı gün korunur. clock.js her saniye çağırır (tek string
    karşılaştırması — ucuz). */
PZA.checkRollover = function () {
  const t = PZA.todayKey();
  if (t === PZA._gun) return false;
  if ((PZA.activeDay || PZA._gun) === PZA._gun) PZA.activeDay = t;
  PZA._gun = t;
  PZA.renderNotes();
  return true;
};

/* ── Zaman ızgarası ───────────────────────────────────────
   00:00 → 24:00 arası 30 dakikalık dilimler. Tek sıra hâlinde
   soldan sağa akar: ilk yarı sol sütun, ikinci yarı sağ sütun.
   Kaydırma çubuğu ikisini birlikte kaydırır (kullanıcı isteği). */
const DILIM_DK  = 30;
const DILIM_SAY = (24 * 60) / DILIM_DK;          // 48

/** "09:50" → 570. Notun düştüğü dilimin BAŞLANGICI (aşağı yuvarlar):
    yukarı yuvarlamak notu gerçek saatinden sonraki dilimde
    gösterirdi. Gerçek saat çipin üstünde yazılı kalır.
    PZA'ya bağlı: testler dilim matematiğini doğrudan sınar. */
function dilimle(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return Math.floor(((h || 0) * 60 + (m || 0)) / DILIM_DK) * DILIM_DK;
}
PZA.dilimle = dilimle;

/** 570 → "09:30" */
function dkSaat(dk) {
  return String(Math.floor(dk / 60)).padStart(2, '0') + ':' + String(dk % 60).padStart(2, '0');
}
PZA.dkSaat = dkSaat;

/** Tek bir dilimin HTML'i. `kayitlar` o dilime düşen notlar.
    Not tam dilim sınırındaysa çipin saatini YAZMAYIZ — dilim başlığı
    zaten aynı saati gösteriyor, tekrar görsel gürültüdür. Sınırda
    değilse (12:35 → 12:30 dilimi) gerçek saat tek yerde buradan
    okunur, o yüzden şart. */
function slotHtml(dk, kayitlar, simdi) {
  const etiket = dkSaat(dk);

  const satirlar = kayitlar.map(n => `
    <div class="note-row ${n.star ? 'starred' : ''}" data-t="${esc(n.t)}" data-x="${esc(n.x)}">
      ${STAR.replace('class="star"', 'class="star' + (n.star ? ' on' : '') + '"')}
      <span class="nt-x">${esc(n.x)}</span>
      ${n.t === etiket ? '' : `<span class="t">${esc(n.t)}</span>`}
      ${n.star ? '<span class="tag">Önemli</span>' : ''}
      <span class="del" title="Sil">✕</span>
    </div>`).join('');

  return `<div class="nt-slot ${kayitlar.length ? 'has' : ''} ${simdi ? 'now' : ''}"
      data-dk="${dk}" role="listitem">
      <span class="nt-t">${etiket}</span>
      <div class="nt-items">${satirlar}</div>
    </div>`;
}

/** Özet alt satırı. Taslaktaki "10 dk. önce bildirim alacaksınız"
    cümlesi BİLEREK yok: uygulamada bildirim özelliği yok, olmayan
    bir davranışı vaat eden yazı yazılmaz. */
function renderSub(list) {
  const el = document.getElementById('notes-sub');
  if (!el) return;
  if (!list.length) {
    el.textContent = 'Eklemek için soldaki tarih düğmesine dokunun.';
    return;
  }
  const onemli = list.filter(n => n.star).length;
  const parca = [];
  parca.push(onemli
    ? onemli + ' tanesi önemli işareti taşıyor'
    : 'Önemli işaretli kayıt yok');
  parca.push('30 dakikalık dilimler');
  el.textContent = parca.join(' · ');
}

/* Açılışta ızgaranın kaydırıldığı gün. Her not işleminde yeniden
   kaydırmak kullanıcının baktığı yeri elinden alırdı; yalnızca gün
   değişince bir kez kaydırılır. */
let kaydirilanGun = null;

/** Açılır panel: başlık → özet → 00:00-24:00 zaman ızgarası */
PZA.renderNotes = function () {
  PZA.renderPreview();
  PZA.renderDayHead();

  const gridEl = document.getElementById('notes-list');
  if (!gridEl) return;

  const key  = PZA.activeDay || PZA.todayKey();
  const list = PZA.dayNotes();

  // `textContent` doğrudan atanır: sayı `#notes-count` içinde durur,
  // özet cümlesi HTML'de sabittir (dış veri içermez).
  const cntEl = document.getElementById('notes-count');
  if (cntEl) cntEl.textContent = list.length;
  renderSub(list);

  // Dilim → o dilime düşen notlar
  const kova = new Map();
  for (const n of list) {
    const d = dilimle(n.t);
    if (!kova.has(d)) kova.set(d, []);
    kova.get(d).push(n);
  }

  // "Şimdi" yalnızca bugün görüntülenirken işaretlenir
  let simdiDilim = -1;
  if (key === PZA.todayKey()) {
    const d = new Date();
    simdiDilim = Math.floor((d.getHours() * 60 + d.getMinutes()) / DILIM_DK) * DILIM_DK;
  }

  /* Satırlar EŞLEŞTİRİLEREK çizilir: her satırda solda 1. yarı, sağda
     2. yarı (12 saat sonrası). İki bağımsız sütun olsaydı bir taraftaki
     not çipi satırı büyütür, öbür sütun kayar ve saatler hizasız
     görünürdü. */
  const yariDk = (DILIM_SAY / 2) * DILIM_DK;
  const satirlar = [];
  for (let d = 0; d < yariDk; d += DILIM_DK) {
    const sag = d + yariDk;
    satirlar.push('<div class="nt-row">'
      + slotHtml(d, kova.get(d) || [], d === simdiDilim)
      + slotHtml(sag, kova.get(sag) || [], sag === simdiDilim)
      + '</div>');
  }
  gridEl.innerHTML = satirlar.join('');

  /* Gün değiştiyse anlamlı yere kaydır: en erken not, yoksa şimdiki
     saat. DİKKAT: DOM'daki ilk `.has` yanlış hedeftir — satırlar
     eşleştirilmiş olduğundan DOM sırası 00:00, 12:00, 00:30, 12:30…
     diye gider; saat sırasına göre en erken not aranır.
     `clientHeight > 0` ŞART: panel kapalıyken ölçüler sıfır çıkar,
     kaydırma boşa gider ve gün "işlenmiş" sayılıp bir daha denenmez. */
  if (kaydirilanGun !== key && gridEl.clientHeight > 0
      && typeof gridEl.scrollTop === 'number'
      && typeof gridEl.querySelector === 'function') {
    kaydirilanGun = key;
    const notlar = [...kova.keys()].sort((a, b) => a - b);
    const hedefDk = notlar.length ? notlar[0] : simdiDilim;
    const hedef = hedefDk >= 0 ? gridEl.querySelector(`.nt-slot[data-dk="${hedefDk}"]`) : null;
    if (hedef) {
      gridEl.scrollTop = Math.max(0, hedef.offsetTop - gridEl.clientHeight / 2 + hedef.offsetHeight / 2);
    }
  }
};

/* ── Panel aç/kapa ───────────────────────────────────── */
PZA.toggleNotes = function (force) {
  const panel = document.getElementById('panel-notes');
  const btn = document.getElementById('btn-notes');
  const open = force !== undefined ? force : panel.hidden;

  panel.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) {
    PZA.closeWeather?.(); PZA.closeCal();   // her açılışta liste görünsün
    /* Açılışta tazele: ızgara kapalıyken çizilmişse kaydırma
       yapılamamıştır (yükseklik 0) ve bu arada gün değişmiş olabilir.
       `kaydirilanGun` sıfırlanınca ızgara ilk dolu dilime kayar. */
    kaydirilanGun = null;
    PZA.renderNotes();
  }
  PZA.emit('panel:notes', open);
};

PZA.closeNotes = function () { PZA.toggleNotes(false); PZA.closeCal(); };

/* ── Takvim ──────────────────────────────────────────────
   Açılır pencere değil, akış içinde bir bölme: `.widget`
   `overflow: hidden` olduğu için dışarı taşan bir popover
   kırpılırdı. Takvim açılınca not listesi gizlenir. */
PZA.calOpen = function () {
  const c = document.getElementById('cal');
  return !!(c && !c.hidden);
};

PZA.openCal = function (on) {
  const cal = document.getElementById('cal');
  if (!cal) return;
  const ac = on !== undefined ? on : cal.hidden;

  cal.hidden = !ac;
  /* Not listesi GİZLENMEZ: katman onun üstüne oturuyor ve panelin
     yüksekliğini listeden alıyor. Gizlenirse panel sıfıra iner,
     `inset: 0` katmanı da kırpılırdı. */
  document.getElementById('panel-notes')?.classList.toggle('sheet', ac);
  document.getElementById('notes-day-btn')?.setAttribute('aria-expanded', String(ac));

  if (ac) {
    const key = PZA.activeDay || PZA.todayKey();
    const [y, m] = String(key).split('-').map(Number);
    PZA.calY = y; PZA.calM = m - 1;      // her açılışta seçili ayda başla
    PZA.renderCal();
    // Saat alanını hazırla: bugüne bakılıyorsa şimdiki saat, başka
    // güne bakılıyorsa 09:00. Kullanıcı çoğu kez bunu değiştirmez.
    const saat = document.getElementById('note-time');
    if (saat) saat.value = key === PZA.todayKey() ? PZA.simdiSaat() : '09:00';
  }
  PZA.emit('calendar:toggle', ac);
};

/** Şimdiki saat, sonraki yarım saate yuvarlı — "09:41" → "10:00" */
PZA.simdiSaat = function () {
  const d = new Date();
  const dk = Math.ceil((d.getHours() * 60 + d.getMinutes()) / DILIM_DK) * DILIM_DK;
  return dk >= 24 * 60 ? '23:30' : dkSaat(dk);
};

PZA.closeCal = function () { PZA.openCal(false); };

PZA.calShift = function (delta) {
  let m = PZA.calM + delta;
  let y = PZA.calY + Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  PZA.calY = y; PZA.calM = m;
  PZA.renderCal();
};

PZA.renderCal = function () {
  const grid = document.getElementById('cal-grid');
  if (!grid || PZA.calY === null) return;

  const y = PZA.calY, m = PZA.calM;
  const title = document.getElementById('cal-title');
  if (title) title.textContent = PZA.AYLAR[m] + ' ' + y;

  const bugun  = PZA.todayKey();
  const secili = PZA.activeDay || bugun;
  const lead   = (new Date(y, m, 1).getDay() + 6) % 7;   // Pazartesi ilk sütun

  const hucre = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(y, m, 1 - lead + i);
    const iso = PZA.isoOf(dt.getFullYear(), dt.getMonth(), dt.getDate());
    hucre.push({
      iso,
      g: dt.getDate(),
      adet: (PZA.notes[iso] || []).length,
      disari: dt.getMonth() !== m,
      bugun: iso === bugun,
      secili: iso === secili
    });
  }

  grid.innerHTML = hucre.map(c => {
    const sinif = 'cal-d'
      + (c.disari ? ' out' : '')
      + (c.bugun ? ' today' : '')
      + (c.secili ? ' sel' : '')
      + (c.adet ? ' has' : '');
    const ipucu = c.adet ? c.adet + ' not' : 'Not yok';
    return `<button type="button" class="${sinif}" data-day="${c.iso}" title="${ipucu}">${c.g}</button>`;
  }).join('');
};
