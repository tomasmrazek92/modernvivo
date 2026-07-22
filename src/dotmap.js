/*! DotMap — artwork reveal by flying in real pixel-slices of the rendered SVG (canvas 2D, NOT WebGL)
 *
 *  Hero-style "particles swarm in and assemble into the shape". To make the end SEAMLESS (no morph/pop
 *  when it hands off to the SVG), the particles are NOT drawn as guessed shapes — each particle is an
 *  actual pixel-slice of the rasterized SVG (one slice per element, measured with getBBox; solid regions
 *  are sliced on a grid). They fly in from all directions and land in place, reconstructing the exact
 *  rendered image. Works with any shape (circles, rects, bars, solid outlines, clip-paths, opacity
 *  groups, any aspect ratio).
 *
 *  The final canvas frame IS the artwork, so we DON'T swap to the SVG (that raster→vector swap is the
 *  only thing that could visibly "jump") — the canvas stays as the resting state. It only hands off to
 *  the crisp, responsive SVG if the width later changes. No rAF runs once settled.
 *  Lazy per instance (shared scroll listener) + one GSAP tween each → fine for 10+ per page.
 *
 *  Markup:  <div data-dotmap> …inline <svg>…</svg> </div>
 *  Attributes (all optional, on the [data-dotmap] wrapper):
 *   data-dotmap-duration   seconds (def 1.8)
 *   data-dotmap-order      radial (def) | random | scan   — which pieces settle first
 *   data-dotmap-window     0..1 stagger window (def 0.5)   — smaller = tighter/snappier cascade
 *   data-dotmap-spread     how far pieces fly in from, as a fraction of the artwork (def 0.35)
 *   data-dotmap-ease       power3.out (def) | power2.out | back.out
 *   data-dotmap-density    slice density for solid shapes (def 1) — higher = finer
 *   data-dotmap-opaque     "true" forces full opacity if the SVG has a faded (opacity<1) group
 */

