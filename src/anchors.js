// -----------------------------------------
// HEADING ANCHORS — [data-anchors]
// -----------------------------------------
// Put data-anchors on a rich text block; every h1–h6 inside it gets a slug id derived from its own
// text, so headings become linkable (#in-vitro-nephrotoxicity).
//
// Idempotent by design — a heading that already has an id is left alone, so it's safe to re-run on
// every barba nav, and an id you set by hand in Webflow always wins over the generated one.

// "In vitro nephrotoxicity, 40mg/kg" → "in-vitro-nephrotoxicity-40mg-kg"
function slugify(text) {
  return (
    text
      .normalize('NFD') // split accents off their base letters…
      .replace(/[\u0300-\u036f]/g, '') // …and drop them, so "Přehled" → "prehled" not "p-ehled"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // any run of non-alphanumerics becomes one dash
      .replace(/^-+|-+$/g, '') // no leading/trailing dashes
      .slice(0, 60) // keep URLs sane on long headings
      .replace(/-+$/, '') // the slice can leave a trailing dash behind
  );
}

// The id goes on an injected zero-height marker sitting ABOVE the heading, not on the heading
// itself. That's the whole offset mechanism: it's pure geometry, so anything that scrolls to the
// element — Lenis, a native #fragment jump, scrollIntoView — lands at the marker's rendered
// position and the heading ends up that far down the screen. `scroll-margin-top` can't do this
// because it only applies to scrolling the BROWSER performs, which Lenis has taken over.
//
// Tune the gap in CSS, not here:  [data-anchors]{ --anchor-offset: 8rem }  (per block if you like)
function injectAnchorCSS() {
  if (document.getElementById('heading-anchor-css')) return;
  const s = document.createElement('style');
  s.id = 'heading-anchor-css';
  s.textContent =
    '[data-anchor-marker]{' +
    'display:block;position:relative;height:0;' +
    // relative shifts the rendered box without touching layout, so nothing moves on the page
    'top:calc(var(--anchor-offset, 6rem) * -1);' +
    'pointer-events:none;visibility:hidden' + // never let an invisible box eat clicks
    '}';
  document.head.appendChild(s);
}

export function initHeadingAnchors(scope = document) {
  const roots = scope.querySelectorAll('[data-anchors]');
  if (!roots.length) return;

  injectAnchorCSS();

  // Every id already on the page, so a generated one can't collide with an existing element —
  // duplicate ids would make #links jump to whichever came first.
  const used = new Set();
  document.querySelectorAll('[id]').forEach((el) => used.add(el.id));

  roots.forEach((root) => {
    root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      // already processed (barba re-init / re-render), or the author set an id by hand
      if (heading.id || heading.previousElementSibling?.hasAttribute?.('data-anchor-marker')) return;

      const base = slugify(heading.textContent || '') || 'section';
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`; // "…-2", "…-3" for repeated headings
      used.add(id);

      const marker = document.createElement('span');
      marker.setAttribute('data-anchor-marker', '');
      marker.id = id;
      heading.parentNode.insertBefore(marker, heading);
      // so you can still find the heading from its slug without walking the DOM
      heading.setAttribute('data-anchor-for', id);
    });
  });
}

// -----------------------------------------
// ANCHOR LINKS — a[href^="#"]
// -----------------------------------------
// Lenis takes scrolling over from the browser, and `scroll-margin-top` only affects scrolling the
// BROWSER performs (native fragment jumps, scrollIntoView). Lenis computes its own target position
// and never consults it — which is why the CSS looks like it does nothing.
//
// So rather than hard-coding an offset here and having two sources of truth, this READS the
// target's computed `scroll-margin-top` and passes it to Lenis as a negative offset. Keep styling
// the headings in CSS exactly as you would without Lenis; this just makes Lenis honour it.
//
// Delegated on document: covers nav, footer and rich-text links, and survives barba without
// re-binding. Falls back to native smooth scrolling (which honours scroll-margin-top on its own)
// when Lenis isn't present.
let anchorLinksBound = false;

function scrollMarginOf(el) {
  return parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
}

function scrollToTarget(target) {
  const lenis = window.lenis;
  const offset = -scrollMarginOf(target);

  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(target, { offset });
    return;
  }
  target.scrollIntoView({ behavior: 'smooth' }); // native path already respects scroll-margin-top
}

// "#id" from a same-page link — ignores "#", and cross-page URLs that merely contain a hash
function hashTargetFrom(link) {
  const href = link.getAttribute('href') || '';
  if (!href.startsWith('#') || href === '#') return null;
  try {
    return document.getElementById(decodeURIComponent(href.slice(1)));
  } catch (e) {
    return null;
  }
}

export function initAnchorLinks() {
  if (anchorLinksBound) return;
  anchorLinksBound = true;

  document.addEventListener('click', (e) => {
    // let modified clicks (new tab/window, middle click) behave normally
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.hasAttribute('data-no-anchor-scroll')) return;

    const target = hashTargetFrom(link);
    if (!target) return; // no such id — leave the browser to it

    e.preventDefault();
    scrollToTarget(target);
    // keep the URL shareable without letting the browser jump to the fragment itself
    history.pushState(null, '', link.getAttribute('href'));
  });

  // A hash in the URL on first load: history.scrollRestoration is 'manual' and the boilerplate
  // scrolls to 0 on init, so the browser's own fragment jump is lost. Re-do it once layout settles.
  if (window.location.hash.length > 1) {
    const jump = () => {
      let target = null;
      try {
        target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      } catch (e) {
        /* malformed hash */
      }
      if (!target) return;
      const lenis = window.lenis;
      if (lenis && typeof lenis.scrollTo === 'function') {
        lenis.scrollTo(target, { offset: -scrollMarginOf(target), immediate: true });
      } else {
        target.scrollIntoView();
      }
    };
    // after fonts (heights shift) and one frame, so the measured position is final
    document.fonts.ready.then(() => requestAnimationFrame(jump));
  }
}
