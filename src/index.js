// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE — Cross Fade
// ModernVivo custom code: hero visual reveal (see ./hero.js)
// -----------------------------------------
// Ambient globals loaded via CDN in Webflow: barba, Lenis, gsap, CustomEase, SplitText.
// three is bundled into dist by esbuild (imported by ./shapefield.js).

import {
  initBackToTop,
  initButton056,
  initCardBorderHover,
  initContentRevealScroll,
  initCopyEmail,
  initCSSMarquee,
  initDotField,
  initDotMap,
  initGlobalParallax,
  initHeadingReveal,
  initIndustryReveal,
  initNavMenu,
  initNavReveal,
  initSearchDock,
  initSearchSuggestions,
  initStackingCardsParallax,
  initStickyStepsFlip,
} from './animations.js';
import { initCalendly } from './calendly.js';
import { initResourcesFilter } from './filters.js';
import { initHero } from './hero.js';

gsap.registerPlugin(CustomEase, ScrollTrigger, SplitText);

history.scrollRestoration = 'manual';

let lenis = null;
let nextPage = document;
let onceFunctionsInitialized = false;

const hasLenis = typeof window.Lenis !== 'undefined';
const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';

const rmMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.('change', (e) => (reducedMotion = e.matches));
rmMQ.addListener?.((e) => (reducedMotion = e.matches));

const has = (s) => !!nextPage.querySelector(s);

let staggerDefault = 0.05;
let durationDefault = 0.6;

CustomEase.create('osmo', '0.625, 0.05, 0, 1');
gsap.defaults({ ease: 'osmo', duration: durationDefault });

// -----------------------------------------
// FUNCTION REGISTRY
// -----------------------------------------

function initOnceFunctions() {
  initLenis();
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;

  // Runs once on first load. NOTE: nav + copy-email live in persistent regions (nav/footer) that sit
  // OUTSIDE the barba container, so their gate must query `document` — `has()` (container-scoped)
  // would miss them. The inits themselves already scan `document` here.
  if (document.querySelector('[data-nav-reveal]')) initNavReveal(document); // nav persists across barba — once only
  if (document.querySelector('[data-nav="hamburger"]')) initNavMenu(document); // nav persists — once only
  if (has('[data-shapefield]')) initHero(document);
  if (has('[data-dotmap]')) initDotMap(nextPage);
  if (has('[data-industry-reveal]')) initIndustryReveal(document);
  if (has('[data-dotfield]')) initDotField(document);
  if (has('[data-button-056]')) initButton056(document);
  if (has('[data-reveal]')) initHeadingReveal(document);
  if (has('[data-reveal-group]')) initContentRevealScroll(document);
  if (has('[data-stacking-cards-item]')) initStackingCardsParallax(document);
  if (has('[data-sticky-steps-init]')) initStickyStepsFlip(document);
  if (has('[data-parallax="trigger"]')) initGlobalParallax(document);
  if (has('[data-card-border]')) initCardBorderHover(document);
  if (has('[data-search-wrapper]')) initSearchDock(document);
  if (document.querySelector('[data-suggestion-item]')) initSearchSuggestions(document); // may sit in the dock clone on <body>
  if (has('.resources-filter')) initResourcesFilter(nextPage);
  if (has('[data-calendly]')) initCalendly(nextPage);
  if (document.querySelector('[data-copy-email]')) initCopyEmail(document); // footer/persistent → document-scoped gate
  if (document.querySelector('[data-css-marquee]')) initCSSMarquee(document); // marquee may live in footer
  if (document.querySelector('[data-back-to-top="wrap"]')) initBackToTop(); // footer/persistent → document-scoped gate

  // reveals have set their own initial hidden state (inline) — safe to drop the CSS pre-hide gate
  document.documentElement.classList.add('reveal-ready');
  // ...and the whole-page anti-flash gate: the head CSS hid <body> until now (so the raw pre-JS DOM
  // never flashed); reveals are hidden/armed, so it's safe to fade the page in. First-load only —
  // barba navs keep .page-ready and fade the incoming container instead. See the head CSS snippet.
  document.documentElement.classList.add('page-ready');
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Runs before the enter animation
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  // Runs after enter animation completes
  if (has('[data-shapefield]')) initHero(nextPage);
  if (has('[data-dotmap]')) initDotMap(nextPage);
  if (has('[data-industry-reveal]')) initIndustryReveal(nextPage);
  if (has('[data-dotfield]')) initDotField(nextPage);
  if (has('[data-button-056]')) initButton056(nextPage);
  if (has('[data-reveal]')) initHeadingReveal(nextPage);
  if (has('[data-reveal-group]')) initContentRevealScroll(nextPage);
  if (has('[data-stacking-cards-item]')) initStackingCardsParallax(nextPage);
  if (has('[data-sticky-steps-init]')) initStickyStepsFlip(nextPage);
  if (has('[data-parallax="trigger"]')) initGlobalParallax(nextPage);
  if (has('[data-card-border]')) initCardBorderHover(nextPage);
  if (has('[data-search-wrapper]')) initSearchDock(nextPage);
  if (document.querySelector('[data-suggestion-item]')) initSearchSuggestions(document);
  if (has('.resources-filter')) initResourcesFilter(nextPage);
  if (has('[data-calendly]')) initCalendly(nextPage);
  if (has('[data-copy-email]')) initCopyEmail(nextPage);
  if (has('[data-css-marquee]')) initCSSMarquee(nextPage);
  // footer-persistent: gate on document (has() is container-scoped). Re-run rebuilds the
  // ScrollTrigger that beforeEnter killed; the click handler is guarded against double-binding.
  if (document.querySelector('[data-back-to-top="wrap"]')) initBackToTop();

  document.documentElement.classList.add('reveal-ready');
}

