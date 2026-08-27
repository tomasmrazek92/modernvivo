# ModernVivo — Webflow custom code

Finsweet/esbuild starter (same setup as `asi`). `src/` bundles to `dist/index.js`, loaded in Webflow via jsDelivr.

Currently ships **one thing**: the hero visual reveal — the ShapeField swarm→shape scene + a
content reveal for the hero title/items — wired into the Osmo **Cross Fade** page-transition boilerplate.

## Structure

```
src/
  index.js       Osmo page-transition boilerplate (barba + lenis + gsap). Effects wired into the registry.
  hero.js        initHero(scope): mounts the scene on [data-shapefield] + reveals [data-hero-reveal] content.
  shapefield.js  the three.js scene — geometry + config baked in (no runtime SVG fetch). three is bundled.
  animations.js  scroll/text effects: initButton056, initSplitHeadings, initContentRevealScroll.
bin/build.js     esbuild config (bundles three; barba/lenis/gsap stay ambient CDN globals).
dist/index.js    built output → load this in Webflow.
```

**Reveal timing** — heading (`[data-reveal]`) and group (`[data-reveal-group]`) reveals fire on scroll
into view by default. Three ways to control *when*:

- **`data-reveal-after="<event>"`** — wait for a one-time document event instead of scroll. The ShapeField
  dispatches **`shapefield:resolved`** once the shapes have formed (at `resolveAt`, default 0.78 of the
  assemble ≈ ~4.3s), so `data-reveal-after="shapefield:resolved"` reveals the hero text *after* the visual.
  A safety timer reveals anyway if the event never comes.
- **`data-reveal-delay="1.5"`** — hold N **seconds** after the trigger fires, then reveal. Works with either
  trigger (scroll or event). e.g. scroll + `data-reveal-delay="0.5"` = half-second after it enters view.
- **`resolveAt`** (shapefield config) — moves when `shapefield:resolved` fires. Lower = sooner.
  `data-shapefield-config='{"resolveAt":0.6}'`.

