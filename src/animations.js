// -----------------------------------------
// ANIMATIONS
// -----------------------------------------
// Page-level effects. Wired into the registry in index.js so they run on first load AND
// after each barba page change. Each takes a `scope` (the incoming container) so navs only
// touch the new page's elements. gsap + SplitText + ScrollTrigger are ambient CDN globals
// (registered in index.js).

import DotField from './dotfield.js'; // matter.js physics visual; matter is bundled by esbuild
import DotMap from './dotmap.js'; // lightweight canvas-2D dot-artwork reveal (for many-per-page maps)

// Button 056 — split the button label into inline-block words (for hover/stagger effects)
export function initButton056(scope = document) {
  document.fonts.ready.then(() => {
    const buttons = scope.querySelectorAll('[data-button-056]');
    if (buttons.length === 0) return;

    buttons.forEach((element) => {
      const textElements = element.querySelectorAll('[data-button-056-text]');
      if (textElements.length === 0) return;

      textElements.forEach((textElement) => {
        const splitText = new SplitText(textElement, {
          type: 'words',
          tag: 'span',
          wordsClass: 'btn_split-word',
          propIndex: true,
        });

        gsap.set(splitText.words, { display: 'inline-block' });
      });
    });
  });
}

// Heading reveal — single init for all heading animations.
// Effect chosen per-element:  data-reveal="lines" | "words" | "type" | "spans"
// Trigger:  default = on scroll into view (start = data-reveal-start, default "top 80%").
//           data-reveal-start="load"  → play immediately on page load (for above-the-fold heroes,
//                                        no scroll needed).
//           data-reveal-after="<event>" → wait for a one-time document event instead
//           (e.g. "shapefield:resolved" so the hero text reveals AFTER the visual forms).
// Optional overrides: data-reveal-start / -stagger / -duration / -once / -markers / -delay
// Each build returns a PAUSED tween (from-state applied immediately, so targets start hidden);
// playWhenReady() plays it when the trigger fires.
const HEADING_REVEALS = {
  // "spans" reveals the element's own direct child elements (e.g. two <span>s) in sequence,
  // no SplitText — first one rises/fades in, then the next after a pause (data-reveal-stagger).
  spans: {
    noSplit: true,
    pick: (el) => el.querySelectorAll(':scope > *'),
    build: (targets, o) => {
      gsap.set(targets, { yPercent: 110, autoAlpha: 0 }); // hide immediately (before the trigger)
      return gsap.to(targets, {
        yPercent: 0, autoAlpha: 1, duration: o.duration, stagger: o.stagger, ease: 'expo.out', paused: true,
      });
    },
  },

  lines: {
    split: { type: 'lines', mask: 'lines', autoSplit: true },
    pick: (self) => self.lines,
    build: (targets, o) => {
      gsap.set(targets, { yPercent: 110 }); // masked — translated out of view
      return gsap.to(targets, { yPercent: 0, duration: o.duration, stagger: o.stagger, ease: 'expo.out', paused: true });
    },
  },

  words: {
    split: { type: 'words', mask: 'words' },
    pick: (self) => self.words,
    build: (targets, o) => {
      gsap.set(targets, { yPercent: 110 });
      return gsap.to(targets, { yPercent: 0, duration: o.duration, stagger: o.stagger, ease: 'expo.out', paused: true });
    },
  },

  type: {
    split: { type: 'chars' },
    pick: (self) => self.chars,
    build: (targets, o) => {
      gsap.set(targets, { autoAlpha: 0 }); // hide before the trigger fires
      return gsap.to(targets, {
        autoAlpha: 1,
        duration: 0.01, // near-instant "pop" per char, not a fade
        ease: 'none',
        stagger: { each: o.stagger }, // each = fixed typing speed regardless of length
        paused: true,
      });
    },
  },
};

// Play a paused reveal when its trigger is reached: scroll into view by default, or a one-time
// document event when data-reveal-after is set. A fallback timer guarantees the content never
// stays hidden if the awaited event never fires.
function playWhenReady(el, opts, play) {
  // data-reveal-delay: hold for N seconds AFTER the trigger fires, before playing
  const fire = opts.delay ? () => gsap.delayedCall(opts.delay, play) : play;
  const after = el.getAttribute('data-reveal-after');

  // data-reveal-start="load" (or data-reveal-after="load") → play immediately on init instead of
  // waiting for a scroll. Use for above-the-fold / hero headings that should animate on page load.
  if (opts.start === 'load' || after === 'load') {
    fire();
    return;
  }

  if (after) {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      fire();
    };
    // if the event already fired before this listener attached (e.g. reduced-motion resolves instantly), play now
    if (window.__shapefieldResolved && window.__shapefieldResolved.has(after)) {
      run();
      return;
    }
    document.addEventListener(after, run, { once: true });
    gsap.delayedCall(12, run); // safety net
    return;
  }
  ScrollTrigger.create({ trigger: el, start: opts.start, once: opts.once, markers: opts.markers, onEnter: fire });
}

export function initHeadingReveal(scope = document) {
  // fonts.ready so line splits measure against the loaded font (avoids reflow flash)
  document.fonts.ready.then(() => {
    gsap.utils.toArray(scope.querySelectorAll('[data-reveal]')).forEach((el) => {
      // Guard against double-init on the SAME element (e.g. once + afterEnter both running on first
      // load) — a second SplitText pass would hit the _revealed branch and clearProps → snap to end,
      // no animation. Fresh barba pages bring fresh elements, so this doesn't block per-page re-init.
      if (el.__revealInit) return;
      el.__revealInit = true;

      const mode = el.getAttribute('data-reveal');
      const cfg = HEADING_REVEALS[mode];
      if (!cfg) return; // unknown value → skip silently, no errors

      const opts = {
        start: el.getAttribute('data-reveal-start') || 'top 80%',
        duration: parseFloat(el.getAttribute('data-reveal-duration')) || 0.8,
        stagger:
          parseFloat(el.getAttribute('data-reveal-stagger')) ||
          (mode === 'type' ? 0.045 : mode === 'spans' ? 0.4 : 0.1),
        once: el.getAttribute('data-reveal-once') !== 'false',
        markers: el.getAttribute('data-reveal-markers') === 'true',
        delay: parseFloat(el.getAttribute('data-reveal-delay')) || 0, // seconds after the trigger fires
      };

      // non-split mode (e.g. "spans"): animate the element's own children, no SplitText
      if (cfg.noSplit) {
        gsap.set(el, { visibility: 'visible' }); // clear the CSS pre-hide on the element
        const targets = cfg.pick(el);
        if (!targets.length) return;
        const tween = cfg.build(targets, opts);
        playWhenReady(el, opts, () => tween.play());
        return;
      }

      SplitText.create(el, {
        ...cfg.split,
        onSplit(self) {
          const targets = cfg.pick(self);

          // Tag each mask wrapper (the overflow:clip element SplitText adds around a line/word) with a
          // class so it can be styled in Webflow — e.g. add padding so descenders (g, y, p) aren't
          // clipped by the mask. Only lines/words modes are masked; "type" has no mask.
          if (cfg.split.mask) {
            targets.forEach((t) => t.parentElement && t.parentElement.classList.add('reveal-mask'));
          }

          // The element may be pre-hidden via CSS (`[data-reveal]{visibility:hidden}`) to avoid a
          // flash before JS runs — reveal it now that the split masks/tweens control the inner parts.
          gsap.set(el, { visibility: 'visible' });

          // autoSplit re-runs onSplit whenever line-breaks genuinely change.
          // If we've already revealed once, don't replay — just leave it visible.
          if (el._revealed) {
            gsap.set(targets, { clearProps: 'opacity,visibility,transform' });
            return;
          }

          const tween = cfg.build(targets, opts);
          playWhenReady(el, opts, () => {
            if (opts.once) el._revealed = true;
            tween.play();
          });
          return tween;
        },
      });
    });
  });
}

// Nav reveal — the nav bar starts off-screen above the top and slides down into place on load.
// Runs ONCE (nav persists across barba navs, so it must not re-slide on every page change).
//   [data-nav-reveal]                     — the nav element to slide in
//   data-reveal-delay="N"                 — seconds to wait before sliding (default 0)
//   data-reveal-duration="N"              — slide duration in seconds (default 0.8)
//   data-nav-distance="120%"              — how far above to start (default 100% of its own height)
//   data-nav-fade="true"                  — also fade in while sliding (default: pure slide, no fade)
// Pre-hide CSS for the page <head> (prevents a flash before JS runs):
//   [data-nav-reveal]{transform:translateY(-100%)}
export function initNavReveal(scope = document) {
  const nav = scope.querySelector('[data-nav-reveal]');
  if (!nav) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const delay = parseFloat(nav.getAttribute('data-reveal-delay')) || 0;
  const duration = parseFloat(nav.getAttribute('data-reveal-duration')) || 0.8;
  const distance = nav.getAttribute('data-nav-distance') || '-100%';
  const fade = nav.getAttribute('data-nav-fade') === 'true';

  // Reduced motion: clear any CSS pre-hide, no animation
  if (prefersReduced) {
    gsap.set(nav, { clearProps: 'transform,opacity,visibility', y: 0, autoAlpha: 1 });
    return;
  }

  // From-state applied immediately so it's hidden before the tween starts (backs up the CSS pre-hide)
  gsap.set(nav, { y: distance, autoAlpha: fade ? 0 : 1 });

  gsap.to(nav, {
    y: 0,
    autoAlpha: 1,
    duration,
    delay,
    ease: 'expo.out',
    onComplete: () => gsap.set(nav, { clearProps: 'transform,opacity,visibility' }),
  });
}