// -----------------------------------------
// PAGE TRANSITIONS
// -----------------------------------------

function runPageOnceAnimation(next) {
  const tl = gsap.timeline();

  tl.call(
    () => {
      resetPage(next);
    },
    null,
    0
  );

  return tl;
}

function runPageLeaveAnimation(current, next) {
  const tl = gsap.timeline({
    onComplete: () => {
      current.remove();
    },
  });

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(
    current,
    {
      autoAlpha: 0,
      ease: 'power1.in',
      duration: 0.5,
    },
    0
  );

  return tl;
}

function runPageEnterAnimation(next) {
  const tl = gsap.timeline();

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    tl.set(next, { autoAlpha: 1 });
    tl.add('pageReady');
    tl.call(resetPage, [next], 'pageReady');
    return new Promise((resolve) => tl.call(resolve, null, 'pageReady'));
  }

  tl.add('startEnter', 0);

  tl.fromTo(
    next,
    {
      autoAlpha: 0,
    },
    {
      autoAlpha: 1,
      ease: 'power1.inOut',
      duration: 0.75,
    },
    'startEnter'
  );

  // let a data-reveal heading animate itself — don't double-animate it here (it's hidden + armed
  // before this fade, so a barba tween on top of it would fight the reveal)
  const enterH1 = next.querySelector('h1:not([data-reveal])');
  if (enterH1) {
    tl.fromTo(
      enterH1,
      {
        yPercent: 25,
        autoAlpha: 0,
      },
      {
        yPercent: 0,
        autoAlpha: 1,
        ease: 'expo.out',
        duration: 1,
      },
      '< 0.3'
    );
  }

  tl.add('pageReady');
  tl.call(resetPage, [next], 'pageReady');

  return new Promise((resolve) => {
    tl.call(resolve, null, 'pageReady');
  });
}

// -----------------------------------------
// BARBA HOOKS + INIT
// -----------------------------------------

// Navy backdrop on html + body + barba wrapper — applied ONLY for the duration of a transition (so a
// navy shows through as page A leaves and before page B is painted), then cleared afterwards.
function setTransitionBackdrop(on) {
  const els = [
    document.documentElement,
    document.body,
    document.querySelector('[data-barba="wrapper"]'),
  ].filter(Boolean);
  new Set(els).forEach((el) => (el.style.backgroundColor = on ? 'var(--navy)' : ''));
}

