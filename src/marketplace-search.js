// -----------------------------------------
// MARKETPLACE SEARCH — live suggestions dropdown + app handoff
// -----------------------------------------
// Typing in the marketplace search hits the app's suggestions endpoint (debounced) and drops a
// dropdown under the input: the returned terms, scrollable, with a "Search with AI" row pinned to
// the bottom that never scrolls away. Picking a term hands off to the app by suggestion id; the AI
// row (and the "Find vendors" button, via initSearchAction) hands off with the raw query.
//
// Attrs on [data-search-wrapper]:
//   data-search-suggest-url    suggestions endpoint; absent = no dropdown, search still works
//   data-search-handoff        app handoff base URL, e.g. https://beta.app.modernvivo.com/marketplace-handoff
//   data-search-suggest-limit  page size (def 20) — one page only, the API's offset is never used
//   data-search-suggest-delay  debounce ms (def 200)
//   data-search-ai-label       text of the pinned row (def "Search with AI")
//   data-search-target         "_blank" to hand off in a new tab (def same tab) — shared with initSearchAction
//
// ONE panel, fixed-positioned on <body> and anchored to whichever field is being typed in. That is
// what makes the docked copy work for free: the dock clones the <form>, so anything living inside
// it would be cloned as stale DOM, and anything living inside the input's own box would be clipped.
// Closed means REMOVED FROM THE DOM, not display:none — nothing here depends on CSS added in
// Webflow, which is how the dock clone ended up visible at the bottom of every page once already.
//
// All the listeners are delegated on document: the dock clone and any CMS re-render are covered
// without a rebind, exactly like initSearchSuggestions.

const FIELD_SEL = 'input:not([type="submit"]):not([type="hidden"]), textarea';
const PANEL_SEL = '[data-search-suggest-panel]';

let bound = false;
let panel = null; // the open panel, or null when closed
let list = null;
let anchor = null; // the field the panel belongs to
let items = [];
let activeIndex = -1; // -1 = nothing active, items.length = the AI row
let query = '';
let config = null;

let debounceTimer = null;
let closeTimer = null;
let blurTimer = null;
let controller = null; // in-flight fetch
let requestSeq = 0;
let frame = 0;

// ---- config -------------------------------------------------------------------------------------

// Number(null) is 0, so a missing attribute read as a number silently becomes a real value.
function attrNum(el, name, fallback) {
  if (!el || !el.hasAttribute(name)) return fallback;
  const n = parseFloat(el.getAttribute(name));
  return Number.isFinite(n) ? n : fallback;
}

// The dock clone is a copy of the <form> from INSIDE the wrapper, so it carries no
// [data-search-wrapper] of its own — fall back to the page's real one for config.
function wrapperFor(field) {
  return field.closest('[data-search-wrapper]') || document.querySelector('[data-search-wrapper]');
}

function readConfig(field) {
  const wrapper = wrapperFor(field);
  return {
    wrapper,
    url: wrapper?.getAttribute('data-search-suggest-url') || '',
    limit: attrNum(wrapper, 'data-search-suggest-limit', 20),
    delay: attrNum(wrapper, 'data-search-suggest-delay', 200),
    aiLabel: wrapper?.getAttribute('data-search-ai-label') || 'Search with AI',
    target: wrapper?.getAttribute('data-search-target') || '',
  };
}

// ---- handoff URLs -------------------------------------------------------------------------------

// The app reads type/query/suggestionId out of the FRAGMENT, not the query string, so the params go
// through URLSearchParams and land on url.hash. Exported because initSearchAction's "Find vendors"
// button has to produce the identical prompt URL — one definition, two callers.
export function searchHandoffURL(wrapper, params) {
  const base = wrapper?.getAttribute('data-search-handoff');
  if (!base) return null;

  let url;
  try {
    url = new URL(base, window.location.href);
  } catch (err) {
    console.warn('[search] data-search-handoff is not a valid URL:', base);
    return null;
  }

  const hash = new URLSearchParams();
  Object.keys(params).forEach((key) => hash.set(key, params[key]));
  url.hash = hash.toString();
  return url.toString();
}

