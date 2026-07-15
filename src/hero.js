// -----------------------------------------
// HERO VISUAL + REVEAL
// -----------------------------------------
// Mounts the ShapeField swarm→shape scene on [data-shapefield] and reveals the hero
// content (title / body / actions) once the swarm has resolved, so nothing overlaps.
//
// Webflow custom attributes (added in the Designer element settings):
//   [data-shapefield]                     → the mount div (empty value). Optional
//                                            data-shapefield-config='{"spin":{"speed":0.6}}' to override config.
//   [data-hero-reveal="title"]            → the H1 (split into chars if SplitText is loaded)
//   [data-hero-reveal="item"]             → any element that fades/rises in after the title (body, buttons, banner)
//
// gsap + (optional) SplitText are ambient globals from the CDN scripts. three is bundled via ShapeField.

import ShapeField from './shapefield.js';

const REVEAL = { startFactor: 0.4, ease: 'power3.out', headEase: 'power4.out', headStagger: 0.018 };

export function initHero(scope = document) {
  const mount = scope.querySelector('[data-shapefield]');
  if (!mount || mount.__shapefield) return; // nothing to do / already mounted

  let cfg = {};
  const raw = mount.getAttribute('data-shapefield-config');
  if (raw) {
    try {
      cfg = JSON.parse(raw);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[modernvivo] invalid data-shapefield-config JSON', e);
    }
  }

  const field = new ShapeField(mount, cfg);
  mount.__shapefield = field;

  playHeroReveal(scope, field);
  return field;
}

export function playHeroReveal(scope = document, field = null) {
  if (typeof gsap === 'undefined') return;

  const title = scope.querySelector('[data-hero-reveal="title"]');
  const items = scope.querySelectorAll('[data-hero-reveal="item"]');

  // begin only once the swarm has (mostly) resolved into its shape → no overlap
  const t = (field && field.config && field.config.timeline) || {
    revealDur: 1.8,
    hold: 0.35,
    assembleDur: 2.8,
  };
  const startDelay = t.revealDur + t.hold + t.assembleDur * REVEAL.startFactor;

  const tl = gsap.timeline({ defaults: { ease: REVEAL.ease, duration: 1 }, delay: startDelay });

  if (title) {
    let split = null;
    try {
      if (typeof SplitText !== 'undefined') {
        gsap.registerPlugin(SplitText);
        split = new SplitText(title, { type: 'chars,words' });
      }
    } catch (e) {
      split = null;
    }
    if (split) {
      tl.from(
        split.chars,
        { yPercent: 110, autoAlpha: 0, stagger: REVEAL.headStagger, duration: 0.9, ease: REVEAL.headEase },
        0
      );
    } else {
      tl.from(title, { yPercent: 25, autoAlpha: 0, duration: 1, ease: REVEAL.headEase }, 0);
    }
  }

  if (items.length) {
    tl.from(items, { y: 22, autoAlpha: 0, stagger: 0.1 }, title ? 0.3 : 0);
  }

  return tl;
}
