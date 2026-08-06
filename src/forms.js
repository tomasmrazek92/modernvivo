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

// -----------------------------------------
// LOOPS NEWSLETTER — [data-loops-form="<form-id>"]
// -----------------------------------------
// Posts a normal Webflow form to Loops instead of to Webflow, so the client keeps their Webflow-designed
// form and its states, and Loops' own <div><form><script> embed is dropped entirely.
//
// Webflow setup:
//   data-loops-form = "cmlzpeb870beh0h0t8wbqbula"   ← the id from the embed's action URL
//                     (the full https://app.loops.so/api/newsletter-form/... URL also works)
//   optional: data-loops-user-group = "Waitlist"
//   optional, extra Loops fields: data-loops-field="firstName" on any input in the form
//
// Put data-loops-form on the inner <form> (Navigator: Form Block › Form) OR on the Form Block wrapper —
// both work. Selecting "Form Block" in the Designer and adding attributes there lands them on the .w-form
// DIV, not the form, and that's the easy mistake to make: a form-only selector would silently not match,
// Webflow's own handler would quietly keep the submission, and Loops would never hear about it. So the
// attribute is resolved with closest() from the form upwards.
//
// WHY document-capture: Webflow's forms module binds submit on the form itself, so a listener on the form
// (or a delegated one on document) runs AFTER it — Webflow would fire its own AJAX submission and swap in
// the success block regardless. Capturing on document runs first, and stopPropagation() there means the
// event never reaches Webflow's handler at all. Consequence, by decision: these signups do NOT appear in
// Webflow → Forms. Loops is the only record.
//
// Which means EVERY state is ours to drive, and all three are:
//   · sending  — the real submit input's data-wait label is written here, which is exactly what the
//     [data-button-instance="form-trigger"] mirror above watches: the styled button flips to
//     data-button-state="submitting" and its double-submit guard engages, with no extra wiring. The label
//     is restored in a finally, so a failed send always returns the button to idle.
//   · success / error — Webflow's own .w-form-done / .w-form-fail blocks inside the .w-form wrapper, so
//     both stay editable and stylable in the Designer, and the error carries Loops' own message.
//   · data-form-state="idle|submitting|done|fail" on the form AND the .w-form wrapper, so anything else
//     can be driven from CSS — e.g. [data-form-state="done"] [data-button-instance="form-trigger"].
//
// The endpoint is form-encoded and CORS-open (that's how Loops' own snippet works from any domain), so no
// proxy, no API key, nothing server-side.

const LOOPS_BASE = 'https://app.loops.so/api/newsletter-form/';
const LOOPS_RATE_KEY = 'loops-form-timestamp';
const LOOPS_RATE_MS = 60000; // Loops sits behind Cloudflare and rate-limits repeat signups
const RATE_LIMIT_MSG = 'Too many signups, please try again in a little while';

let loopsBound = false;

const loopsEndpoint = (value) => {
  const id = (value || '').trim();
  if (!id) return null;
  return /^https?:\/\//i.test(id) ? id : LOOPS_BASE + id;
};

// Read a data-loops-* value from the form, falling back to whichever ancestor carries data-loops-form — so
// attributing the Form Block instead of the Form behaves identically.
const loopsAttr = (form, name) =>
  form.getAttribute(name) || (form.closest('[data-loops-form]') || form).getAttribute(name);

// input[type=submit] keeps its label in .value, a <button> in the DOM — same split as labelOf above
const setSubmitLabel = (el, label) => {
  if (!el) return;
  if (el.tagName === 'INPUT') el.value = label;
  else el.textContent = label;
};

// localStorage throws in Safari private mode / with cookies blocked — never let that kill a signup
const safeStorage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* no-op */
    }
  },
};

// Reveal a Webflow state block WITHOUT flattening a Designer-set display. .w-form-done / .w-form-fail carry
// display:none BOTH inline and in webflow.css, so dropping the inline rule alone leaves them hidden — but
// hard-coding 'block' (what Webflow's own jQuery .show() does) would wreck a success block the client styled
// as flex or grid. So: drop the inline rule, and only force block if the stylesheet still says none.
const showState = (el) => {
  el.style.removeProperty('display');
  if (getComputedStyle(el).display === 'none') el.style.display = 'block';
};

