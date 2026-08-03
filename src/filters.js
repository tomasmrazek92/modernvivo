// -----------------------------------------
// RESOURCES FILTER — Osmo toggle switch + container swap + category filter
// -----------------------------------------
// The filter bar (.resources-filter) is an Osmo toggle switch: a sliding pill
// (--toggle-active / --toggle-count) with keyboard arrow nav. Changing the active
// button drives two containers:
//   • "All" active        → show .resources-index-list, hide .resources-index-results
//   • any category active → hide the list, show the results, keep only matching cards
// Category comes from each card's .text-tiny label. Button labels ("Case studies")
// don't match card labels ("Case Study") exactly, so both sides are normalized
// (lowercase, strip non-letters, singularize ies→y / trailing s) before comparing.

// The empty state must never be visible before JS decides it should be.
function injectResourcesFilterCSS() {
  if (document.getElementById('resources-filter-css')) return;
  const style = document.createElement('style');
  style.id = 'resources-filter-css';
  style.textContent = '.resources-index-empty{display:none}';
  document.head.appendChild(style);
}

// Bring the resources area back into view after the visible content is swapped out from under the
// reader. Shared by the top filter bar and the per-section "See all" shortcuts so both land in the
// same place.
//
// `fromEl` is whatever was clicked. Its closest <section> is preferred, but it's checked AFTER the
// filter has applied: switching category hides the whole sections list, so offsetParent === null
// means that section just got display:none'd with it, and scrolling to a hidden element lands at a
// meaningless position. Falls back to the section wrapping the filter bar, then to the bar itself.
function scrollFilterIntoView(fromEl, toggle) {
  let target = fromEl && fromEl.closest('section');
  if (!target || target.offsetParent === null) target = toggle.closest('section') || toggle;

  const lenis = window.lenis;
  const offset = -(parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(target, { offset });
  } else {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

export function initResourcesFilter(scope = document) {
  const toggle = scope.querySelector('.resources-filter');
  if (!toggle || toggle.__resFilterInit) return;
  toggle.__resFilterInit = true;

  // buttons: prefer the Osmo tag, fall back to the existing filter-item markup
  let buttons = [...toggle.querySelectorAll('[data-toggle-btn]')];
  if (buttons.length < 2) buttons = [...toggle.querySelectorAll('.resources-filter-item')];
  if (buttons.length < 2) return;

  // Hidden-by-DEFAULT in a stylesheet, not just by an inline style JS sets at init. Two failure
  // modes this closes, both of which showed the empty state on arrival when navigating in:
  //   • the inline display:none is wiped later — a reveal ending in clearProps strips inline styles
  //     off elements in its group, and .resources-index-results carries data-reveal-group-nested
  //   • the element isn't found at init, so nothing ever hid it
  // JS shows it with an inline display:block, which still wins over this rule.
  injectResourcesFilterCSS();

  // fall back to document: these live in the barba container in practice, but if one is ever moved
  // outside it, a container-scoped lookup returns null and its visibility silently stops being managed
  const list =
    scope.querySelector('.resources-index-list') || document.querySelector('.resources-index-list');
  const results =
    scope.querySelector('.resources-index-results') ||
    document.querySelector('.resources-index-results');
  const empty =
    scope.querySelector('.resources-index-empty') ||
    document.querySelector('.resources-index-empty');
  const cards = results ? results.querySelectorAll('.resources-list-item') : [];
  const pill = toggle.querySelector('.toggle-switch__bg');

  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/ies$/, 'y')
      .replace(/s$/, '');

  const label = (btn) => norm(btn.textContent);
  const isAll = (btn) => label(btn) === 'all';
  const cardCat = (card) => norm(card.querySelector('.text-tiny')?.textContent);

  // filter cards to the target category, return how many matched
  const filterCards = (target) => {
    let matches = 0;
    cards.forEach((card) => {
      const match = cardCat(card) === target;
      const cell = card.closest('.w-dyn-item') || card;
      cell.style.display = match ? '' : 'none';
      if (match) matches++;
    });
    return matches;
  };

  const applyState = (btn) => {
    // "All" → just the default list
    if (isAll(btn)) {
      if (list) list.style.display = '';
      if (results) results.style.display = 'none';
      if (empty) empty.style.display = 'none';
      return;
    }

    // a category → results if it has items, otherwise the empty state
    const hasItems = filterCards(label(btn)) > 0;
    if (list) list.style.display = 'none';
    if (results) results.style.display = hasItems ? 'block' : 'none';
    if (empty) empty.style.display = hasItems ? 'none' : 'block';
  };

  // measure the active button and snap the pill onto it (handles variable widths)
  const movePill = () => {
    const active = buttons[activeIndex];
    if (!pill || !active) return;
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.height = `${active.offsetHeight}px`;
    pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  };

  // initial active = marked button (data-toggle-active or .is-active), else first
  let activeIndex = buttons.findIndex(
    (b) => b.hasAttribute('data-toggle-active') || b.classList.contains('is-active')
  );
  if (activeIndex < 0) activeIndex = 0;

  const setActive = (index) => {
    activeIndex = index;
    buttons.forEach((btn, i) => {
      const active = i === index;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.toggleAttribute('data-toggle-active', active);
      btn.classList.toggle('is-active', active); // keep existing class styling working
      btn.tabIndex = active ? 0 : -1;
    });
    movePill();
    applyState(buttons[index]);
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = buttons.indexOf(btn);
      if (index === activeIndex) return; // same filter — nothing swapped, don't yank the page
      setActive(index);
      scrollFilterIntoView(toggle, toggle);
    });
    btn.addEventListener('keydown', (event) => {
      const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      event.preventDefault();
      const next = (activeIndex + dir + buttons.length) % buttons.length;
      setActive(next);
      buttons[next].focus();
      scrollFilterIntoView(toggle, toggle);
    });
  });

  setActive(activeIndex);

  // Expose the filter so other UI can drive it — same normalisation, same setActive, so a section
  // shortcut and the toggle bar can never disagree about what "Case studies" means.
  toggle.__setFilterByTag = (tag) => {
    const target = norm(tag);
    const index = buttons.findIndex((b) => label(b) === target);
    if (index < 0) return false;
    if (index !== activeIndex) setActive(index);
    return true;
  };

  // re-measure the pill whenever the bar resizes (viewport, font swap, etc.)
  if (pill && 'ResizeObserver' in window) {
    new ResizeObserver(() => movePill()).observe(toggle);
  }
  // fonts can shift label widths after first paint — re-snap once they're ready
  document.fonts?.ready.then(movePill);
}

