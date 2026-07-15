// -----------------------------------------
// ANIMATIONS
// -----------------------------------------
// Page-level effects. Wired into the registry in index.js so they run on first load AND
// after each barba page change. Each takes a `scope` (the incoming container) so navs only
// touch the new page's elements. gsap + SplitText + ScrollTrigger are ambient CDN globals
// (registered in index.js).

// Button 056 — split the button label into inline-block words (for hover/stagger effects)
export function initButton056(scope = document) {
  document.fonts.ready.then(() => {
    const buttons = scope.querySelectorAll('[data-button-056]');
    if (buttons.length === 0) return;

    buttons.forEach((element) => {
      const textElements = element.querySelectorAll('[data-button-056-text]');
      if (textElements.length === 0) return;

      textElements.forEach((textElement) => {
        const splitText = new SplitText(textElement, {
          type: 'words',
          tag: 'span',
          wordsClass: 'btn_split-word',
          propIndex: true,
        });

        gsap.set(splitText.words, { display: 'inline-block' });
      });
    });
  });
}

// Heading reveal — single init for all heading animations.
// Effect chosen per-element:  data-reveal="lines" | "words" | "type"
// Optional overrides: data-reveal-start / -stagger / -duration / -once / -markers
const HEADING_REVEALS = {
  lines: {
    split: { type: 'lines', mask: 'lines', autoSplit: true },
    pick: (self) => self.lines,
    build: (targets, o, st) =>
      gsap.from(targets, {
        yPercent: 110,
        duration: o.duration,
        stagger: o.stagger,
        ease: 'expo.out',
        scrollTrigger: st,
      }),
  },

  words: {
    split: { type: 'words', mask: 'words' },
    pick: (self) => self.words,
    build: (targets, o, st) =>
      gsap.from(targets, {
        yPercent: 110,
        duration: o.duration,
        stagger: o.stagger,
        ease: 'expo.out',
        scrollTrigger: st,
      }),
  },

  type: {
    split: { type: 'chars' },
    pick: (self) => self.chars,
    build: (targets, o, st) => {
      gsap.set(targets, { autoAlpha: 0 }); // hide before the trigger fires
      return gsap.to(targets, {
        autoAlpha: 1,
        duration: 0.01, // near-instant "pop" per char, not a fade
        ease: 'none',
        stagger: { each: o.stagger }, // each = fixed typing speed regardless of length
        scrollTrigger: st,
      });
    },
  },
};

export function initHeadingReveal(scope = document) {
  // fonts.ready so line splits measure against the loaded font (avoids reflow flash)
  document.fonts.ready.then(() => {
    gsap.utils.toArray(scope.querySelectorAll('[data-reveal]')).forEach((el) => {
      const mode = el.getAttribute('data-reveal');
      const cfg = HEADING_REVEALS[mode];
      if (!cfg) return; // unknown value → skip silently, no errors

      const opts = {
        start: el.getAttribute('data-reveal-start') || 'top 80%',
        duration: parseFloat(el.getAttribute('data-reveal-duration')) || 0.8,
        stagger:
          parseFloat(el.getAttribute('data-reveal-stagger')) || (mode === 'type' ? 0.045 : 0.1),
        once: el.getAttribute('data-reveal-once') !== 'false',
        markers: el.getAttribute('data-reveal-markers') === 'true',
      };

      SplitText.create(el, {
        ...cfg.split,
        onSplit(self) {
          const targets = cfg.pick(self);

          // autoSplit re-runs onSplit whenever line-breaks genuinely change.
          // If we've already revealed once, don't replay — just leave it visible.
          if (el._revealed) {
            gsap.set(targets, { clearProps: 'opacity,visibility,transform' });
            return;
          }

          const st = {
            trigger: el,
            start: opts.start,
            once: opts.once,
            markers: opts.markers,
            onEnter: opts.once ? () => (el._revealed = true) : undefined,
          };

          return cfg.build(targets, opts, st);
        },
      });
    });
  });
}