### Effects & their attributes (all re-run per barba page)
| Effect | Trigger attribute | Notes |
|---|---|---|
| Hero visual + reveal | `[data-shapefield]`, `[data-hero-reveal="title"|"item"]` | see below |
| Button 056 | `[data-button-056]` + `[data-button-056-text]` | splits label into inline-block words |
| Heading reveal | `[data-reveal="lines\|words\|type\|spans"]` | lines/words slide up, `type` = typewriter, `spans` = reveal direct child spans in sequence (default 0.4s pause between). Trigger: scroll into view by default; **`data-reveal-start="load"` plays on page load** (above-the-fold heroes); `data-reveal-after="<event>"` waits for an event. Overrides: `data-reveal-start`, `-stagger`, `-duration`, `-delay`, `-once="false"`, `-markers="true"`. lines/words masks get a **`.reveal-mask`** class — style it in Webflow (e.g. `padding-bottom:.15em; margin-bottom:-.15em`) if descenders get clipped. |
| Content reveal | `[data-reveal-group]` (+ `[data-reveal-group-nested]`) | staggered reveal that cascades through **any depth** of nested groups (recursive). Per-group `data-stagger` (ms, nested groups can set their own), `data-distance`, `data-start`. `data-ignore="true"` skips the element **and its subtree**; `data-ignore="false"` on a nested group also reveals the wrapper itself (default: children only). `data-fade-only="true"` on the group OR any nested group = opacity-only from that level down (never touches `transform`). |
| Stacking cards | `[data-stacking-cards-item]` (+ `[data-stacking-cards-img]`) | scrub parallax — previous card drifts + its image rotates as the next scrolls up |
| Nav menu (mobile) | `[data-nav="hamburger"]` (+ `.nav`, `.nav-menu`, opt. `.nav-bg`) | click grows the **`.nav-bg`** backdrop height (falls back to `.nav` if no `.nav-bg`) to fit `.nav-menu`, then reveals the menu (reverse to close). Runs once. Menu is hidden by CSS on the hamburger breakpoints; it's measured even when `display:none`/positioned (grows by the menu's own height if it's out of flow). `.nav-bg` should be `position:absolute; inset:0` so it expands downward. On open the height is held; on close all inline props are cleared so CSS controls the resting state. Toggles `is-open` on hamburger + `.nav`, `nav-open` on `<html>`. Closes on menu-link click / Escape; width-resize resets. |
| Card border hover | `[data-card-border]` | injects an overlay; on hover all 4 edges draw at once, each clockwise from its corner (pinwheel sweep), retracts on leave. `data-card-border-color` (def currentColor), `-width` (px, def 1), `-duration` (s, def 0.4), `-radius` (def inherits card's) |
| Copy email | `[data-copy-email]` on a `mailto:` link | desktop (fine pointer): click copies the address + overlays a "Copied!" message while the label fades; touch: native mailto fires. Copy uses the Clipboard API when available and falls back to `execCommand` on non-secure/preview URLs. `data-copy-email` value = address (else parsed from href), `[data-copy-email-label]` = element to fade (else first child), `data-copy-email-text` (def "Copied!"). Feedback is opacity-only (never rewrites markup, so a `data-reveal` split inside survives): the email fades and a "Copied!" overlay **types in** char-by-char, using the label's own tag + classes (inherits `h4` etc.) plus `copy-email-tip`; `is-copied` on the link. Gated on `document` so it works in the footer/nav (persistent regions outside the barba container). |
| Dot map | `[data-dotmap]` wrapper around any inline `<svg>` | hero-style **assemble** that works with **any** shape and hands off **seamlessly**. The SVG is rasterized once, then cut into **pixel-slices** — one slice per element (`getBBox` per subpath; solid regions sliced on a grid). The slices **fly in from all directions** and land, retiling the exact rendered image — so the final canvas frame IS the artwork (no morph/pop, because we move real pixels, never guessed shapes). We **keep that canvas as the resting state** — no swap to the SVG (that raster→vector swap was the only thing that could visibly "jump"). No rAF runs once settled; it hands off to the crisp, responsive vector SVG only if the width later changes. **Cheap enough for 10+ per page** — slicing happens **lazily on scroll-in** (shared scroll listener, robust to throttled tabs), animates canvas-2D via **one GSAP tween** (no per-instance rAF); piece count capped (~2600). Attrs: `data-dotmap-order` (`radial` def / `random` / `scan`), `-duration` (s, def 1.8), `-window` (0–1 stagger, def .5), `-spread` (fly-in distance frac, def .35), `-ease` (`power3.out` def / `power2.out` / `back.out`), `-density` (solid-slice density, def 1), `-opaque` (`true` forces full opacity if the SVG has a faded `opacity<1` group — reveal is faithful to the source by default). `prefers-reduced-motion` → SVG shown instantly. `.__dotmap.replay()` re-runs it. |
| CSS marquee (Osmo) | `[data-css-marquee]` (+ `[data-css-marquee-list]` inside) | JS duplicates the list, sets `animation-duration` from its width for constant `data-css-marquee-speed` px/s (def 75), and pauses it offscreen. **The scroll animation itself is CSS you add in Webflow** (keyframe translating the list `-100%`); see the required CSS below. Gated on `document` (works in the footer). |
| Global parallax (Osmo) | `[data-parallax="trigger"]` (+ optional `[data-parallax="target"]` child) | one flexible ScrollTrigger tween. Overrides: `data-parallax-direction="horizontal"`, `-scrub` (`true` or seconds), `-start`/`-end` (% , def 20/-20), `-scroll-start`/`-scroll-end` (def `top bottom`/`bottom top`), `-disable="mobile\|mobileLandscape\|tablet"`. Image-in-mask: overflow-hidden trigger + taller (120%) `target` wrapper holding the image. |

## Build

```bash
pnpm install
pnpm build      # → dist/index.js  (pnpm dev for watch + localhost:3000)
```

## Webflow setup

**Custom attributes** (Designer → element settings):
| Element | Attribute | Value |
|---|---|---|
| Hero mount div | `data-shapefield` | *(empty)* — optional `data-shapefield-config` = JSON overrides |
| Hero `H1` | `data-hero-reveal` | `title` |
| Body / buttons / banner | `data-hero-reveal` | `item` |

**CSS** (embed in Head, or Webflow classes):
```css
.section-hero { position: relative; overflow: hidden; }
.section-hero .hero-content { position: relative; z-index: 2; }
[data-shapefield] { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
[data-shapefield] canvas { width: 100% !important; height: 100% !important; display: block; }
```

**Scripts** — before `</body>`. barba/lenis/gsap/matter are CDN globals; three is bundled into `dist/index.js`.
matter.js is only needed on pages that use `[data-dotfield]` (the physics dot visual).
```html
<link rel="stylesheet" href="https://unpkg.com/lenis@1.3.17/dist/lenis.css">
<script src="https://cdn.jsdelivr.net/npm/@barba/core@2.10.3/dist/barba.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.3.17/dist/lenis.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/CustomEase.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/SplitText.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/tomasmrazek92/modernvivo@main/dist/index.js"></script>
```

**Barba markup:** `<body data-barba="wrapper"> … <main data-barba="container"> … </main> </body>`

(Pin a tag like `@v1.0.0` instead of `@main` for a cached, stable release.)

## Marketplace search dropdown — styling

`src/marketplace-search.js` injects its own defaults sheet as the FIRST thing in `<head>`, so anything
you write in the Webflow head embed overrides it at equal specificity. The dropdown therefore looks
right with no CSS in Webflow at all — the embed is only for retheming.

### DOM the JS builds (inside the input's wrap, `position:absolute`)

```html
<div data-search-suggest-panel data-search-suggest-state="open" data-search-suggest-dir="down">
  <div data-search-suggest-list>
    <div data-search-suggest-option data-search-suggest-index="0">Bladder <mark>Cancer</mark></div>
    <p data-search-suggest-note>No matching terms</p>      <!-- only when the list is empty -->
  </div>
  <div data-search-suggest-ai><svg/><span>Search with AI</span><em>"cancer"</em></div>
</div>
```

The panel is appended into the field's own parent (stamped `data-search-suggest-anchor`, which gets
`position:relative`), so it scrolls with the page — no JS geometry, and immune to the mobile URL bar
resizing the viewport mid-scroll. `data-search-suggest-active` marks the keyboard-highlighted row.
`data-search-suggest-dir` is `up` only inside the docked bar, `down` everywhere else.

