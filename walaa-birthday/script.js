/* ==========================================================================
   Walaa — birthday garden
   Vanilla JS. All content comes from CONFIG (config.js).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Config & helpers
     --------------------------------------------------------------------- */
  const CFG = (typeof CONFIG === 'object' && CONFIG) ? CONFIG : {};
  const TEXT = Object.assign({
    introSubtitle: '', tapToEnter: 'tap to enter', loading: '',
    gardenTitle: 'Our garden of memories', gardenHint: 'Tap a glowing seed to let a memory bloom',
    gardenScrollHint: 'swipe to see the whole garden',
    treeLabel: 'Your olive tree', treeNote: '', counter: '{n} of {total} memories bloomed',
    playStory: 'Play our story', openLetter: 'Open your letter', storyTapForSound: 'tap for sound',
    letterHint: 'Tap the seal', backToGarden: 'Back to the garden', watchAgain: 'Watch again',
    missingMemory: 'This memory is still on its way.'
  }, CFG.text || {});

  const PHOTO_MS = Math.max(2, Number(CFG.photoSeconds) || 6) * 1000;
  const MAX_VIDEO_S = Math.max(3, Number(CFG.maxVideoSeconds) || 20);
  const MUSIC_VOL = Math.min(1, Math.max(0, CFG.musicVolume == null ? 0.45 : Number(CFG.musicVolume)));

  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const EASE_IO = 'cubic-bezier(.65,0,.35,1)';
  const isArabic = (s) => /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(s || '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

  /* ---------------------------------------------------------------------
     Memories
     --------------------------------------------------------------------- */
  const VIDEO_RE = /\.(mp4|m4v|mov|webm|ogv)([?#].*)?$/i;
  const FLOWERS = ['orange-blossom', 'rose', 'jasmine', 'tulip', 'lavender'];

  const memories = (Array.isArray(CFG.memories) ? CFG.memories : [])
    .filter((m) => m && typeof m.src === 'string' && m.src.trim())
    .map((m, i) => ({
      i,
      src: m.src.trim(),
      poster: m.poster || '',
      day: m.day || '',
      place: m.place || '',
      caption: m.caption || '',
      type: (m.type === 'video' || m.type === 'image') ? m.type : (VIDEO_RE.test(m.src) ? 'video' : 'image'),
      flower: FLOWERS.indexOf(m.flower) > -1 ? m.flower : FLOWERS[i % FLOWERS.length]
    }));

  const broken = new Set(); // memory indices that failed to load

  // One seed per memory, or one seed per day when there are more than 10.
  const groups = (function () {
    const out = [];
    if (memories.length > 10) {
      const map = new Map();
      memories.forEach((m) => {
        const k = 'd:' + (m.day || ('#' + m.i)).trim().toLowerCase();
        if (!map.has(k)) { const g = { key: k, items: [] }; map.set(k, g); out.push(g); }
        map.get(k).items.push(m);
      });
    } else {
      memories.forEach((m) => out.push({ key: 'm:' + m.src + '#' + m.i, items: [m] }));
    }
    out.forEach((g, gi) => { g.gi = gi; g.flower = g.items[0].flower; g.day = g.items[0].day; g.place = g.items[0].place; });
    return out;
  })();

  const metaLine = (m) => [m.day, m.place].filter(Boolean).join('  ·  ');

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
    interacted: false,      // a real user gesture happened (audio allowed)
    userMuted: false,
    scene: null,
    busy: false
  };
  const persist = () => store.set(KEY, { bloomed: Array.from(state.bloomed), storyDone: state.storyDone });

  /* ---------------------------------------------------------------------
     FX canvas: motes, petals, fireflies, bursts, showers
     --------------------------------------------------------------------- */
  const FX = (function () {
    const cv = $('#fx');
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1, parts = [], mode = 'none', raf = 0, last = 0, showerUntil = 0, showerRate = 0, spawnAcc = 0;

    function sprite(size, draw) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      draw(c.getContext('2d'), size);
      return c;
    }

    function petalSprite(c1, c2) {
      return sprite(64, (g, s) => {
        g.translate(s / 2, s / 2);
        const grd = g.createLinearGradient(0, -26, 0, 26);
        grd.addColorStop(0, c1); grd.addColorStop(1, c2);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, 26);
        g.bezierCurveTo(-20, 12, -16, -18, 0, -26);
        g.bezierCurveTo(16, -18, 20, 12, 0, 26);
        g.fill();
        g.strokeStyle = 'rgba(210,160,90,.25)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, 22); g.quadraticCurveTo(2, 0, 0, -20); g.stroke();
      });
    }

    const petals = [
      petalSprite('#fffaf1', '#f6dcc0'),
      petalSprite('#fff7ea', '#f3c99a'),
      petalSprite('#fde9dc', '#f0b48a'),
      petalSprite('#ffffff', '#efe2cf')
    ];
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
      none: {}, story: {},
      intro: { mote: 34, petal: 12 },
      garden: { firefly: 22, petal: 4, mote: 8 },
      letter: { mote: 16, petal: 5 }
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
        Object.assign(p, { x: R() * W, y: opts && opts.top ? -30 - R() * 80 : R() * H, s: 9 + R() * 9, vx: 8 + R() * 18, vy: 14 + R() * 22, r: R() * 6.28, vr: (R() - .5) * 1.6, fl: R() * 6.28, vf: 1.2 + R() * 2, img: petals[(R() * petals.length) | 0], sw: R() * 6.28 });
      } else if (kind === 'firefly') {
        Object.assign(p, { x: R() * W, y: H * (.38 + R() * .55), s: 10 + R() * 12, ang: R() * 6.28, sp: 6 + R() * 12, f: .5 + R() * 1.2 });
      }
      if (opts) Object.assign(p, opts);
      return p;
    }

    function setMode(m) {
      mode = m;
      const target = Object.assign({}, TARGETS[m] || {});
      if (reduced) Object.keys(target).forEach((k) => { target[k] = Math.ceil(target[k] / 3); });
      const counts = {};
      parts.forEach((p) => {
        if (p.transient) return;
        counts[p.kind] = (counts[p.kind] || 0) + 1;
        if (counts[p.kind] > (target[p.kind] || 0)) p.fade = 0; else p.fade = 1;
      });
      Object.keys(target).forEach((k) => {
        for (let n = counts[k] || 0; n < target[k]; n++) parts.push(make(k));
      });
      start();
    }

    function burst(points) {
      if (reduced) return;
      points.forEach((pt) => {
        for (let n = 0; n < 3; n++) {
          parts.push(make('petal', {
            transient: true, x: pt.x + (R() - .5) * 20, y: pt.y + (R() - .5) * 20,
            vx: (R() - .5) * 60, vy: -40 - R() * 70, life: 2.2 + R() * 1.4, a: 1, s: 8 + R() * 8
          }));
        }
        parts.push(make('mote', { transient: true, x: pt.x, y: pt.y, vx: (R() - .5) * 30, vy: -30 - R() * 40, life: 1.8, a: 1, s: 18 }));
      });
      start();
    }

    function shower(ms, rate) {
      showerUntil = performance.now() + ms;
      showerRate = reduced ? (rate || 26) / 4 : (rate || 26);
      start();
    }

    function step(now) {
      raf = 0;
      const dt = Math.min(.05, (now - (last || now)) / 1000);
      last = now;

      if (now < showerUntil) {
        spawnAcc += dt * showerRate;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          parts.push(make('petal', { transient: true, top: true, y: -30, life: 9, vy: 40 + R() * 50, vx: (R() - .3) * 30, s: 10 + R() * 12 }));
        }
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        const target = p.transient ? 1 : p.fade;
        p.a += (target - p.a) * Math.min(1, dt * 1.6);
        if (p.transient) {
          p.life -= dt;
          if (p.life <= 0 || p.y > H + 60) { parts.splice(i, 1); continue; }
          if (p.life < 1) p.a = Math.max(0, p.life);
        } else if (p.fade === 0 && p.a < .02) { parts.splice(i, 1); continue; }

        if (p.kind === 'mote') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (!p.transient) {
            if (p.y < -20) { p.y = H + 20; p.x = R() * W; }
            if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
          }
          const tw = .45 + .55 * Math.sin(p.t * p.f * 2 + p.s);
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
          if (p.transient && p.vy < 30) p.vy += 60 * dt; // bursts float up then drift down
          p.sw += dt;
          p.x += (p.vx + Math.sin(p.sw * 1.3) * 14) * dt; p.y += p.vy * dt;
          p.r += p.vr * dt; p.fl += p.vf * dt;
          if (!p.transient && p.y > H + 30) { p.y = -30; p.x = R() * W - W * .2; }
          if (!p.transient && p.x > W + 30) p.x = -30;
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = p.a * .9;
          const sx = Math.cos(p.fl);
          ctx.setTransform(DPR, 0, 0, DPR, p.x * DPR, p.y * DPR);
          ctx.rotate(p.r);
          ctx.scale(sx || .01, 1);
          ctx.drawImage(p.img, -p.s / 2, -p.s / 2, p.s, p.s);
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (parts.length || now < showerUntil) start();
    }

    function start() {
      if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(step); }
    }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    return { setMode, burst, shower, resize };
  })();

  /* ---------------------------------------------------------------------
     Media unlock (iOS) & sound
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
  
  let music = null;
  let volumeWorks = true;
  if (CFG.music) {
    music = new Audio();
    music.src = CFG.music;
    music.loop = true;
    music.preload = 'auto';
    music.addEventListener('error', () => { music = null; updateMuteUI(); });
    try { music.volume = 0.5; volumeWorks = Math.abs(music.volume - 0.5) < 0.01; } catch (e) { volumeWorks = false; }
    music.volume = 0;
  }

  // a tiny silent WAV: playing it inside the first tap unlocks each element on iOS
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

  function primeMedia() {
    if (state.interacted) return;
    state.interacted = true;
    videoPool.forEach((v) => { if (!v.getAttribute('src')) primeEl(v, () => { v.removeAttribute('src'); try { v.load(); } catch (e) { /* */ } }); });
    if (music) {
      primeEl(music, () => {
        music.src = CFG.music;
        try { music.load(); } catch (e) { /* */ }
        if (musicWanted) setMusic(musicTarget);
      });
    }
  }

  let musicWanted = false, musicTarget = 0, musicRaf = 0;
  function setMusic(target) {
    if (!music) return;
    musicTarget = target;
    if (music.src === SILENT) { musicWanted = target > 0; return; }
    if (target > 0) {
      musicWanted = true;
      if (!state.interacted || state.userMuted) return;
      music.muted = false;
      if (!volumeWorks) {
        // iOS: volume is read-only, so we duck by pausing
        if (target < MUSIC_VOL * .5) music.pause(); else music.play().catch(() => {});
        return;
      }
      if (music.paused) { music.play().catch(() => {}); }
    }
    if (!volumeWorks) { if (target === 0) { musicWanted = false; music.pause(); } return; }
    cancelAnimationFrame(musicRaf);
    const tick = () => {
      const v = music.volume, d = musicTarget - v;
      if (Math.abs(d) < .01) {
        music.volume = musicTarget;
        if (musicTarget === 0) { music.pause(); musicWanted = false; }
        return;
      }
      music.volume = clamp(v + Math.sign(d) * Math.min(Math.abs(d), .02), 0, 1);
      musicRaf = requestAnimationFrame(tick);
    };
    musicRaf = requestAnimationFrame(tick);
  }

  const muteBtn = $('#muteBtn');
  const letterMute = $('#letterMute');
  function updateMuteUI() {
    const muted = state.userMuted || !state.interacted;
    [muteBtn, letterMute].forEach((b) => { if (b) { b.classList.toggle('is-muted', muted); b.setAttribute('aria-pressed', String(muted)); } });
    if (letterMute) letterMute.hidden = !(music && musicWanted);
  }

  function toggleMute() {
    if (!state.interacted) primeMedia();
    state.userMuted = !state.userMuted;
    Story.applySound();
    if (music) {
      if (state.userMuted) music.pause();
      else if (musicWanted) { music.muted = false; music.play().catch(() => {}); }
    }
    updateMuteUI();
  }

  /* ---------------------------------------------------------------------
     Scenes
     --------------------------------------------------------------------- */
  const scenes = { intro: $('#intro'), garden: $('#garden'), story: $('#story'), letter: $('#letter') };

  async function crossfade(from, to, o) {
    o = o || {};
    const dur = reduced ? 600 : (o.dur || 900);
    const fromEl = scenes[from], toEl = scenes[to];
    toEl.classList.add('is-active');
    toEl.style.zIndex = 3;
    const outA = fromEl ? animate(fromEl, reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.03)' }], { duration: dur, easing: EASE_IO }) : Promise.resolve();
    const inA = animate(toEl, reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: dur + 150, easing: EASE, delay: o.delay || 0 });
    await Promise.all([outA, inA]);
    if (fromEl && fromEl !== toEl) fromEl.classList.remove('is-active');
    toEl.style.zIndex = '';
    [fromEl, toEl].forEach((n) => n && n.getAnimations && n.getAnimations().forEach((a) => a.cancel()));
  }

  function leaveScene(name) {
    if (name === 'garden') closeCard(true);
    if (name === 'story') Story.stop();
    if (name === 'letter') setMusic(0);
  }

  async function goTo(name, o) {
    if (state.busy || state.scene === name) return;
    state.busy = true;
    const from = state.scene;
    leaveScene(from);
    state.scene = name;
    if (name === 'garden') Garden.enter();
    if (name === 'letter') Letter.enter();
    if (name === 'story') { scenes.story.classList.add('is-active'); Story.start(0); }
    FX.setMode(name);
    await crossfade(from, name, o);
    state.busy = false;
  }

  /* ---------------------------------------------------------------------
     Scene 1 — Intro
     --------------------------------------------------------------------- */
  const Intro = (function () {
    const title = $('#introTitle');
    const sub = $('#introSub');
    const tap = $('#tapEnter');
    let ready = false, leaving = false, lettersEnd = 0;

    function graphemes(str) {
      if (window.Intl && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str), (s) => s.segment);
      }
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
        // Arabic letters must stay joined, so Arabic animates word by word
        const parts = arabic ? [word] : graphemes(word);
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
      lettersEnd = (reduced ? 200 + i * 20 + 900 : 350 + i * 75 + 1250);
      sub.textContent = TEXT.introSubtitle || '';
      tap.textContent = TEXT.tapToEnter;
    }

    function start() {
      FX.setMode('intro');
      setTimeout(() => sub.classList.add('is-in'), lettersEnd - 300);
      setTimeout(() => { tap.classList.add('is-in'); ready = true; }, Math.max(3000, lettersEnd + 300));
      setTimeout(() => { ready = true; }, 900); // allow an early tap after a moment
    }

    async function enter(e) {
      if (!ready || leaving) return;
      if (e) e.preventDefault();
      leaving = true;
      primeMedia();
      updateMuteUI();
      state.busy = true;

      // letters dissolve upward into petals
      const pts = Array.from(title.querySelectorAll('.ch')).map((c) => {
        const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      title.classList.add('is-leaving');
      FX.burst(pts);
      animate(sub, [{ opacity: .92 }, { opacity: 0 }], { duration: 600, easing: EASE_IO });
      animate(tap, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
      tap.classList.remove('is-in');

      await wait(reduced ? 300 : 650);

      // camera descends into the garden
      const g = scenes.garden;
      state.scene = 'garden';
      Garden.enter();
      g.classList.add('is-active');
      g.style.zIndex = 3;
      FX.setMode('garden');
      const D = reduced ? 700 : 1500;
      const outA = animate(scenes.intro, reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        { opacity: 0, transform: 'translateY(-6%) scale(1.12)', filter: 'blur(8px)' }
      ], { duration: D, easing: EASE_IO });
      const inA = animate(g, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
        { opacity: 0, transform: 'translateY(9%) scale(1.14)', filter: 'blur(10px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' }
      ], { duration: D, easing: EASE, delay: reduced ? 0 : 120 });
      await Promise.all([outA, inA]);
      scenes.intro.classList.remove('is-active');
      g.style.zIndex = '';
      [scenes.intro, g].forEach((n) => n.getAnimations && n.getAnimations().forEach((a) => a.cancel()));
      state.busy = false;
      Garden.afterEnter();
    }

    scenes.intro.addEventListener('click', enter);
    tap.addEventListener('click', (e) => { e.stopPropagation(); ready = true; enter(e); });
    document.addEventListener('keydown', (e) => {
      if (state.scene === 'intro' && (e.key === 'Enter' || e.key === ' ')) { ready = true; enter(e); }
    });

    return { build, start };
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
    return `<svg class="flower" viewBox="0 0 60 100" aria-hidden="true">
      <circle class="bloom-glow" cx="30" cy="${tall ? 26 : 32}" r="20" fill="url(#seedGlow)" opacity=".55"/>
      <path class="stem" pathLength="1" d="${stemD}" stroke="#6f8a52" stroke-width="2.1"/>
      <path class="leaf l1" style="transform-origin:29.5px 80px" d="M29.5 80 C 22 78, 15 72, 13 64 C 21 64, 27 70, 29.5 80Z" fill="#6f8758"/>
      <path class="leaf l2" style="transform-origin:30.5px 66px" d="M30.5 66 C 37 63, 43 57, 45 49 C 37 50, 32 56, 30.5 66Z" fill="#87a06a"/>
      <g class="bloom" style="transform-origin:30px ${tall ? 26 : 32}px">${bloomArt(type)}</g>
    </svg>`;
  }

  /* ---------------------------------------------------------------------
     Olive tree
     --------------------------------------------------------------------- */
  function treeSVG() {
    const r = rng(7);
    const clumps = [[120, 70, 40], [78, 92, 34], [162, 92, 34], [98, 52, 30], [146, 54, 30], [58, 118, 24], [184, 118, 24], [120, 104, 34], [120, 36, 24]];
    const cols = ['#8fa27a', '#748c5e', '#a9b993', '#5f7650', '#9fb187', '#c2cdb0'];
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
    let back = '';
    clumps.forEach(([cx, cy, rad]) => {
      for (let k = 0; k < rad * .6; k++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * rad * .8;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .78;
        back += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="2.6" fill="#3d4f36" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
    });
    let olives = '';
    for (let k = 0; k < 16; k++) {
      const c = clumps[(r() * clumps.length) | 0];
      const a = r() * 6.283, d = r() * c[2] * .8;
      olives += `<ellipse cx="${(c[0] + Math.cos(a) * d).toFixed(1)}" cy="${(c[1] + Math.sin(a) * d * .7).toFixed(1)}" rx="2.2" ry="2.9" fill="${k % 3 ? '#3e3350' : '#6b7d3a'}"/>`;
    }
    return `
      <defs>
        <linearGradient id="trunkG" x1="0" x2="1"><stop offset="0" stop-color="#3b3128"/><stop offset=".5" stop-color="#6e5d4a"/><stop offset="1" stop-color="#3a3027"/></linearGradient>
        <radialGradient id="canopyShade" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#2d3b29" stop-opacity="0"/><stop offset="1" stop-color="#16201a" stop-opacity=".55"/></radialGradient>
      </defs>
      <ellipse cx="120" cy="226" rx="62" ry="6" fill="#0c140f" opacity=".7"/>
      <g class="canopy">
        <path d="M108 228c4-20 2-38-6-54-6-12-18-22-30-30l6-4c12 6 22 14 30 24 0-14-4-28-12-40l6-2c10 12 14 28 14 44 4-16 12-30 24-40l5 4c-10 10-17 22-20 38 8-10 20-16 32-18l2 6c-14 4-26 12-32 26-4 14-2 32 4 46Z" fill="url(#trunkG)"/>
        <path d="M118 200c-2-12 0-24 6-34M110 188c-3-10-8-18-14-24" stroke="#2c241d" stroke-width="1.4" fill="none" opacity=".6"/>
        ${back}
        ${leaves}
        ${olives}
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
    const note = $('#treeNote');
    let built = false, seedEls = [], noteTimer = 0, revealedPlay = false, layoutKey = '', laidOutAt = 0;

    function build() {
      if (built) return;
      built = true;
      $('#gardenTitle').textContent = TEXT.gardenTitle;
      $('#gardenHint').textContent = TEXT.gardenHint;
      $('#treeLabel').textContent = TEXT.treeLabel;
      note.textContent = TEXT.treeNote;
      playBtn.querySelector('span').textContent = TEXT.playStory;
      letterBtn.querySelector('span').textContent = TEXT.openLetter;
      hint.querySelector('span').textContent = TEXT.gardenScrollHint;
      $('#treeSvg').innerHTML = treeSVG();
      tree.setAttribute('aria-label', TEXT.treeLabel);

      groups.forEach((g, gi) => {
        const b = el('button', 'seed');
        b.type = 'button';
        b.style.setProperty('--d', (-(gi * 0.37) % 2.6).toFixed(2) + 's');
        const label = [g.day, g.place].filter(Boolean).join(', ');
        b.setAttribute('aria-label', 'Memory ' + (gi + 1) + (label ? ': ' + label : ''));
        b.innerHTML = '<span class="soil"></span>' + flowerSVG(g.flower) +
          '<svg class="seed-dot" viewBox="0 0 40 40" aria-hidden="true"><circle class="halo" cx="20" cy="20" r="19" fill="url(#seedGlow)"/>' +
          '<g class="seed-body"><ellipse cx="20" cy="21" rx="4.2" ry="5.6" fill="url(#seedBody)" transform="rotate(-18 20 21)"/></g></svg>';
        if (state.bloomed.has(g.key)) b.classList.add('is-bloomed');
        b.addEventListener('click', () => onSeed(g, b));
        seedsBox.appendChild(b);
        seedEls.push(b);
      });

      tree.addEventListener('click', showNote);
      tree.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showNote(); } });
      playBtn.addEventListener('click', () => { primeMedia(); goTo('story'); });
      letterBtn.addEventListener('click', () => goTo('letter'));
      world.addEventListener('scroll', () => { if (performance.now() - laidOutAt > 600) hint.classList.remove('is-in'); }, { passive: true });

      let rt = 0;
      window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (state.scene === 'garden') layout(); }, 160); });
      updateCounter();
    }

    function showNote() {
      if (!TEXT.treeNote) return;
      note.classList.add('is-in');
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => note.classList.remove('is-in'), 5200);
    }

    function layout() {
      const vw = sec.clientWidth, vh = sec.clientHeight;
      const key = vw + 'x' + vh;
      if (key === layoutKey) return;
      layoutKey = key;

      const landscape = vw > vh * 1.15;
      const horizon = Math.round(vh * (landscape ? .6 : .585));
      sec.style.setProperty('--horizon', horizon + 'px');

      const sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
      const N = groups.length;
      const fh = clamp(vh * .13, 70, landscape ? 118 : 108);
      const fw = fh * .62;
      const spacing = vw < 520 ? 64 : clamp(fw * 1.45, 80, 120);
      const margin = vw < 520 ? 26 : 60;
      const yTop = horizon + Math.max(fh * .82, vh * .12);
      const yBot = vh - sab - 92;
      const rowGap = 48;
      const rowsMax = clamp(Math.floor((yBot - yTop) / rowGap) + 1, 1, 4);
      const capPerRow = Math.max(1, Math.floor((vw - margin * 2) / spacing));

      let worldW = vw, rows;
      if (N <= rowsMax * capPerRow) {
        rows = Math.min(rowsMax, Math.max(Math.ceil(N / capPerRow), N >= 5 ? 2 : 1));
      } else {
        rows = rowsMax;
        worldW = Math.ceil(N / rows) * spacing + margin * 2;
      }
      rows = Math.max(1, Math.min(rows, N || 1));
      inner.style.width = worldW + 'px';

      // tree
      const treeW = clamp(Math.min(vw * (landscape ? .3 : .54), vh * .36), 150, 360);
      const treeH = treeW * 230 / 240;
      tree.style.width = treeW + 'px';
      tree.style.left = (worldW / 2) + 'px';
      tree.style.top = (horizon - treeH + treeW * .012) + 'px';

      // ground
      buildGround(worldW, vh, horizon, treeW);

      // seeds
      const counts = [];
      for (let r = 0; r < rows; r++) counts.push(Math.floor(N / rows) + (r >= rows - (N % rows) ? 1 : 0));
      let gi = 0;
      const labelBottom = horizon + 30;
      for (let r = 0; r < rows; r++) {
        const n = counts[r];
        const y0 = rows === 1 ? (yTop + yBot) / 2 : yTop + r * (yBot - yTop) / (rows - 1);
        const sc = rows === 1 ? 1 : .84 + .16 * (r / (rows - 1));
        const span = worldW - margin * 2;
        const step = span / Math.max(1, n);
        for (let j = 0; j < n; j++, gi++) {
          const rand = rng(gi + 11);
          let x = margin + step * (j + .5) + (rand() - .5) * step * .4 + (r % 2 ? step * .12 : -step * .12);
          let y = y0 + (rand() - .5) * 14;
          const topOfFlower = y - fh * sc;
          if (topOfFlower < labelBottom && Math.abs(x - worldW / 2) < treeW * .28) {
            x = worldW / 2 + Math.sign(x - worldW / 2 || 1) * treeW * .3;
          }
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

      const scrollable = worldW > vw + 2;
      laidOutAt = performance.now();
      world.scrollLeft = scrollable ? (worldW - vw) / 2 : 0;
      hint.classList.toggle('is-in', scrollable);
    }

    function buildGround(W, H, hz, treeW) {
      const r = rng(3);
      ground.setAttribute('width', W);
      ground.setAttribute('height', H);
      ground.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const blades = (y0, hMin, hMax, stepMin, stepMax, rr) => {
        let d = '';
        for (let x = -6; x < W + 6; x += stepMin + rr() * (stepMax - stepMin)) {
          const h = hMin + rr() * (hMax - hMin), lean = (rr() - .5) * 9, w = 1.4 + rr() * 1.4, yb = y0 + (rr() - .5) * 3;
          d += `M${(x - w).toFixed(1)} ${yb.toFixed(1)}Q${(x + lean * .3).toFixed(1)} ${(yb - h * .6).toFixed(1)} ${(x + lean).toFixed(1)} ${(yb - h).toFixed(1)}Q${(x + lean * .2 + .4).toFixed(1)} ${(yb - h * .5).toFixed(1)} ${(x + w).toFixed(1)} ${yb.toFixed(1)}Z`;
        }
        return d;
      };
      const hill = `M0 ${hz + 4} C ${W * .22} ${hz - 10}, ${W * .38} ${hz + 6}, ${W * .5} ${hz - 4} S ${W * .82} ${hz + 8}, ${W} ${hz - 2} L ${W} ${H} L 0 ${H} Z`;
      let dots = '';
      for (let k = 0; k < Math.round(W / 22); k++) {
        const x = r() * W, y = hz + 8 + Math.pow(r(), 1.6) * (H - hz - 20);
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.3).toFixed(1)}" fill="${r() > .3 ? '#f6ecd8' : '#f2c27e'}" opacity="${(.25 + r() * .45).toFixed(2)}"/>`;
      }
      ground.innerHTML = `
        <defs>
          <linearGradient id="gFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#22382a"/><stop offset=".25" stop-color="#18291e"/><stop offset="1" stop-color="#09110c"/>
          </linearGradient>
          <radialGradient id="gMound" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3a5236" stop-opacity=".8"/><stop offset="1" stop-color="#3a5236" stop-opacity="0"/></radialGradient>
          <linearGradient id="gRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b56c" stop-opacity=".35"/><stop offset="1" stop-color="#e7b56c" stop-opacity="0"/></linearGradient>
        </defs>
        <path d="${hill}" fill="url(#gFill)"/>
        <path d="${hill}" fill="none" stroke="url(#gRim)" stroke-width="2"/>
        <ellipse cx="${W / 2}" cy="${hz + 4}" rx="${treeW * .75}" ry="${Math.max(12, H * .025)}" fill="url(#gMound)"/>
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
      counter.textContent = TEXT.counter.replace('{n}', bloomedMemoryCount()).replace('{total}', memories.length);
      const need = Math.max(1, Math.min(Number(CFG.unlockAfter) || 3, groups.length));
      const unlocked = state.bloomed.size >= need || groups.length === 0;
      if (unlocked && playBtn.hidden) revealPlay(state.scene === 'garden' && !revealedPlay);
      letterBtn.hidden = !state.storyDone;
    }

    function revealPlay(rise) {
      playBtn.hidden = false;
      revealedPlay = true;
      $('#gardenHint').style.opacity = '';
      if (!rise || reduced) { animate(playBtn, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: EASE }); return; }
      const tr = tree.getBoundingClientRect(), br = playBtn.getBoundingClientRect();
      const dy = (tr.top + tr.height * .45) - (br.top + br.height / 2);
      animate(playBtn, [
        { opacity: 0, transform: `translateY(${dy}px) scale(.3)` },
        { opacity: 1, offset: .45 },
        { opacity: 1, transform: 'none' }
      ], { duration: 1800, easing: EASE });
    }

    function onSeed(g, b) {
      if (b.classList.contains('is-growing')) return;
      if (state.bloomed.has(g.key) || b.classList.contains('is-bloomed')) { openCard(g, b); return; }
      b.classList.add('is-growing');
      state.bloomed.add(g.key);
      persist();
      const r = b.getBoundingClientRect();
      const T = reduced ? 600 : 1300;
      setTimeout(() => {
        FX.burst([{ x: r.left + r.width / 2, y: r.top - r.height * .6 }]);
      }, reduced ? 0 : 1000);
      setTimeout(() => {
        b.classList.remove('is-growing');
        b.classList.add('is-bloomed');
        updateCounter();
        openCard(g, b);
      }, T);
    }

    function enter() {
      build();
      layoutKey = '';
      layout();
      updateCounter();
    }

    function afterEnter() { updateCounter(); }

    return { enter, afterEnter, layout, updateCounter };
  })();

  /* ---------------------------------------------------------------------
     Memory card (bottom sheet / modal)
     --------------------------------------------------------------------- */
  const cardEl = $('#card');
  const sheet = $('.card-sheet', cardEl);
  const track = $('#cardTrack');
  const dots = $('#cardDots');
  const cardMeta = $('#cardMeta');
  const cardCaption = $('#cardCaption');
  let cardItems = [], cardIndex = 0, cardReturn = null, cardOpen = false;

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
      v.playsInline = true; v.preload = "auto";
      if (m.poster) v.poster = m.poster;
      v.addEventListener('loadedmetadata', () => { box.classList.remove('is-loading'); box.classList.add('is-loaded'); }, { once: true });
      v.addEventListener('error', fail, { once: true });
      v.addEventListener('play', () => { box.classList.remove('is-loading'); box.classList.add('is-loaded', 'is-playing'); });
      v.addEventListener('pause', () => box.classList.remove('is-playing'));
      v.addEventListener('ended', () => box.classList.remove('is-playing'));
      v.src = m.src + (m.poster ? '' : '#t=0.1');
      const pb = el('button', 'play-btn', PLAY_ICON);
      pb.type = 'button'; pb.setAttribute('aria-label', 'Play video');
      const toggle = (e) => { e.stopPropagation(); primeMedia(); if (v.paused) { v.muted = false; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); } else v.pause(); };
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
    const s = el('div', 'card-slide');
    s.appendChild(el('div', 'card-missing', flowerSVG('orange-blossom') + '<p>' + esc(TEXT.missingMemory) + '</p>'));
    track.appendChild(s);
    dots.innerHTML = '';
    cardMeta.textContent = metaLine(currentGroup.items[0]);
    cardCaption.textContent = currentGroup.items[0].caption;
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
    }, force ? 0 : 180);
    track.querySelectorAll('video').forEach((v, k) => { if (!v.paused && v.closest('.card-slide') !== track.children[i]) v.pause(); });
  }

  let currentGroup = null;
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
    // next frame so the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => cardEl.classList.add('is-open')));
    cardOpen = true;
    setTimeout(() => { const c = $('.card-close', cardEl); if (c) c.focus({ preventScroll: true }); }, 400);
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
    if (instant) done(); else setTimeout(done, 560);
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
      memories.forEach((m) => {
        const b = el('div', 'bar' + (broken.has(m.i) ? ' skip' : ''));
        b.appendChild(el('i'));
        bars.appendChild(b);
      });
    }

    function setBar(i, p) {
      const b = bars.children[i];
      if (b) b.firstChild.style.transform = `scaleX(${clamp(p, 0, 1).toFixed(4)})`;
    }

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
      const st = setTimeout(() => { if (my === token) showSpinner(true); }, 350);
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

      // assemble slide
      const { slide, kb, media, m } = item;
      kb.innerHTML = '';
      slide.querySelectorAll('.slide-bg').forEach((n) => n.remove());
      slide.classList.toggle('fit-contain', item.fit === 'contain');
      if (item.fit === 'contain' && m.type === 'image') {
        const bg = new Image(); bg.className = 'slide-bg'; bg.alt = ''; bg.src = m.src; slide.insertBefore(bg, kb);
      }
      kb.appendChild(media);
      stage.appendChild(slide);

      // Ken Burns (photos) — slow zoom/pan
      if (item.kbAnim) { item.kbAnim.cancel(); item.kbAnim = null; }
      if (m.type === 'image' && !reduced) {
        const r = rng(m.i + 5);
        const s0 = 1.02 + r() * .04, s1 = 1.12 + r() * .06;
        const ax = (r() - .5) * 5, ay = (r() - .5) * 4;
        const fwd = r() > .5;
        const a = `scale(${s0}) translate(${ax}%, ${ay}%)`, b = `scale(${s1}) translate(${-ax}%, ${-ay}%)`;
        item.kbAnim = kb.animate([{ transform: fwd ? a : b }, { transform: fwd ? b : a }], { duration: PHOTO_MS + 1400, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
      }

      // crossfade in
      slide.style.zIndex = 2;
      const inA = slide.animate(reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'scale(1.045)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: 900, easing: EASE, fill: 'both' });
      if (prevItem && prevItem.slide !== slide) {
        const ps = prevItem.slide;
        ps.style.zIndex = 1;
        const pm = prevItem.media;
        ps.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.02)' }], { duration: 900, easing: EASE_IO, fill: 'both' })
          .finished.then(() => {
            if (cur && cur.slide === ps) return;
            ps.remove();
            if (pm && pm.tagName === 'VIDEO' && (!cur || cur.media !== pm)) { try { pm.pause(); } catch (e) { /* */ } }
          }, () => {});
        if (pm && pm.tagName === 'VIDEO' && pm !== media) fadeOutVideo(pm);
      }
      inA.finished.then(() => { slide.style.zIndex = ''; }, () => {});

      // caption
      cap.classList.remove('is-in');
      capMeta.textContent = metaLine(m);
      capText.textContent = m.caption;
      void cap.offsetWidth;
      setTimeout(() => { if (cur === item) cap.classList.add('is-in'); }, 380);

      // video playback
      if (m.type === 'video') {
        media.muted = !soundOn();
        try { media.currentTime = 0; } catch (e) { /* */ }
        playVideo(media);
        setMusic(MUSIC_VOL * .15);
      } else {
        setMusic(MUSIC_VOL);
      }
      if (paused) pauseMedia();

      // preload the next one
      const n = nextValid(i + 1, 1);
      prep.forEach((it, k) => { if (k !== i && k !== n && (!prevItem || k !== prevItem.i)) prep.delete(k); });
      if (n > -1) setTimeout(() => { if (running && cur === item) prepare(n); }, 1000);

      loop();
    }

    function playVideo(v) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {
        if (!v.muted) { v.muted = true; showSoundHint(true); v.play().catch(() => {}); }
      });
    }

    function fadeOutVideo(v) {
      if (v.muted) return;
      const start = v.volume;
      let k = 0;
      const t = setInterval(() => { k++; try { v.volume = Math.max(0, start * (1 - k / 10)); } catch (e) { /* */ } if (k >= 10) { clearInterval(t); try { v.pause(); v.volume = 1; } catch (e) { /* */ } } }, 60);
    }

    function showSoundHint(on) {
      soundHint.hidden = !on || state.userMuted;
    }

    function duration() {
      if (!cur) return PHOTO_MS;
      if (cur.m.type === 'video') {
        const d = cur.media.duration;
        return (isFinite(d) && d > 0 ? Math.min(d, MAX_VIDEO_S) : MAX_VIDEO_S) * 1000;
      }
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
            const v = cur.media;
            const t = v.currentTime || 0;
            p = (t * 1000) / duration();
            if (v.ended) p = 1;
            // skip a video that never manages to play
            if (t === lastVT && !v.paused) stallT += dt; else stallT = 0;
            if (v.paused && v.readyState >= 2 && !paused) { stallT += dt; }
            lastVT = t;
            if (stallT > 9000) { stallT = 0; return next(); }
          } else {
            elapsed += dt;
            p = elapsed / PHOTO_MS;
          }
          setBar(idx, p);
          if (p >= 1) { return next(); }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function pauseMedia() {
      if (!cur) return;
      if (cur.kbAnim) cur.kbAnim.pause();
      if (cur.m.type === 'video') { try { cur.media.pause(); } catch (e) { /* */ } }
    }

    function resumeMedia() {
      if (!cur) return;
      if (cur.kbAnim) cur.kbAnim.play();
      if (cur.m.type === 'video') playVideo(cur.media);
    }

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
      updateMuteUI();
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
      setMusic(MUSIC_VOL * .6);
      black.classList.add('is-in');
      await wait(reduced ? 500 : 1300);
      FX.setMode('none');
      FX.shower(reduced ? 1200 : 2800, 30);
      await wait(reduced ? 600 : 1900);
      videoPool.forEach((v) => { try { v.pause(); } catch (e) { /* */ } });
      stage.querySelectorAll('.slide').forEach((n) => n.remove());
      state.busy = false;
      state.scene = 'story';
      finishing = false;
      await goToLetterFromStory();
    }

    async function goToLetterFromStory() {
      state.busy = true;
      state.scene = 'letter';
      Letter.enter();
      FX.setMode('letter');
      await crossfade('story', 'letter', { dur: 1300 });
      state.busy = false;
    }

    function applySound() {
      const on = soundOn();
      if (cur && cur.m.type === 'video') {
        cur.media.muted = !on;
        if (on && !paused) playVideo(cur.media);
        setMusic(MUSIC_VOL * .15);
      } else if (cur) {
        setMusic(MUSIC_VOL);
      }
      showSoundHint(!on && !state.userMuted && !state.interacted);
    }

    function unlockFromGesture() {
      if (!state.interacted) {
        primeMedia();
        showSoundHint(false);
        applySound();
        updateMuteUI();
      }
    }

    // ----- controls -----
    let px = 0, py = 0, pt = 0, holdT = 0, held = false, down = false;
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; held = false; px = e.clientX; py = e.clientY; pt = performance.now();
      clearTimeout(holdT);
      holdT = setTimeout(() => { if (down) { held = true; holdPaused = true; setPaused(true); } }, 240);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (Math.abs(e.clientX - px) > 14 || Math.abs(e.clientY - py) > 14) clearTimeout(holdT);
    });
    const up = (e) => {
      if (!down) return;
      down = false;
      clearTimeout(holdT);
      if (held) { held = false; if (holdPaused) { holdPaused = false; setPaused(false); } return; }
      if (e.type === 'pointercancel') return;
      unlockFromGesture();
      const dx = e.clientX - px, dy = e.clientY - py;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); return; }
      if (Math.abs(dy) > 50) return;
      const w = stage.clientWidth;
      if (e.clientX < w * .33) prev(); else next();
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

    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.interacted) { unlockFromGesture(); return; }
      toggleMute();
    });
    soundHint.addEventListener('click', (e) => { e.stopPropagation(); unlockFromGesture(); });
    $('#exitStory').addEventListener('click', (e) => { e.stopPropagation(); goTo('garden'); });

    document.addEventListener('visibilitychange', () => {
      if (state.scene !== 'story' || !running) return;
      if (document.hidden) { pauseMedia(); if (music) music.pause(); }
      else { if (!paused) { resumeMedia(); lastT = performance.now(); } if (music && musicWanted && soundOn()) music.play().catch(() => {}); }
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
     Scene 4 — Letter
     --------------------------------------------------------------------- */
  const Letter = (function () {
    const envWrap = $('#envelopeWrap');
    const env = $('#envelope');
    const paper = $('#paper');
    const scroller = $('#paperScroll');
    const body = $('#letterBody');
    const sig = $('#signature');
    const actions = $('#letterActions');
    const hint = $('#letterHint');
    let opened = false, revealIdx = 0, revealItems = [], revealT = 0, waitingScroll = false, built = false;

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
      env.addEventListener('click', open);
      $('#toGarden').addEventListener('click', () => goTo('garden'));
      $('#watchAgain').addEventListener('click', () => { primeMedia(); goTo('story'); });
      scroller.addEventListener('scroll', () => { if (waitingScroll) { waitingScroll = false; step(); } }, { passive: true });
    }

    function reset() {
      opened = false;
      clearTimeout(revealT);
      env.className = 'envelope';
      envWrap.style.opacity = '';
      envWrap.getAnimations && envWrap.getAnimations().forEach((a) => a.cancel());
      paper.className = 'paper';
      paper.setAttribute('aria-hidden', 'true');
      paper.getAnimations && paper.getAnimations().forEach((a) => a.cancel());
      envWrap.hidden = false;
      body.querySelectorAll('p').forEach((p) => p.classList.remove('is-in'));
      sig.classList.remove('is-in');
      actions.classList.remove('is-in');
      scroller.scrollTop = 0;
    }

    function enter() {
      build();
      reset();
      updateMuteUI();
    }

    async function open() {
      if (opened) return;
      opened = true;
      if (reduced) {
        env.classList.add('is-open');
        await animate(envWrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 });
        envWrap.hidden = true;
        paper.classList.add('is-shown', 'unfold-top', 'unfold-bot', 'is-unfolded');
        paper.removeAttribute('aria-hidden');
        await animate(paper, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
        return beginReveal();
      }
      env.classList.add('is-open');             // seal breaks, flap opens
      await wait(820);
      env.classList.add('flap-behind');
      await wait(120);
      env.classList.add('is-out');              // letter slides out
      await wait(1000);
      animate(envWrap, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40px) scale(.94)' }], { duration: 800, easing: EASE_IO })
        .then(() => { envWrap.hidden = true; });
      paper.classList.add('is-shown');
      paper.removeAttribute('aria-hidden');
      await animate(paper, [
        { opacity: 0, transform: 'translate(-50%, -38%) scale(.55)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
      ], { duration: 900, easing: EASE });
      paper.classList.add('unfold-top');
      await wait(380);
      paper.classList.add('unfold-bot');
      await wait(900);
      paper.classList.add('is-unfolded');
      await wait(300);
      beginReveal();
    }

    function beginReveal() {
      revealItems = Array.from(body.querySelectorAll('p'));
      if (sig.textContent) revealItems.push(sig);
      revealIdx = 0;
      step();
    }

    function visible(n) {
      const r = n.getBoundingClientRect(), s = scroller.getBoundingClientRect();
      return r.top < s.bottom - 40;
    }

    function step() {
      clearTimeout(revealT);
      if (revealIdx >= revealItems.length) {
        revealT = setTimeout(() => {
          actions.classList.add('is-in');
          FX.shower(reduced ? 1500 : 3600, 22);
        }, 700);
        return;
      }
      const n = revealItems[revealIdx];
      if (revealIdx > 0 && !visible(n)) { waitingScroll = true; return; }
      n.classList.add('is-in');
      revealIdx++;
      const len = (n.textContent || '').length;
      revealT = setTimeout(step, reduced ? 350 : 650 + Math.min(len * 6, 900));
    }

    return { enter };
  })();

  if (letterMute) letterMute.addEventListener('click', toggleMute);

  /* ---------------------------------------------------------------------
     Global keys
     --------------------------------------------------------------------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cardOpen) { e.preventDefault(); closeCard(); }
  });

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function preload(src) {
    return new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = src; });
  }

  async function boot() {
    $('#loaderText').textContent = TEXT.loading || '';
    Intro.build();
    const t0 = performance.now();
    const firstImg = memories.find((m) => m.type === 'image');
    const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    await Promise.race([Promise.all([fonts, firstImg ? preload(firstImg.src) : null]), wait(3500)]);
    const spent = performance.now() - t0;
    if (spent < 900) await wait(900 - spent);

    const jump = (params.get('scene') || '').toLowerCase();
    const loader = $('#loader');
    loader.classList.add('is-done');
    setTimeout(() => loader.remove(), 1000);

    if (jump === 'garden' || jump === 'story' || jump === 'letter') {
      state.scene = jump;
      scenes[jump].classList.add('is-active');
      if (jump === 'garden') Garden.enter();
      if (jump === 'letter') Letter.enter();
      if (jump === 'story') Story.start(0);
      FX.setMode(jump);
      animate(scenes[jump], [{ opacity: 0 }, { opacity: 1 }], { duration: 700 }).then((a) => a && a.cancel && a.cancel());
      updateMuteUI();
      return;
    }
    state.scene = 'intro';
    scenes.intro.classList.add('is-active');
    Intro.start();
  }

  // Remember the first real gesture anywhere (needed for sound on iOS)
  ['pointerup', 'keydown'].forEach((t) => document.addEventListener(t, () => {
    if (!state.interacted && state.scene && state.scene !== 'story') { primeMedia(); updateMuteUI(); }
  }, { capture: true, passive: true }));

  boot();
})();