// Responsive nav menu — click [data-nav="hamburger"] to expand the .nav's height to fit the .nav-menu,
// then reveal the menu (and reverse to close). Runs ONCE (nav persists across barba navs).
// Contract: on the breakpoints where the hamburger shows, the menu should be HIDDEN (its own CSS,
// e.g. display:none) so .nav is just the bar — the JS grows .nav to its full height, fades the menu
// in, then clears its inline props so your CSS controls the resting state again.
//   [data-nav="hamburger"]   — the toggle
//   .nav                     — the element whose height animates (the panel)
//   .nav-menu                — the menu that's revealed
// Toggles `is-open` on the hamburger + .nav, and `nav-open` on <html> (style burger→X etc. in Webflow).
export function initNavMenu(scope = document) {
  const ham = scope.querySelector('[data-nav="hamburger"]');
  const nav = scope.querySelector('.nav');
  const menu = scope.querySelector('.nav-menu');
  if (!ham || !nav || !menu || ham.__navMenu) return;
  ham.__navMenu = true;

  // The element whose HEIGHT we animate — the background pill (`.nav-bg`) if present, else the .nav
  // itself. .nav-bg is typically position:absolute; inset:0 behind the bar, so growing its height
  // expands the backdrop downward to cover the revealed menu while the .nav bar stays put.
  const bg = scope.querySelector('.nav-bg') || nav;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the menu's display when shown (so we can restore it if CSS hides it with display:none)
  const shownDisplay = getComputedStyle(menu).display === 'none' ? 'flex' : getComputedStyle(menu).display;
  let open = false;
  let tl;

  // Measure the collapsed .nav height + the target open height — synchronous, no paint.
  // Robust to how the menu is laid out when shown:
  //  - menu is a flow child  → showing it grows the .nav, so navWithMenu > closedH → use that.
  //  - menu is absolute/fixed (overlay dropdown) → it's out of flow, .nav doesn't grow, so we
  //    fall back to closedH + the menu's OWN height. This is the case that made the old version
  //    "do nothing" (openH === closedH) when .nav-menu is display:none + positioned.
  const measure = () => {
    const dPrev = menu.style.display;
    const vPrev = menu.style.visibility;
    menu.style.display = 'none';
    const closedH = nav.offsetHeight;
    // reveal the menu off-screen-invisible so it's measurable without a flash
    menu.style.display = shownDisplay;
    menu.style.visibility = 'hidden';
    const navWithMenu = nav.offsetHeight;
    const menuH = menu.offsetHeight;
    menu.style.display = dPrev;
    menu.style.visibility = vPrev;
    const openH = navWithMenu > closedH ? navWithMenu : closedH + menuH;
    return { closedH, openH };
  };

  const setState = (next) => {
    if (next === open) return;
    open = next;
    if (tl) tl.kill();
    ham.setAttribute('aria-expanded', String(open));
    ham.classList.toggle('is-open', open);
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('nav-open', open);

    const d = reduced ? 0 : 1;
    const { closedH, openH } = measure();

    if (open) {
      // reveal the menu in-DOM but invisible, grow the .nav-bg to fit, then fade the menu in
      gsap.set(menu, { display: shownDisplay, autoAlpha: 0 });
      gsap.set(bg, { height: closedH, overflow: 'hidden' });
      tl = gsap
        .timeline()
        .to(bg, { height: openH, duration: 0.5 * d, ease: 'power3.inOut' })
        .to(menu, { autoAlpha: 1, duration: 0.4 * d, ease: 'power2.out' }, `-=${0.15 * d}`)
        // keep height:openH (do NOT clearProps) so the grown backdrop stays held open. Just release overflow.
        .set(bg, { overflow: '' });
    } else {
      gsap.set(bg, { height: openH, overflow: 'hidden' });
      tl = gsap
        .timeline()
        .to(menu, { autoAlpha: 0, duration: 0.3 * d, ease: 'power2.in' })
        .to(bg, { height: closedH, duration: 0.4 * d, ease: 'power3.inOut' }, `-=${0.1 * d}`)
        // clear our inline props → back to the CSS resting state (menu hidden, .nav-bg = bar)
        .set(bg, { clearProps: 'height,overflow' })
        .set(menu, { clearProps: 'display,opacity,visibility' });
    }
  };

  ham.addEventListener('click', () => setState(!open));
  // close on a menu link (barba nav) or Escape
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setState(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setState(false);
  });

  // reset to the clean CSS resting state (closed, all inline props cleared)
  const reset = () => {
    if (tl) tl.kill();
    open = false;
    ham.setAttribute('aria-expanded', 'false');
    ham.classList.remove('is-open');
    nav.classList.remove('is-open');
    document.documentElement.classList.remove('nav-open');
    gsap.set([bg], { clearProps: 'height,overflow' });
    gsap.set([menu], { clearProps: 'display,opacity,visibility' });
  };

  let lastW = window.innerWidth;
  addEventListener('resize', () => {
    const hamVisible = getComputedStyle(ham).display !== 'none';
    // Menu open → keep the .nav-bg backdrop fitted to the (reflowed) menu on ANY resize. This is NOT
    // gated on width: an open menu's height can change without the width changing, and we always want
    // the backdrop to track it. Re-measures and snaps (no animation).
    if (open && hamVisible) {
      lastW = window.innerWidth;
      if (tl) tl.kill();
      const { openH } = measure();
      gsap.set(menu, { display: shownDisplay, autoAlpha: 1 });
      gsap.set(bg, { height: openH, overflow: '' });
      return;
    }
    // Closed / desktop → only clean up on a real WIDTH change (mobile scroll fires height-only
    // resizes — ignore those, per the width-only rule).
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    reset();
  });
}

// Dot field — a shape made of dots blooms in, then hands off to a zero-gravity matter.js field
// (soft spring back to formation + mutual collisions + cursor repel). matter.js is bundled.
//   [data-dotfield]                       — the mount div (position:relative added if static)
//   data-dotfield-config='{"repel":{"radius":140}}'  — optional JSON override of any config
//   data-reveal-start="top 70%"           — ScrollTrigger start for the bloom (optional)
// Lightweight dot-artwork reveals — many can live on one page (steady state is a static inline SVG,
// so 10+ rest for free). Each [data-dotmap] wrapper reveals its inline SVG's dots on scroll-in.
export function initDotMap(scope = document) {
  scope.querySelectorAll('[data-dotmap]').forEach((el) => {
    if (!el.__dotmap) el.__dotmap = new DotMap(el);
  });
}

// Industry-hero reveal — a two-beat sequence on scroll-into-view (or on load if already in view):
//   1) the line GRID draws on, each segment strokeDashoffset-drawn with a directional stagger, then
//   2) the blocky MAP reveals per-cell with a hero-like motion (default converge / swarm→shape).
// Markup: a wrapper with the two inline SVGs inside.
//   [data-industry-reveal]                 — the wrapper (required)
//   grid svg  → [data-industry-grid]  or the .hero-industry-bg-grid class (auto-detected)
//   map  svg  → [data-industry-map]   or the .hero-industry-bg-shape class (auto-detected)
// GRID (draw speed / feel):
//   data-industry-grid-duration            — stagger span in seconds (default 2.4; higher = slower cascade)
//   data-industry-grid-draw                — per-segment draw seconds (default 1.1; higher = slower lines)
//   data-industry-grid-dir                 — order: tl-br (def)|br-tl|tr-bl|bl-tr|ltr|ttb
//   data-industry-grid-ease                — draw ease (default power1.inOut)
//   data-industry-gap                      — extra seconds between the two beats (default 0.2; negative
//                                            overlaps so the map starts before the grid finishes)
// MAP (reveal):
//   data-industry-map-mode                 — converge (def) | radial | rise | render | dotmap
//   data-industry-map-duration             — stagger span in seconds (default 1.6)
//   data-industry-map-cell                 — per-cell motion seconds (default 0.6)
//   data-industry-map-order                — center (def) | edges | random | tl-br | br-tl | ltr | ttb
//   data-industry-map-ease                 — per-cell ease (default power3.out; try back.out(1.4) for pop)
//   data-industry-map-distance             — fly-in / rise distance in svg units (default 40)
//   data-industry-map-scale                — start scale for converge/radial (default 0.35)
//   in "dotmap" map-mode the map svg reads the usual data-dotmap-* attrs.
const IR_NS = 'http://www.w3.org/2000/svg';

// Split each <path> into one <path> per subpath (each square/dot, or each grid line run, is an "M…"
// subpath), so the baked multi-shape paths become individually animatable. Presentation attrs (fill AND
// stroke) are copied to each piece, so this works for the filled map and the stroked grid alike.
const IR_COPY_ATTRS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
];
function splitSvgShapes(svg) {
  const out = [];
  Array.from(svg.querySelectorAll('path')).forEach((p) => {
    const d = p.getAttribute('d') || '';
    const subs = d.match(/[Mm][^Mm]*/g) || [];
    if (subs.length <= 1) {
      out.push(p);
      return;
    }
    const frag = document.createDocumentFragment();
    subs.forEach((sd) => {
      const np = document.createElementNS(IR_NS, 'path');
      np.setAttribute('d', sd.trim());
      IR_COPY_ATTRS.forEach((a) => {
        const v = p.getAttribute(a);
        if (v != null) np.setAttribute(a, v);
      });
      frag.appendChild(np);
      out.push(np);
    });
    p.replaceWith(frag);
  });
  return out;
}

// Staggered line-draw: split the grid into segments and draw each on (strokeDashoffset), ordered along
// a direction so lines cascade across the grid instead of all fading at once.
function buildStrokeDraw(segs, opts) {
  const tl = gsap.timeline({ paused: true });
  const metric = (x, y) => {
    switch (opts.dir) {
      case 'br-tl':
        return -(x + y);
      case 'tr-bl':
        return -x + y;
      case 'bl-tr':
        return x - y;
      case 'ltr':
        return x;
      case 'ttb':
        return y;
      default:
        return x + y; // tl-br
    }
  };
  const info = segs.map((s) => {
    let len = 0;
    let cx = 0;
    let cy = 0;
    try {
      len = s.getTotalLength();
    } catch (e) {
      /* non-rendered */
    }
    try {
      const b = s.getBBox();
      cx = b.x + b.width / 2;
      cy = b.y + b.height / 2;
    } catch (e) {
      /* detached */
    }
    return { s, len, m: metric(cx, cy) };
  });
  const ms = info.map((o) => o.m);
  const min = Math.min.apply(null, ms);
  const max = Math.max.apply(null, ms);
  const range = Math.max(1, max - min);
  info.forEach((o) => {
    if (!o.len) return; // no length → nothing to draw; leave it at its inherited CSS opacity
    const at = ((o.m - min) / range) * opts.duration; // staggered start along the sweep
    // hide via the dash only — never opacity, so the grid's CSS opacity (its faded look) is kept
    gsap.set(o.s, { strokeDasharray: o.len, strokeDashoffset: o.len });
    tl.to(o.s, { strokeDashoffset: 0, duration: opts.drawDur, ease: opts.ease || 'power1.inOut' }, at);
  });
  return tl;
}

function irViewBox(svg) {
  const b = svg.viewBox && svg.viewBox.baseVal;
  if (b && b.width) return b;
  return {
    x: 0,
    y: 0,
    width: parseFloat(svg.getAttribute('width')) || 100,
    height: parseFloat(svg.getAttribute('height')) || 100,
  };
}

