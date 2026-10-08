/* weather.js — Open-Meteo: geocoding + 7 günlük tahmin
   Palet Zaman Asistanı · GPL-3.0
   Anahtar gerekmez. Sonuç 20 dk önbelleğe alınır (kaynak kuralı). */
window.PZA = window.PZA || {};

const WKEY = 'pza.weather.v1';
const CACHE_MS = 20 * 60 * 1000;   // 20 dakika

/* WMO hava kodu → Türkçe etiket + simge */
const WMO = {
  0:  ['Açık', '☀'],
  1:  ['Az bulutlu', '🌤'],
  2:  ['Parçalı bulutlu', '⛅'],
  3:  ['Kapalı', '☁'],
  45: ['Sisli', '🌫'], 48: ['Kırağılı sis', '🌫'],
  51: ['Hafif çisenti', '🌦'], 53: ['Çisenti', '🌦'], 55: ['Yoğun çisenti', '🌦'],
  56: ['Dondurucu çisenti', '🌧'], 57: ['Dondurucu çisenti', '🌧'],
  61: ['Hafif yağmur', '🌧'], 63: ['Yağmur', '🌧'], 65: ['Şiddetli yağmur', '🌧'],
  66: ['Dondurucu yağmur', '🌧'], 67: ['Dondurucu yağmur', '🌧'],
  71: ['Hafif kar', '🌨'], 73: ['Kar', '🌨'], 75: ['Yoğun kar', '🌨'], 77: ['Kar taneleri', '🌨'],
  80: ['Hafif sağanak', '🌦'], 81: ['Sağanak', '🌦'], 82: ['Şiddetli sağanak', '⛈'],
  85: ['Kar sağanağı', '🌨'], 86: ['Yoğun kar sağanağı', '🌨'],
  95: ['Gök gürültülü fırtına', '🌩'], 96: ['Dolulu fırtına', '⛈'], 99: ['Şiddetli dolulu fırtına', '⛈']
};

const wmo = c => WMO[c] || ['Bilinmiyor', '•'];

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(WKEY));
    if (c && Date.now() - c.at < CACHE_MS) return c.data;
  } catch {}
  return null;
}
function writeCache(data) {
  try { localStorage.setItem(WKEY, JSON.stringify({ at: Date.now(), data })); } catch {}
}

/* ── Şehir arama (geocoding) ─────────────────────────── */
PZA.searchCity = async function (name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=tr&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Geocoding hatası: ' + r.status);
  const j = await r.json();
  return (j.results || []).map(x => ({
    name: x.name,
    admin: x.admin1 || '',
    country: x.country_code || '',
    lat: x.latitude,
    lon: x.longitude,
    label: [x.name, x.admin1, x.country_code].filter(Boolean).join(', ')
  }));
};

/* ── Tahmin çekme ────────────────────────────────────── */
async function fetchForecast(city) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', city.lat);
  u.searchParams.set('longitude', city.lon);
  u.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,pressure_msl');
  u.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset');
  u.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability');
  u.searchParams.set('timezone', 'auto');
  u.searchParams.set('forecast_days', '7');

  const r = await fetch(u);
  if (!r.ok) throw new Error('Tahmin hatası: ' + r.status);
  return r.json();
}

/** Şehir için hava verisini yükle (önbellekli) */
PZA.loadWeather = async function (force) {
  const city = PZA.settings.city;
  if (!city) { renderEmpty(); return null; }

  if (!force) {
    const cached = readCache();
    if (cached && cached.city?.name === city.name) { render(cached); return cached; }
  }

  try {
    const data = await fetchForecast(city);
    const payload = { city, data, fetchedAt: Date.now() };
    writeCache(payload);
    render(payload);
    PZA.emit('weather:loaded', payload);
    return payload;
  } catch (e) {
    console.warn('hava durumu alınamadı', e);
    const stale = (() => { try { return JSON.parse(localStorage.getItem(WKEY))?.data; } catch { return null; } })();
    if (stale) render(stale, true);
    else renderError(e.message);
    return null;
  }
};

/* ── Çizim ───────────────────────────────────────────── */
function renderEmpty() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('weather-temp', '--°');
  set('weather-city', 'İl seç');
  set('weather-desc', 'ayarlardan şehir seçin');
  PZA.emit('weather:empty');
}

