/* settings.js — ayar deposu, skin tanımları, DOM'a uygulama
   Palet Zaman Asistanı · GPL-3.0 */
window.PZA = window.PZA || {};

/* ── Skin kataloğu ──────────────────────────────────────
   Winamp mantığı: her skin bir token seti. Kullanıcı skin'i
   eklemek için buraya bir kayıt + CSS'te [data-skin="id"] bloğu yeter. */
PZA.SKINS = [
  { id: 'halo',    name: 'Halo',    swatch: 'linear-gradient(135deg,#101722,#06b6d4)', note: 'Orijinal uzay teması' },
  { id: 'klasik',  name: 'Klasik',  swatch: 'linear-gradient(135deg,#1c1f24,#9aa4b2)', note: 'Düz antrasit' },
  { id: 'neon',    name: 'Neon',    swatch: 'linear-gradient(135deg,#1a0f2e,#e879f9)', note: 'Mor–pembe parıltı' },
  { id: 'minimal', name: 'Minimal', swatch: 'linear-gradient(135deg,#0f0f0f,#fafafa)', note: 'Monokrom' }
];

PZA.DEFAULTS = {
  skin: 'halo',
  theme: 'dark',
  size: '2',          // 2 = 1/2 · 3 = 1/3 · 4 = 1/4
  weather: true,
  preview: true,      // not başlıkları şeridi
  seconds: true,
  speech: false,      // her saat başı sesli okuma
  voice: 'female',    // okuyucu sesi: female | male
  alwaysOnTop: true,  // kapatılınca widget diğer pencerelerin arkasına geçebilir
  autostart: false,
  city: null,         // { name, lat, lon }
  gcal: false
};

const KEY = 'pza.settings.v1';

/* ── Basit olay yolu ─────────────────────────────────── */
const listeners = {};
PZA.on  = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
PZA.emit = (ev, data) => (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

/* ── Depo ─────────────────────────────────────────────── */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign({}, PZA.DEFAULTS, JSON.parse(raw));
  } catch (e) { console.warn('ayar okunamadı', e); }
  return Object.assign({}, PZA.DEFAULTS);
}

PZA.settings = load();

PZA.save = function () {
  try { localStorage.setItem(KEY, JSON.stringify(PZA.settings)); }
  catch (e) { console.warn('ayar yazılamadı', e); }
};

/** Ayar değiştir → kaydet → uygula → duyur */
PZA.set = function (key, value) {
  PZA.settings[key] = value;
  PZA.save();
  PZA.apply();
  PZA.emit('change', { key, value });
};

/* ── Ayarları DOM'a yansıt ───────────────────────────── */
PZA.apply = function () {
  const s = PZA.settings;

  const w = document.getElementById('widget');
  if (!w) return;
  w.dataset.skin  = s.skin;          // kullanıcı skiniyse applySkin 'ozel' yazar
  w.dataset.theme = s.theme;
  w.dataset.size  = s.size;

  w.classList.toggle('hide-weather', !s.weather);
  w.classList.toggle('hide-preview', !s.preview);
  w.classList.toggle('hide-seconds', !s.seconds);

  // Alt bardaki tema göstergesi
  const label = document.getElementById('theme-label');
  if (label) label.textContent = s.theme === 'dark' ? 'Karanlık' : 'Aydınlık';
  document.getElementById('btn-light')?.classList.toggle('on', s.theme === 'light');
  document.getElementById('btn-dark')?.classList.toggle('on', s.theme === 'dark');

  // Ayarlar panelindeki kontroller
  const bind = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  bind('opt-weather', s.weather);
  bind('opt-preview', s.preview);
  bind('opt-seconds', s.seconds);
  bind('opt-speech', s.speech);
  bind('opt-ontop', s.alwaysOnTop);
  bind('opt-autostart', s.autostart);

  // Okuyucu: Ece / Emre
  document.querySelectorAll('[data-voice]').forEach(b =>
    b.classList.toggle('on', b.dataset.voice === (s.voice === 'male' ? 'male' : 'female')));
  const vn = document.getElementById('voice-name');
  if (vn) vn.textContent = PZA.voiceLabel ? PZA.voiceLabel(s.voice) : '—';

  document.querySelectorAll('[data-theme-set]').forEach(b =>
    b.classList.toggle('on', b.dataset.themeSet === s.theme));
  document.querySelectorAll('input[name="size"]').forEach(r =>
    r.checked = r.value === s.size);

  PZA.renderSkins();

  // Şehir çipleri
  const chips = document.getElementById('city-chips');
  if (chips && s.city) {
    // Şehir adı geocoding API'sinden gelir — dış veri, kaçış şart
    chips.innerHTML = `<button data-city-clear>${PZA.escHtml(s.city.name)} ✕</button>`;
  } else if (chips) {
    chips.innerHTML = '<span style="font-size:10px;color:var(--fg-mute)">Henüz şehir seçilmedi.</span>';
  }

  // Kullanıcı skini aktifse token'ları satır içi olarak uygula
  PZA.applySkin && PZA.applySkin();
};

/* ── Skin listesi + seçili skin çubuğu ────────────────────
   Ayrı fonksiyon: stüdyo kaydettikten sonra yalnızca burası
   tazelenir. Tüm PZA.apply() çağrılsaydı stüdyonun tema
   önizlemesi (açık/karanlık sekmesi) sıfırlanırdı. */
PZA.renderSkins = function () {
  const s = PZA.settings;

  const list = document.getElementById('skin-list');
  if (list) {
    const builtin = PZA.SKINS.map(sk => ({ id: sk.id, name: sk.name, swatch: sk.swatch, note: sk.note }));
    const custom = PZA.customSkins().map(sk => ({
      id: 'user:' + sk.id,
      name: sk.name || 'İsimsiz',
      swatch: PZA.skinSwatch(sk),
      note: sk.author ? ('Yapan: ' + sk.author) : 'Kendi skinim',
      custom: true
    }));

    const E = PZA.escHtml;
    list.innerHTML = builtin.concat(custom).map(sk => `
      <button class="skin-card ${sk.id === s.skin ? 'on' : ''}" data-skin-set="${E(sk.id)}" title="${E(sk.note)}">
        <div class="skin-thumb" style="background:${E(sk.swatch)}"></div>
        <span>${E(sk.name)}</span>
        ${sk.custom ? '<i class="skin-flag">✎</i>' : ''}
      </button>`).join('')
      + `<button class="skin-card skin-new" data-skin-new="1" title="Kendi skinini tasarla">
           <div class="skin-thumb">＋</div><span>Yeni</span>
         </button>`;
  }

  // Seçili skin kullanıcı skiniyse altındaki çubuğu göster
  const bar = document.getElementById('skin-bar');
  if (bar) {
    const cur = PZA.skinById(String(s.skin).replace(/^user:/, ''));
    const on = String(s.skin).indexOf('user:') === 0 && cur;
    bar.hidden = !on;
    if (on) {
      bar.dataset.skinId = cur.id;
      document.getElementById('skin-bar-name').textContent = cur.name || 'İsimsiz';
    }
  }

};
