/* sahte-dom.mjs — testler için ASGARİ ama GERÇEK davranışlı DOM ortamı
   Palet Zaman Asistanı · GPL-3.0

   Neden gerekli: mevcut testler `src/js/*.js` dosyalarını metin olarak
   tarıyordu (regex). Metin taraması "dosya yüklendi mi, çalışıyor mu"
   sorusunu YANITLAMAZ. 2026-10-19'da kullanıcı "hava durumu çalışmıyor,
   randevu kaydı açılmıyor" dedi; kök neden notes.js içindeki bir YAZIM
   HATASIYDI (`dinlenebilir` ↔ `dinleyebilir`): ReferenceError dosyanın
   geri kalanını (takvim + PZA.openCal + PZA.closeCal) hiç tanımlamadı.
   Hiçbir regex testi bunu göremezdi.

   Bu ortam: index.html'deki etiketleri/öznitelikleri okuyup id→etiket
   eşlemesi kurar, olay KÖPÜRMESİ (bubbling) yapar ve `localStorage`
   gibi tarayıcı API'lerini taklit eder. Böylece `src/js/*.js` dosyaları
   Node içinde GERÇEKTEN çalıştırılabilir ve testler davranışı ölçer. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const KOK = path.join(import.meta.dirname, '..') + path.sep;

/** index.html'deki <script src> sırası — tarayıcıdaki yükleme sırası. */
export const SIRA = (() => {
  const html = fs.readFileSync(KOK + 'src' + path.sep + 'index.html', 'utf8');
  return [...html.matchAll(/<script\s+src="(js\/[^"]+)"/g)].map(m => m[1]);
})();

/* index.html'den id → { etiket, öznitelikler } çıkar. Etiket adı
   `applyLock` için gerekir (BUTTON'a taşıma bölgesi konmaz). */
const HTML = (() => {
  const html = fs.readFileSync(KOK + 'src' + path.sep + 'index.html', 'utf8');
  const harita = new Map();
  const etiketRe = /<([a-zA-Z][\w-]*)\b([^>]*)>/g;
  let m;
  while ((m = etiketRe.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === 'script' || tag === 'meta' || tag === 'link') continue;
    const attrMetni = m[2];
    const idEş = /\bid="([^"]+)"/.exec(attrMetni);
    if (!idEş) continue;
    const attr = {};
    const aRe = /([\w:.-]+)(?:\s*=\s*"([^"]*)")?/g;
    let a;
    while ((a = aRe.exec(attrMetni))) {
      if (a[1] === 'id') continue;
      attr[a[1]] = a[2] === undefined ? '' : a[2];
    }
    harita.set(idEş[1], { etiket: tag.toUpperCase(), attr, hidden: 'hidden' in attr });
  }
  return harita;
})();

/* index.html'in gerçek AİLE yapısı (olay köpürmesi için gerekli).
   Yalnız testlerde yolu kullanılan öğeler listelenir; listelenmeyen
   öğelerin ebeveyni olmaz (gerçekte de erişilemez demektir). */
const EBEVEYN = {
  widget: 'body',
  'plate-layers': 'widget', 'plate-drag': 'widget',
  'bar-top': 'widget', 'bar-bottom': 'widget',
  'group-left': 'bar-top', 'group-center': 'bar-top', 'group-right': 'bar-top',
  'weather-tile': 'group-left', 'btn-notes': 'group-right', 'btn-lock': 'group-right',
  'panel-notes': 'widget', 'panel-weather': 'widget',
  'notes-day-btn': 'panel-notes', 'notes-list': 'panel-notes', 'cal': 'panel-notes',
  'note-text': 'cal', 'note-save': 'cal', 'note-time': 'cal',
  'cal-grid': 'cal', 'cal-prev': 'cal', 'cal-next': 'cal', 'cal-today': 'cal',
  'pa-modal': 'body', settings: 'body', studio: 'body', 'ezan-menu': 'body'
};

