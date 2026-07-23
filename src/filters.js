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

export function initResourcesFilter(scope = document) {
  const toggle = scope.querySelector('.resources-filter');
  if (!toggle || toggle.__resFilterInit) return;
  toggle.__resFilterInit = true;

  // buttons: prefer the Osmo tag, fall back to the existing filter-item markup
  let buttons = [...toggle.querySelectorAll('[data-toggle-btn]')];
  if (buttons.length < 2) buttons = [...toggle.querySelectorAll('.resources-filter-item')];
  if (buttons.length < 2) return;

  const list = scope.querySelector('.resources-index-list');
  const results = scope.querySelector('.resources-index-results');
  const empty = scope.querySelector('.resources-index-empty');
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
      if (index !== activeIndex) setActive(index);
    });
    btn.addEventListener('keydown', (event) => {
      const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      event.preventDefault();
      const next = (activeIndex + dir + buttons.length) % buttons.length;
      setActive(next);
      buttons[next].focus();
    });
  });

  setActive(activeIndex);

  // re-measure the pill whenever the bar resizes (viewport, font swap, etc.)
  if (pill && 'ResizeObserver' in window) {
    new ResizeObserver(() => movePill()).observe(toggle);
  }
  // fonts can shift label widths after first paint — re-snap once they're ready
  document.fonts?.ready.then(movePill);
}