### The 90% case — retheme from one block

```css
[data-search-suggest-panel] {
  --suggest-bg: #fffff2;        /* panel background */
  --suggest-border: #c6c6a2;    /* outer border + the AI row's top rule */
  --suggest-text: #242228;      /* row text */
  --suggest-hover: #f4f4d0;     /* hover + keyboard-active row */
  --suggest-mark: #fffbae;      /* the matched substring */
  --suggest-muted: #a0a083;     /* "No matching terms" + the quoted query */
  --suggest-ai: #8d04fd;        /* "Search with AI" label + icon */
  --suggest-pad: 0.75em 1.25em; /* row padding */
  --suggest-radius: 0px;
  --suggest-gap: 8px;           /* distance from the input (JS reads this) */
}
```

Motion tokens on the same element: `--dropdown-open-dur` (250ms), `--dropdown-close-dur` (150ms),
`--dropdown-pre-scale` (.97), `--dropdown-closing-scale` (.99), `--dropdown-ease`.

### Do not override

The panel's `position: absolute` + `left/right: 0`, its `display: flex` + `flex-direction: column`, the
`top/bottom: calc(100% + var(--suggest-gap))` pair, and the list's `overflow-y: auto` + `min-height: 0`
are the mechanism, not decoration — the column flex is what keeps the AI row pinned while the list
scrolls. `max-height` uses `vh` deliberately, NOT `dvh`: `dvh` changes as the mobile URL bar collapses
and would resize the panel mid-scroll. Restyle colour, type, padding, radius, shadow freely.

### Full defaults sheet (what the JS injects)