// Runs at the very start of a navigation (nav only — never on first-load `once`, which has no leave).
barba.hooks.beforeLeave((data) => {
  // Navy backdrop shows through as page A fades out AND in the gap before page B fades in (the
  // transition is sequential, not a crossfade — see sync:false). Cleared again in afterEnter.
  setTransitionBackdrop(true);

  // Stack + hide the incoming page up front so it never shows under the leaving page.
  if (data.next && data.next.container) {
    gsap.set(data.next.container, { position: 'fixed', top: 0, left: 0, right: 0, autoAlpha: 0 });
  }

  if (lenis && typeof lenis.stop === 'function') {
    lenis.stop();
  }
});

barba.hooks.beforeEnter((data) => {
  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  if (hasScrollTrigger) {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
});

barba.hooks.enter((data) => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter(() => {
  // Page B is fully in now — drop the navy backdrop so the pages' own backgrounds show again.
  setTransitionBackdrop(false);

  // Page functions (reveal hidden-states + arming) already ran in `enter`, BEFORE the fade, so
  // nothing flashed. Now the container is in its final flow position — just settle scroll + triggers.
  if (hasLenis) {
    lenis.resize();
    lenis.start();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
});

barba.init({
  debug: true, // Set to 'false' in production
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: 'default',
      sync: false, // sequential: page A fully leaves (navy shows) THEN page B enters — no crossfade

      // First load
      async once(data) {
        initOnceFunctions();

        return runPageOnceAnimation(data.next.container);
      },

      // Current page leaves
      async leave(data) {
        return runPageLeaveAnimation(data.current.container, data.next.container);
      },

      // New page enters
      async enter(data) {
        // Prepare page-B (set reveal hidden-states + arm reveals) BEFORE the fade-in, so its content
        // never flashes un-animated. `enter` only runs on navigation, so this never double-runs the
        // first-load `once` path.
        initAfterEnterFunctions(data.next.container);
        return runPageEnterAnimation(data.next.container);
      },
    },
  ],
});

// -----------------------------------------
// GENERIC + HELPERS
// -----------------------------------------

const themeConfig = {
  light: {
    nav: 'dark',
    transition: 'light',
  },
  dark: {
    nav: 'light',
    transition: 'dark',
  },
};

function applyThemeFrom(container) {
  const pageTheme = container?.dataset?.pageTheme || 'light';
  const config = themeConfig[pageTheme] || themeConfig.light;

  document.body.dataset.pageTheme = pageTheme;
  const transitionEl = document.querySelector('[data-theme-transition]');
  if (transitionEl) {
    transitionEl.dataset.themeTransition = config.transition;
  }

  const nav = document.querySelector('[data-theme-nav]');
  if (nav) {
    nav.dataset.themeNav = config.nav;
  }
}

function initLenis() {
  if (lenis) return; // already created
  if (!hasLenis) return;

  lenis = new Lenis({
    lerp: 0.165,
    wheelMultiplier: 1.25,
  });

  // expose the instance so effects outside this module can drive the scroll (back-to-top)
  window.lenis = lenis;

  if (hasScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
  }

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

function resetPage(container) {
  window.scrollTo(0, 0);
  gsap.set(container, { clearProps: 'position,top,left,right' });

  if (hasLenis) {
    lenis.resize();
    lenis.start();
  }
}

function debounceOnWidthChange(fn, ms) {
  let last = innerWidth,
    timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth !== last) {
        last = innerWidth;
        fn.apply(this, args);
      }
    }, ms);
  };
}

function initBarbaNavUpdate(data) {
  var tpl = document.createElement('template');
  tpl.innerHTML = data.next.html.trim();
  var nextNodes = tpl.content.querySelectorAll('[data-barba-update]');
  var currentNodes = document.querySelectorAll('nav [data-barba-update]');

  currentNodes.forEach(function (curr, index) {
    var next = nextNodes[index];
    if (!next) return;

    // Aria-current sync
    var newStatus = next.getAttribute('aria-current');
    if (newStatus !== null) {
      curr.setAttribute('aria-current', newStatus);
    } else {
      curr.removeAttribute('aria-current');
    }

    // Class list sync
    var newClassList = next.getAttribute('class') || '';
    curr.setAttribute('class', newClassList);
  });
}

// -----------------------------------------
// YOUR FUNCTIONS GO BELOW HERE
// -----------------------------------------
// Hero visual reveal lives in ./hero.js and is wired into the registry above
// (initOnceFunctions + initAfterEnterFunctions) via [data-shapefield].