function navigate(href, target) {
  if (!href) return;
  if (target === '_blank') window.open(href, '_blank', 'noopener');
  else window.location.href = href;
}

// ---- styles -------------------------------------------------------------------------------------
// Themed off the site's own variables with the published values as fallbacks, so the dropdown is
// correct even if it renders before/outside the Webflow stylesheet. Font size is not set here — it
// is copied from the anchor field at open time, so a row reads at the size you typed at any
// breakpoint. Motion values are the transitions.dev dropdown tokens, scoped to the panel rather
// than to a second :root block.

function injectCSS() {
  if (document.getElementById('search-suggest-css')) return;
  const style = document.createElement('style');
  style.id = 'search-suggest-css';
  style.textContent = `
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
  position: fixed;
  z-index: 9999;
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
  transform-origin: top center;
  transform: scale(var(--dropdown-pre-scale));
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--dropdown-open-dur) var(--dropdown-ease),
    opacity   var(--dropdown-open-dur) var(--dropdown-ease);
  will-change: transform, opacity;
}
[data-search-suggest-panel][data-search-suggest-dir="up"] { transform-origin: bottom center; }
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
`;
  // FIRST in <head>, not last: this is a defaults sheet, so anything written in Webflow has to be
  // able to beat it at equal specificity.
  document.head.insertBefore(style, document.head.firstChild);
}

// ---- panel --------------------------------------------------------------------------------------

const AI_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z"/>' +
  '<path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"/>' +
  '</svg>';

function buildPanel() {
  injectCSS();
  document.querySelectorAll(PANEL_SEL).forEach((el) => el.remove()); // belt: never stack two

  panel = document.createElement('div');
  panel.setAttribute('data-search-suggest-panel', '');
  panel.setAttribute('data-search-suggest-state', 'closed');
  panel.setAttribute('data-search-suggest-dir', 'down');
  panel.id = 'search-suggest-panel';
  panel.setAttribute('role', 'listbox');

  list = document.createElement('div');
  list.setAttribute('data-search-suggest-list', '');
  // Lenis owns the wheel globally; without this the inner list can't be scrolled at all.
  list.setAttribute('data-lenis-prevent', '');
  panel.appendChild(list);

  // Pointer-down inside the panel must not blur the field, or the blur closes the panel and the
  // click lands on nothing.
  panel.addEventListener('mousedown', (e) => e.preventDefault());

  document.body.appendChild(panel);
}

// Wrap the matched substring so it reads like the app's list. Built from text nodes, never
// innerHTML — the query is raw user input.
function highlight(text, needle) {
  const frag = document.createDocumentFragment();
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) {
    frag.appendChild(document.createTextNode(text));
    return frag;
  }
  frag.appendChild(document.createTextNode(text.slice(0, i)));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(i, i + needle.length);
  frag.appendChild(mark);
  frag.appendChild(document.createTextNode(text.slice(i + needle.length)));
  return frag;
}

function render(state) {
  if (!panel) return;

  list.textContent = '';

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.setAttribute('data-search-suggest-option', '');
    row.setAttribute('data-search-suggest-index', String(i));
    row.setAttribute('role', 'option');
    row.id = `search-suggest-option-${i}`;
    row.appendChild(highlight(item.displayText, query));
    list.appendChild(row);
  });

  if (!items.length) {
    const note = document.createElement('p');
    note.setAttribute('data-search-suggest-note', '');
    note.textContent =
      state === 'loading' ? 'Searching...' : state === 'error' ? 'Suggestions unavailable' : 'No matching terms';
    list.appendChild(note);
  }

  let ai = panel.querySelector('[data-search-suggest-ai]');
  if (!ai) {
    ai = document.createElement('div');
    ai.setAttribute('data-search-suggest-ai', '');
    ai.setAttribute('role', 'option');
    ai.id = 'search-suggest-option-ai';
    panel.appendChild(ai);
  }
  ai.innerHTML = `${AI_ICON}<span></span><em></em>`;
  ai.querySelector('span').textContent = config.aiLabel;
  ai.querySelector('em').textContent = query ? `"${query}"` : '';

  paintActive();
  place();
}