function stilNesnesi() {
  const p = {};
  return new Proxy(p, {
    get(t, k) {
      if (k === 'setProperty') return (a, b) => { t[a] = b; };
      if (k === 'getPropertyValue') return a => (t[a] === undefined ? '' : t[a]);
      if (k === 'removeProperty') return a => { delete t[a]; return ''; };
      if (k === 'cssText') return t.cssText || '';
      if (typeof k === 'symbol') return undefined;
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function sinifListesi(el) {
  const kume = new Set();
  return {
    add: (...s) => s.forEach(x => x && kume.add(x)),
    remove: (...s) => s.forEach(x => kume.delete(x)),
    contains: s => kume.has(s),
    toggle(s, zorla) {
      const ac = zorla === undefined ? !kume.has(s) : !!zorla;
      if (ac) kume.add(s); else kume.delete(s);
      return ac;
    },
    get value() { return [...kume].join(' '); },
    _kume: kume
  };
}

/** Çok basit seçici eşleme: "div", "#id", ".sinif", "[attr]" ve bunların
    virgüllü birleşimleri. Yalnız testlerde çağrılan seçiciler gerekir. */
function seciciUyar(el, secici) {
  return String(secici).split(',').some(tek => {
    const s = tek.trim();
    if (!s) return false;
    const parcalar = s.match(/^[\w*]*(#[^.[\s]+)?(\.[^[\s]+)?(\[.*\])?/);
    if (!parcalar) return false;
    const [, id, sinif, attr] = parcalar;
    if (id && el.id !== id.slice(1)) return false;
    if (sinif) {
      const ad = sinif.slice(1);
      /* `className` (HTML'den gelen) ile `classList` (JS'in eklediği)
         AYRI tutulur; seçici ikisini de görmeli. */
      const siniflar = String(el.className || '').split(/\s+/);
      if (!el.classList.contains(ad) && !siniflar.includes(ad)) return false;
    }
    if (attr) {
      const ad = attr.slice(1, -1).split('=')[0];
      if (!el.hasAttribute(ad)) return false;
    }
    return true;
  });
}

export function sahteDomKur(ayar = {}) {
  /* `hazir` GERÇEKÇİ olmalı: index.html'deki betikler sayfa HÂLÂ
     yüklenirken çalışır (readyState = 'loading'). Node testinde bunu
     'complete' yapmak bir yazım hatasını GİZLER: `a && b` ifadesinde
     `a` false ise `b` hiç değerlendirilmez. (2026-10-19: tam da bu
     yüzden `dinlenebilir` hatası testten kaçtı.) */
  const hazir = ayar.hazir || 'loading';
  const tumDugumler = new Map();      // anahtar → Eleman ("body"/"html" dahil)

  class Eleman {
    constructor(id = '') {
      this.id = id;
      this.tagName = (HTML.get(id)?.etiket) || 'DIV';
      this.parentElement = null;
      this.hidden = HTML.get(id)?.hidden || false;
      this.textContent = '';
      this.value = '';
      this.disabled = false;
      this.checked = false;
      this.type = '';
      this.title = '';
      this.clientHeight = 0;
      this.clientWidth = 0;
      this.offsetHeight = 0;
      this.offsetWidth = 0;
      this.offsetTop = 0;
      this.scrollTop = 0;
      this.scrollHeight = 0;
      this.scrollLeft = 0;
      this.style = stilNesnesi();
      this.dataset = {};
      this.classList = sinifListesi(this);
      this._attr = new Map();
      this._cocuklar = [];
      this._dinleyici = new Map();
      this._html = null;
      const a = HTML.get(id)?.attr || {};
      Object.keys(a).forEach(k => {
        this._attr.set(k, a[k]);
        if (k.startsWith('data-')) {
          this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = a[k];
        }
      });
    }

    /* ── öznitelikler ───────────────────────────────── */
    setAttribute(k, v) { this._attr.set(String(k), String(v)); }
    getAttribute(k) { return this._attr.has(k) ? this._attr.get(k) : null; }
    hasAttribute(k) { return this._attr.has(k); }
    removeAttribute(k) { this._attr.delete(k); }
    get className() { return this._attr.get('class') || ''; }
    set className(v) { this._attr.set('class', String(v)); }

    /* ── ağaç ───────────────────────────────────────── */
    get children() { return this._cocuklar; }
    get firstChild() { return this._cocuklar[0] || null; }
    appendChild(c) { if (c.parentElement) c.parentElement.removeChild(c); c.parentElement = this; this._cocuklar.push(c); return c; }
    insertBefore(c, ref) {
      if (c.parentElement) c.parentElement.removeChild(c);
      const i = this._cocuklar.indexOf(ref);
      if (i < 0) this._cocuklar.push(c); else this._cocuklar.splice(i, 0, c);
      c.parentElement = this;
      return c;
    }
    removeChild(c) { const i = this._cocuklar.indexOf(c); if (i >= 0) this._cocuklar.splice(i, 1); c.parentElement = null; return c; }
    get innerHTML() { return this._html === null ? '' : this._html; }
    set innerHTML(v) { this._html = String(v); this._cocuklar = []; }
    querySelector(s) { return this._derinAra(el => seciciUyar(el, s)); }
    querySelectorAll(s) { const o = []; this._derinTopla(el => { if (seciciUyar(el, s)) o.push(el); }); return o; }
    _derinAra(kosul) {
      for (const c of this._cocuklar) { if (kosul(c)) return c; const b = c._derinAra(kosul); if (b) return b; }
      return null;
    }
    _derinTopla(yap) { for (const c of this._cocuklar) { yap(c); c._derinTopla(yap); } }
    closest(s) { let d = this; while (d) { if (d.getAttribute && seciciUyar(d, s)) return d; d = d.parentElement; } return null; }
    contains(el) { let d = el; while (d) { if (d === this) return true; d = d.parentElement; } return false; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
    focus() { this._odak = true; }
    blur() { this._odak = false; }
    scrollIntoView() {}
    getContext() { return null; }
    toDataURL() { return ''; }
    click() { return this.olay('click'); }

    /* ── olaylar (GERÇEK köpürme) ───────────────────── */
    addEventListener(tur, fn) {
      if (!this._dinleyici.has(tur)) this._dinleyici.set(tur, []);
      this._dinleyici.get(tur).push(fn);
    }
    removeEventListener(tur, fn) {
      const a = this._dinleyici.get(tur) || [];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    }
    olay(tur, ek = {}) {
      let durdu = false, hemen = false;
      const ev = Object.assign({
        type: tur,
        target: this,
        bubbles: true,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { durdu = true; },
        stopImmediatePropagation() { hemen = true; durdu = true; }
      }, ek);
      let d = this;
      while (d && !durdu) {
        const a = (d._dinleyici.get(tur) || []).slice();
        ev.currentTarget = d;
        for (const f of a) {
          if (hemen) break;
          try { f(ev); } catch (e) { ev._hata = e; throw e; }
        }
        d = d.parentElement;
      }
      return ev;
    }
  }

  const belge = {
    readyState: hazir,
    hidden: false,
    body: null,
    documentElement: null,
    _dinleyici: new Map(),
    createElement(tag) { const e = new Eleman(''); e.tagName = String(tag).toUpperCase(); return e; },
    createTextNode(t) { return { textContent: String(t) }; },
    createDocumentFragment() { return new Eleman(''); },
    getElementById(id) {
      const d = dugum(id);
      return d || null;
    },
    querySelector(s) { const o = belge.body ? belge.body.querySelector(s) : null; return o; },
    querySelectorAll(s) {
      const o = [];
      tumDugumler.forEach(el => { if (el.id && seciciUyar(el, s)) o.push(el); });
      return o;
    },
    addEventListener(tur, fn) {
      if (!belge._dinleyici.has(tur)) belge._dinleyici.set(tur, []);
      belge._dinleyici.get(tur).push(fn);
    },
    removeEventListener(tur, fn) {
      const a = belge._dinleyici.get(tur) || [];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    },
    /* Belge düzeyinde olay: köpürme zincirinin SON halkası. */
    olay(tur, ek = {}) {
      const hedef = (ek && ek.target) || belge.body;
      return hedef.olay(tur, ek);
    },
    /* Belgeye DOĞRUDAN kayıtlı dinleyicileri çalıştır (DOMContentLoaded
       gibi hedefi olmayan olaylar). Kısmi olay nesnesi verilir. */
    yay(tur, ek = {}) {
      const ev = Object.assign({ type: tur, target: belge }, ek);
      (belge._dinleyici.get(tur) || []).forEach(f => { try { f(ev); } catch (e) { ev._hata = e; } });
      return ev;
    }
  };

  function dugum(anahtar) {
    if (anahtar === 'body') return belge.body;
    if (anahtar === 'html') return belge.documentElement;
    if (tumDugumler.has(anahtar)) return tumDugumler.get(anahtar);
    const el = new Eleman(anahtar);
    if (anahtar === 'body') el.tagName = 'BODY';
    tumDugumler.set(anahtar, el);
    const p = EBEVEYN[anahtar];
    if (p) el.parentElement = dugum(p);
    return el;
  }

  /* Gövde ve kök: belgeye kadar köpürsün. */
  tumDugumler.set('html', new Eleman('html'));
  belge.documentElement = tumDugumler.get('html');
  belge.documentElement.tagName = 'HTML';
  belge.documentElement.parentElement = belge;
  tumDugumler.set('body', new Eleman('body'));
  belge.body = tumDugumler.get('body');
  belge.body.tagName = 'BODY';
  belge.body.parentElement = belge.documentElement;

  /* ── Gerçek DOM'da hazır gelen kutular ────────────────
     PA perdesinin İÇİNDEKİ asıl kutu (`.pa-box`) index.html'de vardır.
     Sahte DOM'da yoksa "kutu dışına tıklayınca kapan" kuralı hiç
     çalışmaz ve test yanlış yere düşer. */
  (() => {
    const kutu = new Eleman('');
    kutu.className = 'pa-box';
    belge.getElementById('pa-modal').appendChild(kutu);
  })();

  /* ── localStorage ─────────────────────────────────── */
  const depo = new Map();
  const localStorage = {
    getItem: k => (depo.has(String(k)) ? depo.get(String(k)) : null),
    setItem: (k, v) => depo.set(String(k), String(v)),
    removeItem: k => depo.delete(String(k)),
    clear: () => depo.clear()
  };

  const konsol = [];
  const yakala = (seviye) => (...a) => konsol.push(seviye + ': ' + a.map(String).join(' '));

  const pencere = {
    document: belge,
    localStorage,
    PZA: undefined,
    innerWidth: 800,
    innerHeight: 272,
    devicePixelRatio: 1,
    screen: { availWidth: 1920, availHeight: 1040, availTop: 0, width: 1920, height: 1080 },
    navigator: { language: 'tr-TR', languages: ['tr-TR'], onLine: true, userAgent: 'test' },
    location: { href: 'http://localhost/', reload() {} },
    console: { log: yakala('log'), warn: yakala('warn'), error: yakala('error'), info: yakala('info') },
    performance: { now: () => Date.now() },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    /* Zamanlayıcılar: TEST ASILI KALMASIN diye hiçbir şey kaydetmez. */
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } },
    Image: class { set src(v) {} addEventListener() {} },
    alert() {}, confirm: () => false, prompt: () => null,
    /* Tauri YOK: kullanıcı tarayıcı/kurulu uygulama dışı testte bunu görür. */
    __TAURI__: undefined,
    JSON, Math, Date, isFinite, parseInt, parseFloat, String, Number, Boolean,
    Object, Array, Map, Set, Promise, Error, TypeError, RegExp, Symbol,
    Intl, encodeURIComponent, decodeURIComponent, structuredClone
  };
  pencere.window = pencere;
  pencere.globalThis = pencere;

  const baglam = vm.createContext(pencere);
  /* `window.` öneki olmadan kullanılan globaller (alert, fetch, ...) */
  baglam.__konsolDefteri = konsol;

  return { belge, pencere, baglam, Eleman, dugum, konsol, localStorage, SIRA };
}

/** src/js/*.js dosyalarını tarayıcıdaki SIRAYLA çalıştırır.
    Her dosyanın hatası ayrı toplanır (tarayıcı da sonraki dosyayı yükler). */
export function betikleriYukle(ortam, list = SIRA) {
  const sonuc = [];
  for (const f of list) {
    const tam = KOK + 'src' + path.sep + f.split('/').join(path.sep);
    const kod = fs.readFileSync(tam, 'utf8');
    try {
      vm.runInContext(kod, ortam.baglam, { filename: f });
      sonuc.push({ dosya: f, hata: null });
    } catch (e) {
      sonuc.push({ dosya: f, hata: e });
    }
  }
  return sonuc;
}