// Content reveal on scroll — [data-reveal-group] with nested layers, stagger, per-element distance
export function initContentRevealScroll(scope = document) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = gsap.context(() => {
    scope.querySelectorAll('[data-reveal-group]').forEach((groupEl) => {
      // Config from attributes or defaults (group-level)
      const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 100) / 1000; // ms → sec
      const groupDistance = groupEl.getAttribute('data-distance') || '2em';
      const triggerStart = groupEl.getAttribute('data-start') || 'top 80%';

      const animDuration = 0.8;
      const animEase = 'power4.inOut';

      // Reduced motion: show immediately
      if (prefersReduced) {
        gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
        return;
      }

      // If no direct children, animate the group element itself
      const directChildren = Array.from(groupEl.children).filter((el) => el.nodeType === 1);
      if (!directChildren.length) {
        gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
        ScrollTrigger.create({
          trigger: groupEl,
          start: triggerStart,
          once: true,
          onEnter: () =>
            gsap.to(groupEl, {
              y: 0,
              autoAlpha: 1,
              duration: animDuration,
              ease: animEase,
              onComplete: () => gsap.set(groupEl, { clearProps: 'all' }),
            }),
        });
        return;
      }

      // Build animation slots: item or nested (deep layers allowed)
      const slots = [];
      directChildren.forEach((child) => {
        const nestedGroup = child.matches('[data-reveal-group-nested]')
          ? child
          : child.querySelector(':scope [data-reveal-group-nested]');

        if (nestedGroup) {
          const includeParent =
            child.getAttribute('data-ignore') !== 'true' &&
            (child.getAttribute('data-ignore') === 'false' ||
              nestedGroup.getAttribute('data-ignore') === 'false');

          const nestedChildren = Array.from(nestedGroup.children).filter(
            (el) => el.nodeType === 1 && el.getAttribute('data-ignore') !== 'true'
          );

          slots.push({
            type: 'nested',
            parentEl: child,
            nestedEl: nestedGroup,
            includeParent,
            nestedChildren,
          });
        } else {
          if (child.getAttribute('data-ignore') === 'true') return;
          slots.push({ type: 'item', el: child });
        }
      });

      // Initial hidden state
      slots.forEach((slot) => {
        if (slot.type === 'item') {
          // If the element itself is a nested group, force group distance (prevents it from using its own data-distance)
          const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
          const d = isNestedSelf ? groupDistance : slot.el.getAttribute('data-distance') || groupDistance;
          gsap.set(slot.el, { y: d, autoAlpha: 0 });
        } else {
          // Parent follows the group's distance when included, regardless of nested's data-distance
          if (slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
          // Children use nested group's own distance (fallback to group distance)
          const nestedD = slot.nestedEl.getAttribute('data-distance') || groupDistance;
          slot.nestedChildren.forEach((target) => gsap.set(target, { y: nestedD, autoAlpha: 0 }));
        }
      });

      // Extra safety: if a nested parent is included, re-assert its distance to the group's value
      slots.forEach((slot) => {
        if (slot.type === 'nested' && slot.includeParent) {
          gsap.set(slot.parentEl, { y: groupDistance });
        }
      });

      // Reveal sequence
      ScrollTrigger.create({
        trigger: groupEl,
        start: triggerStart,
        once: true,
        onEnter: () => {
          const tl = gsap.timeline();

          slots.forEach((slot, slotIndex) => {
            const slotTime = slotIndex * groupStaggerSec;

            if (slot.type === 'item') {
              tl.to(
                slot.el,
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: animDuration,
                  ease: animEase,
                  onComplete: () => gsap.set(slot.el, { clearProps: 'all' }),
                },
                slotTime
              );
            } else {
              // Optionally include the parent at the same slot time (parent uses group distance)
              if (slot.includeParent) {
                tl.to(
                  slot.parentEl,
                  {
                    y: 0,
                    autoAlpha: 1,
                    duration: animDuration,
                    ease: animEase,
                    onComplete: () => gsap.set(slot.parentEl, { clearProps: 'all' }),
                  },
                  slotTime
                );
              }
              // Nested children use nested stagger (ms → sec); fallback to group stagger
              const nestedMs = parseFloat(slot.nestedEl.getAttribute('data-stagger'));
              const nestedStaggerSec = isNaN(nestedMs) ? groupStaggerSec : nestedMs / 1000;
              slot.nestedChildren.forEach((nestedChild, nestedIndex) => {
                tl.to(
                  nestedChild,
                  {
                    y: 0,
                    autoAlpha: 1,
                    duration: animDuration,
                    ease: animEase,
                    onComplete: () => gsap.set(nestedChild, { clearProps: 'all' }),
                  },
                  slotTime + nestedIndex * nestedStaggerSec
                );
              });
            }
          });
        },
      });
    });
  });

  return () => ctx.revert();
}