function paintActive() {
  if (!panel) return;
  const rows = panel.querySelectorAll('[data-search-suggest-option], [data-search-suggest-ai]');
  rows.forEach((row) => row.removeAttribute('data-search-suggest-active'));

  const active =
    activeIndex < 0
      ? null
      : activeIndex >= items.length
        ? panel.querySelector('[data-search-suggest-ai]')
        : panel.querySelector(`[data-search-suggest-index="${activeIndex}"]`);

  if (active) {
    active.setAttribute('data-search-suggest-active', '');
    revealOption(active);
  }
  anchor?.setAttribute('aria-activedescendant', active ? active.id : '');
}

// scrollIntoView would also scroll the page (and fight Lenis) — move the list's own scrollTop.
function revealOption(el) {
  if (el.parentElement !== list) return;
  const top = el.offsetTop;
  const bottom = top + el.offsetHeight;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

// Anchored to the field's live box every frame while open: Lenis scroll, the dock sliding up and a
// resize all move it, and a fixed panel would otherwise drift off the input.
function place() {
  if (!panel || !anchor) return;
  if (!anchor.isConnected) return close();

  const r = anchor.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return close(); // the field scrolled away

  const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--suggest-gap')) || 8;
  const edge = 16; // never let the panel sit flush against the viewport edge
  const below = window.innerHeight - r.bottom - gap - edge;
  const above = r.top - gap - edge;
  const up = below < 180 && above > below; // docked at the bottom of the screen: open upwards

  panel.setAttribute('data-search-suggest-dir', up ? 'up' : 'down');
  panel.style.left = `${Math.round(r.left)}px`;
  panel.style.width = `${Math.round(r.width)}px`;
  if (up) {
    panel.style.top = 'auto';
    panel.style.bottom = `${Math.round(window.innerHeight - r.top + gap)}px`;
  } else {
    panel.style.bottom = 'auto';
    panel.style.top = `${Math.round(r.bottom + gap)}px`;
  }

  const fontPx = parseFloat(getComputedStyle(anchor).fontSize) || 14;
  panel.style.fontSize = `${fontPx}px`;
  panel.style.maxHeight = `${Math.max(fontPx * 6, Math.min(up ? above : below, fontPx * 24))}px`;
}

function tick() {
  if (!panel) return;
  place();
  frame = requestAnimationFrame(tick);
}

function open(field) {
  if (anchor && anchor !== field) close(true);

  if (!panel) {
    clearTimeout(closeTimer);
    // Clearing a leftover's removal timer without adopting the node leaves it in the DOM forever —
    // one invisible panel per clear-and-retype, each still positioned where it was. Revive it.
    const leftover = document.querySelector(PANEL_SEL);
    if (leftover) {
      panel = leftover;
      list = panel.querySelector('[data-search-suggest-list]');
    } else {
      buildPanel();
    }
  }

  anchor = field;
  anchor.setAttribute('role', 'combobox');
  anchor.setAttribute('aria-autocomplete', 'list');
  anchor.setAttribute('aria-controls', panel.id);
  anchor.setAttribute('aria-expanded', 'true');

  panel.setAttribute('data-search-suggest-state', 'open');
  if (!frame) frame = requestAnimationFrame(tick);
}

// `now` skips the close transition — used when the page is leaving or the anchor is gone, where an
// animating leftover would be the only thing on screen.
function close(now) {
  clearTimeout(debounceTimer);
  clearTimeout(blurTimer);
  controller?.abort();
  controller = null;
  requestSeq++;
  cancelAnimationFrame(frame);
  frame = 0;

  items = [];
  activeIndex = -1;

  if (anchor) {
    ['role', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-activedescendant'].forEach(
      (a) => anchor.removeAttribute(a)
    );
    anchor = null;
  }

  if (!panel) return;
  const dying = panel;
  panel = null;
  list = null;

  if (now) {
    dying.remove();
    return;
  }

  dying.setAttribute('data-search-suggest-state', 'closing');
  closeTimer = setTimeout(() => dying.remove(), 150); // --dropdown-close-dur
}

// ---- data ---------------------------------------------------------------------------------------

async function load(field, value) {
  const seq = ++requestSeq;

  let url;
  try {
    url = new URL(config.url, window.location.href);
  } catch (err) {
    console.warn('[search] data-search-suggest-url is not a valid URL:', config.url);
    return;
  }
  url.searchParams.set('query', value);
  url.searchParams.set('limit', String(config.limit));
  url.searchParams.set('offset', '0');

  controller?.abort();
  controller = new AbortController();

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (seq !== requestSeq || field !== anchor) return; // a newer keystroke already won
    items = Array.isArray(data.items) ? data.items.filter((i) => i && i.displayText) : [];
    activeIndex = -1;
    render('ready');
  } catch (err) {
    if (err.name === 'AbortError' || seq !== requestSeq || field !== anchor) return;
    // The endpoint only sends CORS headers for https://www.modernvivo.com, so this is the expected
    // path on staging and localhost. The AI row still has to work — never close on a failed fetch.
    console.warn('[search] suggestions request failed', err);
    items = [];
    activeIndex = -1;
    render('error');
  }
}

