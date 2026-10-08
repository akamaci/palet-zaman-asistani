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

/** Başka bir güne geç */
PZA.selectDay = function (key) {
  PZA.activeDay = key || PZA.todayKey();
  PZA.closeCal();
  PZA.renderNotes();
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
    bar.innerHTML = `<span style="color:var(--fg-mute);font-size:11px">${kim} için not yok — sağdaki oktan ekleyin.</span>`;
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

/** Açılır panel: sol tarih sütunu + sağ zaman çizelgesi */
PZA.renderNotes = function () {
  PZA.renderPreview();
  PZA.renderDayHead();

  const listEl = document.getElementById('notes-list');
  const cntEl = document.getElementById('notes-count');
  if (!listEl) return;

  const list = PZA.dayNotes();
  if (cntEl) cntEl.textContent = list.length;

  if (!list.length) {
    const bugun = (PZA.activeDay || PZA.todayKey()) === PZA.todayKey();
    listEl.innerHTML = '<div class="notes-empty">'
      + (bugun ? 'Bugün için not yok.' : 'Bu güne ait not yok.')
      + ' Aşağıdaki alandan ekleyebilirsiniz.</div>';
    return;
  }

  listEl.innerHTML = list.map(n => `
    <div class="note-row ${n.star ? 'starred' : ''}" data-t="${esc(n.t)}" data-x="${esc(n.x)}">
      ${STAR.replace('class="star"', 'class="star' + (n.star ? ' on' : '') + '"')}
      <span class="t">${esc(n.t)}</span>
      <span class="x">${esc(n.x)}</span>
      ${n.star ? '<span class="tag">Önemli</span>' : ''}
      <span class="del" title="Sil">✕</span>
    </div>`).join('');
};

/* ── Panel aç/kapa ───────────────────────────────────── */
PZA.toggleNotes = function (force) {
  const panel = document.getElementById('panel-notes');
  const btn = document.getElementById('btn-notes');
  const open = force !== undefined ? force : panel.hidden;

  panel.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) { PZA.closeWeather?.(); PZA.closeCal(); }   // her açılışta liste görünsün
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
  const main = document.getElementById('notes-main');
  if (main) main.hidden = ac;
  document.getElementById('notes-day-btn')?.setAttribute('aria-expanded', String(ac));

  if (ac) {
    const [y, m] = String(PZA.activeDay || PZA.todayKey()).split('-').map(Number);
    PZA.calY = y; PZA.calM = m - 1;      // her açılışta seçili ayda başla
    PZA.renderCal();
  }
  PZA.emit('calendar:toggle', ac);
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