function renderError(msg) {
  const el = document.getElementById('weather-desc');
  if (el) el.textContent = 'veri yok — tekrar denenecek';
  console.warn(msg);
}

function render(payload, stale) {
  const { city, data } = payload;
  const cur = data.current;
  const daily = data.daily;
  const [desc, ic] = wmo(cur.weather_code);

  /* Üst bardaki kutucuk */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('weather-temp', Math.round(cur.temperature_2m) + '°');
  set('weather-city', city.name);
  set('weather-desc', desc);
  const g = document.getElementById('weather-glyph');
  if (g) g.textContent = ic;

  /* Açılır panel */
  set('wx-city', city.name);
  set('wx-temp', Math.round(cur.temperature_2m) + '°');
  set('wx-desc', desc);
  set('wx-feels', Math.round(cur.apparent_temperature) + '°');

  const tel = document.getElementById('wx-telemetry');
  if (tel) {
    tel.innerHTML = [
      ['Nem', cur.relative_humidity_2m + '%'],
      ['Rüzgâr', Math.round(cur.wind_speed_10m) + ' km/s'],
      ['Basınç', Math.round(cur.pressure_msl) + ' hPa'],
      ['Yağış ihtimali', (daily.precipitation_probability_max?.[0] ?? '--') + '%']
    ].map(([k, v]) => `<div class="tl-row"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  /* Gün doğumu / batımı yayı */
  const sr = daily.sunrise?.[0]?.slice(11, 16) || '--:--';
  const ss = daily.sunset?.[0]?.slice(11, 16) || '--:--';
  set('wx-sunrise', '↑ ' + sr);
  set('wx-sunset', '↓ ' + ss);

  const dot = document.getElementById('wx-dot');
  if (dot) {
    const [sh, sm] = sr.split(':').map(Number);
    const [eh, em] = ss.split(':').map(Number);
    const now = new Date();
    const t = now.getHours() * 60 + now.getMinutes();
    const a = sh * 60 + sm, b = eh * 60 + em;
    const pct = b > a ? Math.min(100, Math.max(0, ((t - a) / (b - a)) * 100)) : 50;
    dot.style.left = pct + '%';
  }

  /* Uyarı şeridi — sağanak/fırtına varsa */
  const alert = document.getElementById('weather-alert');
  if (alert) {
    const warn = daily.weather_code?.slice(0, 2).find(c => c >= 80) ?? daily.weather_code?.[0];
    if (warn >= 80) {
      alert.hidden = false;
      alert.textContent = `⚠ Bugün ${wmo(warn)[0].toLowerCase()} bekleniyor.`;
    } else alert.hidden = true;
  }

  /* 7 günlük liste */
  const week = document.getElementById('wx-week');
  if (week) {
    const gn = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
    week.innerHTML = daily.time.map((iso, i) => {
      const d = new Date(iso + 'T12:00:00');
      const [dd, di] = wmo(daily.weather_code[i]);
      const today = i === 0;
      return `<div class="wk-row ${today ? 'today' : ''}">
        <span class="wk-day">${today ? 'Bugün' : gn[d.getDay()]} ${d.getDate()}</span>
        <span class="wk-ico" title="${dd}">${di}</span>
        <span class="wk-pop">${daily.precipitation_probability_max?.[i] ?? '--'}%</span>
        <span class="wk-temp"><b>${Math.round(daily.temperature_2m_max[i])}°</b> ${Math.round(daily.temperature_2m_min[i])}°</span>
      </div>`;
    }).join('');
  }

  if (stale) {
    const el = document.getElementById('weather-desc');
    if (el) el.textContent = desc + ' (eski veri)';
  }
}

/* ── Panel aç/kapa ───────────────────────────────────── */
PZA.toggleWeather = function (force) {
  const panel = document.getElementById('panel-weather');
  const open = force !== undefined ? force : panel.hidden;
  panel.hidden = !open;
  if (open) { PZA.closeNotes?.(); PZA.loadWeather(); }
  PZA.emit('panel:weather', open);
};

PZA.closeWeather = function () { PZA.toggleWeather(false); };

/* Pencere öne gelince ve 20 dk'da bir tazele */
PZA.startWeatherRefresh = function () {
  PZA.loadWeather();
  setInterval(() => { if (!document.hidden) PZA.loadWeather(); }, CACHE_MS);
};