// Map reveal — several "cool" per-cell modes tuned to feel like the homepage ShapeField (particles
// converging into form), not the flat DotMap secondary maps:
//   converge — each cell flies in from a scattered offset + scales up + fades (swarm → shape). Default.
//   radial   — each cell scales up from 0 + fades, ordered center-out (the shape blooms outward).
//   rise     — each cell rises from below + fades.
//   render   — plain per-cell fade (the old flat look), kept as an option.
// `order` sets the stagger order; `mode` sets the per-cell motion. cell = per-cell duration.
function buildMapReveal(svg, shapes, opts) {
  const tl = gsap.timeline({ paused: true });
  const vb = irViewBox(svg);
  const midX = vb.x + vb.width / 2;
  const midY = vb.y + vb.height / 2;

  const cells = shapes.map((s) => {
    let cx = midX;
    let cy = midY;
    try {
      const b = s.getBBox();
      cx = b.x + b.width / 2;
      cy = b.y + b.height / 2;
    } catch (e) {
      /* detached */
    }
    return { s, cx, cy, rand: Math.random() };
  });

  const orderVal = (c) => {
    switch (opts.order) {
      case 'center':
        return Math.hypot(c.cx - midX, c.cy - midY); // center → out
      case 'edges':
        return -Math.hypot(c.cx - midX, c.cy - midY); // edges → in
      case 'random':
        return c.rand;
      case 'ttb':
        return c.cy;
      case 'ltr':
        return c.cx;
      case 'br-tl':
        return -(c.cx + c.cy);
      default:
        return c.cx + c.cy; // tl-br
    }
  };
  const os = cells.map(orderVal);
  const min = Math.min.apply(null, os);
  const max = Math.max.apply(null, os);
  const range = Math.max(1, max - min);

  cells.forEach((c) => {
    const at = ((orderVal(c) - min) / range) * opts.duration;
    const from = { opacity: 0, transformOrigin: '50% 50%' };
    const to = { opacity: 1, duration: opts.cell, ease: opts.ease };

    if (opts.mode === 'converge') {
      const ang = c.rand * Math.PI * 2;
      const dist = opts.distance * (0.5 + c.rand);
      from.x = Math.cos(ang) * dist;
      from.y = Math.sin(ang) * dist;
      from.scale = opts.scale;
      to.x = 0;
      to.y = 0;
      to.scale = 1;
    } else if (opts.mode === 'radial') {
      from.scale = opts.scale;
      to.scale = 1;
    } else if (opts.mode === 'rise') {
      from.y = opts.distance;
      to.y = 0;
    } // 'render' → opacity only

    gsap.set(c.s, from);
    tl.to(c.s, to, at);
  });
  return tl;
}

export function initIndustryReveal(scope = document) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  scope.querySelectorAll('[data-industry-reveal]').forEach((wrap) => {
    if (wrap.__industryReveal) return; // guard barba re-init
    wrap.__industryReveal = true;

    const gridSvg = wrap.querySelector('[data-industry-grid], .hero-industry-bg-grid');
    const mapSvg = wrap.querySelector('[data-industry-map], .hero-industry-bg-shape');
    if (!gridSvg && !mapSvg) return;

    const gridStagger = parseFloat(wrap.getAttribute('data-industry-grid-duration')) || 2.4; // stagger span
    const gridDraw = parseFloat(wrap.getAttribute('data-industry-grid-draw')) || 1.1; // per-segment draw
    const gridDir = wrap.getAttribute('data-industry-grid-dir') || 'tl-br';
    const gapAttr = wrap.getAttribute('data-industry-gap');
    const gap = gapAttr !== null ? parseFloat(gapAttr) : 0.2;

    // hide both until their beat via VISIBILITY only (never opacity) so any CSS opacity on the svgs
    // (e.g. the grid's faded look) is preserved — the draw/render animate dash / cell opacity, not the svg.
    if (gridSvg) gsap.set(gridSvg, { visibility: 'hidden' });
    if (mapSvg) gsap.set(mapSvg, { visibility: 'hidden' });

    // Beat 1 — the grid DRAWS ON: split into segments, each strokeDashoffset-draws, staggered along dir.
    // Returns the timeline so the map can start when the grid actually finishes.
    const runGrid = () => {
      if (!gridSvg) return null;
      if (reduced) {
        gsap.set(gridSvg, { visibility: 'visible' });
        return null;
      }
      try {
        const segs = splitSvgShapes(gridSvg);
        const tl = buildStrokeDraw(segs, {
          duration: gridStagger,
          drawDur: gridDraw,
          dir: gridDir,
          ease: wrap.getAttribute('data-industry-grid-ease') || 'power1.inOut',
        });
        gsap.set(gridSvg, { visibility: 'visible' });
        tl.play(0);
        return tl;
      } catch (e) {
        gsap.set(gridSvg, { visibility: 'visible' });
        return null;
      }
    };

    // Beat 2 — the map REVEALS with a hero-like per-cell motion (default: converge / swarm→shape).
    const mapMode = wrap.getAttribute('data-industry-map-mode') || 'converge';
    const runMap = () => {
      if (!mapSvg) return;
      if (reduced) {
        gsap.set(mapSvg, { visibility: 'visible' });
        return;
      }
      if (mapMode === 'dotmap') {
        try {
          gsap.set(mapSvg, { visibility: 'visible' });
          wrap.__industryMap = new DotMap(mapSvg); // fall back to the secondary-map particle-assemble
        } catch (e) {
          gsap.set(mapSvg, { visibility: 'visible' });
        }
        return;
      }
      try {
        const shapes = splitSvgShapes(mapSvg);
        const tl = buildMapReveal(mapSvg, shapes, {
          mode: mapMode, // converge (def) | radial | rise | render
          duration: parseFloat(wrap.getAttribute('data-industry-map-duration')) || 1.6, // stagger span
          cell: parseFloat(wrap.getAttribute('data-industry-map-cell')) || 0.6, // per-cell duration
          order: wrap.getAttribute('data-industry-map-order') || 'center',
          ease: wrap.getAttribute('data-industry-map-ease') || 'power3.out',
          distance: parseFloat(wrap.getAttribute('data-industry-map-distance')) || 40, // fly-in / rise (svg units)
          scale: parseFloat(wrap.getAttribute('data-industry-map-scale')) || 0.35, // start scale (converge/radial)
        });
        gsap.set(mapSvg, { visibility: 'visible' }); // cells are individually hidden (opacity 0), no flash
        tl.play(0);
      } catch (e) {
        gsap.set(mapSvg, { visibility: 'visible' }); // never leave the map invisible on failure
      }
    };

    const play = () => {
      if (reduced) {
        runGrid();
        runMap();
        return;
      }
      const gridTL = runGrid();
      const gridTotal = gridTL ? gridTL.duration() : 0;
      gsap.delayedCall(Math.max(0, gridTotal + gap), runMap); // grid draws on, then the map renders
    };

    // Play on load if already in view (hero above the fold), else on scroll-into-view. A ScrollTrigger
    // whose start is already passed at creation won't fire onEnter, hence the in-view check.
    const r = wrap.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
      play();
    } else {
      ScrollTrigger.create({ trigger: wrap, start: 'top 80%', once: true, onEnter: play });
    }
  });
}

export function initDotField(scope = document) {
  const mount = scope.querySelector('[data-dotfield]');
  if (!mount || mount.__dotfield) return; // nothing to do / already mounted

  let cfg = {};
  const raw = mount.getAttribute('data-dotfield-config');
  if (raw) {
    try {
      cfg = JSON.parse(raw);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[modernvivo] invalid data-dotfield-config JSON', e);
    }
  }

  mount.__dotfield = new DotField(mount, cfg);
  return mount.__dotfield;
}

// Stacking cards — as each card scrolls up, the previous one drifts + its image rotates (parallax).
// Desktop-only: the effect is registered inside a gsap.matchMedia '(min-width:992px)', so below 992px
// no ScrollTriggers are created and the cards sit static. The module-level mm is reverted on re-init so
// its triggers don't accumulate across barba navs (same pattern as initGlobalParallax).
let stackingMM = null;
export function initStackingCardsParallax(scope = document) {
  if (stackingMM) stackingMM.revert(); // clean up the prior page's instance (barba re-init)
  const mm = gsap.matchMedia();
  stackingMM = mm;

  mm.add('(min-width:992px)', () => {
    const cards = scope.querySelectorAll('[data-stacking-cards-item]');

    if (cards.length < 2) return;

    const ctx = gsap.context(() => {
      cards.forEach((card, i) => {
        // Skip over the first section
        if (i === 0) return;

        // When current section is in view, target the PREVIOUS one
        const previousCard = cards[i - 1];
        if (!previousCard) return;

        // Find any element inside the previous card
        const previousCardImage = previousCard.querySelector('[data-stacking-cards-img]');

        let tl = gsap.timeline({
          defaults: {
            ease: 'none',
            duration: 1,
          },
          scrollTrigger: {
            trigger: card,
            start: 'top bottom',
            end: 'top top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(previousCard, { yPercent: 0 }, { yPercent: 50 }).fromTo(
          previousCardImage,
          { rotate: 0, yPercent: 0 },
          { rotate: -5, yPercent: -25 },
          '<'
        );
      });
    }, scope);

    return () => ctx.revert(); // clears the yPercent/rotate transforms when dropping below 992px
  });
}

// Content reveal on scroll — [data-reveal-group] with nested layers, stagger, per-element distance
export function initContentRevealScroll(scope = document) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = gsap.context(() => {
    scope.querySelectorAll('[data-reveal-group]').forEach((groupEl) => {
      // Config from attributes or defaults (group-level)
      const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 100) / 1000; // ms → sec
      const groupDistance = groupEl.getAttribute('data-distance') || '2em';
      const triggerStart = groupEl.getAttribute('data-start') || 'top 80%';
      const groupDelay = parseFloat(groupEl.getAttribute('data-reveal-delay')) || 0; // sec after trigger

      const animDuration = 0.8;
      const animEase = 'power4.inOut';

      // data-fade-only="true" → reveal with OPACITY ONLY and never touch transform, so effects that
      // own the element's transform (parallax, a Webflow rotate, the dotfield canvas…) aren't
      // disturbed. Readable on the top-level group OR a nested group independently.
      const groupFadeOnly = groupEl.getAttribute('data-fade-only') === 'true';
      const resolveFade = (nestedEl) => groupFadeOnly || (!!nestedEl && nestedEl.getAttribute('data-fade-only') === 'true');
      const hideAt = (el, dist, fo) => gsap.set(el, fo ? { autoAlpha: 0 } : { y: dist, autoAlpha: 0 });
      const showVars = (fo, extra) => (fo ? { autoAlpha: 1, ...extra } : { y: 0, autoAlpha: 1, ...extra });
      const clearAfter = (el, fo) => gsap.set(el, { clearProps: fo ? 'opacity,visibility' : 'all' });

      // Reduced motion: show immediately
      if (prefersReduced) {
        gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
        return;
      }

      // If no direct children, animate the group element itself
      const directChildren = Array.from(groupEl.children).filter((el) => el.nodeType === 1);
      if (!directChildren.length) {
        hideAt(groupEl, groupDistance, groupFadeOnly);
        ScrollTrigger.create({
          trigger: groupEl,
          start: triggerStart,
          once: true,
          onEnter: () =>
            gsap.to(
              groupEl,
              showVars(groupFadeOnly, {
                duration: animDuration,
                ease: animEase,
                onComplete: () => clearAfter(groupEl, groupFadeOnly),
              })
            ),
        });
        return;
      }

      // Collect reveal entries by walking the group tree RECURSIVELY, so the stagger cascades
      // through any depth of nested groups. Each [data-reveal-group-nested] descends a level: its
      // children stagger by its own data-stagger (fallback: the parent's) starting at that nested
      // group's own slot time.
      //   data-ignore="true"                    → skip the element AND its whole subtree
      //   data-ignore="false" on a nested group → ALSO reveal the wrapper itself (default: children only)
      //   data-fade-only="true" on any group    → opacity-only from that level down
      const staggerOf = (el, fallback) => {
        const ms = parseFloat(el.getAttribute('data-stagger'));
        return isNaN(ms) ? fallback : ms / 1000;
      };
      const distOf = (el) => el.getAttribute('data-distance') || groupDistance;

      const entries = []; // flat, time-ordered list: { el, time, fadeOnly, distance }
      const walk = (group, baseTime, stagger, fadeInherited) => {
        let slot = 0;
        Array.from(group.children).forEach((child) => {
          if (child.nodeType !== 1 || child.getAttribute('data-ignore') === 'true') return; // skip + subtree
          const time = baseTime + slot * stagger;
          slot += 1;

          // is this child a nested group, or a wrapper around one?
          const nested = child.matches('[data-reveal-group-nested]')
            ? child
            : child.querySelector(':scope [data-reveal-group-nested]');

          if (nested) {
            const fade = fadeInherited || nested.getAttribute('data-fade-only') === 'true';
            // reveal the wrapper element itself only when explicitly opted in
            if (child.getAttribute('data-ignore') === 'false' || nested.getAttribute('data-ignore') === 'false') {
              entries.push({ el: child, time, fadeOnly: fade, distance: groupDistance });
            }
            walk(nested, time, staggerOf(nested, stagger), fade); // descend a level
          } else {
            entries.push({ el: child, time, fadeOnly: fadeInherited, distance: distOf(child) });
          }
        });
      };
      walk(groupEl, 0, groupStaggerSec, groupFadeOnly);

      // Initial hidden state
      entries.forEach((e) => hideAt(e.el, e.distance, e.fadeOnly));

      // Reveal sequence — each entry plays at its collected time
      const play = () => {
        const tl = gsap.timeline({ delay: groupDelay });
        entries.forEach((e) => {
          tl.to(
            e.el,
            showVars(e.fadeOnly, {
              duration: animDuration,
              ease: animEase,
              onComplete: () => clearAfter(e.el, e.fadeOnly),
            }),
            e.time
          );
        });
      };

      const after = groupEl.getAttribute('data-reveal-after');
      if (after) {
        let done = false;
        const run = () => {
          if (done) return;
          done = true;
          play();
        };
        if (window.__shapefieldResolved && window.__shapefieldResolved.has(after)) {
          run(); // event already fired before this listener attached
        } else {
          document.addEventListener(after, run, { once: true });
          gsap.delayedCall(12, run); // safety net if the event never fires
        }
      } else {
        ScrollTrigger.create({ trigger: groupEl, start: triggerStart, once: true, onEnter: play });
      }
    });
  });

  return () => ctx.revert();
}

