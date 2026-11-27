/* ==========================================================================
   Walaa — birthday garden
   Gift -> Title -> Garden -> Our story -> Dua at Fajr -> Calligraphy + letter
   Vanilla JS. All content comes from CONFIG (config.js); stars from stars.js.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Config & helpers
     --------------------------------------------------------------------- */
  const CFG = (typeof CONFIG === 'object' && CONFIG) ? CONFIG : {};
  const TEXT = Object.assign({
    giftText: 'Tap to open your gift, habibti', giftSub: 'turn your sound on',
    introSubtitle: '', enterGarden: 'Enter the garden', loading: '',
    gardenTitle: 'Our garden of memories', gardenHint: 'Every flower is a moment with you',
    gardenScrollHint: 'swipe to see the whole garden',
    skyNote: 'The sky above Valencia, our first night in the same city',
    sinceLabel: 'Since our first hug at {place}',
    treeLabel: 'Your olive tree', certificateTitle: 'Planted in your name, growing for you.',
    certificateMeta: 'Sadaqah jariyah', counter: '{n} of {total} memories bloomed',
    playStory: 'Our story, from the beginning', openLetter: 'Open your letter',
    surpriseHint: 'Something new is growing for you', storyTapForSound: 'tap for sound',
    duaTitle: 'At the first light of Fajr', duaContinue: 'continue', ameen: 'Ameen',
    letterHint: 'Tap the seal, and take your time, habibti', backToGarden: 'Back to the garden', watchAgain: 'Watch again',
    missingMemory: 'This memory is still on its way.'
  }, CFG.text || {});

  const PHOTO_MS = Math.max(2, Number(CFG.photoSeconds) || 6) * 1000;
  const MAX_VIDEO_S = Math.max(3, Number(CFG.maxVideoSeconds) || 20);
  const MUSIC_VOL = Math.min(1, Math.max(0, CFG.musicVolume == null ? 0.45 : Number(CFG.musicVolume)));

  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const EASE_IO = 'cubic-bezier(.65,0,.35,1)';
  const BREATH = 'cubic-bezier(.45,.05,.55,.95)';
  const isArabic = (s) => /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(s || '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const D2R = Math.PI / 180;
  const vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ } };

  // deterministic pseudo random (so the garden looks the same on every visit)
  function rng(seed) {
    let t = (seed * 2654435761) >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  function animate(node, frames, opts) {
    if (!node || !node.animate) return Promise.resolve();
    try {
      const a = node.animate(frames, Object.assign({ fill: 'both' }, opts));
      return a.finished.then(() => a, () => a);
    } catch (e) { return Promise.resolve(); }
  }

  const cancelAnims = (n) => { if (n && n.getAnimations) n.getAnimations().forEach((a) => a.cancel()); };

  /* ---------------------------------------------------------------------
     Memories
     --------------------------------------------------------------------- */
  const VIDEO_RE = /\.(mp4|m4v|mov|webm|ogv)([?#].*)?$/i;
  const FLOWERS = ['orange-blossom', 'rose', 'jasmine', 'tulip', 'lavender'];

  // The story plays every memory in date order (when "date" is given, else in
  // config order). Memories with highlight: true are the seeds in the garden.
  const memories = (Array.isArray(CFG.memories) ? CFG.memories : [])
    .filter((m) => m && typeof m.src === 'string' && m.src.trim())
    .map((m, k) => ({ m, k, t: m.date ? Date.parse(m.date) : NaN }))
    .sort((a, b) => (isNaN(a.t) || isNaN(b.t)) ? a.k - b.k : (a.t - b.t) || (a.k - b.k))
    .map(({ m }, i) => ({
      i,
      src: m.src.trim(),
      poster: m.poster || '',
      day: m.day || '',
      place: m.place || '',
      caption: m.caption || '',
      highlight: !!m.highlight,
      type: (m.type === 'video' || m.type === 'image') ? m.type : (VIDEO_RE.test(m.src) ? 'video' : 'image'),
      flower: FLOWERS.indexOf(m.flower) > -1 ? m.flower : FLOWERS[i % FLOWERS.length]
    }));

  const broken = new Set(); // memory indices that failed to load

  // Garden seeds: only the highlights when any are marked, otherwise everything.
  const gardenMemories = memories.some((m) => m.highlight) ? memories.filter((m) => m.highlight) : memories;

  // One seed per memory, or one seed per day when there are more than 10.
  const groups = (function () {
    const out = [];
    if (gardenMemories.length > 10) {
      const map = new Map();
      gardenMemories.forEach((m) => {
        const k = 'd:' + (m.day || ('#' + m.i)).trim().toLowerCase();
        if (!map.has(k)) { const g = { key: k, items: [] }; map.set(k, g); out.push(g); }
        map.get(k).items.push(m);
      });
    } else {
      gardenMemories.forEach((m) => out.push({ key: 'm:' + m.src, items: [m] }));
    }
    out.forEach((g, gi) => { g.gi = gi; g.flower = g.items[0].flower; g.day = g.items[0].day; g.place = g.items[0].place; });
    return out;
  })();

  const metaLine = (m) => [m.day, m.place].filter(Boolean).join('  ·  ');
  const duas = (Array.isArray(CFG.dua) ? CFG.dua : []).filter((d) => d && (d.ar || d.en));

  /* ---------------------------------------------------------------------
     Persistent state
     --------------------------------------------------------------------- */
  const KEY = 'walaa-garden-v1';
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) store.del(KEY);
  const saved = store.get(KEY, {}) || {};
  const validKeys = new Set(groups.map((g) => g.key));
  const state = {
    bloomed: new Set((saved.bloomed || []).filter((k) => validKeys.has(k))),
    storyDone: !!saved.storyDone,
    letterRead: !!saved.letterRead,
    surpriseBloomed: !!saved.surpriseBloomed,
    surpriseSeen: !!saved.surpriseSeen,
    interacted: false,      // a real user gesture happened (audio allowed)
    userMuted: false,
    scene: null,
    busy: false
  };
  const persist = () => store.set(KEY, {
    bloomed: Array.from(state.bloomed), storyDone: state.storyDone, letterRead: state.letterRead,
    surpriseBloomed: state.surpriseBloomed, surpriseSeen: state.surpriseSeen
  });

  /* ---------------------------------------------------------------------
     The sky: night -> Fajr -> morning
     --------------------------------------------------------------------- */
  const SKY_FOR = { gift: 'night', intro: 'night', garden: 'night', story: 'story', dua: 'fajr', letter: 'morning' };
  function setSky(phase) {
    document.body.setAttribute('data-sky', phase);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', { night: '#081a21', story: '#000000', fajr: '#0c1f3e', morning: '#3e4c66' }[phase] || '#081a21');
    Starfield.wake();
  }

  /* Faint khatam pattern for the sky, drawn with Hankin's "polygons in contact"
     method on the 4.8.8 (octagon + square) tiling: from the middle of every edge
     two rays go into the tile at the contact angle and stop where they meet the
     neighbouring edge's ray. Technique studied in evoluteur/islamic-patterns (MIT). */
  function khatamTile(size, angle) {
    const W8 = 1 + Math.SQRT2;
    const R8 = 1 / (2 * Math.sin(Math.PI / 8));
    const poly = (cx, cy, n, r, a0) => {
      const v = [];
      for (let k = 0; k < n; k++) { const a = (a0 + k * 360 / n) * D2R; v.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return { v, c: [cx, cy] };
    };
    const meet = (p, d, q, e) => {
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-9) return null;
      const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
      return [p[0] + t * d[0], p[1] + t * d[1]];
    };
    const segs = [];
    const motif = ({ v, c }) => {
      const n = v.length, th = angle * D2R, ct = Math.cos(th), st = Math.sin(th), rays = [];
      for (let k = 0; k < n; k++) {
        const a = v[k], b = v[(k + 1) % n];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const e = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        let nr = [-e[1], e[0]];
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if ((c[0] - m[0]) * nr[0] + (c[1] - m[1]) * nr[1] < 0) nr = [-nr[0], -nr[1]];
        rays.push({ m, toB: [e[0] * ct + nr[0] * st, e[1] * ct + nr[1] * st], toA: [-e[0] * ct + nr[0] * st, -e[1] * ct + nr[1] * st] });
      }
      for (let k = 0; k < n; k++) {
        const r1 = rays[k], r2 = rays[(k + 1) % n], w = v[(k + 1) % n];
        const P = meet(r1.m, r1.toB, w, [c[0] - w[0], c[1] - w[1]]) || c;
        segs.push([r1.m, P], [P, r2.m]);
      }
    };
    [[0, 0], [W8, 0], [0, W8], [W8, W8]].forEach(([x, y]) => motif(poly(x, y, 8, R8, 22.5)));
    motif(poly(W8 / 2, W8 / 2, 4, Math.SQRT2 / 2, 0));
    const s = size / W8;
    const d = segs.map(([a, b]) => `M${(a[0] * s).toFixed(2)} ${(a[1] * s).toFixed(2)}L${(b[0] * s).toFixed(2)} ${(b[1] * s).toFixed(2)}`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${d}" fill="none" stroke="#f2d796" stroke-width=".8"/></svg>`;
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  try { $('#khatam').style.backgroundImage = khatamTile(92, 67.5); } catch (e) { /* decorative only */ }

  /* ---------------------------------------------------------------------
     Real star sky above Valencia (39.47 N, 0.38 W), 13 Nov 2026, 20:00.
     Catalog from d3-celestial (BSD-3-Clause), positions computed here.
     --------------------------------------------------------------------- */
  const Starfield = (function () {
    const cv = $('#starfield');
    const ctx = cv.getContext('2d');
    const DATA = window.STAR_DATA || { stars: [], lines: [] };
    const LAT = 39.47 * D2R, LON = -0.38;
    const when = Date.parse(CFG.skyAt || '2026-11-13T20:00:00+01:00');
    const jd = when / 86400000 + 2440587.5;
    const lst = ((280.46061837 + 360.98564736629 * (jd - 2451545) + LON) % 360 + 360) % 360;
    const AZ0 = 62 * D2R, ALT0 = 32 * D2R;   // looking east-north-east: Pleiades, Taurus, Perseus, Capella, Cassiopeia

    function altaz(ra, dec) {
      const H = (lst - ra) * D2R, d = dec * D2R;
      const alt = Math.asin(Math.sin(d) * Math.sin(LAT) + Math.cos(d) * Math.cos(LAT) * Math.cos(H));
      const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(LAT) - Math.cos(d) * Math.sin(LAT) * Math.cos(H));
      return [alt, az];
    }
    // stereographic projection centred on (AZ0, ALT0): keeps constellation shapes true
    function proj(alt, az) {
      const dA = az - AZ0;
      const k = 2 / (1 + Math.sin(ALT0) * Math.sin(alt) + Math.cos(ALT0) * Math.cos(alt) * Math.cos(dA));
      return [k * Math.cos(alt) * Math.sin(dA), k * (Math.cos(ALT0) * Math.sin(alt) - Math.sin(ALT0) * Math.cos(alt) * Math.cos(dA))];
    }
    const colour = (bv) => bv < 0 ? [205, 222, 255] : bv < .4 ? [238, 242, 255] : bv < .8 ? [255, 244, 222] : bv < 1.2 ? [255, 226, 186] : [255, 204, 160];

    const r = rng(42);
    const stars = DATA.stars.map(([ra, dec, mag, bv]) => {
      const [alt, az] = altaz(ra, dec);
      return { alt, az, mag, c: colour(bv), ph: r() * 6.28, f: .6 + r() * 1.6 };
    }).filter((s) => s.alt > 0);
    const lines = DATA.lines.map(([ra1, d1, ra2, d2]) => [altaz(ra1, d1), altaz(ra2, d2)]);

    let W = 0, H = 0, DPR = 1, pts = [], segs = [], raf = 0, lastDraw = 0, lineA = .09, lineTarget = .09, glow = null;

    glow = document.createElement('canvas');
    glow.width = glow.height = 32;
    (function () {
      const g = glow.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,248,225,.9)'); gr.addColorStop(.3, 'rgba(255,236,200,.25)'); gr.addColorStop(1, 'rgba(255,236,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    })();

    function layout() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth || window.innerWidth + 48; H = cv.clientHeight || window.innerHeight + 48;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      const yH = 24 + (H - 48) * .585;                   // same horizon as the garden
      const top = 2 * Math.tan((72 * D2R - ALT0) / 2), bottom = 2 * Math.tan(ALT0 / 2);
      const S = (yH - 10) / (top + bottom);
      const cy = yH - S * bottom, cx = W / 2;
      const P = (alt, az) => { const [x, y] = proj(alt, az); return [cx + x * S, cy - y * S]; };
      pts = stars.map((s) => { const [x, y] = P(s.alt, s.az); return { s, x, y }; })
        .filter((p) => p.x > -10 && p.x < W + 10 && p.y > -10 && p.y < yH);
      segs = lines.map(([a, b]) => P(a[0], a[1]).concat(P(b[0], b[1])));
    }

    function draw(now) {
      raf = 0;
      const phase = document.body.getAttribute('data-sky');
      if (phase !== 'night' && phase !== 'fajr') return;      // stars rest during the day
      if (!document.hidden) raf = requestAnimationFrame(draw);
      if (now - lastDraw < 33 && lastDraw) return;             // ~30 fps is plenty for twinkling
      lastDraw = now;
      const t = now / 1000;
      lineA += (lineTarget - lineA) * .05;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(242,215,150,${lineA.toFixed(3)})`;
      ctx.lineWidth = .7;
      ctx.beginPath();
      segs.forEach(([x1, y1, x2, y2]) => { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); });
      ctx.stroke();
      for (let i = 0; i < pts.length; i++) {
        const { s, x, y } = pts[i];
        const rad = clamp(2.1 - s.mag * .42, .55, 2.4);
        const horizonFade = clamp(s.alt / (14 * D2R), .15, 1);
        const tw = reduced ? 1 : .78 + .22 * Math.sin(t * s.f + s.ph);
        const a = clamp(1.05 - s.mag * .17, .25, 1) * tw * horizonFade;
        if (s.mag < 1.7) { ctx.globalAlpha = a * .7; ctx.drawImage(glow, x - rad * 5, y - rad * 5, rad * 10, rad * 10); }
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function wake() { if (!raf) raf = requestAnimationFrame(draw); }
    function highlight() { lineTarget = .42; setTimeout(() => { lineTarget = .09; }, 6000); wake(); }

    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); lastDraw = 0; wake(); }, 150); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    layout();
    return { wake, highlight };
  })();

  /* ---------------------------------------------------------------------
     Parallax: device tilt on phones, the pointer on desktops, otherwise a
     slow drift. Calibrates on the first reading and eases with friction
     (approach studied in wagerfield/parallax, MIT).
     --------------------------------------------------------------------- */
  const Parallax = (function () {
    const root = document.documentElement;
    let tx = 0, ty = 0, x = 0, y = 0, mode = 'drift', cal = null, listening = false, lx = 9, ly = 9;

    function onOrient(e) {
      if (e.beta == null || e.gamma == null) return;
      mode = 'tilt';
      const portrait = window.innerHeight >= window.innerWidth;
      const b = portrait ? e.beta : e.gamma, g = portrait ? e.gamma : -e.beta;
      if (!cal) cal = { b, g };
      cal.b += (b - cal.b) * .004; cal.g += (g - cal.g) * .004;   // slowly re-centre when she changes posture
      tx = clamp((g - cal.g) / 20, -1, 1);
      ty = clamp((b - cal.b) / 20, -1, 1);
    }

    function listen() {
      if (listening) return;
      listening = true;
      window.addEventListener('deviceorientation', onOrient, { passive: true });
    }

    function request() {
      // must be called inside a tap on iOS 13+
      try {
        const DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === 'function') {
          DOE.requestPermission().then((s) => { if (s === 'granted') listen(); }).catch(() => {});
        } else listen();
      } catch (e) { /* drift instead */ }
    }

    if (window.matchMedia && matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        if (mode === 'tilt') return;
        mode = 'pointer';
        tx = (e.clientX / window.innerWidth - .5) * 1.4;
        ty = (e.clientY / window.innerHeight - .5) * 1.0;
      }, { passive: true });
    }

    function tick(now) {
      requestAnimationFrame(tick);
      const phase = document.body.getAttribute('data-sky');
      if (phase !== 'night' || document.hidden) return;
      if (mode === 'drift') { tx = Math.sin(now / 9000) * .55; ty = Math.sin(now / 13000) * .35; }
      x += (tx - x) * .06; y += (ty - y) * .06;
      if (Math.abs(x - lx) > .002 || Math.abs(y - ly) > .002) {
        lx = x; ly = y;
        root.style.setProperty('--px', x.toFixed(3));
        root.style.setProperty('--py', y.toFixed(3));
      }
    }

    if (!reduced) {
      // Android fires orientation without a permission prompt
      if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') listen();
      requestAnimationFrame(tick);
    }
    return { request: reduced ? () => {} : request };
  })();

  /* ---------------------------------------------------------------------
     FX canvas: motes, petals (with depth), fireflies, bursts, showers,
     a heart made of petals and rising light.
     Depth-scaled drift and two-axis tumbling studied in 599316527/sakura-canvas (MIT).
     --------------------------------------------------------------------- */
  const FX = (function () {
    const cv = $('#fx');
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1, parts = [], raf = 0, last = 0, showerUntil = 0, showerRate = 0, spawnAcc = 0, riseUntil = 0, riseAcc = 0;

    function sprite(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }

    function petalSprite(c1, c2) {
      return sprite(64, (g, s) => {
        g.translate(s / 2, s / 2);
        const grd = g.createLinearGradient(0, -26, 0, 26);
        grd.addColorStop(0, c1); grd.addColorStop(1, c2);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, 26);
        g.bezierCurveTo(-20, 12, -16, -18, -2, -26);
        g.quadraticCurveTo(0, -22, 2, -26);
        g.bezierCurveTo(16, -18, 20, 12, 0, 26);
        g.fill();
        g.strokeStyle = 'rgba(210,160,90,.22)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, 22); g.quadraticCurveTo(2, 0, 0, -20); g.stroke();
      });
    }

    const petals = [petalSprite('#fffaf1', '#f6dcc0'), petalSprite('#fff7ea', '#f3c99a'), petalSprite('#fde9dc', '#f0b48a'), petalSprite('#ffffff', '#efe2cf')];
    const glow = sprite(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(.25, 'rgba(250,210,140,.55)'); r.addColorStop(1, 'rgba(250,210,140,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });
    const fly = sprite(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(250,255,210,1)'); r.addColorStop(.18, 'rgba(225,245,140,.8)'); r.addColorStop(.5, 'rgba(200,230,110,.18)'); r.addColorStop(1, 'rgba(200,230,110,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });

    const TARGETS = {
      none: {}, story: {}, dua: {},
      gift: { mote: 30, petal: 6 },
      intro: { mote: 34, petal: 12 },
      garden: { firefly: 22, petal: 4, mote: 6 },
      letter: { mote: 10, petal: 4 }
    };

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    }

    const R = Math.random;

    function make(kind, opts) {
      const p = { kind, a: 0, fade: 1, t: R() * 100 };
      if (kind === 'mote') {
        Object.assign(p, { x: R() * W, y: R() * H, s: 6 + R() * 16, vx: (R() - .5) * 8, vy: -4 - R() * 10, f: .4 + R() * .9 });
      } else if (kind === 'petal') {
        const z = .45 + R() * .8;   // depth: far petals are smaller, slower, softer
        Object.assign(p, { z, x: R() * W, y: opts && opts.top ? -30 - R() * 80 : R() * H, s: (11 + R() * 9) * z, vx: (8 + R() * 16) * z, vy: (14 + R() * 20) * z, r1: R() * 6.28, v1: (R() - .5) * 1.4, r2: R() * 6.28, v2: 1 + R() * 1.8, img: petals[(R() * petals.length) | 0], sw: R() * 6.28 });
      } else if (kind === 'firefly') {
        Object.assign(p, { x: R() * W, y: H * (.38 + R() * .55), s: 10 + R() * 12, ang: R() * 6.28, sp: 6 + R() * 12, f: .5 + R() * 1.2 });
      }
      if (opts) Object.assign(p, opts);
      return p;
    }

    function setMode(m) {
      const target = Object.assign({}, TARGETS[m] || {});
      if (reduced) Object.keys(target).forEach((k) => { target[k] = Math.ceil(target[k] / 3); });
      const counts = {};
      parts.forEach((p) => {
        if (p.transient) return;
        counts[p.kind] = (counts[p.kind] || 0) + 1;
        p.fade = counts[p.kind] > (target[p.kind] || 0) ? 0 : 1;
      });
      Object.keys(target).forEach((k) => { for (let n = counts[k] || 0; n < target[k]; n++) parts.push(make(k)); });
      start();
    }

    function burst(points, n) {
      if (reduced) return;
      points.forEach((pt) => {
        for (let k = 0; k < (n || 3); k++) {
          parts.push(make('petal', { transient: true, x: pt.x + (R() - .5) * 20, y: pt.y + (R() - .5) * 20, vx: (R() - .5) * 50, vy: -30 - R() * 60, life: 2.6 + R() * 1.4, a: 1, s: 8 + R() * 8, z: 1 }));
        }
        parts.push(make('mote', { transient: true, x: pt.x, y: pt.y, vx: (R() - .5) * 24, vy: -24 - R() * 30, life: 2, a: 1, s: 20 }));
      });
      start();
    }

    function clear(sec) {
      showerUntil = 0; riseUntil = 0;
      parts.forEach((p) => { p.transient = true; p.life = Math.min(p.life || 99, sec || 1); });
    }

    function shower(ms, rate) { showerUntil = performance.now() + ms; showerRate = reduced ? (rate || 24) / 4 : (rate || 24); start(); }
    function rise(ms) { riseUntil = performance.now() + ms; start(); }

    // a small heart drawn by petals, held for a breath, then let go
    function heart(cx, cy, size) {
      if (reduced) return;
      const N = 34;
      for (let k = 0; k < N; k++) {
        const t = k / N * 6.2832;
        const hx = 16 * Math.pow(Math.sin(t), 3), hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const ang = R() * 6.28, dist = Math.max(W, H) * (.35 + R() * .3);
        parts.push(make('petal', {
          transient: true, z: 1, s: 11 + R() * 4, a: 0,
          x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist,
          tx: cx + hx * size / 17, ty: cy + hy * size / 17, hold: 1.7 + 2.2 + k * .012, life: 9, vx: 0, vy: 0
        }));
      }
      for (let k = 0; k < 6; k++) parts.push(make('mote', { transient: true, x: cx + (R() - .5) * size, y: cy + (R() - .5) * size * .6, vx: 0, vy: -6, life: 4.5, a: 0, s: 30 + R() * 20 }));
      start();
    }

    function step(now) {
      raf = 0;
      const dt = Math.min(.05, (now - (last || now)) / 1000);
      last = now;

      if (now < showerUntil) {
        spawnAcc += dt * showerRate;
        while (spawnAcc >= 1) { spawnAcc -= 1; parts.push(make('petal', { transient: true, top: true, y: -30, life: 10, vy: 36 + R() * 44, vx: (R() - .3) * 26, z: .7 + R() * .5 })); }
      }
      if (now < riseUntil) {
        riseAcc += dt * (reduced ? 6 : 26);
        while (riseAcc >= 1) { riseAcc -= 1; parts.push(make('mote', { transient: true, x: R() * W, y: H + 20, vx: (R() - .5) * 10, vy: -50 - R() * 70, life: 6, a: 0, s: 10 + R() * 22 })); }
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        const target = p.transient ? 1 : p.fade;
        p.a += (target - p.a) * Math.min(1, dt * 1.4);
        if (p.transient) {
          p.life -= dt;
          if (p.life <= 0 || p.y > H + 60 || p.y < -80) { parts.splice(i, 1); continue; }
          if (p.life < 1.2) p.a = Math.min(p.a, Math.max(0, p.life / 1.2));
        } else if (p.fade === 0 && p.a < .02) { parts.splice(i, 1); continue; }

        if (p.kind === 'mote') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (!p.transient) {
            if (p.y < -20) { p.y = H + 20; p.x = R() * W; }
            if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
          }
          const tw = .45 + .55 * Math.sin(p.t * (p.f || 1) * 2 + p.s);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, p.a * tw * .55);
          ctx.drawImage(glow, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        } else if (p.kind === 'firefly') {
          p.ang += (Math.sin(p.t * .7 + p.s) * .9) * dt;
          p.x += Math.cos(p.ang) * p.sp * dt; p.y += Math.sin(p.ang) * p.sp * dt * .7;
          if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
          if (p.y < H * .3) p.ang = Math.abs(p.ang); else if (p.y > H * .97) p.ang = -Math.abs(p.ang);
          const b = Math.pow(Math.max(0, Math.sin(p.t * p.f + p.s)), 2.2);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = p.a * (.15 + .85 * b);
          ctx.drawImage(fly, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        } else if (p.kind === 'petal') {
          if (p.tx != null) {
            if (p.t < p.hold) { const k = Math.min(1, dt * 1.8); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.r1 += (0 - p.r1) * k * .3; }
            else { p.tx = null; p.vx = (R() - .5) * 14; p.vy = 16 + R() * 20; }
          } else {
            if (p.transient && p.vy < 28) p.vy += 50 * dt;     // bursts float up, then drift down
            p.sw += dt;
            p.x += (p.vx + Math.sin(p.sw * 1.3) * 12 * (p.z || 1)) * dt; p.y += p.vy * dt;
            p.r1 += p.v1 * dt;
          }
          p.r2 += p.v2 * dt;
          if (!p.transient && p.y > H + 30) { p.y = -30; p.x = R() * W - W * .2; }
          if (!p.transient && p.x > W + 30) p.x = -30;
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = p.a * (.5 + .45 * (p.z || 1));
          ctx.setTransform(DPR, 0, 0, DPR, p.x * DPR, p.y * DPR);
          ctx.rotate(p.r1);
          ctx.scale(Math.cos(p.r2) || .01, .75 + .25 * Math.abs(Math.sin(p.r2 * .7)));
          ctx.drawImage(p.img, -p.s / 2, -p.s / 2, p.s, p.s);
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (parts.length || now < showerUntil || now < riseUntil) start();
    }

    function start() { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(step); } }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    return { setMode, burst, shower, rise, heart, clear };
  })();

  /* ---------------------------------------------------------------------
     Audio: one AudioContext, unlocked in the first tap.
     Unlock = resume() + a 1-sample silent buffer inside the gesture
     (pattern from pavle-goloskokovic/web-audio-unlock, MIT).
     --------------------------------------------------------------------- */
  const AudioHub = (function () {
    let ctx = null, master = null, songBus = null, musicBus = null, verbIn = null;

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = state.userMuted ? 0 : 1; master.connect(ctx.destination);
        songBus = ctx.createGain(); songBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      } catch (e) { ctx = null; }
      return ctx;
    }

    function unlock() {
      const c = ensure();
      // iOS 17+: play through the ringer switch like a normal media app
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* */ }
      if (!c) return;
      try { if (c.state !== 'running' && c.resume) c.resume().catch(() => {}); } catch (e) { /* */ }
      try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) { /* */ }
    }

    // Generated stereo impulse: a short pre-delay, then decaying noise that
    // gets darker as it fades (Reverb technique studied in Tonejs/Tone.js, MIT).
    function reverb() {
      if (verbIn || !ensure()) return verbIn;
      try {
        const sr = ctx.sampleRate, dur = 3.4, pre = .025, n = Math.floor(sr * dur);
        const ir = ctx.createBuffer(2, n, sr);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            if (t < pre) { d[i] = 0; continue; }
            const env = Math.exp(-(t - pre) * 2.1);
            const a = .55 - .42 * (t / dur);               // one-pole low-pass, closing over time
            lp += a * ((Math.random() * 2 - 1) - lp);
            d[i] = lp * env;
          }
        }
        const conv = ctx.createConvolver(); conv.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = .5;
        conv.connect(wet); wet.connect(songBus);
        verbIn = conv;
      } catch (e) { verbIn = null; }
      return verbIn;
    }

    function ramp(param, to, sec) {
      if (!ctx) return;
      const t = ctx.currentTime;
      try { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + Math.max(.01, sec)); } catch (e) { param.value = to; }
    }

    function setMuted(m) { if (master) ramp(master.gain, m ? 0 : 1, .4); }

    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      try { if (document.hidden) ctx.suspend(); else if (state.interacted) ctx.resume(); } catch (e) { /* */ }
    });

    return {
      ensure, unlock, reverb, ramp, setMuted,
      get ctx() { return ctx; }, get songBus() { return songBus; }, get musicBus() { return musicBus; }
    };
  })();

  /* Happy Birthday (public domain) as a warm music box, synthesized live.
     A tine has a pure fundamental, a soft octave from the comb's body and a
     brief inharmonic "ping" (first bending mode, ~6.27x). Two passes: the
     second an octave higher and softer. */
  const Song = (function () {
    const mode = String(CFG.birthdaySong || '').trim();
    let playing = false, endTimer = 0, fileEl = null, fileSrcNode = null, firstNoteMs = 500, voices = [];

    if (mode && mode !== 'musicbox') {
      fileEl = new Audio();
      fileEl.preload = 'auto';
      fileEl.src = mode;
      fileEl.addEventListener('error', () => { fileEl = null; });
    }

    // melody in C, 3/4, with the pickup; [midi, beats]
    const MEL = [[67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2], [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
      [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 1.7], [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 3.2]];
    // bass + soft chord tones per bar (bars start after the 1-beat pickup)
    const BARS = [[48, 64, 67], [43, 62, 65], [43, 62, 65], [48, 64, 67], [48, 64, 67], [41, 65, 69], [43, 62, 65], [48, 64, 67]];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function note(c, out, send, midi, t, vel) {
      const f = hz(midi) * Math.pow(2, ((Math.random() - .5) * 6) / 1200);
      const decay = clamp(2.8 - (midi - 48) * .035, 1.1, 2.8);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + decay);
      g.connect(out); g.connect(send);
      const partial = (type, mult, amp, dec) => {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f * mult;
        const pg = c.createGain();
        pg.gain.setValueAtTime(amp, t); pg.gain.exponentialRampToValueAtTime(.0001, t + dec);
        o.connect(pg); pg.connect(g);
        o.start(t); o.stop(t + dec + .05);
        voices.push(o);
      };
      partial('sine', 1, 1, decay);
      partial('triangle', 1, .08, decay * .5);          // a little wooden warmth
      partial('sine', 2, .16, decay * .35);
      if (f * 6.27 < c.sampleRate / 2.2) partial('sine', 6.27, .035, .09);
    }

    function musicbox() {
      const c = AudioHub.ensure();
      if (!c) return;
      const bus = AudioHub.songBus;
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 4200; tone.Q.value = .4;
      const dry = c.createGain(); dry.gain.value = .9;
      tone.connect(dry); dry.connect(bus);
      const verb = AudioHub.reverb();
      const send = c.createGain(); send.gain.value = .42;
      if (verb) send.connect(verb);
      const input = c.createGain(); input.gain.value = .32; input.connect(tone);
      const sendIn = c.createGain(); sendIn.gain.value = .32; sendIn.connect(send);

      bus.gain.cancelScheduledValues(c.currentTime);
      bus.gain.setValueAtTime(1, c.currentTime);
      let t = c.currentTime + firstNoteMs / 1000;
      const pass = (shift, vel, beat) => {
        let beats = 0, bar = -1;
        MEL.forEach(([m, d], k) => {
          // gentle ritardando into the last phrase
          const slow = k >= MEL.length - 4 ? 1.12 : 1;
          note(c, input, sendIn, m + shift, t, vel * (k % 3 === 0 ? 1 : .9));
          const nb = beats + d;
          // bar lines fall at beats 1, 4, 7, ...
          for (let b = Math.ceil(beats - 1) + 1; b * 3 + 1 <= nb + 1e-6 && b < BARS.length; b++) {
            if (b <= bar) continue;
            bar = b;
            const barStart = t + ((b * 3 + 1) - beats) * beat * slow;
            const [bass, c1, c2] = BARS[b];
            note(c, input, sendIn, bass + (shift ? 12 : 0), barStart, vel * .42);
            note(c, input, sendIn, c1 - 12 + (shift ? 12 : 0), barStart + beat, vel * .16);
            note(c, input, sendIn, c2 - 12 + (shift ? 12 : 0), barStart + beat * 2, vel * .14);
          }
          t += d * beat * slow;
          beats = nb;
        });
      };
      pass(0, .9, .75);
      t += 1.4;
      pass(12, .5, .8);
      const endIn = (t - c.currentTime) * 1000 + 1800;
      clearTimeout(endTimer);
      endTimer = setTimeout(() => fadeOut(4), endIn);
    }

    function start() {
      if (playing || !mode) return;
      playing = true;
      if (mode === 'musicbox') { musicbox(); return; }
      if (!fileEl) return;
      const c = AudioHub.ensure();
      try {
        if (c && !fileSrcNode) { fileSrcNode = c.createMediaElementSource(fileEl); fileSrcNode.connect(AudioHub.songBus); }
      } catch (e) { fileSrcNode = null; }
      if (fileSrcNode) { AudioHub.songBus.gain.setValueAtTime(0, c.currentTime); AudioHub.ramp(AudioHub.songBus.gain, 1, 2); }
      else { fileEl.volume = 0; let k = 0; const iv = setInterval(() => { k++; try { fileEl.volume = Math.min(1, k / 20); } catch (e) { /* */ } if (k >= 20) clearInterval(iv); }, 100); }
      fileEl.currentTime = 0;
      const p = fileEl.play();
      if (p && p.catch) p.catch(() => { playing = false; });
      fileEl.onended = () => fadeOut(1);
    }

    function soften() { if (playing && AudioHub.songBus) AudioHub.ramp(AudioHub.songBus.gain, .6, 2.5); }

    function fadeOut(sec) {
      if (!playing) return Promise.resolve();
      playing = false;
      clearTimeout(endTimer);
      sec = sec == null ? 4 : sec;
      if (AudioHub.songBus) AudioHub.ramp(AudioHub.songBus.gain, 0, sec);
      return wait(sec * 1000 + 80).then(() => {
        if (fileEl) { try { fileEl.pause(); } catch (e) { /* */ } }
        voices.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } });
        voices = [];
      });
    }

    return { start, soften, fadeOut, get firstNoteMs() { return firstNoteMs; }, get isPlaying() { return playing; }, get mode() { return mode; } };
  })();

  /* ---------------------------------------------------------------------
     Video pool, story music, and sound unlock
     --------------------------------------------------------------------- */
  const videoPool = [0, 1].map(() => {
    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.playsInline = true;
    v.preload = 'auto';
    v.disableRemotePlayback = true;
    return v;
  });

  // a tiny silent WAV: playing it inside the first tap unlocks each media element on iOS
  const SILENT = (function () {
    try {
      const n = 800, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
      const w = (o, str) => { for (let k = 0; k < str.length; k++) dv.setUint8(o + k, str.charCodeAt(k)); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 16000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
      w(36, 'data'); dv.setUint32(40, n * 2, true);
      return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    } catch (e) { return ''; }
  })();

  function primeEl(m, after) {
    if (!SILENT) return;
    try {
      m.src = SILENT;
      m.muted = false;
      const p = m.play();
      const done = () => { if (m.src === SILENT) { try { m.pause(); } catch (e) { /* */ } after(); } };
      if (p && p.then) p.then(done, done); else done();
    } catch (e) { /* ignore */ }
  }

  // Story music (CONFIG.music) goes through Web Audio so it can be ducked on iOS too
  let music = null, musicNode = null, musicWanted = false, musicTarget = 0, musicStopT = 0;
  if (CFG.music) {
    music = new Audio();
    music.loop = true;
    music.preload = 'auto';
    music.src = CFG.music;
    music.addEventListener('error', () => { if (music && music.src !== SILENT) music = null; });
  }

  function primeMedia() {
    if (state.interacted) return;
    state.interacted = true;
    AudioHub.unlock();
    videoPool.forEach((v) => { if (!v.getAttribute('src')) primeEl(v, () => { v.removeAttribute('src'); try { v.load(); } catch (e) { /* */ } }); });
    if (music) {
      primeEl(music, () => {
        music.src = CFG.music;
        try { music.load(); } catch (e) { /* */ }
        if (musicWanted) setMusic(musicTarget);
      });
    }
    updateMuteUI();
  }

  function setMusic(target) {
    if (!music) return;
    musicTarget = target;
    musicWanted = target > 0;
    if (music.src === SILENT || !state.interacted) return;
    const c = AudioHub.ctx;
    if (c && !musicNode) {
      try { musicNode = c.createMediaElementSource(music); musicNode.connect(AudioHub.musicBus); } catch (e) { musicNode = null; }
    }
    clearTimeout(musicStopT);
    if (target > 0 && music.paused) { const p = music.play(); if (p && p.catch) p.catch(() => {}); }
    if (musicNode) {
      AudioHub.ramp(AudioHub.musicBus.gain, target, target > 0 ? 1.2 : 1.4);
      if (target === 0) musicStopT = setTimeout(() => { try { music.pause(); } catch (e) { /* */ } }, 1500);
    } else {
      // no Web Audio: plain element volume (read-only on iOS, so pause to duck there)
      try { music.volume = target; } catch (e) { /* */ }
      if (target < MUSIC_VOL * .5) music.pause();
    }
  }

  function silenceAll(sec) {
    setMusic(0);
    return Song.fadeOut(sec);
  }

  const soundBtn = $('#soundBtn');
  function updateMuteUI() {
    const muted = state.userMuted || !state.interacted;
    soundBtn.classList.toggle('is-muted', muted);
    soundBtn.setAttribute('aria-pressed', String(muted));
    soundBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }

  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.interacted) { state.userMuted = false; primeMedia(); Story.applySound(); return; }
    state.userMuted = !state.userMuted;
    AudioHub.setMuted(state.userMuted);
    Story.applySound();
    updateMuteUI();
  });

  /* ---------------------------------------------------------------------
     Scenes
     --------------------------------------------------------------------- */
  const scenes = { gift: $('#gift'), intro: $('#intro'), garden: $('#garden'), story: $('#story'), dua: $('#dua'), letter: $('#letter') };

  async function crossfade(from, to, o) {
    o = o || {};
    const dur = reduced ? 800 : (o.dur || 1300);
    const fromEl = scenes[from], toEl = scenes[to];
    toEl.classList.add('is-active');
    toEl.style.zIndex = 3;
    const outA = fromEl && fromEl !== toEl ? animate(fromEl, reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.02)' }], { duration: dur, easing: BREATH }) : Promise.resolve();
    const inA = animate(toEl, reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'scale(.99)' }, { opacity: 1, transform: 'none' }], { duration: dur + 200, easing: BREATH, delay: o.delay || 0 });
    await Promise.all([outA, inA]);
    if (fromEl && fromEl !== toEl) fromEl.classList.remove('is-active');
    toEl.style.zIndex = '';
    cancelAnims(fromEl); cancelAnims(toEl);
  }

  function leaveScene(name, to) {
    if (name === 'garden') { closeCard(true); if (to === 'story') Song.fadeOut(4); }
    if (name === 'story') Story.stop();
    if (name === 'dua') Dua.stop();
  }

  async function goTo(name, o) {
    o = o || {};
    if (state.busy || state.scene === name) return;
    state.busy = true;
    const from = state.scene;
    leaveScene(from, name);
    state.scene = name;
    setSky(SKY_FOR[name]);
    if (name === 'garden') Garden.enter(o);
    if (name === 'dua') Dua.enter();
    if (name === 'letter') Letter.enter();
    if (name === 'story') { scenes.story.classList.add('is-active'); Story.start(0); }
    FX.setMode(name);
    await crossfade(from, name, o);
    state.busy = false;
    if (name === 'garden') Garden.afterEnter(o);
    if (name === 'dua') Dua.begin();
    if (name === 'letter') Letter.begin();
  }

  /* ---------------------------------------------------------------------
     Scene 0 — The gift (the first tap starts the song and unlocks media)
     --------------------------------------------------------------------- */
  const Gift = (function () {
    const sec = scenes.gift;
    const seal = $('#giftSeal');
    let ready = false, opened = false;

    function build() {
      $('#giftText').textContent = TEXT.giftText;
      $('#giftSub').textContent = Song.mode ? TEXT.giftSub : '';
    }

    function start() { setTimeout(() => { ready = true; }, 700); }

    function open(e) {
      if (!ready || opened) return;
      if (e) e.preventDefault();
      opened = true;
      // everything that needs the gesture happens right here, synchronously
      Parallax.request();
      primeMedia();
      Song.start();
      Intro.play(Song.mode === 'musicbox' ? Song.firstNoteMs : 450);

      vibrate(10);
      sec.classList.add('is-opening');
      seal.classList.add('is-open');
      const r = seal.getBoundingClientRect();
      const pts = [];
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; pts.push({ x: r.left + r.width / 2 + Math.cos(a) * r.width * .3, y: r.top + r.height / 2 + Math.sin(a) * r.height * .3 }); }
      FX.burst(pts, 2);
      setTimeout(() => goTo('intro', { dur: 1500 }), reduced ? 200 : 650);
    }

    sec.addEventListener('click', open);
    document.addEventListener('keydown', (e) => {
      if (state.scene === 'gift' && (e.key === 'Enter' || e.key === ' ')) { ready = true; open(e); }
    });
    return { build, start };
  })();

  /* ---------------------------------------------------------------------
     Scene 1 — Title
     --------------------------------------------------------------------- */
  const Intro = (function () {
    const title = $('#introTitle');
    const sub = $('#introSub');
    const tap = $('#tapEnter');
    let ready = false, leaving = false, count = 0, playing = false;

    function graphemes(str) {
      if (window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str), (s) => s.segment);
      return str.match(/\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|[\s\S]/gu) || [];
    }

    function build() {
      const text = String(CFG.title || 'HAPPY BIRTHDAY HABIBTI ❤️');
      const arabic = isArabic(text);
      let i = 0;
      title.textContent = '';
      title.setAttribute('aria-label', text);
      text.split(/\s+/).filter(Boolean).forEach((word, wi, arr) => {
        const w = el('span', 'word');
        w.setAttribute('aria-hidden', 'true');
        const parts = arabic ? [word] : graphemes(word);    // Arabic letters must stay joined
        parts.forEach((g) => {
          const c = el('span', 'ch');
          c.style.setProperty('--i', i++);
          if (/\p{Extended_Pictographic}/u.test(g)) { const b = el('span', 'beat'); b.textContent = g; c.appendChild(b); }
          else c.textContent = g;
          w.appendChild(c);
        });
        title.appendChild(w);
        if (wi < arr.length - 1) title.appendChild(document.createTextNode(' '));
      });
      title.querySelectorAll('.ch').forEach((c, j, all) => c.style.setProperty('--j', all.length - j));
      count = i;
      sub.textContent = TEXT.introSubtitle || '';
      tap.textContent = TEXT.enterGarden;
    }

    // the letters begin exactly with the first note
    function play(delayMs) {
      if (playing) return;
      playing = true;
      title.style.setProperty('--d0', Math.max(0, delayMs | 0) + 'ms');
      title.classList.add('is-playing');
      const lettersEnd = delayMs + (reduced ? count * 20 + 1200 : count * 85 + 1500);
      setTimeout(() => sub.classList.add('is-in'), lettersEnd - 200);
      setTimeout(() => { tap.classList.add('is-in'); ready = true; }, Math.max(3600, lettersEnd + 900));
    }

    async function enter(e) {
      if (!ready || leaving || state.busy) return;
      if (e) e.preventDefault();
      leaving = true;
      primeMedia();
      state.busy = true;

      const pts = Array.from(title.querySelectorAll('.ch')).map((c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      title.classList.add('is-leaving');
      FX.burst(pts);
      animate(sub, [{ opacity: .92 }, { opacity: 0 }], { duration: 900, easing: BREATH });
      tap.classList.remove('is-in');

      await wait(reduced ? 300 : 800);

      // the camera descends into the garden
      const g = scenes.garden;
      state.scene = 'garden';
      Garden.enter({});
      g.classList.add('is-active');
      g.style.zIndex = 3;
      FX.setMode('garden');
      Song.soften();
      const D = reduced ? 900 : 1600;
      const outA = animate(scenes.intro, reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        { opacity: 0, transform: 'translateY(-6%) scale(1.1)', filter: 'blur(8px)' }
      ], { duration: D, easing: BREATH });
      const inA = animate(g, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
        { opacity: 0, transform: 'translateY(8%) scale(1.12)', filter: 'blur(10px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' }
      ], { duration: D, easing: BREATH, delay: reduced ? 0 : 150 });
      await Promise.all([outA, inA]);
      scenes.intro.classList.remove('is-active');
      g.style.zIndex = '';
      cancelAnims(scenes.intro); cancelAnims(g);
      state.busy = false;
      Garden.afterEnter({});
    }

    scenes.intro.addEventListener('click', enter);
    tap.addEventListener('click', (e) => { e.stopPropagation(); enter(e); });
    document.addEventListener('keydown', (e) => {
      if (state.scene === 'intro' && (e.key === 'Enter' || e.key === ' ')) { ready = true; enter(e); }
    });

    return { build, play };
  })();

  /* ---------------------------------------------------------------------
     Flower drawings (inline SVG)
     --------------------------------------------------------------------- */
  function petalsRing(n, rx, ry, cy, fill, stroke, rot) {
    let s = '';
    for (let k = 0; k < n; k++) s += `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${(360 / n) * k + (rot || 0)})" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width=".5"` : ''}/>`;
    return s;
  }

  function bloomArt(type) {
    switch (type) {
      case 'rose':
        return `<g transform="translate(30 32)">
          ${petalsRing(5, 7.5, 8.5, -5.5, '#d9736c', '#b9544f', 18)}
          ${petalsRing(5, 6, 7, -3.5, '#ec9a8d', '#cf6f66', 54)}
          <circle r="5.4" fill="#f4b3a5"/>
          <path d="M-2.6 .5c0-2.6 2-4 4-3.4 2 .6 2.2 3.2.4 4.2-1.6.9-3.2-.4-2.6-1.8.4-1 1.6-1 2-.3" fill="none" stroke="#c45c55" stroke-width="1" stroke-linecap="round"/>
        </g>`;
      case 'jasmine': {
        const star = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${petalsRing(5, 2.9, 7.4, -6.6, '#fffdf6', '#e8dcc6', 0)}<circle r="2.1" fill="#f4dc8c"/></g>`;
        return `<g transform="translate(30 34)">
          <path d="M0 6 L-8 10 M0 6 L8 8" stroke="#6f8758" stroke-width="1.2"/>
          ${star(-8.5, 7, .78)}${star(8.5, 5, .84)}${star(0, -4, 1.05)}
          <ellipse cx="-14" cy="-2" rx="1.6" ry="3.6" fill="#f6e6e2" transform="rotate(-30 -14 -2)"/>
        </g>`;
      }
      case 'tulip':
        return `<g transform="translate(30 32)">
          <path d="M0 12C-11 11-13-3-8-13c2 4 5 6 8 7Z" fill="#e2783f"/>
          <path d="M0 12C11 11 13-3 8-13c-2 4-5 6-8 7Z" fill="#cf6430"/>
          <path d="M0 12C-7 9-7-6 0-15c7 9 7 24 0 27Z" fill="#f39a5b"/>
          <path d="M-1.5-9c-1.4 4-1.6 10-.4 16" stroke="#ffc58e" stroke-width="1" fill="none" opacity=".7" stroke-linecap="round"/>
        </g>`;
      case 'lavender': {
        let b = '';
        for (let k = 0; k < 13; k++) {
          const y = -20 + k * 2.6, side = k % 2 ? 1 : -1, x = side * (2.2 - k * .06);
          b += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="2.3" ry="3.1" fill="${k % 3 ? '#a58fd1' : '#c3b2e6'}" transform="rotate(${side * 22} ${x.toFixed(2)} ${y.toFixed(2)})"/>`;
        }
        return `<g transform="translate(30 36)">${b}<ellipse cx="0" cy="-22" rx="1.8" ry="2.6" fill="#d6c9f0"/></g>`;
      }
      case 'golden':
        return `<g transform="translate(30 30)">
          <circle r="17" fill="url(#goldGlow)" opacity=".9"/>
          ${petalsRing(8, 4.4, 10, -9.5, 'url(#goldPetal)', '#c88f2f', 0)}
          ${petalsRing(8, 2.8, 6, -5.6, '#fff1c9', '#e9b95c', 22.5)}
          <circle r="3.6" fill="#fff8e0"/><circle r="1.6" fill="#e9a53b"/>
        </g>`;
      default: // orange blossom (azahar)
        return `<g transform="translate(30 32)">
          ${petalsRing(5, 5.6, 9.6, -8.4, '#fffaf0', '#ead7bd', 0)}
          <circle r="3.6" fill="#f0b24a"/>
          ${[0, 1, 2, 3, 4, 5, 6].map((k) => { const a = k / 7 * 6.283; return `<line x1="0" y1="0" x2="${(Math.cos(a) * 4.6).toFixed(2)}" y2="${(Math.sin(a) * 4.6).toFixed(2)}" stroke="#f6e3a0" stroke-width=".7"/><circle cx="${(Math.cos(a) * 4.8).toFixed(2)}" cy="${(Math.sin(a) * 4.8).toFixed(2)}" r=".95" fill="#d9861f"/>`; }).join('')}
          <g transform="translate(13 12)"><path d="M-6-3 Q-3 0 0 0" stroke="#6f8758" stroke-width="1" fill="none"/><ellipse rx="2.6" ry="3.6" fill="#fbf3e2" stroke="#ead7bd" stroke-width=".5"/></g>
        </g>`;
    }
  }

  function flowerSVG(type) {
    const tall = type === 'lavender';
    const stemD = tall ? 'M30 98 C 29 84, 31 70, 30 20' : 'M30 98 C 27 82, 34 62, 30 40';
    const stemC = type === 'golden' ? '#9aa66a' : '#6f8a52';
    return `<svg class="flower" viewBox="0 0 60 100" aria-hidden="true">
      <circle class="bloom-glow" cx="30" cy="${tall ? 26 : 32}" r="20" fill="url(#seedGlow)" opacity=".55"/>
      <path class="stem" pathLength="1" d="${stemD}" stroke="${stemC}" stroke-width="2.1"/>
      <path class="leaf l1" style="transform-origin:29.5px 80px" d="M29.5 80 C 22 78, 15 72, 13 64 C 21 64, 27 70, 29.5 80Z" fill="#6f8758"/>
      <path class="leaf l2" style="transform-origin:30.5px 66px" d="M30.5 66 C 37 63, 43 57, 45 49 C 37 50, 32 56, 30.5 66Z" fill="#87a06a"/>
      <g class="bloom" style="transform-origin:30px ${tall ? 26 : 32}px">${bloomArt(type)}</g>
    </svg>`;
  }

  function seedSVG(gold) {
    return '<svg class="seed-dot" viewBox="0 0 40 40" aria-hidden="true"><circle class="halo" cx="20" cy="20" r="19" fill="url(#' + (gold ? 'goldGlow' : 'seedGlow') + ')"/>' +
      '<g class="seed-body"><ellipse cx="20" cy="21" rx="4.2" ry="5.6" fill="url(#seedBody)" transform="rotate(-18 20 21)"/></g></svg>';
  }

  /* ---------------------------------------------------------------------
     Olive tree + its geometric halo of light
     --------------------------------------------------------------------- */
  function treeSVG() {
    const r = rng(7);
    const clumps = [[120, 70, 40], [78, 92, 34], [162, 92, 34], [98, 52, 30], [146, 54, 30], [58, 118, 24], [184, 118, 24], [120, 104, 34], [120, 36, 24]];
    const cols = ['#8fa27a', '#748c5e', '#a9b993', '#5f7650', '#9fb187', '#c2cdb0'];
    let back = '';
    clumps.forEach(([cx, cy, rad]) => {
      for (let k = 0; k < rad * .6; k++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * rad * .8;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .78;
        back += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="2.6" fill="#3d4f36" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
    });
    let leaves = '';
    clumps.forEach(([cx, cy, rad]) => {
      const n = Math.round(rad * 1.5);
      for (let k = 0; k < n; k++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * rad;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .78;
        const rot = (a * 57.3 + (r() - .5) * 70).toFixed(0);
        leaves += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(5.5 + r() * 3.5).toFixed(1)}" ry="${(1.7 + r() * 1).toFixed(1)}" fill="${cols[(r() * cols.length) | 0]}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
    });
    let olives = '';
    for (let k = 0; k < 16; k++) {
      const c = clumps[(r() * clumps.length) | 0];
      const a = r() * 6.283, d = r() * c[2] * .8;
      olives += `<ellipse cx="${(c[0] + Math.cos(a) * d).toFixed(1)}" cy="${(c[1] + Math.sin(a) * d * .7).toFixed(1)}" rx="2.2" ry="2.9" fill="${k % 3 ? '#3e3350' : '#6b7d3a'}"/>`;
    }
    return `
      <defs><linearGradient id="trunkG" x1="0" x2="1"><stop offset="0" stop-color="#3b3128"/><stop offset=".5" stop-color="#6e5d4a"/><stop offset="1" stop-color="#3a3027"/></linearGradient></defs>
      <ellipse cx="120" cy="226" rx="62" ry="6" fill="#0c140f" opacity=".7"/>
      <g class="canopy">
        <path d="M108 228c4-20 2-38-6-54-6-12-18-22-30-30l6-4c12 6 22 14 30 24 0-14-4-28-12-40l6-2c10 12 14 28 14 44 4-16 12-30 24-40l5 4c-10 10-17 22-20 38 8-10 20-16 32-18l2 6c-14 4-26 12-32 26-4 14-2 32 4 46Z" fill="url(#trunkG)"/>
        <path d="M118 200c-2-12 0-24 6-34M110 188c-3-10-8-18-14-24" stroke="#2c241d" stroke-width="1.4" fill="none" opacity=".6"/>
        ${back}${leaves}${olives}
      </g>`;
  }

  function treeHaloSVG() {
    const star = (r, rot, op, w) => `<g transform="rotate(${rot})" fill="none" stroke="#f2d796" stroke-opacity="${op}" stroke-width="${w}"><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"/><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" transform="rotate(45)"/></g>`;
    let dots = '';
    for (let k = 0; k < 16; k++) { const a = k / 16 * 6.2832; dots += `<circle cx="${(Math.cos(a) * 86).toFixed(1)}" cy="${(Math.sin(a) * 86).toFixed(1)}" r=".9" fill="#f2d796" fill-opacity=".5"/>`; }
    return `<defs><radialGradient id="haloFill"><stop offset="0" stop-color="#ffe2a6" stop-opacity=".32"/><stop offset=".55" stop-color="#ffd38a" stop-opacity=".1"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/></radialGradient></defs>
      <circle r="98" fill="url(#haloFill)"/>
      <g class="halo-rot">
        ${star(48, 0, .13, .45)}${star(36, 22.5, .1, .4)}
        <circle r="70" fill="none" stroke="#f2d796" stroke-opacity=".14" stroke-width=".5" stroke-dasharray="2 4"/>
        <circle r="58" fill="none" stroke="#f2d796" stroke-opacity=".12" stroke-width=".4"/>
        ${dots}
      </g>`;
  }

  /* ---------------------------------------------------------------------
     Scene 2 — Garden
     --------------------------------------------------------------------- */
  const Garden = (function () {
    const sec = scenes.garden;
    const world = $('#gardenWorld');
    const inner = $('#gardenInner');
    const ground = $('#groundSvg');
    const tree = $('#tree');
    const seedsBox = $('#seeds');
    const counter = $('#counter');
    const playBtn = $('#playStory');
    const letterBtn = $('#openLetter');
    const hint = $('#scrollHint');
    const skyNote = $('#skyNote');
    let built = false, seedEls = [], goldSeed = null, revealedPlay = false, layoutKey = '', laidOutAt = 0, noteT = 0, horizonPx = 0, sinceT = 0;

    function build() {
      if (built) return;
      built = true;
      $('#gardenTitle').textContent = TEXT.gardenTitle;
      $('#gardenHint').textContent = TEXT.gardenHint;
      $('#treeLabel').textContent = TEXT.treeLabel;
      playBtn.querySelector('span').textContent = TEXT.playStory;
      letterBtn.querySelector('span').textContent = TEXT.openLetter;
      hint.querySelector('span').textContent = TEXT.gardenScrollHint;
      $('#treeSvg').innerHTML = treeSVG();
      $('#treeHalo').innerHTML = treeHaloSVG();
      tree.setAttribute('aria-label', TEXT.treeLabel + ' — ' + TEXT.certificateTitle);

      groups.forEach((g, gi) => {
        const b = el('button', 'seed');
        b.type = 'button';
        b.style.setProperty('--d', (-(gi * 0.37) % 4).toFixed(2) + 's');
        const label = [g.day, g.place].filter(Boolean).join(', ');
        b.setAttribute('aria-label', 'Memory ' + (gi + 1) + (label ? ': ' + label : ''));
        b.innerHTML = '<span class="soil"></span>' + flowerSVG(g.flower) + seedSVG(false);
        if (state.bloomed.has(g.key)) b.classList.add('is-bloomed');
        b.addEventListener('click', (e) => { e.stopPropagation(); onSeed(g, b); });
        seedsBox.appendChild(b);
        seedEls.push(b);
      });

      if (CFG.surprise) {
        goldSeed = el('button', 'seed gold');
        goldSeed.type = 'button';
        goldSeed.setAttribute('aria-label', TEXT.surpriseHint);
        goldSeed.innerHTML = '<span class="soil"></span>' + flowerSVG('golden') + seedSVG(true);
        if (state.surpriseBloomed) goldSeed.classList.add('is-bloomed');
        if (state.letterRead && state.surpriseSeen) goldSeed.classList.add('is-shown');
        goldSeed.addEventListener('click', (e) => { e.stopPropagation(); onGoldSeed(); });
        seedsBox.appendChild(goldSeed);
      }

      tree.addEventListener('click', (e) => { e.stopPropagation(); openCertificate(); });
      tree.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCertificate(); } });
      playBtn.addEventListener('click', () => { primeMedia(); goTo('story'); });
      letterBtn.addEventListener('click', () => goTo('letter'));
      world.addEventListener('scroll', () => { if (performance.now() - laidOutAt > 600) hint.classList.remove('is-in'); }, { passive: true });
      // tapping the open sky
      world.addEventListener('click', (e) => {
        if (e.target.closest('.seed, .tree, button')) return;
        if (e.clientY < horizonPx - 8) showSkyNote();
      });

      let rt = 0;
      window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (state.scene === 'garden') layout(); }, 160); });
      setupSince();
      updateCounter();
    }

    function toast(text, ms) {
      if (!text) return;
      skyNote.textContent = text;
      skyNote.classList.add('is-in');
      clearTimeout(noteT);
      noteT = setTimeout(() => skyNote.classList.remove('is-in'), ms || 5200);
    }

    function showSkyNote() { Starfield.highlight(); toast(TEXT.skyNote, 5600); }

    function openCertificate() {
      const src = String(CFG.oliveCertificate || '').trim();
      openCard({
        items: src ? [{ i: -1, type: 'image', src, day: TEXT.certificateMeta, place: '', caption: TEXT.certificateTitle }] : [],
        meta: TEXT.certificateMeta, caption: TEXT.certificateTitle, missing: ' '
      }, tree);
    }

    /* live counter since the first hug */
    function setupSince() {
      const box = $('#since');
      const t0 = Date.parse(CFG.metAt || '');
      if (!CFG.metAt || isNaN(t0)) { box.hidden = true; return; }
      $('#sinceLabel').textContent = TEXT.sinceLabel.replace('{place}', CFG.metPlace || '').replace(/\s+at\s*$/, '').trim();
      const out = $('#sinceTime');
      const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
      const tick = () => {
        let ms = Date.now() - t0;
        if (ms < 0) ms = 0;
        const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
        out.textContent = [plural(d, 'day'), plural(h, 'hour'), plural(mm, 'minute')].join('  ·  ');
      };
      tick();
      clearInterval(sinceT);
      sinceT = setInterval(tick, 15000);
    }

    function layout() {
      const vw = sec.clientWidth, vh = sec.clientHeight;
      const key = vw + 'x' + vh;
      if (key === layoutKey) return;
      layoutKey = key;

      const landscape = vw > vh * 1.15;
      const horizon = Math.round(vh * .585);
      horizonPx = horizon;
      sec.style.setProperty('--horizon', horizon + 'px');

      const sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
      const N = groups.length;
      const fh = clamp(vh * .13, 70, landscape ? 118 : 108);
      const fw = fh * .62;
      const spacing = vw < 520 ? 64 : clamp(fw * 1.45, 80, 120);
      const margin = vw < 520 ? 26 : 60;
      const yTop = horizon + Math.max(fh * .82, vh * .12);
      const yBot = vh - sab - 100;
      const rowGap = 46;
      const rowsMax = clamp(Math.floor((yBot - yTop) / rowGap) + 1, 1, 4);
      const capPerRow = Math.max(1, Math.floor((vw - margin * 2) / spacing));

      let worldW = vw, rows;
      if (N <= rowsMax * capPerRow) rows = Math.min(rowsMax, Math.max(Math.ceil(N / capPerRow), N >= 5 ? 2 : 1));
      else { rows = rowsMax; worldW = Math.ceil(N / rows) * spacing + margin * 2; }
      rows = Math.max(1, Math.min(rows, N || 1));
      inner.style.width = worldW + 'px';

      const treeW = clamp(Math.min(vw * (landscape ? .3 : .54), vh * .34), 150, 360);
      const treeH = treeW * 230 / 240;
      tree.style.width = treeW + 'px';
      tree.style.left = (worldW / 2) + 'px';
      tree.style.top = (horizon - treeH + treeW * .012) + 'px';

      buildGround(worldW, vh, horizon, treeW);

      const counts = [];
      for (let r = 0; r < rows; r++) counts.push(Math.floor(N / rows) + (r >= rows - (N % rows) ? 1 : 0));
      let gi = 0;
      const labelBottom = horizon + 30;
      for (let r = 0; r < rows; r++) {
        const n = counts[r];
        const y0 = rows === 1 ? (yTop + yBot) / 2 : yTop + r * (yBot - yTop) / (rows - 1);
        const sc = rows === 1 ? 1 : .84 + .16 * (r / (rows - 1));
        const step = (worldW - margin * 2) / Math.max(1, n);
        for (let j = 0; j < n; j++, gi++) {
          const rand = rng(gi + 11);
          let x = margin + step * (j + .5) + (rand() - .5) * step * .4 + (r % 2 ? step * .12 : -step * .12);
          const y = y0 + (rand() - .5) * 14;
          if (y - fh * sc < labelBottom && Math.abs(x - worldW / 2) < treeW * .28) x = worldW / 2 + Math.sign(x - worldW / 2 || 1) * treeW * .3;
          x = clamp(x, 28, worldW - 28);
          const b = seedEls[gi];
          b.style.left = x.toFixed(1) + 'px';
          b.style.top = y.toFixed(1) + 'px';
          b.style.zIndex = 10 + r;
          b.style.setProperty('--s', sc.toFixed(3));
          b.style.setProperty('--fw', fw.toFixed(1) + 'px');
          b.style.setProperty('--fh', fh.toFixed(1) + 'px');
        }
      }

      if (goldSeed) {
        // at the foot of the olive tree, a little to the right
        goldSeed.style.left = (worldW / 2 + treeW * .36) + 'px';
        goldSeed.style.top = (horizon + 14) + 'px';
        goldSeed.style.zIndex = 9;
        goldSeed.style.setProperty('--fw', (fw * .9).toFixed(1) + 'px');
        goldSeed.style.setProperty('--fh', (fh * .78).toFixed(1) + 'px');
      }

      const scrollable = worldW > vw + 2;
      laidOutAt = performance.now();
      world.scrollLeft = scrollable ? (worldW - vw) / 2 : 0;
      hint.classList.toggle('is-in', scrollable);
    }

    function buildGround(W, H, hz, treeW) {
      const r = rng(3);
      const X0 = -40, X1 = W + 40;
      ground.setAttribute('width', W);
      ground.setAttribute('height', H);
      ground.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const blades = (y0, hMin, hMax, stepMin, stepMax, rr) => {
        let d = '';
        for (let x = X0; x < X1; x += stepMin + rr() * (stepMax - stepMin)) {
          const h = hMin + rr() * (hMax - hMin), lean = (rr() - .5) * 9, w = 1.4 + rr() * 1.4, yb = y0 + (rr() - .5) * 3;
          d += `M${(x - w).toFixed(1)} ${yb.toFixed(1)}Q${(x + lean * .3).toFixed(1)} ${(yb - h * .6).toFixed(1)} ${(x + lean).toFixed(1)} ${(yb - h).toFixed(1)}Q${(x + lean * .2 + .4).toFixed(1)} ${(yb - h * .5).toFixed(1)} ${(x + w).toFixed(1)} ${yb.toFixed(1)}Z`;
        }
        return d;
      };
      const hill = `M${X0} ${hz + 4} C ${W * .22} ${hz - 10}, ${W * .38} ${hz + 6}, ${W * .5} ${hz - 4} S ${W * .82} ${hz + 8}, ${X1} ${hz - 2} L ${X1} ${H + 40} L ${X0} ${H + 40} Z`;
      let dots = '';
      for (let k = 0; k < Math.round(W / 22); k++) {
        const x = r() * W, y = hz + 8 + Math.pow(r(), 1.6) * (H - hz - 20);
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.3).toFixed(1)}" fill="${r() > .3 ? '#f6ecd8' : '#f2c27e'}" opacity="${(.25 + r() * .45).toFixed(2)}"/>`;
      }
      ground.innerHTML = `
        <defs>
          <linearGradient id="gFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22382a"/><stop offset=".25" stop-color="#18291e"/><stop offset="1" stop-color="#09110c"/></linearGradient>
          <radialGradient id="gMound" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4a5f3a" stop-opacity=".8"/><stop offset="1" stop-color="#3a5236" stop-opacity="0"/></radialGradient>
          <linearGradient id="gRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b56c" stop-opacity=".38"/><stop offset="1" stop-color="#e7b56c" stop-opacity="0"/></linearGradient>
        </defs>
        <path d="${hill}" fill="url(#gFill)"/>
        <path d="${hill}" fill="none" stroke="url(#gRim)" stroke-width="2"/>
        <ellipse cx="${W / 2}" cy="${hz + 4}" rx="${treeW * .8}" ry="${Math.max(12, H * .026)}" fill="url(#gMound)"/>
        <g class="grass-sway"><path d="${blades(hz + 6, 6, 18, 3, 7, rng(5))}" fill="#2f4831"/></g>
        <g class="grass-sway b"><path d="${blades(hz + 10, 4, 12, 4, 9, rng(6))}" fill="#3d5a3a"/></g>
        ${dots}
        <g class="grass-sway b"><path d="${blades(H + 4, 14, 34, 4, 8, rng(8))}" fill="#0f1c13"/></g>
        <g class="grass-sway"><path d="${blades(H + 6, 8, 22, 5, 10, rng(9))}" fill="#16271a"/></g>`;
    }

    function bloomedMemoryCount() {
      let n = 0;
      groups.forEach((g) => { if (state.bloomed.has(g.key)) n += g.items.length; });
      return n;
    }

    function updateCounter() {
      counter.textContent = gardenMemories.length ? TEXT.counter.replace('{n}', bloomedMemoryCount()).replace('{total}', gardenMemories.length) : '';
      const need = Math.max(1, Math.min(Number(CFG.unlockAfter) || 3, groups.length));
      const unlocked = state.bloomed.size >= need || groups.length === 0;
      if (unlocked && playBtn.hidden) revealPlay(state.scene === 'garden' && !revealedPlay);
      letterBtn.hidden = !state.storyDone;
    }

    function revealPlay(rise) {
      playBtn.hidden = false;
      revealedPlay = true;
      if (!rise || reduced) { animate(playBtn, [{ opacity: 0 }, { opacity: 1 }], { duration: 1200, easing: BREATH }); return; }
      const tr = tree.getBoundingClientRect(), br = playBtn.getBoundingClientRect();
      const dy = (tr.top + tr.height * .45) - (br.top + br.height / 2);
      animate(playBtn, [
        { opacity: 0, transform: `translateY(${dy}px) scale(.3)` },
        { opacity: 1, offset: .45 },
        { opacity: 1, transform: 'none' }
      ], { duration: 2200, easing: BREATH });
    }

    function onSeed(g, b) {
      if (b.classList.contains('is-growing')) return;
      if (state.bloomed.has(g.key) || b.classList.contains('is-bloomed')) { openCard(g, b); return; }
      const wasAll = state.bloomed.size >= groups.length;
      b.classList.add('is-growing');
      state.bloomed.add(g.key);
      persist();
      vibrate(12);
      const last = !wasAll && state.bloomed.size === groups.length;
      const r = b.getBoundingClientRect();
      const T = reduced ? 800 : 1550;
      setTimeout(() => { FX.burst([{ x: r.left + r.width / 2, y: r.top - r.height * .6 }]); }, reduced ? 0 : 1200);
      setTimeout(() => {
        b.classList.remove('is-growing');
        b.classList.add('is-bloomed', 'is-settling');
        setTimeout(() => b.classList.remove('is-settling'), 2400);
        updateCounter();
        if (last) {
          // every flower has bloomed: a little heart of petals rises over the tree
          const tr = tree.getBoundingClientRect();
          FX.heart(window.innerWidth / 2, Math.max(120, tr.top + tr.height * .25), Math.min(window.innerWidth, 420) * .22);
          setTimeout(() => openCard(g, b), reduced ? 400 : 3000);
        } else openCard(g, b);
      }, T);
    }

    function onGoldSeed() {
      if (!goldSeed) return;
      if (goldSeed.classList.contains('is-bloomed')) { Surprise.open(); return; }
      if (goldSeed.classList.contains('is-growing')) return;
      goldSeed.classList.add('is-growing');
      vibrate([10, 60, 10]);
      state.surpriseBloomed = true; persist();
      const r = goldSeed.getBoundingClientRect();
      setTimeout(() => FX.burst([{ x: r.left + r.width / 2, y: r.top - r.height }], 6), reduced ? 0 : 1200);
      setTimeout(() => {
        goldSeed.classList.remove('is-growing');
        goldSeed.classList.add('is-bloomed', 'is-settling');
        Surprise.open();
      }, reduced ? 800 : 1700);
    }

    function revealSurprise() {
      if (!goldSeed || !state.letterRead) return;
      if (goldSeed.classList.contains('is-shown')) return;
      state.surpriseSeen = true; persist();
      setTimeout(() => {
        goldSeed.classList.add('is-shown');
        const r = goldSeed.getBoundingClientRect();
        FX.burst([{ x: r.left + r.width / 2, y: r.top + r.height / 2 }], 4);
        toast(TEXT.surpriseHint, 4200);
      }, 900);
    }

    function enter() {
      build();
      layoutKey = '';
      layout();
      updateCounter();
    }

    function afterEnter() {
      updateCounter();
      if (state.letterRead && goldSeed && !goldSeed.classList.contains('is-shown')) revealSurprise();
    }

    return { enter, afterEnter, updateCounter };
  })();

  /* ---------------------------------------------------------------------
     Memory card (bottom sheet / modal, frosted glass)
     --------------------------------------------------------------------- */
  const cardEl = $('#card');
  const sheet = $('.card-sheet', cardEl);
  const track = $('#cardTrack');
  const dots = $('#cardDots');
  const cardMeta = $('#cardMeta');
  const cardCaption = $('#cardCaption');
  let cardItems = [], cardIndex = 0, cardReturn = null, cardOpen = false, currentGroup = null;

  const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>';
  const CHEV = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function cardSlide(m) {
    const slide = el('div', 'card-slide');
    const box = el('div', 'card-media is-loading');
    slide.appendChild(box);
    const fail = () => {
      broken.add(m.i);
      const idx = cardItems.indexOf(m);
      if (idx > -1) { cardItems.splice(idx, 1); slide.remove(); renderDots(); }
      if (!cardItems.length) showMissing();
      else setCardIndex(Math.min(cardIndex, cardItems.length - 1), true);
    };
    if (m.type === 'video') {
      const v = document.createElement('video');
      v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.playsInline = true; v.preload = 'auto';
      if (m.poster) v.poster = m.poster;
      v.addEventListener('loadedmetadata', () => { box.classList.remove('is-loading'); box.classList.add('is-loaded'); }, { once: true });
      v.addEventListener('error', fail, { once: true });
      v.addEventListener('play', () => { box.classList.remove('is-loading'); box.classList.add('is-loaded', 'is-playing'); });
      v.addEventListener('pause', () => box.classList.remove('is-playing'));
      v.addEventListener('ended', () => box.classList.remove('is-playing'));
      v.src = m.src + (m.poster ? '' : '#t=0.1');
      const pb = el('button', 'play-btn', PLAY_ICON);
      pb.type = 'button'; pb.setAttribute('aria-label', 'Play video');
      const toggle = (e) => { e.stopPropagation(); primeMedia(); if (v.paused) { v.muted = state.userMuted; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); } else v.pause(); };
      pb.addEventListener('click', toggle);
      v.addEventListener('click', toggle);
      box.appendChild(v); box.appendChild(pb);
    } else {
      const img = new Image();
      img.alt = [m.caption, m.day, m.place].filter(Boolean).join(' - ');
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('load', () => { box.classList.remove('is-loading'); box.classList.add('is-loaded'); }, { once: true });
      img.addEventListener('error', fail, { once: true });
      img.src = m.src;
      box.appendChild(img);
    }
    return slide;
  }

  function showMissing() {
    track.innerHTML = '';
    track.classList.add('is-single');
    const g = currentGroup || { items: [] };
    const first = g.items[0] || {};
    const s = el('div', 'card-slide');
    const msg = g.missing != null ? g.missing.trim() : TEXT.missingMemory;
    s.appendChild(el('div', 'card-missing', flowerSVG(g.missing != null ? 'golden' : 'orange-blossom') + (msg ? '<p>' + esc(msg) + '</p>' : '')));
    track.appendChild(s);
    dots.innerHTML = '';
    cardMeta.textContent = g.meta != null ? g.meta : metaLine(first);
    cardCaption.textContent = g.caption != null ? g.caption : (first.caption || '');
  }

  function renderDots() {
    dots.innerHTML = '';
    if (cardItems.length < 2) { track.classList.add('is-single'); sheet.querySelectorAll('.card-nav').forEach((n) => n.remove()); return; }
    cardItems.forEach((_, k) => { const d = el('i'); if (k === cardIndex) d.className = 'on'; dots.appendChild(d); });
  }

  function setCardIndex(i, force) {
    i = clamp(i, 0, Math.max(0, cardItems.length - 1));
    if (i === cardIndex && !force) return;
    cardIndex = i;
    const m = cardItems[i];
    if (!m) return;
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === i));
    cardCaption.classList.add('is-swap'); cardMeta.classList.add('is-swap');
    setTimeout(() => {
      cardMeta.textContent = metaLine(m);
      cardCaption.textContent = m.caption;
      cardCaption.classList.remove('is-swap'); cardMeta.classList.remove('is-swap');
    }, force ? 0 : 260);
    track.querySelectorAll('video').forEach((v) => { if (!v.paused && v.closest('.card-slide') !== track.children[i]) v.pause(); });
  }

  function openCard(g, from) {
    currentGroup = g;
    cardReturn = from || null;
    cardItems = g.items.filter((m) => !broken.has(m.i));
    cardIndex = 0;
    track.innerHTML = '';
    track.classList.toggle('is-single', cardItems.length < 2);
    sheet.querySelectorAll('.card-nav').forEach((n) => n.remove());
    if (!cardItems.length) showMissing();
    else {
      cardItems.forEach((m) => track.appendChild(cardSlide(m)));
      renderDots();
      cardMeta.textContent = metaLine(cardItems[0]);
      cardCaption.textContent = cardItems[0].caption;
      if (cardItems.length > 1) {
        const prev = el('button', 'icon-btn card-nav prev', CHEV('M15 6l-6 6 6 6'));
        const next = el('button', 'icon-btn card-nav next', CHEV('M9 6l6 6-6 6'));
        prev.type = next.type = 'button';
        prev.setAttribute('aria-label', 'Previous'); next.setAttribute('aria-label', 'Next');
        const go = (d) => (e) => { e.stopPropagation(); track.scrollTo({ left: (cardIndex + d) * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' }); };
        prev.addEventListener('click', go(-1)); next.addEventListener('click', go(1));
        [prev, next].forEach((b) => $('#cardStage').appendChild(b));
      }
    }
    cardEl.hidden = false;
    track.scrollLeft = 0;
    sheet.style.transform = '';
    requestAnimationFrame(() => requestAnimationFrame(() => cardEl.classList.add('is-open')));
    cardOpen = true;
    setTimeout(() => { const c = $('.card-close', cardEl); if (c) c.focus({ preventScroll: true }); }, 500);
  }

  function closeCard(instant) {
    if (!cardOpen) return;
    cardOpen = false;
    track.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch (e) { /* */ } });
    cardEl.classList.remove('is-open', 'is-dragging');
    sheet.style.transform = '';
    const done = () => {
      if (cardOpen) return;
      cardEl.hidden = true;
      track.querySelectorAll('video').forEach((v) => { v.removeAttribute('src'); v.load(); });
      track.innerHTML = '';
    };
    if (instant) done(); else setTimeout(done, 950);
    if (cardReturn && !instant) { try { cardReturn.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

  cardEl.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeCard(); });
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i !== cardIndex) setCardIndex(i);
  }, { passive: true });

  // swipe down to close
  (function () {
    let y0 = 0, x0 = 0, dy = 0, t0 = 0, active = false, decided = false, vertical = false, pid = null;
    sheet.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button, video')) return;
      active = true; decided = false; vertical = false; dy = 0;
      y0 = e.clientY; x0 = e.clientX; t0 = performance.now(); pid = e.pointerId;
    });
    sheet.addEventListener('pointermove', (e) => {
      if (!active || e.pointerId !== pid) return;
      const ddx = e.clientX - x0, ddy = e.clientY - y0;
      if (!decided && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
        decided = true;
        vertical = Math.abs(ddy) > Math.abs(ddx) && ddy > 0;
        if (vertical) { cardEl.classList.add('is-dragging'); try { sheet.setPointerCapture(pid); } catch (err) { /* */ } }
      }
      if (!vertical) return;
      dy = Math.max(0, ddy);
      const desktop = matchMedia('(min-width: 760px) and (min-height: 560px)').matches;
      sheet.style.transform = desktop ? `translate(-50%, calc(-50% + ${dy}px))` : `translateY(${dy}px)`;
    });
    const end = (e) => {
      if (!active || (e && e.pointerId !== pid)) return;
      active = false;
      if (!vertical) return;
      cardEl.classList.remove('is-dragging');
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 110 || v > .6) closeCard(); else sheet.style.transform = '';
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
  })();

  /* ---------------------------------------------------------------------
     The hidden surprise
     --------------------------------------------------------------------- */
  const Surprise = (function () {
    const box = $('#surprise');
    let open = false;
    function show() {
      if (!CFG.surprise) return;
      $('#surpriseText').textContent = CFG.surprise;
      box.hidden = false;
      open = true;
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-in')));
      FX.shower(reduced ? 1200 : 2600, 12);
      setTimeout(() => { try { $('#surpriseClose').focus({ preventScroll: true }); } catch (e) { /* */ } }, 600);
    }
    function close() {
      if (!open) return;
      open = false;
      box.classList.remove('is-in');
      setTimeout(() => { if (!open) box.hidden = true; }, 1400);
    }
    box.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') close(); });
    return { open: show, close, get isOpen() { return open; } };
  })();

  /* ---------------------------------------------------------------------
     Scene 3 — Story player
     --------------------------------------------------------------------- */
  const Story = (function () {
    const sec = scenes.story;
    const stage = $('#stage');
    const bars = $('#bars');
    const cap = $('#storyCaption');
    const capMeta = $('.story-meta', cap);
    const capText = $('.story-text', cap);
    const black = $('#storyBlack');
    const soundHint = $('#soundHint');
    let idx = -1, running = false, paused = false, holdPaused = false, cur = null, prep = new Map(), raf = 0, elapsed = 0, lastT = 0, finishing = false, token = 0, spinner = null, stallT = 0, lastVT = -1;
    const videoOrder = new Map();
    memories.filter((m) => m.type === 'video').forEach((m, k) => videoOrder.set(m.i, k));

    function buildBars() {
      bars.innerHTML = '';
      memories.forEach((m) => { const b = el('div', 'bar' + (broken.has(m.i) ? ' skip' : '')); b.appendChild(el('i')); bars.appendChild(b); });
    }
    function setBar(i, p) { const b = bars.children[i]; if (b) b.firstChild.style.transform = `scaleX(${clamp(p, 0, 1).toFixed(4)})`; }
    function syncBars() {
      Array.from(bars.children).forEach((b, k) => {
        b.classList.toggle('skip', broken.has(memories[k].i));
        b.firstChild.style.transform = k < idx ? 'scaleX(1)' : 'scaleX(0)';
      });
    }

    function soundOn() { return state.interacted && !state.userMuted; }

    function fitFor(w, h) {
      if (!w || !h) return 'cover';
      const ar = w / h, sr = stage.clientWidth / Math.max(1, stage.clientHeight);
      return Math.abs(Math.log(ar / sr)) < .38 ? 'cover' : 'contain';
    }

    function prepare(i) {
      if (prep.has(i)) return prep.get(i);
      const m = memories[i];
      const slide = el('div', 'slide');
      const kb = el('div', 'slide-kb');
      slide.appendChild(kb);
      const item = { i, m, slide, kb, media: null, ready: null, fit: 'cover' };
      if (m.type === 'video') {
        const v = videoPool[(videoOrder.get(m.i) || 0) % 2];
        item.media = v;
        item.ready = new Promise((res, rej) => {
          let done = false;
          const ok = () => { if (done) return; done = true; cleanup(); item.fit = fitFor(v.videoWidth, v.videoHeight); res(item); };
          const bad = () => { if (done) return; done = true; cleanup(); rej(new Error('video')); };
          const to = setTimeout(() => (v.readyState >= 2 ? ok() : bad()), 12000);
          const cleanup = () => { clearTimeout(to); v.removeEventListener('loadeddata', ok); v.removeEventListener('canplay', ok); v.removeEventListener('error', bad); };
          v.addEventListener('loadeddata', ok); v.addEventListener('canplay', ok); v.addEventListener('error', bad);
          try { v.pause(); } catch (e) { /* */ }
          const abs = new URL(m.src, location.href).href;
          if (v.src !== abs) { v.src = m.src; v.load(); } else if (v.readyState >= 2) { try { v.currentTime = 0; } catch (e) { /* */ } ok(); }
          if (m.poster) v.poster = m.poster; else v.removeAttribute('poster');
          v.muted = !soundOn();
        });
      } else {
        const img = new Image();
        img.decoding = 'async';
        img.alt = m.caption || '';
        img.draggable = false;
        item.media = img;
        item.ready = new Promise((res, rej) => {
          img.onload = () => {
            item.fit = fitFor(img.naturalWidth, img.naturalHeight);
            (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(item));
          };
          img.onerror = () => rej(new Error('image'));
          img.src = m.src;
        });
      }
      item.ready.catch(() => {});
      prep.set(i, item);
      return item;
    }

    function nextValid(from, dir) {
      let i = from;
      while (i >= 0 && i < memories.length) { if (!broken.has(memories[i].i)) return i; i += dir; }
      return -1;
    }

    function showSpinner(on) {
      if (on && !spinner) { spinner = el('div', 'story-spinner'); stage.appendChild(spinner); }
      if (!on && spinner) { spinner.remove(); spinner = null; }
    }

    async function show(i, dir) {
      const my = ++token;
      i = nextValid(i, dir || 1);
      if (i < 0) { if ((dir || 1) > 0) finish(); return; }
      const item = prepare(i);
      const st = setTimeout(() => { if (my === token) showSpinner(true); }, 400);
      try { await item.ready; } catch (e) {
        clearTimeout(st); showSpinner(false);
        if (my !== token) return;
        broken.add(item.m.i); prep.delete(i); syncBars();
        return show(i + (dir || 1), dir || 1);
      }
      clearTimeout(st); showSpinner(false);
      if (my !== token || !running) return;

      const prevItem = cur;
      idx = i; cur = item; elapsed = 0; lastVT = -1; stallT = 0;
      syncBars();
      setBar(i, 0);

      const { slide, kb, media, m } = item;
      kb.innerHTML = '';
      slide.querySelectorAll('.slide-bg').forEach((n) => n.remove());
      slide.classList.toggle('fit-contain', item.fit === 'contain');
      if (item.fit === 'contain' && m.type === 'image') {
        const bg = new Image(); bg.className = 'slide-bg'; bg.alt = ''; bg.src = m.src; slide.insertBefore(bg, kb);
      }
      kb.appendChild(media);
      stage.appendChild(slide);

      // Ken Burns: a slow, eased zoom and drift
      if (item.kbAnim) { item.kbAnim.cancel(); item.kbAnim = null; }
      if (m.type === 'image' && !reduced) {
        const r = rng(m.i + 5);
        const s0 = 1.02 + r() * .04, s1 = 1.12 + r() * .06;
        const ax = (r() - .5) * 5, ay = (r() - .5) * 4;
        const fwd = r() > .5;
        const a = `scale(${s0}) translate(${ax}%, ${ay}%)`, b = `scale(${s1}) translate(${-ax}%, ${-ay}%)`;
        item.kbAnim = kb.animate([{ transform: fwd ? a : b }, { transform: fwd ? b : a }], { duration: PHOTO_MS + 1600, easing: BREATH, fill: 'both' });
      }

      slide.style.zIndex = 2;
      const inA = slide.animate(reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'scale(1.04)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: 1100, easing: BREATH, fill: 'both' });
      if (prevItem && prevItem.slide !== slide) {
        const ps = prevItem.slide;
        ps.style.zIndex = 1;
        const pm = prevItem.media;
        ps.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.02)' }], { duration: 1100, easing: BREATH, fill: 'both' })
          .finished.then(() => {
            if (cur && cur.slide === ps) return;
            ps.remove();
            if (pm && pm.tagName === 'VIDEO' && (!cur || cur.media !== pm)) { try { pm.pause(); } catch (e) { /* */ } }
          }, () => {});
        if (pm && pm.tagName === 'VIDEO' && pm !== media) fadeOutVideo(pm);
      }
      inA.finished.then(() => { slide.style.zIndex = ''; }, () => {});

      cap.classList.remove('is-in');
      capMeta.textContent = metaLine(m);
      capText.textContent = m.caption;
      void cap.offsetWidth;
      setTimeout(() => { if (cur === item) cap.classList.add('is-in'); }, 520);

      if (m.type === 'video') {
        media.muted = !soundOn();
        try { media.currentTime = 0; } catch (e) { /* */ }
        playVideo(media);
        setMusic(MUSIC_VOL * .15);
      } else {
        setMusic(MUSIC_VOL);
      }
      if (paused) pauseMedia();

      const n = nextValid(i + 1, 1);
      prep.forEach((it, k) => { if (k !== i && k !== n && (!prevItem || k !== prevItem.i)) prep.delete(k); });
      if (n > -1) setTimeout(() => { if (running && cur === item) prepare(n); }, 1200);

      loop();
    }

    function playVideo(v) {
      const p = v.play();
      if (p && p.catch) p.catch(() => { if (!v.muted) { v.muted = true; showSoundHint(true); v.play().catch(() => {}); } });
    }

    function fadeOutVideo(v) {
      if (v.muted) return;
      const start = v.volume;
      let k = 0;
      const t = setInterval(() => { k++; try { v.volume = Math.max(0, start * (1 - k / 10)); } catch (e) { /* */ } if (k >= 10) { clearInterval(t); try { v.pause(); v.volume = 1; } catch (e) { /* */ } } }, 70);
    }

    function showSoundHint(on) { soundHint.hidden = !on || state.userMuted; }

    function duration() {
      if (!cur) return PHOTO_MS;
      if (cur.m.type === 'video') { const d = cur.media.duration; return (isFinite(d) && d > 0 ? Math.min(d, MAX_VIDEO_S) : MAX_VIDEO_S) * 1000; }
      return PHOTO_MS;
    }

    function loop() {
      cancelAnimationFrame(raf);
      lastT = performance.now();
      const tick = (now) => {
        if (!running || finishing) return;
        const dt = now - lastT; lastT = now;
        if (cur && !paused) {
          let p;
          if (cur.m.type === 'video') {
            const v = cur.media, t = v.currentTime || 0;
            p = (t * 1000) / duration();
            if (v.ended) p = 1;
            if (t === lastVT && !v.paused) stallT += dt; else stallT = 0;
            if (v.paused && v.readyState >= 2 && !paused) stallT += dt;
            lastVT = t;
            if (stallT > 9000) { stallT = 0; return next(); }
          } else { elapsed += dt; p = elapsed / PHOTO_MS; }
          setBar(idx, p);
          if (p >= 1) return next();
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function pauseMedia() { if (!cur) return; if (cur.kbAnim) cur.kbAnim.pause(); if (cur.m.type === 'video') { try { cur.media.pause(); } catch (e) { /* */ } } }
    function resumeMedia() { if (!cur) return; if (cur.kbAnim) cur.kbAnim.play(); if (cur.m.type === 'video') playVideo(cur.media); }

    function setPaused(on) {
      if (paused === on) return;
      paused = on;
      sec.classList.toggle('is-paused', on);
      if (on) pauseMedia(); else { resumeMedia(); lastT = performance.now(); }
    }

    function next() { if (!running || finishing) return; show(idx + 1, 1); }
    function prev() {
      if (!running || finishing) return;
      const p = nextValid(idx - 1, -1);
      if (p < 0) { show(idx, 1); return; }
      show(p, -1);
    }

    function start(from) {
      stop(true);
      running = true; finishing = false; paused = false; holdPaused = false;
      sec.classList.remove('is-paused');
      black.classList.remove('is-in');
      stage.querySelectorAll('.slide').forEach((n) => n.remove());
      buildBars();
      cur = null; idx = -1;
      showSoundHint(!state.interacted);
      soundHint.textContent = TEXT.storyTapForSound;
      if (!memories.length) { finish(); return; }
      show(from || 0, 1);
    }

    function stop(keepMusic) {
      running = false;
      token++;
      cancelAnimationFrame(raf);
      videoPool.forEach((v) => { try { v.pause(); } catch (e) { /* */ } });
      prep.clear();
      showSpinner(false);
      cap.classList.remove('is-in');
      if (!keepMusic && !finishing) setMusic(0);
    }

    async function finish() {
      if (finishing) return;
      finishing = true;
      running = false;
      cancelAnimationFrame(raf);
      if (idx > -1) setBar(idx, 1);
      state.storyDone = true; persist();
      cap.classList.remove('is-in');
      videoPool.forEach((v) => fadeOutVideo(v));
      black.classList.add('is-in');
      // all music fades out completely before the dua
      const quiet = silenceAll(1.6);
      await wait(reduced ? 600 : 1500);
      FX.setMode('none');
      FX.shower(reduced ? 1200 : 3000, 26);
      await Promise.all([quiet, wait(reduced ? 800 : 2600)]);
      videoPool.forEach((v) => { try { v.pause(); } catch (e) { /* */ } });
      stage.querySelectorAll('.slide').forEach((n) => n.remove());
      finishing = false;
      state.busy = false;
      state.scene = 'story';
      goTo(duas.length ? 'dua' : 'letter', { dur: 1600 });
    }

    function applySound() {
      const on = soundOn();
      if (cur && cur.m.type === 'video') {
        cur.media.muted = !on;
        if (on && !paused && running) playVideo(cur.media);
      }
      showSoundHint(!on && !state.userMuted && !state.interacted);
      updateMuteUI();
    }

    function unlockFromGesture() { if (!state.interacted) { primeMedia(); showSoundHint(false); applySound(); if (cur) setMusic(cur.m.type === 'video' ? MUSIC_VOL * .15 : MUSIC_VOL); } }

    // ----- controls -----
    let px = 0, py = 0, holdT = 0, held = false, down = false;
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; held = false; px = e.clientX; py = e.clientY;
      clearTimeout(holdT);
      holdT = setTimeout(() => { if (down) { held = true; holdPaused = true; setPaused(true); } }, 260);
    });
    stage.addEventListener('pointermove', (e) => { if (down && (Math.abs(e.clientX - px) > 14 || Math.abs(e.clientY - py) > 14)) clearTimeout(holdT); });
    const up = (e) => {
      if (!down) return;
      down = false;
      clearTimeout(holdT);
      if (held) { held = false; if (holdPaused) { holdPaused = false; setPaused(false); } return; }
      if (e.type === 'pointercancel') return;
      unlockFromGesture();
      const dx = e.clientX - px, dy = e.clientY - py;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
      if (Math.abs(dy) > 50) return;
      if (e.clientX < stage.clientWidth * .33) prev(); else next();
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      if (state.scene !== 'story' || finishing) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); unlockFromGesture(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); unlockFromGesture(); prev(); }
      else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); unlockFromGesture(); setPaused(!paused); }
      else if (e.key === 'Escape') { e.preventDefault(); goTo('garden'); }
    });

    soundHint.addEventListener('click', (e) => { e.stopPropagation(); unlockFromGesture(); });
    $('#exitStory').addEventListener('click', (e) => { e.stopPropagation(); goTo('garden'); });

    document.addEventListener('visibilitychange', () => {
      if (state.scene !== 'story' || !running) return;
      if (document.hidden) pauseMedia();
      else if (!paused) { resumeMedia(); lastT = performance.now(); }
    });

    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!cur) return;
        const w = cur.media.naturalWidth || cur.media.videoWidth, h = cur.media.naturalHeight || cur.media.videoHeight;
        const f = fitFor(w, h);
        if (f !== cur.fit) { cur.fit = f; cur.slide.classList.toggle('fit-contain', f === 'contain'); }
      }, 200);
    });

    return { start, stop, applySound };
  })();

  /* ---------------------------------------------------------------------
     Scene 4 — Dua at the first light of Fajr
     Calm on purpose: no music, no movement, opacity fades only.
     --------------------------------------------------------------------- */
  const Dua = (function () {
    const sec = scenes.dua;
    const title = $('#duaTitle');
    const block = $('#duaBlock');
    const ar = $('#duaAr'), en = $('#duaEn'), src = $('#duaSrc');
    const nextBtn = $('#duaNext');
    const ameen = $('#ameenBtn');
    const dotsBox = $('#duaDots');
    let idx = 0, timers = [], done = false;

    const later = (fn, ms) => { timers.push(setTimeout(fn, reduced ? Math.min(ms, 600) : ms)); };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    function enter() {
      clear();
      done = false;
      idx = 0;
      sec.classList.remove('is-leaving');
      title.textContent = TEXT.duaTitle;
      title.classList.remove('is-in');
      [ar, en, src].forEach((n) => { n.classList.remove('is-in'); n.textContent = ''; });
      block.classList.remove('is-out');
      nextBtn.textContent = TEXT.duaContinue;
      nextBtn.classList.remove('is-in');
      ameen.textContent = TEXT.ameen;
      ameen.hidden = true; ameen.classList.remove('is-in');
      dotsBox.innerHTML = '';
      if (duas.length > 1) duas.forEach(() => dotsBox.appendChild(el('i')));
      silenceAll(1.2);
      FX.clear(1);          // nothing drifts over the words
    }

    function begin() {
      if (!duas.length) { goTo('letter'); return; }
      later(() => title.classList.add('is-in'), 400);
      later(() => showItem(0), 2400);
    }

    function showItem(i) {
      idx = i;
      const d = duas[i];
      block.classList.remove('is-out');
      ar.textContent = d.ar || '';
      en.textContent = d.en || '';
      src.textContent = d.src || '';
      Array.from(dotsBox.children).forEach((n, k) => n.classList.toggle('on', k <= i));
      later(() => ar.classList.add('is-in'), 100);
      later(() => en.classList.add('is-in'), d.ar ? 1900 : 100);
      later(() => src.classList.add('is-in'), d.ar ? 2900 : 900);
      later(() => {
        if (i === duas.length - 1) { ameen.hidden = false; requestAnimationFrame(() => ameen.classList.add('is-in')); }
        else nextBtn.classList.add('is-in');
      }, d.ar ? 4400 : 2400);
    }

    nextBtn.addEventListener('click', () => {
      if (!nextBtn.classList.contains('is-in')) return;
      nextBtn.classList.remove('is-in');
      block.classList.add('is-out');
      later(() => { [ar, en, src].forEach((n) => n.classList.remove('is-in')); showItem(idx + 1); }, 1200);
    });

    ameen.addEventListener('click', () => {
      if (done) return;
      done = true;
      vibrate(10);
      sec.classList.add('is-leaving');                     // the words rest first...
      later(() => FX.rise(3200), 1400);                    // ...then light rises into the sky
      later(() => goTo('letter', { dur: 1600 }), 4600);
    });

    function stop() { clear(); }
    return { enter, begin, stop };
  })();

  /* ---------------------------------------------------------------------
     Scene 5 — Her name in gold, then the letter
     --------------------------------------------------------------------- */
  const Letter = (function () {
    const sec = scenes.letter;
    const callig = $('#callig');
    const csvg = $('#calligSvg');
    const ctext = $('#calligText');
    const creveal = $('#calligReveal');
    const envWrap = $('#envelopeWrap');
    const env = $('#envelope');
    const paper = $('#paper');
    const scroller = $('#paperScroll');
    const body = $('#letterBody');
    const sig = $('#signature');
    const actions = $('#letterActions');
    const hint = $('#letterHint');
    let opened = false, revealIdx = 0, revealItems = [], revealT = 0, waitingScroll = false, built = false, run = 0;

    function build() {
      if (built) return;
      built = true;
      hint.textContent = TEXT.letterHint;
      $('#toGarden').textContent = TEXT.backToGarden;
      $('#watchAgain').textContent = TEXT.watchAgain;
      const paras = Array.isArray(CFG.letter) ? CFG.letter : [String(CFG.letter || '')];
      body.innerHTML = '';
      paras.filter((p) => String(p).trim()).forEach((p) => {
        const n = el('p');
        n.setAttribute('dir', 'auto');
        n.textContent = p;
        if (isArabic(p)) n.classList.add('is-ar');
        body.appendChild(n);
      });
      sig.textContent = CFG.signature || '';
      ctext.textContent = CFG.herArabic || '';
      env.addEventListener('click', open);
      $('#toGarden').addEventListener('click', () => goTo('garden', { fromLetter: true }));
      $('#watchAgain').addEventListener('click', () => { primeMedia(); goTo('story'); });
      scroller.addEventListener('scroll', () => { if (waitingScroll) { waitingScroll = false; step(); } }, { passive: true });
    }

    function reset() {
      run++;
      opened = false;
      clearTimeout(revealT);
      env.className = 'envelope';
      envWrap.classList.remove('is-in');
      envWrap.hidden = false;
      cancelAnims(envWrap);
      paper.className = 'paper';
      paper.style.top = '';
      paper.setAttribute('aria-hidden', 'true');
      cancelAnims(paper);
      callig.className = 'callig';
      callig.style.opacity = '0';
      cancelAnims(callig);
      cancelAnims(creveal);
      body.querySelectorAll('p').forEach((p) => p.classList.remove('is-in'));
      sig.classList.remove('is-in');
      actions.classList.remove('is-in');
      scroller.scrollTop = 0;
    }

    function enter() { build(); reset(); }

    // fit the viewBox snugly around the shaped Arabic glyphs
    function fitName() {
      try {
        const b = ctext.getBBox();
        if (b.width > 0) {
          const pad = 18;
          csvg.setAttribute('viewBox', `${(b.x - pad).toFixed(1)} ${(b.y - pad).toFixed(1)} ${(b.width + pad * 2).toFixed(1)} ${(b.height + pad * 2).toFixed(1)}`);
          creveal.setAttribute('x', b.x - pad); creveal.setAttribute('y', b.y - pad);
          creveal.setAttribute('width', b.width + pad * 2); creveal.setAttribute('height', b.height + pad * 2);
        }
      } catch (e) { /* keep default viewBox */ }
    }

    async function begin() {
      const my = run;
      const name = String(CFG.herArabic || '').trim();
      if (!name) { envWrap.classList.add('is-in'); return; }
      try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 150px "Aref Ruqaa"', name), wait(2500)]); } catch (e) { /* fallback font */ }
      if (my !== run) return;
      fitName();
      if (reduced) {
        callig.classList.add('is-filled');
        animate(callig, [{ opacity: 0 }, { opacity: 1 }], { duration: 1200 });
        callig.style.opacity = '';
        await wait(900);
        if (my === run) envWrap.classList.add('is-in');
        return;
      }
      // written at the centre, larger, as if by a pen moving right to left
      const r = callig.getBoundingClientRect();
      const dy = window.innerHeight * .42 - (r.top + r.height / 2);
      const big = `translateX(-50%) translateY(${dy.toFixed(0)}px) scale(1.55)`;
      callig.style.transform = big;
      callig.style.opacity = '1';
      creveal.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 3000, easing: BREATH, fill: 'both' });
      requestAnimationFrame(() => callig.classList.add('is-drawing'));
      await wait(3300);
      if (my !== run) return;
      callig.classList.add('is-filled');
      await wait(1500);
      if (my !== run) return;
      // then it rests gently above the envelope
      await animate(callig, [{ transform: big }, { transform: 'translateX(-50%)' }], { duration: 1600, easing: BREATH });
      if (my !== run) return;
      callig.style.transform = '';
      cancelAnims(callig);
      envWrap.classList.add('is-in');
    }

    async function open() {
      if (opened || !envWrap.classList.contains('is-in')) return;
      opened = true;
      const my = run;
      if (reduced) {
        env.classList.add('is-open');
        await animate(envWrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 });
        envWrap.hidden = true;
        placePaper();
        paper.classList.add('is-shown', 'unfold-top', 'unfold-bot', 'is-unfolded');
        paper.removeAttribute('aria-hidden');
        await animate(paper, [{ opacity: 0 }, { opacity: 1 }], { duration: 900 });
        return beginReveal();
      }
      vibrate(8);
      env.classList.add('is-open');             // the seal breaks, the flap turns (z-index flips in CSS)
      await wait(1500);
      env.classList.add('is-out');              // the letter rises out with a slight tilt
      await wait(1300);
      if (my !== run) return;
      animate(envWrap, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40px) scale(.95)' }], { duration: 1100, easing: BREATH })
        .then(() => { envWrap.hidden = true; });
      placePaper();
      paper.classList.add('is-shown');
      paper.removeAttribute('aria-hidden');
      await animate(paper, [
        { opacity: 0, transform: 'translateX(-50%) translateY(14%) scale(.55)' },
        { opacity: 1, transform: 'translateX(-50%)' }
      ], { duration: 1200, easing: BREATH });
      paper.classList.add('unfold-top');
      await wait(520);
      paper.classList.add('unfold-bot');
      await wait(1200);
      paper.classList.add('is-unfolded');
      await wait(600);
      if (my === run) beginReveal();
    }

    // the letter opens just below her name, so the name keeps resting above it
    function placePaper() {
      paper.style.top = '';
      if (!String(CFG.herArabic || '').trim()) return;
      const r = callig.getBoundingClientRect();
      if (r.height > 0) paper.style.top = Math.round(r.bottom + 2) + 'px';
    }

    function beginReveal() {
      revealItems = Array.from(body.querySelectorAll('p'));
      if (sig.textContent) revealItems.push(sig);
      revealIdx = 0;
      step();
    }

    function visible(n) { const r = n.getBoundingClientRect(), s = scroller.getBoundingClientRect(); return r.top < s.bottom - 40; }

    function step() {
      clearTimeout(revealT);
      if (revealIdx >= revealItems.length) {
        revealT = setTimeout(() => {
          actions.classList.add('is-in');
          FX.shower(reduced ? 1500 : 4000, 20);
          if (!state.letterRead) { state.letterRead = true; persist(); }
        }, 900);
        return;
      }
      const n = revealItems[revealIdx];
      if (revealIdx > 0 && !visible(n)) { waitingScroll = true; return; }
      n.classList.add('is-in');
      revealIdx++;
      const len = (n.textContent || '').length;
      revealT = setTimeout(step, reduced ? 400 : 900 + Math.min(len * 7, 1100));
    }

    return { enter, begin };
  })();

  /* ---------------------------------------------------------------------
     Global keys
     --------------------------------------------------------------------- */
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardOpen) { e.preventDefault(); closeCard(); } });

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function preload(src) { return new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = src; }); }

  async function boot() {
    $('#loaderText').textContent = TEXT.loading || '';
    Gift.build();
    Intro.build();
    updateMuteUI();
    const t0 = performance.now();
    const firstImg = memories.find((m) => m.type === 'image');
    const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    await Promise.race([Promise.all([fonts, firstImg ? preload(firstImg.src) : null]), wait(3500)]);
    const spent = performance.now() - t0;
    if (spent < 1000) await wait(1000 - spent);

    const jump = (params.get('scene') || '').toLowerCase();
    const loader = $('#loader');
    loader.classList.add('is-done');
    setTimeout(() => loader.remove(), 1300);

    const name = scenes[jump] ? jump : 'gift';
    state.scene = name;
    setSky(SKY_FOR[name]);
    scenes[name].classList.add('is-active');
    FX.setMode(name);
    if (name === 'gift') Gift.start();
    if (name === 'intro') Intro.play(400);
    if (name === 'garden') { Garden.enter({}); Garden.afterEnter({}); }
    if (name === 'story') Story.start(0);
    if (name === 'dua') { Dua.enter(); Dua.begin(); }
    if (name === 'letter') { Letter.enter(); Letter.begin(); }
    animate(scenes[name], [{ opacity: 0 }, { opacity: 1 }], { duration: 1200, easing: BREATH }).then((a) => a && a.cancel && a.cancel());
  }

  // Remember the first real gesture anywhere (needed for sound on iOS)
  ['pointerup', 'keydown'].forEach((t) => document.addEventListener(t, () => {
    if (!state.interacted && state.scene && state.scene !== 'story' && state.scene !== 'gift') primeMedia();
  }, { capture: true, passive: true }));

  boot();
})();
