// -----------------------------------------
// DODGE — [data-dodge]
// -----------------------------------------
// The footer maps won't let you catch them: hover one and it dissolves, then rebuilds somewhere
// else in the figure — often as a different map from the family. One assemble (the DotMap build,
// run backwards), with every dodge rolling its own VALUES so it never repeats without ever changing
// character.
//
// Nothing to add in Webflow — it finds the footer figure and its parts by their existing classes:
//   .footer-bottom-figure   the wrapper
//   .footer-bottom-map-1    purple colony   ┐ these take part
//   .footer-bottom-map-2    khaki map       ┘
//   .footer-bottom-logo     wordmark — maps route around it, never cover it
//   .footer-bottom-grid*    untouched backdrop
// The data-* equivalents (data-dodge / -map / -avoid) still win if present, so anything can be
// re-pointed later without a code change.
//
// TUNING LIVES IN `CONFIG` BELOW — edit, `pnpm build`, ship. No attributes involved.
//
// Rendering: those svgs are rasterised, grid-sliced (empty cells culled by alpha — same model as
// dotmap.js) and drawn to one canvas; the originals are then hidden. Slicing by raster rather than
// by subpath is what makes granularity uniform: the purple colony is 400+ subpaths and the khaki
// map is 9, so per-subpath slicing dissolved one as a swarm and the other as sliding blocks.

// ------------------------------------------------------------------------------------------------
// CONFIG — the tuned values. This is the only place to change the feel.
// ------------------------------------------------------------------------------------------------
const CONFIG = {
  cell: 30,        // slice size in px — bigger = chunkier break-up (and cheaper)
  out: 0.5,        // dissolve seconds
  in: 0.7,         // rebuild seconds
  gap: 0.05,       // pause while fully dispersed
  stagger: 0.45,   // cascade window 0..1 — smaller = tighter, more simultaneous
  spread: 1.23,    // fly distance
  spin: 1.05,      // cell spin
  shrink: 0.4,     // shrink while gone
  pad: 10,         // hover padding px — 10 means you have to actually touch it
  gapMaps: 26,     // min px between maps
  cooldown: 0.12,  // seconds before a map can flee again
  variation: 1,    // 0 = every dodge identical, 1 = max wander (same motion either way)
  swap: true,      // rebuild as a different map from the pool
  stackAt: 767,    // at/below this width the figure splits top/bottom instead of left/right
  revealStagger: 0.18, // seconds between the two maps assembling in on scroll

  // Where the maps live, as fractions of the figure. These replace the static svgs that used to be
  // in the Webflow markup — they were removed because the canvas drew them a second time and the
  // two overlapped. x/y are the centre, w is the width.
  slots: [
    { x: 0.22, y: 0.66, w: 0.28 }, // was the purple colony, lower-left
    { x: 0.76, y: 0.60, w: 0.24 }, // was the khaki map, right
  ],
};

const SEL = {
  root: '[data-dodge], .footer-bottom-figure',
  map: '[data-dodge-map], .footer-bottom-map-1, .footer-bottom-map-2',
  avoid: '[data-dodge-avoid], .footer-bottom-logo',
};


// ------------------------------------------------------------------------------------------------
// EXTRA MAPS — the rest of the family, so a dodging map can come back as something else.
//
// Fetched, NOT bundled: all eight shapes total ~604KB, which is about the size of the whole bundle
// again for a footer effect. They're pulled from the repo via jsDelivr only once the footer scrolls
// into view, and cached by the CDN thereafter. If the fetch fails the footer just swaps between its
// own two maps — nothing breaks.
//
// All eight are enabled (~604KB total, sequential). Weights are noted per file — trim the list if
// that ever matters more than variety.
// ------------------------------------------------------------------------------------------------
const POOL_BASE = 'https://cdn.jsdelivr.net/gh/tomasmrazek92/modernvivo@main/demo/shapes/';
const POOL_FILES = [
  // Ordered lightest-first on purpose: fetched sequentially, so the family widens within a few
  // hundred KB while the heavy ones are still arriving.
  'shape-07.svg', //  12 KB
  'shape-04.svg', //  25 KB
  'shape-08.svg', //  25 KB
  'shape-05.svg', //  35 KB
  'shape-03.svg', //  88 KB
  'shape-01.svg', //  92 KB
  'shape-02.svg', // 137 KB
  'shape-06.svg', // 174 KB
];