// Sticky Steps — 3D flip + internal reveal (Osmo "Sticky Steps", upgraded).
// Instead of crossfading images, the pinned card does a single 180° flip to the next step and
// its contents reveal top→bottom mid-flip. No markup changes: the inline SVGs are folded into
// ONE flip card in the first item's media (which spans the collection, so it stays pinned) and
// the other items' media are removed.
//   [data-sticky-steps-init]     — the collection wrapper (one per section)
//   [data-sticky-steps-item]     — each step (text column + inline SVG card in .sticky-steps__visual)
//   [data-sticky-steps-anchor]   — the scroll trigger for that step (the text column)
// Behaviour: each step = a single half-flip — skip several steps fast and it's ONE flip to the
// final card. Reveal order is top→bottom via getBBox().y, independent of the SVG's element order.
// Prior pages' matchMedia instances are reverted on re-init (barba) so their ScrollTriggers / pins /
// DOM restores don't accumulate across navigations.
let stickyStepsMMs = [];
export function initStickyStepsFlip(scope = document) {
  stickyStepsMMs.forEach((mm) => mm.revert());
  stickyStepsMMs = [];
  scope.querySelectorAll('[data-sticky-steps-init]').forEach(setupStickySteps);
}

// Dispatcher: desktop (≥992px) = the pinned flip that consolidates every card into one flip card;
// mobile (<992px) = leave each item's own .sticky-steps__visual in place and reveal it on scroll.
// gsap.matchMedia swaps between them on resize. The desktop path MUTATES the DOM (strips media, injects
// the flip), so we snapshot the pristine markup once and restore it on teardown — that way crossing the
// breakpoint (either direction) rebuilds from clean source instead of from the other mode's leftovers.
function setupStickySteps(container) {
  const items = container.querySelectorAll('[data-sticky-steps-item]');
  if (items.length < 2) return;
  if (!container.__ssOriginalHTML) container.__ssOriginalHTML = container.innerHTML;

  const mm = gsap.matchMedia();
  stickyStepsMMs.push(mm);

  mm.add('(min-width:992px)', () => {
    setupStickyStepsDesktop(container);
    return () => {
      container.innerHTML = container.__ssOriginalHTML; // restore pristine DOM for the other breakpoint
    };
  });

  mm.add('(max-width:991px)', () => {
    const cleanup = setupStickyStepsMobile(container);
    return () => {
      if (cleanup) cleanup(); // destroy the per-item DotMaps before the DOM is blown away
      container.innerHTML = container.__ssOriginalHTML;
    };
  });
}

// Mobile (<992px): no flip, no pin. Each [data-sticky-steps-item] keeps its own .sticky-steps__visual
// (its correct step visual). Two reveals per item on scroll-into-view, matching desktop: the dot-grid
// background assembles (DotMap) and the card svg plays the staggered leaf reveal. The shared multi-grid
// .sticky-steps_bg-wrap stacks every step's grid in one item (a desktop construct), so we read its
// shapes, hide the original, and drop ONE grid behind each item instead.
// Contract: the item visuals must be visible (not display:none) on mobile in the Webflow styles.
// Returns a cleanup that destroys the per-item DotMaps (called before the DOM is restored on teardown).
function setupStickyStepsMobile(container) {
  const bgWrap = container.querySelector('.sticky-steps_bg-wrap');
  const bgShapes = bgWrap ? Array.from(bgWrap.querySelectorAll('svg')).map((s) => s.outerHTML) : [];
  if (bgWrap) bgWrap.style.display = 'none';

  const dms = [];
  Array.from(container.querySelectorAll('[data-sticky-steps-item]')).forEach((item, i) => {
    const visual = item.querySelector('.sticky-steps__visual');
    if (!visual) return;

    // per-item dot-grid behind the card — same DotMap assemble as desktop, one shape per step
    const shape = bgShapes.length ? bgShapes[Math.min(i, bgShapes.length - 1)] : null;
    if (shape) {
      if (getComputedStyle(visual).position === 'static') visual.style.position = 'relative';
      const bg = document.createElement('div');
      bg.className = 'sticky-steps_bg-wrap sticky-steps_bg-wrap--mobile';
      bg.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;';
      bg.innerHTML = shape;
      visual.insertBefore(bg, visual.firstChild);
      try {
        dms.push(new DotMap(bg)); // below the fold → pending, assembles when scrolled into view
      } catch (e) {
        const s = bg.querySelector('svg');
        if (s) gsap.set(s, { autoAlpha: 1 }); // never leave the grid invisible on failure
      }
    }

    // the card svg reveals on top of its grid (keep it above the z:0 bg layer)
    const cardSvg = Array.from(visual.querySelectorAll('svg')).find(
      (s) => !s.closest('.sticky-steps_bg-wrap')
    );
    if (!cardSvg) return;
    cardSvg.style.position = 'relative';
    cardSvg.style.zIndex = '1';

    const tl = buildStickyReveal(cardSvg); // paused → the card sits hidden until scrolled into view
    ScrollTrigger.create({
      trigger: visual,
      start: 'top 80%',
      once: true,
      onEnter: () => tl.play(),
    });
  });

  return () => dms.forEach((dm) => dm && dm.destroy && dm.destroy());
}

// flip-only CSS, added once (everything else stays your Webflow styles)
function injectStickyStepsCSS() {
  if (document.getElementById('sticky-steps-flip-css')) return;
  const s = document.createElement('style');
  s.id = 'sticky-steps-flip-css';
  s.textContent =
    // Desktop-only (the flip is desktop-only): perspective + center the flip in the visual; card = 80%
    // of the visual's height, width auto via the card's aspect ratio. Scoped so it never touches the
    // mobile per-item visuals after a resize across the breakpoint.
    '@media (min-width:992px){' +
    '.sticky-steps__visual{position:relative;perspective:1800px;-webkit-perspective:1800px;display:flex;align-items:center;justify-content:center}' +
    // NOTE: no `will-change:transform` here — some WebKit versions flatten a preserve-3d subtree
    // when the element is also marked will-change, which breaks the flip. GSAP promotes the layer
    // anyway once it starts writing transforms.
    '.ss-flip{position:relative;height:80%;width:auto;aspect-ratio:362 / 502;transform-style:preserve-3d;-webkit-transform-style:preserve-3d}' +
    // The explicit rotateY(0) on the base face is deliberate: WebKit only keeps an element in its
    // parent's 3D rendering context (and thus honors backface-visibility) reliably when the element
    // carries its own 3D transform. Without it the front face flattens and its backface stays
    // visible — you see card 1 through card 0, and a mirrored front instead of the back on flip.
    '.ss-flip__face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform-style:preserve-3d;-webkit-transform-style:preserve-3d;transform:rotateY(0deg);-webkit-transform:rotateY(0deg)}' +
    '.ss-flip__face--back{transform:rotateY(180deg);-webkit-transform:rotateY(180deg)}' +
    '.ss-flip__face svg{display:block;width:100%;height:100%}' +
    '}';
  document.head.appendChild(s);
}