const NS = 'http://www.w3.org/2000/svg';
const frac = (n) => { const h = Math.sin(n * 78.233) * 43758.5453; return h - Math.floor(h); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EASE = {
  'power2.out': (x) => 1 - (1 - x) * (1 - x),
  'power3.out': (x) => 1 - Math.pow(1 - x, 3),
  'back.out': (x) => { const c1 = 1.70158, c3 = c1 + 1, m = x - 1; return 1 + c3 * m * m * m + c1 * m * m; },
};
const MAX_PIECES = 2600; // safety cap; thinned uniformly above this

// Shared scroll-reveal registry — one scroll/resize listener drives every DotMap. More robust than a
// per-instance IntersectionObserver (which some throttled/background tabs never deliver): each map
// reveals when it enters view and can never get stuck hidden.
const _pending = new Set();
const _done = new Set(); // finished maps still showing their (fixed-size) canvas
let _rafPending = 0;
let _listening = false;
let _lastW = typeof window !== 'undefined' ? window.innerWidth : 0;
function _checkPending() {
  _rafPending = 0;
  _pending.forEach((dm) => { if (dm._inView()) { _pending.delete(dm); dm._start(); } });
}
function _scheduleCheck() { if (!_rafPending) _rafPending = requestAnimationFrame(_checkPending); }
function _onResize() {
  // width-only (mobile scroll fires height-only resizes — ignore): a real width change means the
  // finished maps' fixed-size canvases no longer fit the layout → hand them to the responsive SVG.
  if (window.innerWidth !== _lastW) {
    _lastW = window.innerWidth;
    _done.forEach((dm) => dm._toSvg());
  }
  _scheduleCheck();
}
function _ensureListening() {
  if (_listening) return;
  _listening = true;
  addEventListener('scroll', _scheduleCheck, { passive: true });
  addEventListener('resize', _onResize);
}

class DotMap {
  constructor(host) {
    this.host = host;
    this.svg = host.matches('svg') ? host : host.querySelector('svg');
    if (!this.svg) return;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduced) return; // leave the SVG as-is (instant, no canvas)

    const g = (k, d) => host.getAttribute('data-dotmap-' + k) ?? d;
    this.duration = parseFloat(g('duration', 1.8)) || 1.8;
    this.order = g('order', 'radial');
    this.window = Math.min(0.95, Math.max(0.05, parseFloat(g('window', 0.5)) || 0.5));
    this.spread = parseFloat(g('spread', 0.35)) || 0.35;
    this.ease = EASE[g('ease', 'power3.out')] || EASE['power3.out'];
    this.density = Math.min(3, Math.max(0.3, parseFloat(g('density', 1)) || 1));

    // Faithful by default: if the SVG has a group with e.g. opacity="0.6", the reveal ends at 0.6 too.
    // data-dotmap-opaque="true" forces full opacity — normalize the live SVG so the reveal AND the
    // resize-handoff both render solid (not just the canvas).
    if (g('opaque', 'false') === 'true') {
      this.svg.querySelectorAll('[opacity]').forEach((el) => el.setAttribute('opacity', '1'));
      this.svg.style.opacity = '';
    }

    gsap.set(this.svg, { autoAlpha: 0 }); // hide the static art until the reveal runs (no flash)
    _ensureListening();
    _pending.add(this);
    if (this._inView()) { _pending.delete(this); this._start(); }
  }

  _inView() {
    const r = this.host.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.width > 0 && r.bottom > 0 && r.top < vh * 0.9; // ~10% into view from the bottom
  }

  // rasterize a clean clone of the SVG to an offscreen canvas at the given pixel size (the piece slices
  // are cut from this, so it must match the display resolution for crispness)
  async _raster(rw, rh) {
    const clone = this.svg.cloneNode(true);
    clone.removeAttribute('style'); // drop the autoAlpha:0 we set, so it renders
    clone.setAttribute('width', rw); clone.setAttribute('height', rh);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', NS);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const off = document.createElement('canvas');
    off.width = rw; off.height = rh;
    off.getContext('2d').drawImage(img, 0, 0, rw, rh);
    return off;
  }

  // Cut the rendered SVG into pieces. Each element (subpath, via getBBox) → one pixel-slice; a subpath
  // too big to be a "dot" (a solid region) is sliced on a grid. Each piece stores its source rect in the
  // raster and its dest box in CSS px — at rest the dest boxes exactly retile the image.
  async _slice() {
    const { cw, ch } = this.map, dpr = this.dpr;
    const rw = Math.max(1, Math.round(cw * dpr)), rh = Math.max(1, Math.round(ch * dpr));
    this.raster = await this._raster(rw, rh);
    const svg = this.svg;
    const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width
      ? svg.viewBox.baseVal
      : { x: 0, y: 0, width: parseFloat(svg.getAttribute('width')) || cw, height: parseFloat(svg.getAttribute('height')) || ch };
    const kx = cw / vb.width, ky = ch / vb.height, vbx = vb.x || 0, vby = vb.y || 0; // viewBox → CSS px

    const piece = (bx, by, bw, bh) => ({
      sx: bx * dpr, sy: by * dpr, sw: bw * dpr, sh: bh * dpr, // source rect in raster px
      dw: bw, dh: bh, cx: bx + bw / 2, cy: by + bh / 2,       // dest size + centre in CSS px
      nx: (bx + bw / 2) / cw, ny: (by + bh / 2) / ch,         // normalized centre (order + offset)
    });

    const pieces = [];
    const solids = [];
    const LIMIT = Math.max(cw, ch) * 0.06; // above this (CSS px) a subpath is a solid region, not a dot
    const tmp = document.createElementNS(NS, 'path');
    svg.appendChild(tmp);
    svg.querySelectorAll('path').forEach((p) => {
      const d = p.getAttribute('d') || '';
      (d.match(/M[^M]*/g) || []).forEach((sd) => {
        tmp.setAttribute('d', sd);
        let b; try { b = tmp.getBBox(); } catch (e) { return; }
        if (b.width < 0.01 || b.height < 0.01) return;
        const bx = (b.x - vbx) * kx, by = (b.y - vby) * ky, bw = b.width * kx, bh = b.height * ky;
        if (Math.max(bw, bh) <= LIMIT) pieces.push(piece(bx, by, bw, bh));
        else solids.push({ bx, by, bw, bh });
      });
    });
    svg.removeChild(tmp);

    // solid regions → grid-slice, culling empty cells against the raster's alpha
    if (solids.length) {
      const data = this.raster.getContext('2d').getImageData(0, 0, rw, rh).data;
      const step = Math.max(4, Math.round(Math.max(cw, ch) / (46 * this.density))); // CSS px cell
      solids.forEach((bb) => {
        for (let y = bb.by; y < bb.by + bb.bh; y += step) {
          for (let x = bb.bx; x < bb.bx + bb.bw; x += step) {
            const rx = Math.min(rw - 1, Math.max(0, Math.round((x + step / 2) * dpr)));
            const ry = Math.min(rh - 1, Math.max(0, Math.round((y + step / 2) * dpr)));
            if (data[(ry * rw + rx) * 4 + 3] > 60) pieces.push(piece(x, y, step, step));
          }
        }
      });
    }

    if (pieces.length > MAX_PIECES) {
      const keep = [], stepK = pieces.length / MAX_PIECES;
      for (let k = 0; k < pieces.length; k += stepK) keep.push(pieces[Math.floor(k)]);
      this.pieces = keep;
    } else {
      this.pieces = pieces;
    }
  }

  _prep() {
    const parts = this.pieces;
    let cxn = 0, cyn = 0;
    parts.forEach((p) => { cxn += p.nx; cyn += p.ny; });
    cxn /= parts.length; cyn /= parts.length;
    let maxR = 1e-4;
    parts.forEach((p) => { maxR = Math.max(maxR, Math.hypot(p.nx - cxn, p.ny - cyn)); });
    parts.forEach((p, i) => {
      let ord;
      if (this.order === 'random') ord = frac(i * 1.37 + 1);
      else if (this.order === 'scan') ord = p.ny;
      else ord = Math.hypot(p.nx - cxn, p.ny - cyn) / maxR; // radial (default) — blooms from the centre
      p.ord = Math.min(1, Math.max(0, ord));
      const a = frac(i * 7.13 + 3) * Math.PI * 2; // random direction
      const mag = this.spread * (0.4 + 0.6 * frac(i * 3.7 + 5)); // varied distance → "all directions"
      p.ox = Math.cos(a) * mag; p.oy = Math.sin(a) * mag;
    });
  }

  _build() {
    const hostRect = this.host.getBoundingClientRect();
    const sRect = this.svg.getBoundingClientRect();
    const cw = sRect.width, ch = sRect.height;
    this.map = { cw, ch };
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    const cvs = document.createElement('canvas');
    cvs.width = Math.round(cw * this.dpr); cvs.height = Math.round(ch * this.dpr);
    cvs.style.cssText = `position:absolute;left:${sRect.left - hostRect.left}px;top:${sRect.top - hostRect.top}px;width:${cw}px;height:${ch}px;pointer-events:none;`;
    if (getComputedStyle(this.host).position === 'static') this.host.style.position = 'relative';
    this.host.appendChild(cvs);
    this.cvs = cvs; this.ctx = cvs.getContext('2d'); this.ctx.scale(this.dpr, this.dpr);
  }

  _draw(p) {
    const { ctx, map, pieces, raster, window: win } = this;
    ctx.clearRect(0, 0, map.cw, map.ch);
    for (const pt of pieces) {
      const raw = (p - pt.ord * (1 - win)) / win;
      if (raw <= 0) continue;
      const dp = raw >= 1 ? 1 : this.ease(raw);
      const inv = 1 - dp;
      const dw = pt.dw * dp, dh = pt.dh * dp;
      const dcx = pt.cx + pt.ox * map.cw * inv;
      const dcy = pt.cy + pt.oy * map.ch * inv;
      ctx.globalAlpha = dp < 1 ? dp : 1;
      // draw the element's real pixels from the raster → at rest this retiles the exact image
      ctx.drawImage(raster, pt.sx, pt.sy, pt.sw, pt.sh, dcx - dw / 2, dcy - dh / 2, dw, dh);
    }
    ctx.globalAlpha = 1;
  }

  _start() {
    if (this._running) return;
    this._running = true;
    _pending.delete(this); _done.delete(this);
    this._build();
    this._slice()
      .then(() => {
        if (!this.pieces || !this.pieces.length) { this._showSvg(); return; }
        this._prep();
        this._draw(0);
        const st = { p: 0 };
        this._tween = gsap.to(st, {
          p: 1, duration: this.duration, ease: 'none',
          onUpdate: () => this._draw(st.p),
          onComplete: () => this._finish(),
        });
      })
      .catch(() => this._showSvg()); // rasterize failed → just show the SVG
  }

  _showSvg() {
    gsap.set(this.svg, { autoAlpha: 1 });
    if (this.cvs) { this.cvs.remove(); this.cvs = null; this.ctx = null; }
    this.raster = null;
  }

  // The final canvas frame already IS the rendered artwork (real pixels retiled), so we DON'T swap to
  // the SVG — that raster→vector swap is the only thing that could "jump". Keep the canvas as the
  // resting state (free the source raster). It only hands off to the responsive SVG if the width later
  // changes (see _toSvg), which the user isn't watching → no visible jump.
  _finish() {
    this.raster = null; // source raster no longer needed; the display canvas holds the final image
    _done.add(this);
  }

  // hand the finished map off to the crisp, responsive vector SVG (used on width-resize)
  _toSvg() {
    _done.delete(this);
    gsap.set(this.svg, { autoAlpha: 1 });
    if (this.cvs) { this.cvs.remove(); this.cvs = null; this.ctx = null; }
  }

  replay() {
    if (this.reduced || !this.svg) return;
    this._tween && this._tween.kill();
    if (this.cvs) { this.cvs.remove(); this.cvs = null; this.ctx = null; }
    this.raster = null; _done.delete(this);
    this._running = false;
    gsap.set(this.svg, { autoAlpha: 0 });
    this._start();
  }

  destroy() {
    _pending.delete(this); _done.delete(this);
    this._tween && this._tween.kill();
    if (this.cvs) this.cvs.remove();
    this.raster = null;
    if (this.svg) gsap.set(this.svg, { clearProps: 'opacity,visibility' });
  }
}

export { DotMap };
export default DotMap;
