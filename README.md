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

### Effects & their attributes (all re-run per barba page)
| Effect | Trigger attribute | Notes |
|---|---|---|
| Hero visual + reveal | `[data-shapefield]`, `[data-hero-reveal="title"|"item"]` | see below |
| Button 056 | `[data-button-056]` + `[data-button-056-text]` | splits label into inline-block words |
| Heading reveal | `[data-reveal="lines\|words\|type"]` | lines/words slide up, `type` = typewriter. Overrides: `data-reveal-start`, `-stagger`, `-duration`, `-once="false"`, `-markers="true"` |
| Content reveal | `[data-reveal-group]` (+ `[data-reveal-group-nested]`) | per-group `data-stagger` (ms), `data-distance`, `data-start`; `data-ignore` to skip |

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

**Scripts** — before `</body>`. barba/lenis/gsap are CDN globals; three is bundled into `dist/index.js`.
```html
<link rel="stylesheet" href="https://unpkg.com/lenis@1.3.17/dist/lenis.css">
<script src="https://cdn.jsdelivr.net/npm/@barba/core@2.10.3/dist/barba.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.3.17/dist/lenis.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/CustomEase.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15/dist/SplitText.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/tomasmrazek92/modernvivo@main/dist/index.js"></script>
```

**Barba markup:** `<body data-barba="wrapper"> … <main data-barba="container"> … </main> </body>`

(Pin a tag like `@v1.0.0` instead of `@main` for a cached, stable release.)

## Hero config
Full default preset (Tom's exported values) is the `DEFAULTS` object in `src/shapefield.js`. Override per-page
on the mount div, e.g. `data-shapefield-config='{"spin":{"speed":0.6},"warp":{"amount":0.05}}'`.

Built-in production behavior: `prefers-reduced-motion` renders the resolved shape instantly; an
IntersectionObserver pauses the render loop while the hero is scrolled out of view; DPR capped at 2×.
