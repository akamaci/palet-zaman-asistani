/* log.js — hafif olay/hata günlüğü
   Palet Zaman Asistanı · GPL-3.0 */
window.PZA = window.PZA || {};

PZA.LOG = { acik: true, enFazla: 200, halka: [] };

PZA.logYaz = function (seviye, mesaj, baglam) {
  if (!PZA.LOG.acik) return;
  const g = { t: new Date().toISOString(), s: seviye, m: String(mesaj) };
  if (baglam !== undefined) g.b = baglam;
  PZA.LOG.halka.push(g);
  if (PZA.LOG.halka.length > PZA.LOG.enFazla) PZA.LOG.halka.shift();
  try {
    if (seviye === 'hata') console.error('[PZA]', mesaj, baglam || '');
    else if (seviye === 'uyari') console.warn('[PZA]', mesaj, baglam || '');
    else console.log('[PZA]', mesaj, baglam || '');
  } catch (e) { /* konsol yoksa önemli değil */ }
};

PZA.logDok = function () {
  return PZA.LOG.halka.map(g =>
    (g.t || '').slice(11, 19) + ' [' + g.s + '] ' + g.m +
    (g.b ? '  ← ' + JSON.stringify(g.b) : '')
  ).join('\n');
};

PZA.logKopyala = async function () {
  const metin = PZA.logDok() || 'Günlük boş.';
  try { await navigator.clipboard.writeText(metin); return true; }
  catch (e) { return false; }
};

window.addEventListener('error', e =>
  PZA.logYaz('hata', 'JS hatası: ' + (e.message || 'bilinmeyen'),
    { dosya: String(e.filename || '').split('/').pop(), satir: e.lineno }));

window.addEventListener('unhandledrejection', e =>
  PZA.logYaz('hata', 'Beklenmeyen söz reddi: ' +
    ((e.reason && (e.reason.message || e.reason)) || 'bilinmeyen')));