// -----------------------------------------
// SECTION FILTER SHORTCUTS — [data-button-instance="filter-all"]
// -----------------------------------------
// Each resources section carries its category in a [data-filter-tag] element and a "See all"
// button. Clicking it switches the top filter bar to that category — it does NOT reimplement
// filtering, it calls the toggle's own setActive, so labels normalise identically ("Case studies"
// vs "Case Study") and the pill/aria/active states all stay correct.
//
// Delegated on document: the sections are CMS-rendered and this survives barba without re-binding.
//
// Tag value = data-filter-tag's own value if set, else the element's text. Text is the normal case
// here, and it survives the data-reveal="type" split (the per-character divs still read back as
// "Case studies" through textContent).
let filterShortcutsBound = false;

export function initFilterShortcuts() {
  if (filterShortcutsBound) return;
  filterShortcutsBound = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-button-instance="filter-all"]');
    if (!btn) return;

    // find the nearest ancestor that also holds the section's tag
    let node = btn.parentElement;
    let tagEl = null;
    while (node && !tagEl) {
      tagEl = node.querySelector('[data-filter-tag]');
      node = node.parentElement;
    }
    if (!tagEl) return;

    const attr = tagEl.getAttribute('data-filter-tag');
    const tag = (attr && attr.trim()) || tagEl.textContent.trim();

    const toggle = document.querySelector('.resources-filter');
    if (!toggle || typeof toggle.__setFilterByTag !== 'function') return;

    e.preventDefault(); // it's an <a href="#"> — don't jump to the top of the page
    if (!toggle.__setFilterByTag(tag)) return; // no matching filter button — leave the page alone

    scrollFilterIntoView(btn, toggle);
  });
}
