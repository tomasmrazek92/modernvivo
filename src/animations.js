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

// Heading reveal — split into masked words that rise in on scroll
export function initSplitHeadings(scope = document) {
  const headings = scope.querySelectorAll('[data-split="heading"]');
  headings.forEach((heading) => {
    SplitText.create(heading, {
      type: 'words',
      autoSplit: true,
      mask: 'words',
      onSplit(instance) {
        return gsap.from(instance.words, {
          duration: 0.8,
          yPercent: 110,
          stagger: 0.1,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: heading,
            start: 'top 80%',
            once: true,
            markers: true,
          },
        });
      },
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
