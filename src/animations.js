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

// Stacking cards — as each card scrolls up, the previous one drifts + its image rotates (parallax)
export function initStackingCardsParallax(scope = document) {
  const cards = scope.querySelectorAll('[data-stacking-cards-item]');

  if (cards.length < 2) return;

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
export function initStickyStepsFlip(scope = document) {
  scope.querySelectorAll('[data-sticky-steps-init]').forEach(setupStickySteps);
}

// flip-only CSS, added once (everything else stays your Webflow styles)
function injectStickyStepsCSS() {
  if (document.getElementById('sticky-steps-flip-css')) return;
  const s = document.createElement('style');
  s.id = 'sticky-steps-flip-css';
  s.textContent =
    // perspective + center the flip in the visual; card = 80% of the visual's height,
    // width auto via the card's aspect ratio. No stretch — relies on the visual's own height.
    '.sticky-steps__visual{position:relative;perspective:1800px;display:flex;align-items:center;justify-content:center}' +
    '.ss-flip{position:relative;height:80%;width:auto;aspect-ratio:362 / 502;transform-style:preserve-3d;will-change:transform}' +
    '.ss-flip__face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
    '.ss-flip__face--back{transform:rotateY(180deg)}' +
    '.ss-flip__face svg{display:block;width:100%;height:100%}';
  document.head.appendChild(s);
}

// Reveal one card face: leaf paint elements, staggered top→bottom.
function buildStickyReveal(face) {
  const svg = face.querySelector('svg');
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

    if (stroked && stroke !== '#e3e0df') {
      // draw lines / underlines on
      const len = el.getTotalLength();
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

function setupStickySteps(container) {
  if (container.hasAttribute('data-flip-ready')) return; // already wired (guards double-init)
  const items = Array.from(container.querySelectorAll('[data-sticky-steps-item]'));
  if (items.length < 2) return;

  // grab each card's SVG markup in DOM order
  const cards = items.map((it) => {
    const svg = it.querySelector('.sticky-steps__visual svg');
    return svg ? svg.outerHTML : '';
  });
  if (cards.some((c) => !c)) return; // an item is missing its inline SVG → skip silently

  injectStickyStepsCSS();
  container.setAttribute('data-flip-ready', '');

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

  // init: front = card 0 (revealed), back = card 1 (ready)
  const [firstCard, secondCard] = cards;
  front.innerHTML = firstCard;
  back.innerHTML = secondCard;
  buildStickyReveal(front).play();
  setStatus(0);

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

          // Get the scrub value, our default is 'true' because that feels nice with Lenis
          const scrubAttr = trigger.getAttribute('data-parallax-scrub');
          const scrub = scrubAttr ? parseFloat(scrubAttr) : true;

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

          gsap.fromTo(
            target,
            { [prop]: startVal },
            {
              [prop]: endVal,
              ease: 'none',
              scrollTrigger: {
                trigger,
                start: scrollStart,
                end: scrollEnd,
                scrub,
              },
            }
          );
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

  // fonts.ready so the width (→ duration) is measured against the loaded font, not a fallback
  document.fonts.ready.then(() => {
    marquees.forEach((marquee) => {
      if (marquee.__marquee) return; // guard: don't duplicate the list again on barba re-init
      marquee.__marquee = true;

      const speed = parseFloat(marquee.getAttribute('data-css-marquee-speed')) || 75; // px/sec

      // duplicate each list so the scroll wraps seamlessly
      marquee.querySelectorAll('[data-css-marquee-list]').forEach((list) => {
        marquee.appendChild(list.cloneNode(true));
      });

      // set duration from width (constant speed), start paused until scrolled into view
      marquee.querySelectorAll('[data-css-marquee-list]').forEach((list) => {
        list.style.animationDuration = list.offsetWidth / speed + 's';
        list.style.animationPlayState = 'paused';
      });

      marqueeObserver.observe(marquee);
    });
  });
}