function setFormState(form, state, message) {
  // the single styling hook: mirrored onto the wrapper too, since the state blocks are the form's siblings
  const wrapper = form.closest('.w-form') || form.parentElement;
  form.setAttribute('data-form-state', state);
  if (wrapper) wrapper.setAttribute('data-form-state', state);

  const done = wrapper && wrapper.querySelector('.w-form-done');
  const fail = wrapper && wrapper.querySelector('.w-form-fail');

  if (done) state === 'done' ? showState(done) : (done.style.display = 'none');
  if (fail) state === 'fail' ? showState(fail) : (fail.style.display = 'none');

  // Webflow hides the form on success; on failure it stays put so the address can be corrected. Only hide
  // it if there IS a success block to replace it — a raw <form> would otherwise just vanish.
  form.style.display = state === 'done' && done ? 'none' : '';

  // Webflow's .w-form-done ships tabindex="-1" + role="region" precisely so it can take focus once it
  // replaces the form — otherwise a screen reader is left on a button that no longer exists.
  // preventScroll because Lenis owns scrolling here and a focus jump would fight it.
  if (state === 'done' && done && done.hasAttribute('tabindex'))
    done.focus({ preventScroll: true });

  if (state === 'done' && !done) {
    console.warn(
      '[loops] signup succeeded but there is no .w-form-done to show — put the form in a Webflow Form Block, or style [data-form-state="done"]',
      form
    );
  }

  // Keep the Designer's copy as the default and only overwrite it when Loops says something more useful
  const msgEl = fail && fail.firstElementChild;
  if (msgEl) {
    if (msgEl.__loopsDefault === undefined) msgEl.__loopsDefault = msgEl.textContent;
    msgEl.textContent = message || msgEl.__loopsDefault;
  }
}

async function submitToLoops(form, endpoint) {
  const email = form.querySelector('input[type="email"], input[name="email"]');
  if (!email || !email.value) return;

  const submit = form.querySelector('input[type="submit"], button[type="submit"]');
  const idleLabel = submit ? (submit.tagName === 'INPUT' ? submit.value : submit.textContent) : '';
  const waitLabel = (submit && submit.getAttribute('data-wait')) || 'Please wait...';

  const stamp = Number(safeStorage.get(LOOPS_RATE_KEY));
  if (stamp && stamp + LOOPS_RATE_MS > Date.now()) {
    setFormState(form, 'fail', RATE_LIMIT_MSG);
    return;
  }

  // Writing the wait text is normally Webflow's job — we blocked it, so do it here. The trigger mirror is
  // watching this exact property, so the styled button goes to data-button-state="submitting" by itself.
  setSubmitLabel(submit, waitLabel);
  setFormState(form, 'submitting');

  const body = new URLSearchParams();
  body.set('email', email.value);
  body.set('userGroup', loopsAttr(form, 'data-loops-user-group') || '');
  body.set('mailingLists', '');
  // any extra Loops field, opted in per input: data-loops-field="firstName"
  form.querySelectorAll('[data-loops-field]').forEach((el) => {
    body.set(el.getAttribute('data-loops-field'), el.value || '');
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.ok) {
      safeStorage.set(LOOPS_RATE_KEY, String(Date.now()));
      form.reset();
      setFormState(form, 'done');
      return;
    }

    const data = await res.json().catch(() => null);
    setFormState(form, 'fail', (data && data.message) || res.statusText);
  } catch (err) {
    // a blocked/rate-limited request surfaces as an opaque "Failed to fetch", not a status code
    const rateLimited = err && err.message === 'Failed to fetch';
    setFormState(form, 'fail', rateLimited ? RATE_LIMIT_MSG : err && err.message);
  } finally {
    // restore before the state settles: on failure the button must be clickable again, and on success the
    // form is hidden anyway — either way it must never be left stuck on "Please wait..."
    setSubmitLabel(submit, idleLabel);
  }
}

export function initLoopsForms(scope = document) {
  // Stamp the resting state up front so [data-form-state="idle"] is styleable BEFORE anyone interacts —
  // otherwise the attribute only appears on first submit and idle styling silently does nothing. Re-runs
  // per page (barba) to catch the incoming container's forms; never clobbers a state already in progress.
  scope.querySelectorAll('[data-loops-form]').forEach((el) => {
    const form = el.matches('form') ? el : el.querySelector('form');
    if (!form) return;
    const wrapper = form.closest('.w-form') || form.parentElement;
    if (!form.hasAttribute('data-form-state')) form.setAttribute('data-form-state', 'idle');
    if (wrapper && !wrapper.hasAttribute('data-form-state'))
      wrapper.setAttribute('data-form-state', 'idle');
  });

  if (loopsBound) return; // one document listener covers every page — barba-safe by construction
  loopsBound = true;

  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target.closest && e.target.closest('form');
      if (!form) return;

      // matches the form itself when it carries the attribute, otherwise the Form Block wrapper above it
      const host = form.closest('[data-loops-form]');
      if (!host) return;

      const endpoint = loopsEndpoint(host.getAttribute('data-loops-form'));
      if (!endpoint) return; // no id → let Webflow have it rather than swallowing the submission

      e.preventDefault();
      e.stopPropagation(); // capture phase: the event never reaches Webflow's own submit handler
      submitToLoops(form, endpoint);
    },
    true
  );
}
