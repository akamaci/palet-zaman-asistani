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

/** Bir günün notları — saate göre sıralı */
PZA.dayNotes = function (key) {
  const list = PZA.notes[key || PZA.todayKey()] || [];
  return [...list].sort((a, b) => a.t.localeCompare(b.t));
};

PZA.addNote = function (t, x) {
  if (!x || !x.trim()) return false;
  const key = PZA.todayKey();
  (PZA.notes[key] = PZA.notes[key] || []).push({ t, x: x.trim(), star: false });
  PZA.saveNotes(); PZA.renderNotes();
  PZA.emit('notes:changed');
  PZA.gcalPush?.({ t, x: x.trim(), date: key });   // takvim bağlıysa gönder
  return true;
};

PZA.removeNote = function (t, x) {
  const key = PZA.todayKey();
  const list = PZA.notes[key] || [];
  const i = list.findIndex(n => n.t === t && n.x === x);
  if (i < 0) return;
  list.splice(i, 1);
  PZA.saveNotes(); PZA.renderNotes();
  PZA.emit('notes:changed');
};

PZA.toggleStar = function (t, x) {
  const key = PZA.todayKey();
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
    bar.innerHTML = `<span style="color:var(--fg-mute);font-size:11px">Bugün için not yok — sağdaki oktan ekleyin.</span>`;
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

/** Açılır panel: sol tarih sütunu + sağ zaman çizelgesi */
PZA.renderNotes = function () {
  PZA.renderPreview();

  const listEl = document.getElementById('notes-list');
  const cntEl = document.getElementById('notes-count');
  if (!listEl) return;

  const list = PZA.dayNotes();
  if (cntEl) cntEl.textContent = list.length;

  if (!list.length) {
    listEl.innerHTML = `<div style="padding:18px var(--pad);color:var(--fg-mute);font-size:12px">
      Bu güne ait not yok. Aşağıdaki alandan ekleyebilirsiniz.</div>`;
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
  if (open) PZA.closeWeather?.();
  PZA.emit('panel:notes', open);
};

PZA.closeNotes = function () { PZA.toggleNotes(false); };