// Reveal one card face: leaf paint elements, staggered top→bottom.
function buildStickyReveal(face) {
  // `face` is a face div (desktop flip) or an <svg> directly (mobile). Pick the card svg, skipping any
  // bg-wrap grid svgs that may share the visual.
  const svg =
    face.tagName && face.tagName.toLowerCase() === 'svg'
      ? face
      : Array.from(face.querySelectorAll('svg')).find((s) => !s.closest('.sticky-steps_bg-wrap')) ||
        face.querySelector('svg');
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  if (!svg) return tl;

  const els = Array.from(
    svg.querySelectorAll('path,rect,line,polyline,circle,polygon,ellipse')
  ).filter((el) => {
    if (el.tagName.toLowerCase() === 'rect') {
      // skip the full-size white card background
      const w = +el.getAttribute('width') || 0;
      const h = +el.getAttribute('height') || 0;
      const f = (el.getAttribute('fill') || '').toLowerCase();
      if (w >= 360 && h >= 500 && (f === 'white' || f === '#fff' || f === '#ffffff')) return false;
    }
    return true;
  });

  // stagger by vertical position → always top→bottom, regardless of SVG element order
  els.sort((a, b) => {
    let ya = 0;
    let yb = 0;
    try {
      ya = a.getBBox().y;
    } catch (e) {
      /* detached / non-rendered */
    }
    try {
      yb = b.getBBox().y;
    } catch (e) {
      /* detached / non-rendered */
    }
    return ya - yb;
  });

  els.forEach((el, i) => {
    const at = i * 0.02;
    const tag = el.tagName.toLowerCase();
    const stroke = (el.getAttribute('stroke') || '').toLowerCase();
    const stroked =
      tag === 'line' || tag === 'polyline' || (tag === 'path' && stroke && stroke !== 'none');
    const hasTransform = el.hasAttribute('transform'); // don't let GSAP y clobber an existing translate

    let len = 0;
    if (stroked && stroke !== '#e3e0df') {
      // WebKit throws on getTotalLength() for a degenerate/empty path (and for anything not
      // currently rendered). Unguarded, that exception escapes buildStickyReveal and takes the whole
      // sticky-steps setup with it — including the ScrollTriggers built after it.
      try {
        len = el.getTotalLength();
      } catch (e) {
        len = 0;
      }
    }

    if (len) {
      // draw lines / underlines on
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      tl.to(el, { strokeDashoffset: 0, duration: 0.6 }, at);
    } else if (tag === 'circle') {
      // pop chart nodes
      tl.fromTo(
        el,
        { opacity: 0, scale: 0, transformOrigin: '50% 50%' },
        { opacity: 1, scale: 1, ease: 'back.out(2)', duration: 0.5 },
        at
      );
    } else if (hasTransform) {
      // opacity only — preserves the element's own translate (e.g. the status pill)
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5 }, at);
    } else {
      // everything else: fade + rise
      tl.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, at);
    }
  });
  return tl;
}

function setupStickyStepsDesktop(container) {
  const items = Array.from(container.querySelectorAll('[data-sticky-steps-item]'));
  if (items.length < 2) return;

  // grab each card's SVG markup in DOM order
  const cards = items.map((it) => {
    const svg = it.querySelector('.sticky-steps__visual svg');
    return svg ? svg.outerHTML : '';
  });
  if (cards.some((c) => !c)) return; // an item is missing its inline SVG → skip silently

  injectStickyStepsCSS();

  // one flip card in the first item's media (spans the collection → stays pinned); strip the rest
  const firstVisual = items[0].querySelector('.sticky-steps__visual');

  // Preserve the dot-grid background: ONE `.sticky-steps_bg-wrap` holds one bg-shape SVG per step. It may
  // sit in ANY item's visual (in this build it's the LAST item's), so find it across the whole collection —
  // NOT just item 0 — collect its shapes, and relocate it into the pinned first visual so it survives the
  // media strip below. Then drive one shape per step with the DotMap particle-assemble (see revealBg).
  const bgWrap = container.querySelector('.sticky-steps_bg-wrap');
  const bgShapes = bgWrap ? Array.from(bgWrap.querySelectorAll('svg')).map((s) => s.outerHTML) : [];
  const hasBg = !!bgWrap && bgShapes.length >= 1;

  // rebuild the visual WITHOUT clobbering the bg-wrap: drop only the cover card, empty + move the bg-wrap
  // into the first (pinned) visual behind the flip, and append the flip card on top.
  const cover = firstVisual.querySelector('.sticky-steps__cover-image');
  if (cover) cover.remove();
  if (hasBg) {
    bgWrap.innerHTML = '';
    if (bgWrap.parentElement !== firstVisual) firstVisual.appendChild(bgWrap); // relocate before media strip
  }
  firstVisual.insertAdjacentHTML(
    'beforeend',
    '<div class="ss-flip" data-flip>' +
      '<div class="ss-flip__face ss-flip__face--front" data-flip-front></div>' +
      '<div class="ss-flip__face ss-flip__face--back" data-flip-back></div>' +
      '</div>'
  );
  items.slice(1).forEach((it) => {
    const media = it.querySelector('.sticky-steps__media');
    if (media) media.remove();
  });

  const flip = firstVisual.querySelector('[data-flip]');
  const front = firstVisual.querySelector('[data-flip-front]');
  const back = firstVisual.querySelector('[data-flip-back]');
  const clamp = (i) => Math.max(0, Math.min(cards.length - 1, i));

  let rot = 0;
  let busy = false;
  let revealed = false;
  let frontUp = true;
  let currentIndex = 0;
  let pendingIndex = 0;
  let incomingFace = null;
  let incomingTL = null;

  // Explicit face visibility — the flip's correctness does not depend on backface-visibility working.
  const setFaceVisible = (face, on) => {
    face.style.visibility = on ? 'visible' : 'hidden';
  };

  const setStatus = (i) =>
    items.forEach((it, n) =>
      it.setAttribute(
        'data-sticky-steps-item-status',
        n < i ? 'before' : n > i ? 'after' : 'active'
      )
    );

  // swap the background dot-grid to this step's shape and run the DotMap particle-assemble on it (same
  // reveal as the standalone [data-dotmap] cards). DEBOUNCED: slicing a dense grid is heavy, so scrubbing
  // fast through steps must NOT re-slice every one it passes — only the step you settle on assembles
  // (~130ms). The previous grid stays put until then, so there's no flash/gap between steps.
  let bgIndex = -1;
  let bgDM = null;
  let bgTimer = null;
  function revealBg(index) {
    if (!hasBg) return;
    index = clamp(index);
    if (index === bgIndex) return;
    bgIndex = index;
    const shape = bgShapes[Math.min(index, bgShapes.length - 1)];
    if (bgTimer) clearTimeout(bgTimer);
    bgTimer = setTimeout(() => {
      if (bgDM) {
        bgDM.destroy();
        bgDM = null;
      }
      bgWrap.innerHTML = shape;
      // in view (a step is active) → DotMap assembles immediately; below the fold (first-load step 0)
      // → it registers pending and assembles when the section is scrolled into view.
      try {
        bgDM = new DotMap(bgWrap);
      } catch (e) {
        const s = bgWrap.querySelector('svg');
        if (s) gsap.set(s, { autoAlpha: 1 }); // never leave the background invisible on failure
      }
    }, 130);
  }

  function startFlip(index) {
    busy = true;
    revealed = false;
    currentIndex = index;
    pendingIndex = index;
    rot += 180; // ONE half-flip, always
    incomingFace = frontUp ? back : front; // the face rotating into view
    const inFace = incomingFace; // captured: setActiveStep can re-target the CONTENT mid-flip, not the face
    const outFace = frontUp ? front : back; // the face rotating away — must be computed before the toggle
    frontUp = !frontUp;
    incomingFace.innerHTML = cards[index];
    incomingTL = buildStickyReveal(incomingFace);
    gsap.to(flip, {
      rotationY: rot,
      duration: 0.9,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate() {
        if (!revealed && this.progress() >= 0.5) {
          revealed = true;
          // Swap face visibility ourselves at the halfway point rather than trusting
          // backface-visibility — WebKit does not reliably honor it here (SVG-filled faces, and any
          // ancestor that flattens the 3D context is enough to lose it), which showed up as a
          // mirrored front face on step 2 with the back card never appearing.
          // `visibility` specifically, NOT opacity: an opacity < 1 flattens the 3D rendering
          // context and would break the flip itself.
          setFaceVisible(inFace, true);
          setFaceVisible(outFace, false);
          incomingTL.play();
        }
      },
      onComplete() {
        busy = false;
        if (pendingIndex !== currentIndex) startFlip(pendingIndex);
      },
    });
  }

  function setActiveStep(index) {
    index = clamp(index);
    setStatus(index);
    revealBg(index); // swap + assemble the background dot-grid for this step
    pendingIndex = index;
    if (busy) {
      // mid-flip: retarget the incoming face, don't queue another rotation
      if (index !== currentIndex) {
        currentIndex = index;
        incomingFace.innerHTML = cards[index];
        incomingTL = buildStickyReveal(incomingFace);
        if (revealed) incomingTL.play(); // already past the midpoint → reveal the new card now
      }
      return;
    }
    if (index === currentIndex) return;
    startFlip(index);
  }

  // init: front = card 0, back = card 1 (ready)
  const [firstCard, secondCard] = cards;
  front.innerHTML = firstCard;
  back.innerHTML = secondCard;
  // Card 0 faces us, card 1 waits behind. Set this explicitly instead of leaning on
  // backface-visibility (see startFlip) — otherwise on WebKit card 1's content bleeds through card 0
  // from the very first paint, which reads as "the first card isn't hidden".
  setFaceVisible(front, true);
  setFaceVisible(back, false);
  // Build (and discard) a paused reveal for the back face purely for its side effect: the fromTo
  // tweens render their hidden "from" state immediately, so card 1's content is armed-and-hidden
  // rather than sitting fully drawn behind card 0. startFlip rebuilds it when card 1 actually flips in.
  buildStickyReveal(back);
  setStatus(0);
  // Seed the step-0 background so it ALSO assembles on scroll-in — not just on the first step change.
  // Item 0's ScrollTrigger onEnter doesn't fire if its start is already passed when the trigger is
  // created (post-refresh), so revealBg(0) would otherwise never run until you scroll to step 1 and
  // back. DotMap handles the timing itself: below the fold it registers pending and assembles when the
  // section scrolls into view; already in view → assembles now. Dedups with item 0's onEnter via bgIndex.
  revealBg(0);

  // Card 0 is deliberately NOT revealed on scroll-into-view — it just sits fully visible from the
  // start (front.innerHTML above is its resting state; nothing hides it). Its staggered reveal only
  // plays when card 0 flips back IN from step 2, which startFlip handles like any other step.
  // (The previous scroll-into-view reveal fired on approach and read as the card animating twice.)

  items.forEach((item, index) => {
    const anchor = item.querySelector('[data-sticky-steps-anchor]');
    if (!anchor) return;
    ScrollTrigger.create({
      trigger: anchor,
      start: 'center 60%',
      onEnter: () => setActiveStep(index),
      onEnterBack: () => setActiveStep(index),
    });
  });
  setActiveStep(0);
}

