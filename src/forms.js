// -----------------------------------------
// FORM TRIGGER BUTTON — [data-button-instance="form-trigger"]
// -----------------------------------------
// A styled Webflow button that stands in for the form's real submit input:
//
//   <div data-button-instance="form-trigger" class="btn">
//     <span data-button-instance-text>Send</span>
//   </div>
//
// Clicking it clicks the real input[type="submit"] in the same form, and the real input's label is
// mirrored back onto it — so Webflow's own data-wait text ("Please wait...") appears on YOUR button
// with no extra config, and reverts when Webflow reverts it. While that's happening the trigger is
// marked submitting and further clicks are ignored, so the form can't be double-submitted.
//
// State (drive the look from CSS, as with everything else):
//   data-button-state="idle" | "submitting"   + aria-disabled while submitting
//
// Text target: [data-button-instance-text], else [data-button-056-text], else the trigger itself.

function injectFormTriggerCSS() {
  if (document.getElementById('form-trigger-css')) return;
  const style = document.createElement('style');
  style.id = 'form-trigger-css';
  // pointer-events is belt to the JS guard, not the guard itself — a stylesheet can be overridden
  style.textContent = '[data-button-instance][aria-disabled="true"]{pointer-events:none}';
  document.head.appendChild(style);
}

// Webflow uses input[type=submit] (label lives in .value); a <button> keeps its label in the DOM
const labelOf = (el) => (el.tagName === 'INPUT' ? el.value : el.textContent.trim());

// Notify on ANY change to the real submit's label or disabled state.
// The value-property trap matters: Webflow sets the wait text with jQuery .val(), which writes the
// value PROPERTY, not the attribute — a MutationObserver alone never fires and the mirror looks
// broken. Wrapping the instance's own `value` descriptor catches it; the observer still covers the
// attribute route and `disabled`.
function watchSubmit(input, onChange) {
  if (!input.__triggerWatched) {
    input.__triggerWatched = true;

    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (input.tagName === 'INPUT' && proto && proto.set) {
      Object.defineProperty(input, 'value', {
        configurable: true,
        get() {
          return proto.get.call(this);
        },
        set(v) {
          proto.set.call(this, v);
          onChange();
        },
      });
    }

    new MutationObserver(onChange).observe(input, {
      attributes: true,
      attributeFilter: ['value', 'disabled'],
      childList: input.tagName !== 'INPUT', // a <button>'s label is its children
      subtree: input.tagName !== 'INPUT',
    });
  }
}

export function initFormTriggers(scope = document) {
  const triggers = scope.querySelectorAll('[data-button-instance="form-trigger"]');
  if (!triggers.length) return;

  injectFormTriggerCSS();

  triggers.forEach((trigger) => {
    if (trigger.__formTrigger) return; // guard: barba re-init would stack another click handler
    const form = trigger.closest('form');
    if (!form) return;

    const submit = form.querySelector('input[type="submit"], button[type="submit"]');
    if (!submit) return;
    trigger.__formTrigger = true;

    const textEl =
      trigger.querySelector('[data-button-instance-text]') ||
      trigger.querySelector('[data-button-056-text]') ||
      trigger;

    // Cache the markup, not just the string: the label may be split into per-word spans by
    // initButton056, and overwriting it with textContent would flatten those and kill the hover
    // effect for good. Restoring the original HTML puts the split — and the effect — back.
    const originalHTML = textEl.innerHTML;
    const originalLabel = labelOf(submit);

    trigger.setAttribute('data-button-state', 'idle');

    const sync = () => {
      const label = labelOf(submit);
      const busy = label !== originalLabel || submit.disabled;

      if (busy) {
        if (textEl.textContent.trim() !== label) textEl.textContent = label;
        trigger.setAttribute('data-button-state', 'submitting');
        trigger.setAttribute('aria-disabled', 'true');
      } else {
        if (textEl.innerHTML !== originalHTML) textEl.innerHTML = originalHTML;
        trigger.setAttribute('data-button-state', 'idle');
        trigger.removeAttribute('aria-disabled');
      }
    };

    watchSubmit(submit, sync);
    sync(); // in case the form is already mid-submit when this initialises

    const activate = (e) => {
      e.preventDefault();
      // spam guard: read live state rather than a local flag, so it stays correct even if Webflow
      // (or another script) resets the form without us hearing about it
      if (trigger.getAttribute('data-button-state') === 'submitting' || submit.disabled) return;
      submit.click(); // let the real button submit — Webflow's handler is bound to the form
    };

    trigger.addEventListener('click', activate);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') activate(e);
    });

    // a div isn't focusable or announced as a control; an <a>/<button> already is
    if (!trigger.hasAttribute('tabindex') && !['A', 'BUTTON'].includes(trigger.tagName)) {
      trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('role', 'button');
    }
  });
}
