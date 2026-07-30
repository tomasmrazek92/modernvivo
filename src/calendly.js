// -----------------------------------------
// CALENDLY INLINE EMBED — [data-calendly]
// -----------------------------------------
// Webflow side is just an empty div:
//   <div data-calendly="https://calendly.com/andres-modernvivo/info-call-with-modernvivo"></div>
// No Calendly <script> in the page — this loads it, and only on pages that actually have a mount.
//
// Why not Calendly's copy-paste snippet: widget.js auto-initialises `.calendly-inline-widget`
// elements once, at load. Under barba the script never re-runs on a page change, so navigating TO
// the booking page renders an empty div — the classic "works on refresh, broken after navigating".
// So the mount deliberately does NOT carry the `calendly-inline-widget` class (that would let
// auto-init race us and double-embed) and we call Calendly.initInlineWidget ourselves from the
// registry, on first load and after every barba enter.
//
// Attrs:
//   data-calendly            the scheduling URL (query params like hide_gdpr_banner=1,
//                            hide_event_type_details=1, primary_color=… go in the URL itself)
//   data-calendly-height     px, default 700
//   data-calendly-min-width  px, default 320 (Calendly's own floor)

const WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';

let scriptPromise = null;

// load once per session, shared by every mount; resolves immediately if the script is already there
function loadCalendly() {
  if (window.Calendly) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_SRC}"]`);
    const script = existing || document.createElement('script');

    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Calendly widget.js failed to load')));

    if (!existing) {
      script.src = WIDGET_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}

export function initCalendly(scope = document) {
  const mounts = scope.querySelectorAll('[data-calendly]');
  if (!mounts.length) return;

  loadCalendly()
    .then(() => {
      mounts.forEach((mount) => {
        const url = mount.getAttribute('data-calendly');
        // guard: barba re-init (or a double registry call) would otherwise stack a second iframe
        if (!url || mount.__calendly) return;
        // a container swapped out mid-load is detached by now — nothing to embed into
        if (!mount.isConnected) return;
        mount.__calendly = true;

        const height = parseFloat(mount.getAttribute('data-calendly-height')) || 700;
        const minWidth = parseFloat(mount.getAttribute('data-calendly-min-width')) || 320;
        mount.style.height = height + 'px';
        mount.style.minWidth = minWidth + 'px';

        window.Calendly.initInlineWidget({ url, parentElement: mount });
      });
    })
    .catch(() => {
      // never leave a dead empty box: fall back to a plain link out to the booking page
      mounts.forEach((mount) => {
        const url = mount.getAttribute('data-calendly');
        if (!url || mount.__calendly || mount.children.length) return;
        mount.__calendly = true;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Book a call';
        mount.appendChild(a);
      });
    });
}