// Global parallax (Osmo Supply) — one flexible ScrollTrigger tween driven entirely by data-attrs.
// Attributes (all optional except the trigger; only add the ones you want to override):
//   [data-parallax="trigger"]           — the element to animate (required)
//   [data-parallax="target"]            — animate this child of the trigger instead (for image-in-mask)
//   data-parallax-direction             — "horizontal" | "vertical" (default vertical → yPercent)
//   data-parallax-scrub                 — "true" (default) or a number = seconds to catch up
//   data-parallax-start / -end          — start/end position in % (defaults 20 / -20)
//   data-parallax-rotate                — degrees of slow tilt across the scroll (e.g. "8"); 0 = off
//   data-parallax-scroll-start / -end   — ScrollTrigger start/end (defaults "top bottom" / "bottom top")
//   data-parallax-disable               — "mobile" | "mobileLandscape" | "tablet" (skip below that bp)
// Osmo's tween logic is kept verbatim; only adapted for the boilerplate: query is scoped to the
// incoming barba container, and the previous matchMedia is reverted on re-init so ScrollTriggers /
// resize listeners don't accumulate across page navigations.
let parallaxMM = null;
export function initGlobalParallax(scope = document) {
  if (parallaxMM) parallaxMM.revert(); // clean up the prior page's instance (barba re-init)
  const mm = gsap.matchMedia();
  parallaxMM = mm;

  mm.add(
    {
      isMobile: '(max-width:479px)',
      isMobileLandscape: '(max-width:767px)',
      isTablet: '(max-width:991px)',
      isDesktop: '(min-width:992px)',
    },
    (context) => {
      const { isMobile, isMobileLandscape, isTablet } = context.conditions;

      const ctx = gsap.context(() => {
        scope.querySelectorAll('[data-parallax="trigger"]').forEach((trigger) => {
          // Check if this trigger has to be disabled on smaller breakpoints
          const disable = trigger.getAttribute('data-parallax-disable');
          if (
            (disable === 'mobile' && isMobile) ||
            (disable === 'mobileLandscape' && isMobileLandscape) ||
            (disable === 'tablet' && isTablet)
          ) {
            return;
          }

          // Optional: you can target an element inside a trigger if necessary
          const target = trigger.querySelector('[data-parallax="target"]') || trigger;

          // Get the direction value to decide between xPercent or yPercent tween
          const direction = trigger.getAttribute('data-parallax-direction') || 'vertical';
          const prop = direction === 'horizontal' ? 'xPercent' : 'yPercent';

          // Get the scrub value, our default is 'true' because that feels nice with Lenis.
          // Accept: absent / "true" → true, "false" → false, a number → catch-up seconds.
          // (parseFloat("true") is NaN, which GSAP reads as no-scrub — so a literal "true" must be handled.)
          const scrubAttr = trigger.getAttribute('data-parallax-scrub');
          let scrub;
          if (scrubAttr === null || scrubAttr === 'true') scrub = true;
          else if (scrubAttr === 'false') scrub = false;
          else {
            const n = parseFloat(scrubAttr);
            scrub = isNaN(n) ? true : n;
          }

          // Get the start position in %
          const startAttr = trigger.getAttribute('data-parallax-start');
          const startVal = startAttr !== null ? parseFloat(startAttr) : 20;

          // Get the end position in %
          const endAttr = trigger.getAttribute('data-parallax-end');
          const endVal = endAttr !== null ? parseFloat(endAttr) : -20;

          // Get the start value of the ScrollTrigger
          const scrollStartRaw = trigger.getAttribute('data-parallax-scroll-start') || 'top bottom';
          const scrollStart = `clamp(${scrollStartRaw})`;

          // Get the end value of the ScrollTrigger
          const scrollEndRaw = trigger.getAttribute('data-parallax-scroll-end') || 'bottom top';
          const scrollEnd = `clamp(${scrollEndRaw})`;

          // Optional slow rotation across the same scroll span. data-parallax-rotate="8" (degrees)
          // tilts from +rot/2 through 0 to -rot/2, so the resting mid-scroll state is un-rotated.
          const rotateAttr = trigger.getAttribute('data-parallax-rotate');
          const rot = rotateAttr !== null ? parseFloat(rotateAttr) : 0;

          const fromVars = { [prop]: startVal };
          const toVars = {
            [prop]: endVal,
            ease: 'none',
            scrollTrigger: {
              trigger,
              start: scrollStart,
              end: scrollEnd,
              scrub,
            },
          };
          if (rot) {
            fromVars.rotation = rot / 2;
            toVars.rotation = -rot / 2;
          }

          gsap.fromTo(target, fromVars, toVars);
        });
      }, scope);

      return () => ctx.revert();
    }
  );
}

