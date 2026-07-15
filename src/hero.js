// -----------------------------------------
// HERO VISUAL
// -----------------------------------------
// Mounts the ShapeField swarm→shape scene on [data-shapefield]. Content reveals (headline,
// body, buttons) are handled by the Osmo animations in animations.js via [data-reveal] /
// [data-reveal-group] — not here.
//
// Webflow custom attribute:
//   [data-shapefield]   → the mount div (empty value).
//                         Optional data-shapefield-config='{"spin":{"speed":0.6}}' to override config.
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

  mount.__shapefield = new ShapeField(mount, cfg);
  return mount.__shapefield;
}