```css
[data-search-suggest-anchor] { position: relative; }

[data-search-suggest-panel] {
  --suggest-bg: var(--white, #fffff2);
  --suggest-border: var(--dark-grey-yellow, #c6c6a2);
  --suggest-text: var(--almost-black, #242228);
  --suggest-hover: var(--grey-yellow, #f4f4d0);
  --suggest-mark: var(--yellow-light, #fffbae);
  --suggest-muted: var(--darker-grey-yellow, #a0a083);
  --suggest-ai: var(--purple, #8d04fd);
  --suggest-pad: 0.75em 1.25em;
  --suggest-radius: 0px;
  --suggest-gap: 8px;
  --dropdown-open-dur: 250ms;
  --dropdown-close-dur: 150ms;
  --dropdown-pre-scale: 0.97;
  --dropdown-closing-scale: 0.99;
  --dropdown-ease: cubic-bezier(0.22, 1, 0.36, 1);
  position: absolute;
  left: 0;
  right: 0;
  z-index: 900;
  /* vh, not dvh: the mobile URL bar collapsing must not resize the panel mid-scroll */
  max-height: min(24em, 45vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--suggest-border);
  border-radius: var(--suggest-radius);
  background-color: var(--suggest-bg);
  color: var(--suggest-text);
  font-family: "DM Mono", Arial, sans-serif;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: -0.02em;
  text-align: left;
  box-shadow: 0 1.5em 2.5em -1.5em rgba(23, 0, 63, 0.35);
  transform: scale(var(--dropdown-pre-scale));
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--dropdown-open-dur) var(--dropdown-ease),
    opacity   var(--dropdown-open-dur) var(--dropdown-ease);
  will-change: transform, opacity;
}
[data-search-suggest-panel][data-search-suggest-dir="down"] {
  top: calc(100% + var(--suggest-gap));
  transform-origin: top center;
}
[data-search-suggest-panel][data-search-suggest-dir="up"] {
  bottom: calc(100% + var(--suggest-gap));
  transform-origin: bottom center;
}
[data-search-suggest-panel][data-search-suggest-state="open"] {
  transform: scale(1);
  opacity: 1;
  pointer-events: auto;
}
[data-search-suggest-panel][data-search-suggest-state="closing"] {
  transform: scale(var(--dropdown-closing-scale));
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--dropdown-close-dur) var(--dropdown-ease),
    opacity   var(--dropdown-close-dur) var(--dropdown-ease);
}

[data-search-suggest-list] {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

[data-search-suggest-option],
[data-search-suggest-ai],
[data-search-suggest-note] {
  margin: 0;
  padding: var(--suggest-pad);
  font-size: 1em;
  transition: background-color .2s cubic-bezier(.215, .61, .355, 1);
}
/* block, not flex: the match highlight is an inline <mark> inside the label and flex would make
   every text node its own item, breaking the term across gaps mid-word */
[data-search-suggest-option],
[data-search-suggest-note] {
  display: block;
  overflow-wrap: break-word;
}
[data-search-suggest-option] { cursor: pointer; }
[data-search-suggest-option][data-search-suggest-active],
[data-search-suggest-option]:hover {
  background-color: var(--suggest-hover);
}
[data-search-suggest-option] mark {
  background-color: var(--suggest-mark);
  color: inherit;
}
[data-search-suggest-note] {
  color: var(--suggest-muted);
  cursor: default;
}

[data-search-suggest-ai] {
  display: flex;
  align-items: center;
  gap: 0.75em;
  flex: 0 0 auto;
  cursor: pointer;
  border-top: 1px solid var(--suggest-border);
  background-color: var(--suggest-bg);
  color: var(--suggest-ai);
}
[data-search-suggest-ai][data-search-suggest-active],
[data-search-suggest-ai]:hover {
  background-color: var(--suggest-hover);
}
[data-search-suggest-ai] svg { flex: 0 0 auto; width: 1em; height: 1em; }
[data-search-suggest-ai] em {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--suggest-muted);
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  [data-search-suggest-panel] { transition: none !important; }
}
```

## Hero config
Full default preset (Tom's exported values) is the `DEFAULTS` object in `src/shapefield.js`. Override per-page
on the mount div, e.g. `data-shapefield-config='{"spin":{"speed":0.6},"warp":{"amount":0.05}}'`.

### Sizing the resolved shape to a div
The cloud **reveal is always full-screen**; only the morphed-together **end state** is scaled. Point it at any
element on the page and the resolved shape sizes itself to that element's on-screen box (recomputed on resize +
after webfonts load):
```html
<div data-shapefield data-shapefield-target=".hero-logo-size"></div>
```
- `data-shapefield-target` — the reference element (an empty sizing box works great — it never needs to be
  visible, just laid out at the size you want the logo to end at). Accepts a CSS selector (`.hp-hero-bg-shape`,
  `#foo`) **or a bare class/id name** (`hp-hero-bg-shape` → resolved as `.hp-hero-bg-shape`, then `#…`).
- `data-shapefield-final-fit` — `contain` (default, fits the whole shape inside the box) · `width` · `height` · `cover`.
- `data-shapefield-center` — the resolved shape also **moves to the target div's center** (default). Set `"false"`
  to keep it centered on the mount and only size it. The offset tracks the div, so if the div is off-center in the
  hero the shape resolves there; recomputed on resize.
- No target? Set a plain multiplier instead: `data-shapefield-config='{"finalScale":0.6}'` (0.6 = 60% of the
  natural full-screen size). `finalScale` also multiplies on top of a target fit if you set both.

The cloud reveal always blooms full-screen and centered on the mount; only the **resolved** end-state is scaled +
repositioned onto the target div.

Built-in production behavior: `prefers-reduced-motion` renders the resolved shape instantly; an
IntersectionObserver pauses the render loop while the hero is scrolled out of view; DPR capped at 2×.