// Border draw on hover — injects an overlay of 4 full-edge lines. On hover all four draw at once,
// each travelling clockwise from its corner (top L→R, right T→B, bottom R→L, left B→T) so the border
// sweeps in like a pinwheel; on leave it retracts. Lines are injected by JS, so in Webflow you only
// add the attributes below to the card.
//   [data-card-border]                — the card (required)
//   data-card-border-color="#8D04FD"  — line color (default: currentColor)
//   data-card-border-width="1"        — line thickness in px (default 1)
//   data-card-border-duration="0.4"   — draw duration in seconds (default 0.4)
//   data-card-border-radius="0.75em"  — round the overlay's corners (default: inherit the card's)
export function initCardBorderHover(scope = document) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  scope.querySelectorAll('[data-card-border]').forEach((card) => {
    if (card.__cardBorder) return; // already wired (guards barba re-init)
    card.__cardBorder = true;

    const color = card.getAttribute('data-card-border-color') || 'currentColor';
    const w = parseFloat(card.getAttribute('data-card-border-width')) || 1;
    const duration = parseFloat(card.getAttribute('data-card-border-duration')) || 0.4;
    const radius = card.getAttribute('data-card-border-radius') || getComputedStyle(card).borderRadius;

    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'card-border';
    overlay.style.cssText = `position:absolute;inset:-1px;pointer-events:none;z-index:2;border-radius:${radius};overflow:hidden;`;

    // 4 full-edge lines, each anchored at a corner and growing in the clockwise direction:
    // top L→R, right T→B, bottom R→L, left B→T. All four animate at once (see timeline below).
    const edges = [
      { axis: 'x', side: 'top:0;left:0', size: `height:${w}px;width:100%`, origin: 'left center' },
      { axis: 'y', side: 'top:0;right:0', size: `width:${w}px;height:100%`, origin: 'center top' },
      { axis: 'x', side: 'bottom:0;right:0', size: `height:${w}px;width:100%`, origin: 'right center' },
      { axis: 'y', side: 'bottom:0;left:0', size: `width:${w}px;height:100%`, origin: 'center bottom' },
    ];

    const lines = edges.map((e) => {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;${e.side};${e.size};background:${color};transform-origin:${e.origin};`;
      overlay.appendChild(line);
      gsap.set(line, e.axis === 'x' ? { scaleX: 0 } : { scaleY: 0 });
      return { el: line, prop: e.axis === 'x' ? 'scaleX' : 'scaleY' };
    });

    card.appendChild(overlay);

    // all 4 edges draw at once, each travelling clockwise from its corner (pinwheel fill);
    // reverse() retracts it on leave (handles mid-draw interruption)
    const tl = gsap.timeline({ paused: true });
    lines.forEach(({ el, prop }) => tl.to(el, { [prop]: 1, duration, ease: 'power2.out' }, 0));

    card.addEventListener('mouseenter', () => (prefersReduced ? tl.progress(1) : tl.play()));
    card.addEventListener('mouseleave', () => (prefersReduced ? tl.progress(0) : tl.reverse()));
  });
}

// Copy email on desktop, native mailto on touch — put [data-copy-email] on a `mailto:` link.
// Desktop (fine pointer + hover): click copies the address and flashes a "Copied!" message instead
// of opening a mail client. Touch devices are left untouched, so the default mailto fires. Copy uses
// the async Clipboard API when available (secure contexts) and falls back to execCommand otherwise,
// so it still works on non-HTTPS/preview URLs. If copying fails entirely, it falls back to the mailto.
//   [data-copy-email]                 — the trigger (a `mailto:` <a>). Value optional = the address
//                                       to copy (otherwise parsed from href, or the element's text).
//   [data-copy-email-label]           — element to fade during the swap (default: the link's first
//                                       child, e.g. a <p>). Only its opacity is touched.
//   data-copy-email-text="Copied!"    — the confirmation message (default "Copied!").
// Feedback overlays a "Copied!" element on top and only fades the label's opacity — the markup is
// never rewritten, so a split-text reveal (data-reveal) inside the link stays intact. The overlay
// copies the label's tag + classes (so it inherits its styling, e.g. `h4`) plus a `copy-email-tip`
// class, and types the message in character by character. Toggles an `is-copied` class during it.
function copyToClipboard(text) {
  // Legacy synchronous copy — works in non-secure contexts AND in iframes (e.g. Webflow Preview),
  // where the async Clipboard API is blocked.
  const legacy = () =>
    new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        ok ? resolve() : reject(new Error('execCommand copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  // Prefer the async API when present, but if it REJECTS (iframe / permissions), fall back to legacy
  // before giving up — only if both fail does the caller fall back to the mailto.
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(legacy);
  return legacy();
}

export function initCopyEmail(scope = document) {
  // Desktop = copy; touch = leave the native mailto alone. (No secure-context gate here — copy has
  // an execCommand fallback, so we bind on desktop regardless and only fall back to mailto if copy fails.)
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  scope.querySelectorAll('[data-copy-email]').forEach((trigger) => {
    if (trigger.__copyEmail) return; // already wired (guards barba re-init)
    trigger.__copyEmail = true;

    const href = trigger.getAttribute('href') || '';
    const email =
      trigger.getAttribute('data-copy-email') ||
      (href.startsWith('mailto:') ? decodeURIComponent(href.slice(7).split('?')[0]) : trigger.textContent.trim());

    const copiedText = trigger.getAttribute('data-copy-email-text') || 'Copied!';
    let busy = false;

    const confirm = () => {
      if (busy) return; // ignore repeat clicks while the message is showing
      busy = true;
      trigger.classList.add('is-copied');
      if (getComputedStyle(trigger).position === 'static') trigger.style.position = 'relative';

      // Element to fade for the swap — the label if marked, else the first child (e.g. a <p>), else
      // the whole link's content wrapped once. We only ever animate its opacity, never its markup,
      // so a split-text reveal (data-reveal) inside it is left completely intact.
      let fadeEl = trigger.querySelector('[data-copy-email-label]') || trigger.children[0];
      if (!fadeEl) {
        fadeEl = document.createElement('span');
        while (trigger.firstChild) fadeEl.appendChild(trigger.firstChild);
        trigger.appendChild(fadeEl);
      }

      // "Copied!" overlaid on top — same tag + classes as the label so it inherits its styling
      // (h4 etc.), and each character is its own inline-block span so it can "type" in like
      // data-reveal="type". Independent of the faded content, so the label's markup is never touched.
      const tip = document.createElement(fadeEl.tagName === 'A' ? 'span' : fadeEl.tagName);
      tip.className = (fadeEl.className ? fadeEl.className + ' ' : '') + 'copy-email-tip';
      tip.setAttribute('aria-hidden', 'true');
      tip.style.cssText =
        'position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:flex-start;white-space:pre;pointer-events:none;';
      const chars = copiedText.split('').map((ch) => {
        const s = document.createElement('span');
        s.textContent = ch;
        s.style.display = 'inline-block';
        tip.appendChild(s);
        return s;
      });
      gsap.set(tip, { autoAlpha: 1 });
      gsap.set(chars, { autoAlpha: 0 });
      trigger.appendChild(tip);

      const d = reduced ? 0 : 0.18;
      const stagger = reduced ? 0 : 0.045; // per-char typing speed

      // The visible text always leaves INSTANTLY; the incoming text always TYPES in. If the label is
      // itself a split reveal (data-reveal="type") its own chars type; otherwise it just appears.
      const emailChars = [...fadeEl.children].filter((el) => el.nodeType === 1);
      const split = emailChars.length > 0;
      const emailTarget = split ? emailChars : fadeEl;
      const emailShow = split
        ? { opacity: 1, duration: 0.01, ease: 'none', stagger }
        : { autoAlpha: 1, duration: d, ease: 'power1.out' };

      gsap
        .timeline({
          onComplete: () => {
            busy = false;
            trigger.classList.remove('is-copied');
            tip.remove();
          },
        })
        .set(emailTarget, split ? { opacity: 0 } : { autoAlpha: 0 }) // email leaves instantly
        .to(chars, { autoAlpha: 1, duration: 0.01, ease: 'none', stagger }) // "Copied!" types in
        .set(tip, { autoAlpha: 0 }, '+=1.1') // "Copied!" leaves instantly after the hold
        .to(emailTarget, emailShow); // email types back in
    };

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      copyToClipboard(email).then(confirm).catch(() => {
        window.location.href = href || `mailto:${email}`; // copy denied → fall back to mailto
      });
    });
  });
}

// CSS Marquee (Osmo) — the scroll animation itself is CSS you set up in Webflow (keyframes translating
// the list by -100%). This JS only: duplicates the list so the loop has no gap, sets each list's
// animation-duration from its width for a constant px/second speed, and pauses it while offscreen.
//   [data-css-marquee]              — the marquee container
//   [data-css-marquee-list]         — the scrolling list (gets duplicated to fill the loop)
//   data-css-marquee-speed="75"     — pixels per second (optional, default 75)
let marqueeObserver;
let marqueeResizeObserver;

// Recompute animation-duration from the CURRENT measured width. Called on init AND from a
// ResizeObserver, because there is no single reliable "layout is final" moment to measure at:
// fonts.ready doesn't wait for IMAGES (a logo marquee measures short until the images decode —
// that was the Safari-7.6s / Chrome-18.4s split; Chrome had them decoded, Safari didn't yet),
// and the viewport can change later anyway. So instead of chasing the right event, re-derive the
// duration whenever the width actually changes. Self-healing: fonts, images, responsive resize.
// Debug logging for the width measurement — the marquee's duration is only ever as good as the
// width it was measured from, and the interesting question is always "what did it read, WHEN?".
// Enable without touching Webflow by adding ?marquee-debug to the URL (works on the published
// site, which is the only place Safari can be tested), or per-marquee via
// data-css-marquee-debug="true". Off by default: no console noise in production.
const marqueeDebugQuery =
  typeof location !== 'undefined' && /[?&]marquee-debug/.test(location.search);
const marqueeDebug = (marquee) =>
  marqueeDebugQuery || marquee.getAttribute('data-css-marquee-debug') === 'true';

function logMarquee(marquee, reason, data) {
  if (!marqueeDebug(marquee)) return;

  const list = marquee.querySelector('[data-css-marquee-list]');
  const imgs = list ? Array.from(list.querySelectorAll('img')) : [];

  console.log(`[marquee] ${reason} @ ${Math.round(performance.now())}ms`, {
    ...data,
    // rect vs scrollWidth: if scrollWidth is much larger, the list is being COMPRESSED by its
    // parent (flex-shrink) rather than measured early — a CSS fix, not a timing one
    scrollWidth: list?.scrollWidth,
    flexShrink: list ? getComputedStyle(list).flexShrink : null,
    parentDisplay: list?.parentElement ? getComputedStyle(list.parentElement).display : null,
    lists: marquee.querySelectorAll('[data-css-marquee-list]').length,
    // the image hypothesis, directly: un-decoded images make the list measure short
    imgs: imgs.length,
    imgsComplete: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    fontsStatus: document.fonts?.status,
    marquee,
  });
}

function setMarqueeDuration(marquee, reason = 'measure') {
  const lists = marquee.querySelectorAll('[data-css-marquee-list]');
  if (!lists.length) return;

  const width = lists[0].getBoundingClientRect().width;
  if (!width) {
    logMarquee(marquee, `${reason} → SKIPPED (width 0, not laid out)`, { width });
    return; // not laid out yet (display:none / 0-width) — the observer will call us again
  }

  const speed = parseFloat(marquee.getAttribute('data-css-marquee-speed')) || 75; // px/sec
  const duration = width / speed;

  // skip sub-pixel noise: rewriting animation-duration on a running animation re-maps its
  // progress, which shows as a tiny jump — only worth it for a real width change
  if (marquee.__marqueeWidth && Math.abs(marquee.__marqueeWidth - width) < 1) {
    logMarquee(marquee, `${reason} → SKIPPED (width unchanged)`, {
      width,
      previousWidth: marquee.__marqueeWidth,
    });
    return;
  }

  logMarquee(marquee, reason, {
    width,
    previousWidth: marquee.__marqueeWidth ?? null,
    speed,
    duration: duration + 's',
  });

  marquee.__marqueeWidth = width;

  // one duration for every list (original + clones) — they're identical, so measuring each
  // separately risks two different durations and a visible desync mid-loop
  lists.forEach((list) => {
    list.style.animationDuration = duration + 's';
  });
}

export function initCSSMarquee(scope = document) {
  const marquees = scope.querySelectorAll('[data-css-marquee]');
  if (!marquees.length) return;

  // one shared observer across pages — running only while the marquee is on screen
  if (!marqueeObserver) {
    marqueeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.querySelectorAll('[data-css-marquee-list]').forEach((list) => {
            list.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
          });
        });
      },
      { threshold: 0 }
    );
  }

  // one shared ResizeObserver watching each marquee's first list — fires when the font swaps in,
  // when images decode, and on viewport resize, i.e. every moment the duration could go stale.
  // (transform doesn't trigger RO, so the marquee's own animation can't feed back into this.)
  if (!marqueeResizeObserver && typeof ResizeObserver !== 'undefined') {
    marqueeResizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const marquee = entry.target.closest('[data-css-marquee]');
        if (marquee) setMarqueeDuration(marquee, 'resize-observer');
      });
    });
  }

  document.fonts.ready.then(() => {
    marquees.forEach((marquee) => {
      if (marquee.__marquee) return; // guard: don't duplicate the list again on barba re-init
      marquee.__marquee = true;

      const lists = Array.from(marquee.querySelectorAll('[data-css-marquee-list]'));
      if (!lists.length) return;

      // duplicate each list so the scroll wraps seamlessly
      lists.forEach((list) => {
        marquee.appendChild(list.cloneNode(true));
      });

      // start paused until scrolled into view; duration comes from the measurement below
      marquee.querySelectorAll('[data-css-marquee-list]').forEach((list) => {
        list.style.animationPlayState = 'paused';
      });

      setMarqueeDuration(marquee, 'init (after fonts.ready)');
      marqueeObserver.observe(marquee);
      // observe the ORIGINAL list (still lists[0]); clones track it
      marqueeResizeObserver?.observe(lists[0]);
    });
  });
}

// -----------------------------------------
// BACK TO TOP (Osmo) — [data-back-to-top="wrap"] + [data-back-to-top="button"]
// -----------------------------------------
// Lives in the FOOTER (outside the barba container), so it's queried against `document`, not the
// scope. Two halves with different lifetimes:
//   - click binding: bound ONCE (guard), because the footer element itself persists across navs
//   - ScrollTrigger: re-created on every init, because beforeEnter kills all ScrollTriggers on nav
// Scrolls with Lenis when present (window.lenis, set in index.js initLenis) — a native
// window.scrollTo fights Lenis's rAF loop and stutters. Falls back to native if Lenis is absent.
// Attrs (on the wrap): data-back-to-top-distance (vh % scrolled before it appears, def 50)
//                      data-back-to-top-duration  (scroll-to-top duration in s, def 1.2)
export function initBackToTop() {
  const wrap = document.querySelector('[data-back-to-top="wrap"]');
  const button = document.querySelector('[data-back-to-top="button"]');
  if (!wrap || !button) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minimumScrollDistance = parseFloat(wrap.getAttribute('data-back-to-top-distance')) || 50; // vh %
  const scrollDuration = parseFloat(wrap.getAttribute('data-back-to-top-duration')) || 1.2; // seconds

  // undo the CSS pre-hide on the wrapper (it exists to stop a flash before JS runs), keep the
  // button itself hidden until the scroll threshold is crossed
  gsap.set(wrap, { autoAlpha: 1 });
  gsap.set(button, { autoAlpha: 0, rotate: reduced ? 0 : -65, scale: reduced ? 1 : 0.4 });

  // re-created every init — the previous one was killed in beforeEnter
  ScrollTrigger.create({
    trigger: document.body,
    start: `top top-=${minimumScrollDistance}%`,
    onEnter: () => {
      gsap.to(button, {
        autoAlpha: 1,
        rotate: 0,
        scale: 1,
        duration: reduced ? 0 : 0.45,
        ease: 'power4.out',
      });
    },
    onLeaveBack: () => {
      gsap.to(button, {
        autoAlpha: 0,
        rotate: reduced ? 0 : -65,
        scale: reduced ? 1 : 0.6,
        duration: reduced ? 0 : 0.4,
        ease: 'power4.out',
      });
    },
  });

  if (button.__backToTop) return; // guard: the footer button persists, don't stack click handlers
  button.__backToTop = true;

  const nativeScrollTop = () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  button.addEventListener('click', () => {
    const lenis = window.lenis;

    // no Lenis on the page at all (CDN blocked / not loaded) → native, done
    if (!lenis || typeof lenis.scrollTo !== 'function') {
      nativeScrollTop();
      return;
    }

    const startY = window.scrollY;

    // Lenis is present but can still fail to move the page: it throws, or it's currently
    // .stop()'d (barba does that during a page transition) in which case scrollTo silently
    // no-ops. Catch the throw AND verify movement on the next frames before giving up.
    try {
      // `immediate` (not duration:0) for reduced motion — Lenis's duration path can no-op at 0
      lenis.scrollTo(0, reduced ? { immediate: true } : { duration: scrollDuration });
    } catch (err) {
      nativeScrollTop();
      return;
    }

    if (startY === 0) return; // already at the top, nothing to verify

    // 2 rAFs ≈ 2 frames: enough for one Lenis raf tick to have run, short enough that the
    // native fallback still reads as the same click. If nothing moved, Lenis isn't driving.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (window.scrollY >= startY) nativeScrollTop();
      });
    });
  });
}

// -----------------------------------------
// SEARCH DOCK — [data-search-wrapper]
// -----------------------------------------
// Once the closest <section> scrolls out of view, a copy of the search slides up from the bottom of
// the screen and stays pinned there; scrolling back into the section sends it away again.
//
// It's a CLONE, and the ORIGINAL is never touched — not taken out of the flow, not height-frozen —
// so there is no way for docking to shift the page. That's only safe because the search's action is
// a redirect (read the value, go to another URL): there's no live filter state to lose. The clone
// still doesn't own that behaviour though — it FORWARDS to the original (copies the value across,
// fires input/change, then clicks the matching original button), so whatever the real search does
// stays defined in exactly one place and the dock can't drift out of sync with it.
//
// JS owns only WHEN it docks and the slide. Everything visual is CSS, off a state attribute on the
// clone, plus a class on <body> for neutralising competing z-indexes:
//
//   data-search-dock="idle"     off duty — style it display:none
//   data-search-dock="docked"   pinned by your CSS (stays set until the slide-out ends)
//   body.search-docked          present for exactly as long as the dock is on screen
//
// The clone is appended to <body>, so position:fixed can't be broken by a transformed ancestor, and
// any stale dock from a previous barba page is removed on init.
//
// NOTE: this animates the clone's TRANSFORM, so the docked CSS must not use one — centre with
// left/right/margin or a flex parent, never `translateX(-50%)`, or the two will fight.
//
// Attrs on [data-search-wrapper]:
//   data-search-dock-offset   px past the viewport top before docking (def 100)
//   data-search-dock-duration slide duration in seconds (def 0.6)
//   data-search-dock-trigger  CSS selector overriding the closest <section> as the trigger
//   data-search-dock-target   CSS-selectable child to clone instead of the <form>
export function initSearchDock(scope = document) {
  const wrapper = scope.querySelector('[data-search-wrapper]');
  if (!wrapper || wrapper.__searchDock) return;

  const bar =
    wrapper.querySelector('[data-search-dock-target]') ||
    wrapper.querySelector('form') ||
    wrapper.firstElementChild;
  if (!bar) return;
  wrapper.__searchDock = true;

  const offset = parseFloat(wrapper.getAttribute('data-search-dock-offset')) || 100;
  const duration = parseFloat(wrapper.getAttribute('data-search-dock-duration')) || 0.6;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A barba nav can leave the previous page's dock behind — it lives on <body>, outside the
  // container. Match on the CLONE-IDENTITY attribute, never the state attribute: state is cosmetic
  // and could plausibly end up on the real search, and "remove everything with that attribute"
  // would then delete the actual form. Extra belt: never remove an element containing the original.
  document.querySelectorAll('body > [data-search-dock-clone]').forEach((el) => {
    if (!el.contains(wrapper)) el.remove();
  });
  document.body.classList.remove('search-docked');

  // ---- build the clone -------------------------------------------------------------------------
  const dock = bar.cloneNode(true);
  dock.setAttribute('data-search-dock-clone', ''); // identity — what makes it safe to remove
  dock.setAttribute('data-search-dock', 'idle'); // state — what CSS styles
  // Duplicate ids are invalid and would break getElementById / label[for] on the REAL search, which
  // must keep working. Drop them from the copy; it's addressed by [data-search-dock] instead.
  dock.removeAttribute('id');
  dock.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  dock.querySelectorAll('[for]').forEach((el) => el.removeAttribute('for'));
  // strip effect hooks so a later init pass can't re-run them on the copy (initButton056 would
  // split the already-split label a second time)
  dock.querySelectorAll('[data-button-056]').forEach((el) => el.removeAttribute('data-button-056'));
  document.body.appendChild(dock);

  const fieldSel = 'input:not([type="submit"]):not([type="hidden"]), textarea, select';
  const clickSel = 'a, button, input[type="submit"]';
  const srcField = bar.querySelector(fieldSel);
  const dockField = dock.querySelector(fieldSel);
  // index-matched so the copy's button maps to the original's without depending on class names
  const srcClicks = Array.from(bar.querySelectorAll(clickSel));
  const dockClicks = Array.from(dock.querySelectorAll(clickSel));

  // never let the copy submit natively — the original owns what "search" means
  if (dock.tagName.toLowerCase() === 'form') {
    dock.addEventListener('submit', (e) => e.preventDefault());
  }

  const forward = () => {
    if (!srcField || !dockField) return;
    srcField.value = dockField.value;
    // let whatever listens on the real input react to the value it's about to be asked to act on
    srcField.dispatchEvent(new Event('input', { bubbles: true }));
    srcField.dispatchEvent(new Event('change', { bubbles: true }));
  };

  dockClicks.forEach((el, i) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      forward();
      (srcClicks[i] || srcClicks[0])?.click(); // hand off to the real button
    });
  });

  dockField?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    forward();
    (srcClicks[0] || srcField)?.click();
  });

  // ---- dock / undock ---------------------------------------------------------------------------
  let docked = false;
  let tween;

  // Exact px that puts the bar's top edge on the bottom of the viewport, i.e. fully off-screen.
  // Measured rather than assumed (yPercent:100 would leave it peeking by whatever bottom offset the
  // CSS uses), and CSS-agnostic — restyle the docked position and the slide still starts off-screen.
  // Subtracts any transform already applied so it stays correct if called mid-slide.
  const offScreenY = () => {
    const currentY = parseFloat(gsap.getProperty(dock, 'y')) || 0;
    const restTop = dock.getBoundingClientRect().top - currentY;
    return window.innerHeight - restTop;
  };

  const show = () => {
    if (docked) return;
    docked = true;

    if (srcField && dockField) dockField.value = srcField.value; // carry a typed query across
    dock.setAttribute('data-search-dock', 'docked');
    document.body.classList.add('search-docked');

    tween?.kill();
    // pure slide up from below the screen edge — no fade.
    // ease omitted on purpose: gsap.defaults in index.js makes 'osmo' the default.
    tween = gsap.fromTo(dock, { y: offScreenY() }, { y: 0, duration: reduced ? 0 : duration });
  };

  const hide = () => {
    if (!docked) return;
    docked = false;

    if (srcField && dockField) srcField.value = dockField.value; // hand a typed query back
    tween?.kill();
    tween = gsap.to(dock, {
      y: offScreenY(),
      duration: reduced ? 0 : duration * 0.8,
      onComplete() {
        // state flips back only once it's off-screen, so CSS keeps it pinned — and the neutralised
        // z-indexes stay neutralised — for the whole slide-out, instead of the dock being covered
        // or vanishing halfway through its exit
        dock.setAttribute('data-search-dock', 'idle');
        document.body.classList.remove('search-docked');
        gsap.set(dock, { clearProps: 'transform' });
      },
    });
  };

  // Docking is tied to the SECTION leaving/re-entering view, not the search's own box — so the bar
  // appears once you've left the whole hero, not the moment the input scrolls off. Override with a
  // selector in data-search-dock-trigger (resolved as an ancestor first, then document-wide).
  const triggerSel = wrapper.getAttribute('data-search-dock-trigger');
  const trigger =
    (triggerSel && (wrapper.closest(triggerSel) || document.querySelector(triggerSel))) ||
    wrapper.closest('section') ||
    wrapper;

  // Should the dock be up RIGHT NOW, judged from live geometry rather than from remembered state?
  // Mirrors the ScrollTrigger start below: the trigger's bottom edge is `offset` px above the top
  // of the viewport.
  const shouldDock = () => trigger.getBoundingClientRect().bottom < -offset;

  // Reconcile state with reality. Both show/hide are guarded, so calling this repeatedly is free.
  const syncDockState = () => (shouldDock() ? show() : hide());

  ScrollTrigger.create({
    trigger,
    start: `bottom top-=${offset}`,
    onEnter: show,
    onLeaveBack: hide,
    // ScrollTrigger recalculates start/end on refresh but does NOT re-fire onEnter/onLeaveBack, so
    // a layout change alone can leave the dock contradicting the page: resize a phone-width window
    // (tall hero, scrolled past → docked) up to desktop (short hero, now back inside it) and the bar
    // stays pinned over the hero. Refresh fires on resize, font load and ScrollTrigger.refresh().
    onRefresh: syncDockState,
  });

  // Loading already scrolled past the section is the same problem: a trigger whose start is already
  // behind you never fires onEnter.
  syncDockState();
}

// -----------------------------------------
// SEARCH SUGGESTIONS — [data-suggestion-item]
// -----------------------------------------
// Click (or Enter/Space) a suggestion tag → its text lands in the search input.
//
// Bound by DELEGATION on document, deliberately: the suggestions are CMS-rendered, and the search
// dock clones its bar into <body> — so a per-element pass would have to run after the clone exists
// and again after any CMS re-render. One document listener covers every copy, present and future,
// and survives barba without re-binding.
//
// Which input gets filled: the one inside the SAME search block as the tag you clicked — the
// docked copy if you clicked a tag in the dock, the hero one otherwise — falling back to the page's
// [data-search-wrapper]. The dock already syncs values with the original when it shows/hides, so
// filling either one carries across.
//
// Value = data-suggestion-item's own value if set (use it for a CMS slug that differs from the
// visible label), else the tag's text.
let suggestionsBound = false;
export function initSearchSuggestions(scope = document) {
  // Keyboard access: these are <div role="listitem">, so without a tabindex they can't be reached
  // at all. Idempotent, so it's safe to re-run for CMS-rendered or cloned tags.
  scope.querySelectorAll('[data-suggestion-item]').forEach((item) => {
    if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
  });

  if (suggestionsBound) return;
  suggestionsBound = true;

  const fieldSel = 'input:not([type="submit"]):not([type="hidden"]), textarea';

  const apply = (item) => {
    const root =
      item.closest('[data-search-dock-clone]') ||
      item.closest('[data-search-wrapper]') ||
      document.querySelector('[data-search-wrapper]');
    const input = root?.querySelector(fieldSel);
    if (!input) return;

    const attr = item.getAttribute('data-suggestion-item');
    input.value = (attr && attr.trim()) || item.textContent.trim();

    // let anything listening on the input (validation, the search itself) see the new value —
    // assigning .value directly never fires these on its own
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  };

  document.addEventListener('click', (e) => {
    const item = e.target.closest('[data-suggestion-item]');
    if (item) apply(item);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('[data-suggestion-item]');
    if (!item) return;
    e.preventDefault(); // stop Space scrolling the page
    apply(item);
  });
}