// Add ?dodge-debug to the URL to see why a hover did or didn't move a map. Works on the published
// site, which is the only place this can really be judged.
const DEBUG = typeof location !== 'undefined' && /[?&]dodge-debug/.test(location.search);
const log = (...a) => DEBUG && console.log('[dodge]', ...a);

const RASTER_W = 620; // resolution each map is rasterised at before slicing
const ORDERS = ['radial', 'random', 'scan'];

const frac = (n) => n - Math.floor(n);
const rnd = (i) => frac(Math.sin(i * 12.9898) * 43758.5453); // deterministic — no Math.random
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

const orderKey = (kind, i, c) =>
  kind === 'random'
    ? rnd(i * 1.37 + 1)
    : kind === 'scan'
      ? c.ny
      : Math.hypot(c.nx - 0.5, c.ny - 0.5) / 0.707;

function injectDodgeCSS() {
  if (document.getElementById('dodge-css')) return;
  const style = document.createElement('style');
  style.id = 'dodge-css';
  // !important so it beats the reveal's inline autoAlpha write; a stylesheet rule also can't be
  // removed by clearProps the way an inline style can
  style.textContent = '[data-dodge-hidden]{visibility:hidden !important}';
  document.head.appendChild(style);
}

export function initDodge(scope = document) {
  const roots = scope.querySelectorAll(SEL.root);
  if (!roots.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // desktop only

  roots.forEach((root) => {
    if (root.__dodge) return; // the footer persists across barba navs
    root.__dodge = build(root);
  });
}

function build(root) {
  const svgs = Array.from(root.querySelectorAll(SEL.map));
  if (svgs.length < 1) return null;

  const cfg = CONFIG;

  // Hidden immediately: the canvas draws them from here on, and leaving them visible until the lazy
  // build would double-draw (the overlap) then flash as they swap over.
  //
  // Hidden via an injected STYLESHEET RULE with !important, not an inline style. The figure is a
  // [data-reveal-group], so the content reveal animates these svgs: it writes inline
  // visibility:visible via autoAlpha, and finishes with clearProps:'all' which strips any inline
  // style we set. An inline hide therefore survives until the reveal completes and then vanishes —
  // which is exactly the "originals come back and never leave" symptom. A stylesheet !important
  // rule outranks GSAP's inline write and can't be cleared by clearProps.
  //
  // visibility (not display) so the boxes still measure for slot positions.
  injectDodgeCSS();
  svgs.forEach((svg) => {
    svg.setAttribute('data-dodge-hidden', '');
    svg.__dodgeHidden = true;
  });
  const restoreSvgs = () =>
    svgs.forEach((svg) => {
      svg.removeAttribute('data-dodge-hidden');
      svg.__dodgeHidden = false;
    });

  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-dodge-canvas', '');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const ctx = canvas.getContext('2d');

  let pool = [];   // every rasterised+sliced map
  let slots = [];  // the ones on screen (one per map that was inline in the layout)
  let W = 0;
  let H = 0;
  let DPR = 1;
  let running = false;
  let built = false;
  const pointer = { x: -1e5, y: -1e5, inside: false };

  // ---- raster + slice -------------------------------------------------------------------------
  // one raster path for both sources: an inline <svg> element, or fetched markup
  function rasteriseMarkup(markup, ar) {
    return new Promise((resolve) => {
      const w = RASTER_W;
      const h = Math.max(1, Math.round(RASTER_W / (ar || 1)));
      // the blob is same-origin, so the canvas is never tainted even for CDN-fetched markup
      const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve({ canvas: c, w, h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null); // a map that won't rasterise is skipped, not fatal
      };
      img.src = url;
    });
  }

  function rasterise(svg) {
    const clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const ar = vb && vb.width ? vb.width / vb.height : 1;
    clone.setAttribute('width', RASTER_W);
    clone.setAttribute('height', Math.max(1, Math.round(RASTER_W / ar)));
    return rasteriseMarkup(new XMLSerializer().serializeToString(clone), ar);
  }

  // Pulled in AFTER the footer is already interactive, so the first dodge never waits on a network
  // round trip. Each one just widens what a map can become.
  async function loadExtras(limit = Infinity) {
    let got = 0;
    for (const file of POOL_FILES) {
      if (got >= limit) return;
      try {
        const res = await fetch(POOL_BASE + file);
        if (!res.ok) continue;
        const markup = await res.text();
        const m = markup.match(/viewBox="([\d.\-\s]+)"/);
        const vb = m ? m[1].trim().split(/\s+/).map(Number) : null;
        const ar = vb && vb[3] ? vb[2] / vb[3] : 1;
        const r = await rasteriseMarkup(markup, ar);
        if (!r) continue;
        r.cells = slice(r, cfg.cell);
        pool.push(r);
        got++;
      } catch (e) {
        /* offline / blocked — the two inline maps still work on their own */
      }
    }
  }

  function slice(r, cell) {
    const data = r.canvas.getContext('2d').getImageData(0, 0, r.w, r.h).data;
    const cells = [];
    for (let y = 0; y < r.h; y += cell) {
      for (let x = 0; x < r.w; x += cell) {
        const cw = Math.min(cell, r.w - x);
        const ch = Math.min(cell, r.h - y);
        let opaque = false;
        for (let yy = y; yy < y + ch && !opaque; yy += 2) {
          for (let xx = x; xx < x + cw; xx += 2) {
            if (data[(yy * r.w + xx) * 4 + 3] > 12) {
              opaque = true;
              break;
            }
          }
        }
        if (opaque) {
          cells.push({ x, y, w: cw, h: ch, nx: (x + cw / 2) / r.w, ny: (y + ch / 2) / r.h });
        }
      }
    }
    return cells;
  }

  // ---- geometry -------------------------------------------------------------------------------
  function measure() {
    const r = root.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }

  // Elements the maps must never cover — the wordmark, plus anything else tagged.
  function avoidBoxes() {
    const r = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll(SEL.avoid)).map((el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height };
    });
  }

  const boxOf = (s, nx, ny) => {
    const w = s.wFrac * W;
    const h = w * (s.src.h / s.src.w);
    return { x: (nx ?? s.x) * W - w / 2, y: (ny ?? s.y) * H - h / 2, w, h };
  };

  const hits = (A, B, pad) =>
    A.x - pad < B.x + B.w && A.x + A.w + pad > B.x && A.y - pad < B.y + B.h && A.y + A.h + pad > B.y;

  // Each slot owns half the figure so the two can never compete for the same room. WHICH half
  // depends on the shape of the figure: side-by-side on wide viewports, stacked at/below stackAt,
  // where a left/right split would squeeze each map into a sliver.
  const stacked = () => window.innerWidth <= cfg.stackAt;

  // The centre-point range, in fractions, that keeps this slot's box inside its own half. The free
  // axis gets the full span minus the box; the owned axis gets its half minus a centre gutter.
  function slotRange(s) {
    const w = s.wFrac * W;
    const h = w * (s.src.h / s.src.w);
    const hw = w / 2 / W;
    const hh = h / 2 / H;
    const gx = cfg.gapMaps / 2 / W;
    const gy = cfg.gapMaps / 2 / H;
    const span = (lo, hi, mid) => (hi > lo ? [lo, hi] : [mid, mid]); // too big for its half → pin

    if (stacked()) {
      const y = s.side === 0 ? span(hh, 0.5 - hh - gy, 0.25) : span(0.5 + hh + gy, 1 - hh, 0.75);
      return { xLo: hw, xHi: 1 - hw, yLo: y[0], yHi: y[1] };
    }
    const x = s.side === 0 ? span(hw, 0.5 - hw - gx, 0.25) : span(0.5 + hw + gx, 1 - hw, 0.75);
    return { xLo: x[0], xHi: x[1], yLo: hh, yHi: 1 - hh };
  }

  // Which slot owns which half. Honours the design — whichever map sits further left (or higher,
  // when stacked) takes the first half — and is re-run whenever the axis flips on resize.
  function assignSides() {
    if (slots.length < 2) {
      slots.forEach((s) => (s.side = 0));
    } else {
      const key = stacked() ? 'y' : 'x';
      const order = slots[0][key] <= slots[1][key] ? [0, 1] : [1, 0];
      slots[order[0]].side = 0;
      slots[order[1]].side = 1;
    }
    slots.forEach((s) => {
      const r = slotRange(s);
      s.x = Math.min(r.xHi, Math.max(r.xLo, s.x)); // pull into its own half if the design sat outside
      s.y = Math.min(r.yHi, Math.max(r.yLo, s.y));
    });
  }

  // Padding relaxes across passes so a tight figure still resolves — otherwise a map could find no
  // legal home and stay dispersed forever.
  function place(s, avoidPointer = true) {
    const avoid = avoidBoxes();
    const { xLo, xHi, yLo, yHi } = slotRange(s);
    for (let pass = 0; pass < 4; pass++) {
      const pad = cfg.gapMaps * (1 - pass * 0.3);
      for (let i = 0; i < 60; i++) {
        const seed = s.seed++ * 1.7 + pass * 31;
        const nx = xLo + rnd(seed * 2.1) * (xHi - xLo);
        const ny = yLo + rnd(seed * 3.7 + 9) * (yHi - yLo);
        const b = boxOf(s, nx, ny);
        if (b.x < 2 || b.y < 2 || b.x + b.w > W - 2 || b.y + b.h > H - 2) continue;
        if (
          avoidPointer &&
          pointer.inside &&
          pointer.x > b.x - 40 &&
          pointer.x < b.x + b.w + 40 &&
          pointer.y > b.y - 40 &&
          pointer.y < b.y + b.h + 40
        ) {
          continue; // never rebuild under the cursor, or it re-triggers instantly
        }
        let clash = avoid.some((a) => hits(b, a, pad));
        if (!clash) clash = slots.some((o) => o !== s && hits(b, boxOf(o), pad));
        if (!clash) return { nx, ny };
      }
    }

    // Last resort: mirror across the figure, clamped inside it. Returning nothing here was a real
    // bug — trigger() bailed and the map simply refused to move, which reads as "hover does nothing"
    // rather than as a placement failure. A slightly awkward home beats no dodge at all.
    // mirror along the FREE axis only — mirroring the owned axis would cross into the other half
    const home = stacked()
      ? { nx: Math.min(xHi, Math.max(xLo, 1 - s.x)), ny: Math.min(yHi, Math.max(yLo, s.y)) }
      : { nx: Math.min(xHi, Math.max(xLo, s.x)), ny: Math.min(yHi, Math.max(yLo, 1 - s.y)) };
    log('no clear slot found — falling back to mirrored home', home);
    return home;
  }

  // per-dodge multipliers on the configured values — same effect, never the same take
  function roll(s) {
    const v = cfg.variation;
    const j = (n, lo, hi) => 1 + (lo + rnd(s.seed * n) * (hi - lo)) * v;
    return {
      spread: j(1.7, -0.45, 0.55),
      spin: j(3.1, -0.7, 0.9),
      window: j(5.3, -0.35, 0.35),
      out: j(7.9, -0.25, 0.3),
      in: j(9.7, -0.25, 0.35),
      order: ORDERS[Math.floor(rnd(s.seed * 11.3) * ORDERS.length) % ORDERS.length],
    };
  }

  function nextSrc(s) {
    if (!cfg.swap || pool.length < 2) return s.src;
    const used = new Set(slots.filter((o) => o !== s).map((o) => o.src));
    const free = pool.filter((p) => p !== s.src && !used.has(p));
    if (!free.length) return s.src;
    return free[Math.floor(rnd(s.seed++ * 4.3) * free.length) % free.length];
  }

  function trigger(s) {
    if (s.phase !== 'idle') {
      log('hover ignored — map is mid-dodge', s.phase);
      return;
    }
    const home = place(s);
    if (!home) return;
    s.seed++;
    s.vary = roll(s);
    s.pending = { home, src: nextSrc(s) };
    log('dodge', { from: [+s.x.toFixed(2), +s.y.toFixed(2)], to: [+home.nx.toFixed(2), +home.ny.toFixed(2)], pool: pool.length });
    s.phase = 'out';
    s.t = 0;
  }

  // ---- build ----------------------------------------------------------------------------------
  async function make() {
    if (built) return;
    built = true;

    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.appendChild(canvas);
    measure();

    const rootRect = root.getBoundingClientRect();
    for (const svg of svgs) {
      const r = await rasterise(svg);
      if (!r) continue;
      r.cells = slice(r, cfg.cell);
      pool.push(r);

      // A map that's laid out in the design becomes a slot, starting exactly where it sits, so the
      // resting composition is the designed one. Hidden pool-only maps just widen the family.
      const b = svg.getBoundingClientRect();
      if (b.width > 4 && b.height > 4) {
        slots.push({
          src: r,
          wFrac: b.width / rootRect.width,
          x: (b.left - rootRect.left + b.width / 2) / rootRect.width,
          y: (b.top - rootRect.top + b.height / 2) / rootRect.height,
          phase: 'idle',
          t: 0,
          seed: slots.length * 97 + 5,
          vary: null,
        });
      }
    }
    // No inline maps (they were removed from Webflow to stop the canvas double-drawing them) —
    // so the first sources have to come off the network before anything can be shown. Await just
    // the lightest couple, then let the rest stream in behind.
    if (!slots.length) {
      await loadExtras(Math.max(2, cfg.slots.length));
      cfg.slots.forEach((decl, i) => {
        const src = pool[i % pool.length];
        if (!src) return;
        slots.push({
          src,
          wFrac: decl.w,
          x: decl.x,
          y: decl.y,
          phase: 'idle',
          t: 0,
          seed: i * 97 + 5,
          vary: null,
        });
      });
    }

    // nothing rasterised or placed → hand the static artwork back rather than leaving a blank footer
    if (!slots.length) {
      restoreSvgs();
      return;
    }

    assignSides();

    slots.forEach((s) => (s.vary = roll(s)));

    // Assemble in on first view, using the same motion the dodge uses — so arriving reads as the
    // site's build, and the footer is never just blank-then-there.
    slots.forEach((s, i) => {
      s.phase = 'in';
      s.t = -i * cfg.revealStagger; // negative time = a beat before this one starts
    });

    log('built', {
      figure: [Math.round(W), Math.round(H)],
      slots: slots.map((x) => ({
        box: (({ x: bx, y: by, w, h }) => [Math.round(bx), Math.round(by), Math.round(w), Math.round(h)])(boxOf(x)),
      })),
      avoid: avoidBoxes().length,
      pool: pool.length,
    });

    loadExtras(); // the rest, in the background
  }

  // ---- frame ----------------------------------------------------------------------------------
  function step() {
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.05);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const s of slots) {
      const vy = s.vary || { spread: 1, spin: 1, window: 1, out: 1, in: 1, order: 'radial' };

      if (s.phase !== 'idle') {
        s.t += dt;
        const vOut = cfg.out * vy.out;
        const vIn = cfg.in * vy.in;
        if (s.phase === 'out' && s.t >= vOut + cfg.gap) {
          s.phase = 'in';
          s.t = 0;
          s.x = s.pending.home.nx;
          s.y = s.pending.home.ny;
          s.src = s.pending.src; // relocate + change identity while fully dispersed
        } else if (s.phase === 'in' && s.t >= vIn + cfg.cooldown) {
          s.phase = 'idle';
          s.t = 0;
        }
      }

      const box = boxOf(s);

      if (s.phase === 'idle' && pointer.inside) {
        const p = cfg.pad;
        if (
          pointer.x > box.x - p &&
          pointer.x < box.x + box.w + p &&
          pointer.y > box.y - p &&
          pointer.y < box.y + box.h + p
        ) {
          trigger(s);
        }
      }

      // idle costs one drawImage; the per-cell path is only paid while a map is actually moving
      if (s.phase === 'idle') {
        ctx.drawImage(s.src.canvas, box.x, box.y, box.w, box.h);
        continue;
      }

      const dissolving = s.phase === 'out';
      const prog = Math.max(0, Math.min(1, s.t / (dissolving ? cfg.out * vy.out : cfg.in * vy.in)));
      const k = box.w / s.src.w;
      const win = Math.min(0.95, Math.max(0.03, cfg.stagger * vy.window));
      const cells = s.src.cells;

      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        let local = (prog - orderKey(vy.order, i, c) * (1 - win)) / win;
        local = local < 0 ? 0 : local > 1 ? 1 : local;
        const alpha = dissolving ? 1 - easeIn(local) : easeOut(local);
        if (alpha <= 0.004) continue;

        const dx = box.x + c.x * k;
        const dy = box.y + c.y * k;
        const cw = c.w * k;
        const ch = c.h * k;

        if (alpha >= 0.999) {
          ctx.drawImage(s.src.canvas, c.x, c.y, c.w, c.h, dx, dy, cw, ch);
          continue;
        }

        const ang = Math.atan2(c.ny - 0.5, c.nx - 0.5) + (rnd(i * 5.3) - 0.5) * 1.2;
        const mag =
          cfg.spread * vy.spread * box.w * (0.35 + 0.65 * rnd(i * 3.7 + 5)) * (1 - alpha);
        const sc = 1 - (1 - alpha) * cfg.shrink;
        const rot = (rnd(i * 7.1) - 0.5) * cfg.spin * vy.spin * (1 - alpha);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(dx + cw / 2 + Math.cos(ang) * mag, dy + ch / 2 + Math.sin(ang) * mag);
        if (rot) ctx.rotate(rot);
        ctx.scale(sc, sc);
        ctx.drawImage(s.src.canvas, c.x, c.y, c.w, c.h, -cw / 2, -ch / 2, cw, ch);
        ctx.restore();
      }
    }
  }

  // ---- lifecycle ------------------------------------------------------------------------------
  const onMove = (e) => {
    const r = root.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.inside =
      pointer.x >= 0 && pointer.x <= r.width && pointer.y >= 0 && pointer.y <= r.height;
  };
  const onLeave = () => (pointer.inside = false);

  async function start() {
    if (running) return;
    running = true;
    await make(); // lazy: nothing is rasterised on a page nobody scrolls to the footer on
    if (!slots.length) return;
    measure();
    gsap.ticker.add(step);
    window.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
  }

  function stop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(step); // removed, not early-returning — zero per-frame cost out of view
    window.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    pointer.inside = false;
    slots.forEach((s) => {
      s.phase = 'idle';
      s.t = 0;
    });
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting && !document.hidden ? start() : stop())),
    { threshold: 0 }
  );
  io.observe(root);

  const onVis = () => (document.hidden ? stop() : null);
  document.addEventListener('visibilitychange', onVis);

  // width-only: a mobile URL bar changing viewport height must not re-measure
  let lastW = window.innerWidth;
  // A resize changes the figure's aspect, so positions that were legal can now sit on the logo, on
  // each other, or off the edge. Positions are fractions so they scale, but scaling is not the same
  // as staying valid — re-check and snap anything that no longer fits.
  function revalidate() {
    const avoid = avoidBoxes();
    assignSides(); // the split axis may have flipped across stackAt
    slots.forEach((s) => {
      if (s.phase !== 'idle') return; // mid-dodge: it's heading somewhere legal already
      const r = slotRange(s);
      const b = boxOf(s);
      const outside = b.x < 2 || b.y < 2 || b.x + b.w > W - 2 || b.y + b.h > H - 2;
      const onLogo = avoid.some((a) => hits(b, a, cfg.gapMaps));
      const wrongHalf =
        s.x < r.xLo - 1e-6 || s.x > r.xHi + 1e-6 || s.y < r.yLo - 1e-6 || s.y > r.yHi + 1e-6;
      const onOther = slots.some((o) => o !== s && hits(b, boxOf(o), cfg.gapMaps));
      if (!outside && !onLogo && !wrongHalf && !onOther) return;
      const home = place(s, false); // snap, don't choreograph — a resize is not a moment for motion
      if (home) {
        s.x = home.nx;
        s.y = home.ny;
      }
      log('repositioned on resize', { outside, onLogo, wrongHalf, onOther });
    });
  }

  const onResize = () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    measure();
    revalidate();
  };
  window.addEventListener('resize', onResize);

  return {
    cfg,
    get slots() {
      return slots;
    },
    destroy() {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      canvas.remove();
      restoreSvgs();
      root.__dodge = null;
    },
  };
}