function onInput(field) {
  config = readConfig(field);
  query = field.value.trim();

  clearTimeout(debounceTimer);
  if (!config.url || !query) {
    close();
    return;
  }

  open(field);
  render(items.length ? 'ready' : 'loading'); // keep the previous rows up rather than flashing empty
  debounceTimer = setTimeout(() => load(field, query), config.delay);
}

// ---- selection ----------------------------------------------------------------------------------

function choose(index) {
  const target = config?.target;
  const wrapper = config?.wrapper;
  const value = query;
  const item = index >= 0 && index < items.length ? items[index] : null;

  close(true);

  const href = item
    ? searchHandoffURL(wrapper, { type: 'suggestion', suggestionId: item.id })
    : searchHandoffURL(wrapper, { type: 'prompt', query: value });

  if (!href) {
    console.warn('[search] missing data-search-handoff on [data-search-wrapper] — nowhere to hand off to');
    return;
  }
  navigate(href, target);
}

// ---- wiring -------------------------------------------------------------------------------------

function fieldFrom(target) {
  if (!target || !target.closest) return null;
  const field = target.closest(FIELD_SEL);
  if (!field) return null;
  return field.closest('[data-search-wrapper]') || field.closest('[data-search-dock-clone]')
    ? field
    : null;
}

export function initMarketplaceSearch() {
  if (bound) return;
  bound = true;

  document.addEventListener('input', (e) => {
    const field = fieldFrom(e.target);
    if (field) onInput(field);
  });

  // CAPTURE on document: the dock clone binds its own Enter handler directly on its field, and
  // initSearchAction binds one on the wrapper — arrow keys and a chosen row have to win over both.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!panel || e.target !== anchor) return;
      const last = items.length; // the AI row

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        activeIndex = activeIndex + step;
        if (activeIndex > last) activeIndex = -1;
        if (activeIndex < -1) activeIndex = last;
        paintActive();
        return;
      }

      if (e.key === 'Enter') {
        if (activeIndex < 0) return; // nothing picked — fall through to initSearchAction's go()
        e.preventDefault();
        e.stopImmediatePropagation();
        choose(activeIndex);
        return;
      }

      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        close();
      }
    },
    true
  );

  document.addEventListener('click', (e) => {
    const option = e.target.closest?.('[data-search-suggest-option]');
    if (option) {
      e.preventDefault();
      choose(parseInt(option.getAttribute('data-search-suggest-index'), 10));
      return;
    }
    if (e.target.closest?.('[data-search-suggest-ai]')) {
      e.preventDefault();
      choose(-1);
      return;
    }
    if (panel && !e.target.closest?.(PANEL_SEL) && e.target !== anchor) close();
  });

  // Deferred a tick so a click inside the panel (which keeps focus on the field via the mousedown
  // guard) is already reflected in activeElement.
  document.addEventListener('focusout', (e) => {
    if (!panel || e.target !== anchor) return;
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (!panel) return;
      const el = document.activeElement;
      if (el !== anchor && !panel.contains(el)) close();
    }, 0);
  });
}

// Barba leaves the panel behind otherwise — it lives on <body>, outside the container.
export function cleanupMarketplaceSearch() {
  close(true);
  document.querySelectorAll(PANEL_SEL).forEach((el) => el.remove()); // including one mid-close
}
