// -----------------------------------------
// HERO VISUAL
// -----------------------------------------
// Mounts the ShapeField swarm→shape scene on [data-shapefield]. Content reveals (headline,
// body, buttons) are handled by the Osmo animations in animations.js via [data-reveal] /
// [data-reveal-group] — not here.
//
// Webflow custom attribute:
//   [data-shapefield]          → the mount div (empty value).
//                                 Optional data-shapefield-config='{"spin":{"speed":0.6}}' to override config.
//   [data-shapefield-target]   → CSS selector of a div the RESOLVED shape should size itself to (the
//                                 cloud reveal stays full-screen). e.g. data-shapefield-target=".hero-logo-size"
//   [data-shapefield-final-fit]→ contain (default) | width | height | cover — how the shape fits that div.
//   [data-shapefield-center]   → "false" to keep the shape centered on the mount instead of moving it to
//                                 the target div's center (default: centers on the target when one is set).
//
// three is bundled via ShapeField.

import ShapeField from './shapefield.js';

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

  // dedicated attributes win over the config JSON
  const target = mount.getAttribute('data-shapefield-target');
  if (target) cfg.target = target;
  const finalFit = mount.getAttribute('data-shapefield-final-fit');
  if (finalFit) cfg.finalFit = finalFit;
  if (mount.getAttribute('data-shapefield-center') === 'false') cfg.finalCenter = false;

  // Play the intro at most once per session, and only when the hero is actually in view on load —
  // like a ScrollTrigger that's already been passed. Either condition → skip straight to the resolved
  // shape (ShapeField reads cfg.skipAnimation). `data-shapefield-always` opts a page out of the guard.
  const alwaysPlay = mount.getAttribute('data-shapefield-always') === 'true';
  if (!alwaysPlay) {
    let played = false;
    try {
      played = sessionStorage.getItem('mv:heroPlayed') === '1';
    } catch (e) {
      /* sessionStorage blocked (private mode) — treat as not played */
    }

    // Loaded past the hero: its bottom is above the middle of the viewport, so the intro would play
    // off-screen. Skip it (matches how a passed ScrollTrigger doesn't fire on load).
    const r = mount.getBoundingClientRect();
    const scrolledPast = r.bottom < window.innerHeight * 0.5;

    if (played || scrolledPast) {
      cfg.skipAnimation = true;
    } else {
      // We're about to play it for real — mark the session so reloads / barba navs skip.
      try {
        sessionStorage.setItem('mv:heroPlayed', '1');
      } catch (e) {
        /* ignore */
      }
    }
  }

  mount.__shapefield = new ShapeField(mount, cfg);
  return mount.__shapefield;
}
