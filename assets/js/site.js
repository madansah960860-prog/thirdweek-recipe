/* ==========================================================================
   Saltgrain - shared behavior
   Vanilla JS, no dependencies, no build step.

   Modules
   01. Helpers
   02. Mobile navigation
   03. Dropdown menus (mouse + keyboard)
   04. Accordions
   05. Scroll reveals (IntersectionObserver, reduced-motion aware)
   06. Back to top
   07. Cookie consent (no non-essential cookies before consent)
   08. Form validation
   09. Recipe: unit toggle, servings scaler, ingredient checklist
   10. Recipe index filtering
   11. Print buttons
   12. Current year stamps
   ========================================================================== */
(function () {
  'use strict';

  /* ======================================================================
     01. HELPERS
     ====================================================================== */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  // localStorage can throw in private modes. Never let that break the page.
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { /* no-op */ }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* no-op */ }
    }
  };

  /* ======================================================================
     02. MOBILE NAVIGATION
     ====================================================================== */
  function initMobileNav() {
    var toggle = $('.nav-toggle');
    var nav = $('#site-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
      $('.nav-toggle-label', toggle).textContent = open ? 'Menu' : 'Close';
    });

    // Escape closes the mobile drawer and returns focus to the button.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (toggle.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        $('.nav-toggle-label', toggle).textContent = 'Menu';
        toggle.focus();
      }
    });
  }

  /* ======================================================================
     03. DROPDOWN MENUS
     Click/tap to open on every viewport. Hover only assists on pointer
     devices; it is never the sole way to reach a link.
     ====================================================================== */
  function initDropdowns() {
    var triggers = $$('.nav-trigger');
    if (!triggers.length) return;

    var desktop = window.matchMedia('(min-width: 62rem)');
    // Devices where hover already opens the menu. On these, moving the pointer
    // to the trigger opens it, so a following click must not toggle it shut.
    var hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');

    function closeAll(except) {
      triggers.forEach(function (t) {
        if (t === except) return;
        t.setAttribute('aria-expanded', 'false');
        var m = document.getElementById(t.getAttribute('aria-controls'));
        if (m) m.classList.remove('is-open');
      });
    }

    triggers.forEach(function (trigger) {
      var menu = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!menu) return;

      trigger.addEventListener('click', function (e) {
        var open = trigger.getAttribute('aria-expanded') === 'true';

        // A real pointer click (detail > 0) on a hover-capable desktop arrives
        // with the menu already opened by mouseenter. Toggling here would shut
        // it the instant the user clicks, so leave it open and let hover close
        // it on mouseleave. Keyboard activation reports detail === 0 and still
        // toggles normally.
        if (open && desktop.matches && hoverCapable.matches && e.detail > 0) return;

        closeAll(trigger);
        trigger.setAttribute('aria-expanded', String(!open));
        menu.classList.toggle('is-open', !open);
      });

      // Arrow-down from the trigger moves into the first menu link.
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          trigger.setAttribute('aria-expanded', 'true');
          menu.classList.add('is-open');
          var first = menu.querySelector('a');
          if (first) first.focus();
        }
      });

      var parent = trigger.closest('.nav-item');
      if (!parent) return;

      // Hover only assists real pointers. A touch device at desktop width
      // synthesises mouseenter on tap, which would fight the click handler.
      var closeTimer = null;

      parent.addEventListener('mouseenter', function () {
        if (!desktop.matches || !hoverCapable.matches) return;
        window.clearTimeout(closeTimer);
        closeAll(trigger);
        trigger.setAttribute('aria-expanded', 'true');
        menu.classList.add('is-open');
      });

      // A short grace period means clipping the corner of the menu on the way
      // in does not snap it shut. Re-entering cancels the pending close.
      parent.addEventListener('mouseleave', function () {
        if (!desktop.matches || !hoverCapable.matches) return;
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () {
          trigger.setAttribute('aria-expanded', 'false');
          menu.classList.remove('is-open');
        }, 180);
      });
      // Closing on focus-out keeps keyboard and mouse behavior identical.
      parent.addEventListener('focusout', function (e) {
        if (!desktop.matches) return;
        if (parent.contains(e.relatedTarget)) return;
        trigger.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
      });
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('.nav-item')) return;
      closeAll(null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = triggers.filter(function (t) { return t.getAttribute('aria-expanded') === 'true'; })[0];
      if (open) {
        closeAll(null);
        open.focus();
      }
    });
  }

  /* ======================================================================
     04. ACCORDIONS
     ====================================================================== */
  function initAccordions() {
    $$('.accordion-trigger').forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;
      trigger.addEventListener('click', function () {
        var open = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
      });
    });

    // Deep links like faq.html#q-ads open the matching panel.
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target && target.classList.contains('accordion-item')) {
        var t = $('.accordion-trigger', target);
        if (t) t.click();
      }
    }
  }

  /* ======================================================================
     05. SCROLL REVEALS
     Content is visible by default; the class only adds an entrance.
     ====================================================================== */
  function initReveals() {
    var items = $$('.reveal, .arch-reveal');
    if (!items.length) return;

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });

    // Index children of staggered groups so the CSS delay ramp works.
    $$('.stagger').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty('--i', Math.min(i, 9));
      });
    });
  }

  /* ======================================================================
     06. BACK TO TOP
     ====================================================================== */
  function initBackToTop() {
    var btn = $('.to-top');
    if (!btn) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:600px;left:0;width:1px;height:1px;';
    document.body.appendChild(sentinel);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        btn.classList.toggle('is-visible', !entries[0].isIntersecting);
      });
      io.observe(sentinel);
    } else {
      btn.classList.add('is-visible');
    }

    btn.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
      });
      var skip = $('.skip-link');
      if (skip) skip.focus();
    });
  }

  /* ======================================================================
     07. COOKIE CONSENT
     Essential cookies only until a choice is made. Analytics and advertising
     scripts are loaded from loadOptionalScripts(), which runs only after
     explicit opt-in.
     ====================================================================== */
  var CONSENT_KEY = 'sg-consent-v1';

  function readConsent() {
    var raw = store.get(CONSENT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function writeConsent(prefs) {
    store.set(CONSENT_KEY, JSON.stringify({
      analytics: !!prefs.analytics,
      advertising: !!prefs.advertising,
      date: new Date().toISOString()
    }));
  }

  function loadOptionalScripts(prefs) {
    // Real analytics / advertising tags belong here, gated behind consent.
    // Nothing is injected before a visitor opts in.
    if (prefs.analytics) { document.documentElement.setAttribute('data-analytics', 'on'); }
    if (prefs.advertising) { document.documentElement.setAttribute('data-ads', 'on'); }
  }

  function initCookieBanner() {
    var banner = $('#cookie-banner');
    if (!banner) return;

    var modal = $('#cookie-prefs');
    var existing = readConsent();

    if (existing) {
      loadOptionalScripts(existing);
    } else {
      // Shown at the bottom of the page. It never covers the main content
      // on load and it is dismissible with a single action.
      banner.classList.add('is-visible');
    }

    function decide(prefs) {
      writeConsent(prefs);
      loadOptionalScripts(prefs);
      banner.classList.remove('is-visible');
      if (modal && modal.open) modal.close();
    }

    var acceptBtn = $('#cookie-accept', banner);
    var rejectBtn = $('#cookie-reject', banner);
    var manageBtn = $('#cookie-manage', banner);

    if (acceptBtn) acceptBtn.addEventListener('click', function () { decide({ analytics: true, advertising: true }); });
    if (rejectBtn) rejectBtn.addEventListener('click', function () { decide({ analytics: false, advertising: false }); });

    if (manageBtn && modal) {
      manageBtn.addEventListener('click', function () {
        if (typeof modal.showModal === 'function') { modal.showModal(); }
        else { modal.setAttribute('open', ''); }
      });
    }

    if (modal) {
      var saveBtn = $('#cookie-save', modal);
      var closeBtn = $('#cookie-close', modal);
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          decide({
            analytics: $('#pref-analytics', modal).checked,
            advertising: $('#pref-advertising', modal).checked
          });
        });
      }
      if (closeBtn) closeBtn.addEventListener('click', function () { modal.close(); });
    }

    // Footer link lets anyone change their mind later, on any page.
    $$('.js-cookie-settings').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var prefs = readConsent() || { analytics: false, advertising: false };
        if (modal) {
          $('#pref-analytics', modal).checked = prefs.analytics;
          $('#pref-advertising', modal).checked = prefs.advertising;
          if (typeof modal.showModal === 'function') modal.showModal();
        }
      });
    });

    // "Do Not Sell or Share" clears advertising consent immediately.
    $$('.js-do-not-sell').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (link.dataset.optout !== 'inline') return;
        e.preventDefault();
        decide({ analytics: (readConsent() || {}).analytics === true, advertising: false });
        link.textContent = 'Advertising sharing turned off';
      });
    });
  }

  /* ======================================================================
     08. FORM VALIDATION
     Inline messages next to each field. Nothing is submitted to a server
     in this build; the success state explains what happens next.
     ====================================================================== */
  function showFieldError(field, message) {
    var wrap = field.closest('.field') || field.closest('.checkbox-field');
    if (!wrap) return;
    wrap.classList.add('has-error');
    var msg = wrap.querySelector('.error-msg');
    if (msg) msg.textContent = message;
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    var wrap = field.closest('.field') || field.closest('.checkbox-field');
    if (!wrap) return;
    wrap.classList.remove('has-error');
    field.removeAttribute('aria-invalid');
  }

  function validateField(field) {
    var value = (field.value || '').trim();
    var type = field.dataset.validate || field.type;

    if (field.type === 'checkbox') {
      if (field.required && !field.checked) {
        showFieldError(field, field.dataset.errorRequired || 'Please tick this box to continue.');
        return false;
      }
      clearFieldError(field);
      return true;
    }

    if (field.required && !value) {
      showFieldError(field, field.dataset.errorRequired || 'This field is required.');
      return false;
    }
    if (!value) { clearFieldError(field); return true; }

    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      showFieldError(field, 'Enter an email address in the format name@example.com.');
      return false;
    }
    if (type === 'tel' && !/^[0-9+()\-.\s]{7,}$/.test(value)) {
      showFieldError(field, 'Enter a phone number using digits, spaces, and + ( ) - only.');
      return false;
    }
    if (field.minLength > 0 && value.length < field.minLength) {
      showFieldError(field, 'Please write at least ' + field.minLength + ' characters.');
      return false;
    }
    clearFieldError(field);
    return true;
  }

  function initForms() {
    $$('form[data-validate-form]').forEach(function (form) {
      var status = form.querySelector('.form-status');
      var fields = $$('input, select, textarea', form).filter(function (f) {
        return f.type !== 'hidden' && f.type !== 'submit';
      });

      fields.forEach(function (field) {
        field.addEventListener('blur', function () { validateField(field); });
        field.addEventListener('input', function () {
          var wrap = field.closest('.field') || field.closest('.checkbox-field');
          if (wrap && wrap.classList.contains('has-error')) validateField(field);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var firstBad = null;
        fields.forEach(function (field) {
          if (!validateField(field) && !firstBad) firstBad = field;
        });

        if (firstBad) {
          if (status) {
            status.className = 'form-status is-error';
            status.textContent = 'Please fix the highlighted fields and send again.';
          }
          firstBad.focus();
          return;
        }

        if (status) {
          status.className = 'form-status is-success';
          status.textContent = form.dataset.successMessage ||
            'Thank you. Your message has been received and we reply within two business days.';
          status.focus();
        }
        form.reset();
      });
    });
  }

  /* ======================================================================
     09. RECIPE TOOLS
     Unit toggle, servings scaler, ingredient checklist.

     Quantities are authored in US customary units on the element itself:
       <span class="amt" data-qty="1.5" data-unit="cup"></span>
     The script renders the label for the current unit system and scale.
     US cup = 240 ml. US tablespoon = 15 ml. US teaspoon = 5 ml.
     ====================================================================== */
  var VULGAR = { 0.125: '⅛', 0.25: '¼', 0.333: '⅓', 0.375: '⅜',
                 0.5: '½', 0.625: '⅝', 0.667: '⅔', 0.75: '¾', 0.875: '⅞' };

  function toFraction(value) {
    if (!isFinite(value)) return '';
    var whole = Math.floor(value + 1e-9);
    var rest = value - whole;
    var best = null;
    var bestDiff = 0.041; // snap only when genuinely close to a kitchen fraction
    Object.keys(VULGAR).forEach(function (k) {
      var diff = Math.abs(rest - parseFloat(k));
      if (diff < bestDiff) { bestDiff = diff; best = VULGAR[k]; }
    });
    if (rest < 0.04) return String(whole);
    if (best) return (whole > 0 ? whole + ' ' : '') + best;
    return (Math.round(value * 100) / 100).toString();
  }

  function roundMetric(n) {
    if (n >= 500) return Math.round(n / 25) * 25;
    if (n >= 100) return Math.round(n / 5) * 5;
    if (n >= 20) return Math.round(n);
    return Math.round(n * 10) / 10;
  }

  // Volume units convert to millilitres, weight units to grams.
  var METRIC = {
    cup:     { factor: 240, unit: 'ml' },
    tbsp:    { factor: 15,  unit: 'ml' },
    tsp:     { factor: 5,   unit: 'ml' },
    floz:    { factor: 30,  unit: 'ml' },
    pint:    { factor: 480, unit: 'ml' },
    quart:   { factor: 950, unit: 'ml' },
    gallon:  { factor: 3800, unit: 'ml' },
    oz:      { factor: 28,  unit: 'g' },
    lb:      { factor: 454, unit: 'g' },
    inch:    { factor: 2.5, unit: 'cm' }
  };

  var UNIT_LABEL = {
    cup: ['cup', 'cups'],
    tbsp: ['Tbsp', 'Tbsp'],
    tsp: ['tsp', 'tsp'],
    floz: ['fl oz', 'fl oz'],
    pint: ['pint', 'pints'],
    quart: ['quart', 'quarts'],
    gallon: ['gallon', 'gallons'],
    oz: ['oz', 'oz'],
    lb: ['lb', 'lb'],
    inch: ['inch', 'inches'],
    clove: ['clove', 'cloves'],
    can: ['can', 'cans'],
    slice: ['slice', 'slices'],
    sprig: ['sprig', 'sprigs'],
    bunch: ['bunch', 'bunches'],
    stalk: ['stalk', 'stalks'],
    ear: ['ear', 'ears'],
    piece: ['', ''],
    pinch: ['pinch', 'pinches'],
    handful: ['handful', 'handfuls'],
    package: ['package', 'packages'],
    large: ['large', 'large'],
    medium: ['medium', 'medium'],
    small: ['small', 'small']
  };

  function renderAmount(el, system, scale) {
    var qty = parseFloat(el.dataset.qty);
    var unit = el.dataset.unit || 'piece';

    if (isNaN(qty)) { el.textContent = el.dataset.text || ''; return; }

    var scaled = qty * scale;

    if (system === 'metric' && METRIC[unit]) {
      var m = METRIC[unit];
      var value = roundMetric(scaled * m.factor);
      // Roll millilitres up to liters and grams up to kilograms when it reads better.
      if (m.unit === 'ml' && value >= 1000) {
        el.textContent = (Math.round(value / 50) * 50 / 1000) + ' l';
      } else if (m.unit === 'g' && value >= 1000) {
        el.textContent = (Math.round(value / 50) * 50 / 1000) + ' kg';
      } else {
        el.textContent = value + ' ' + m.unit;
      }
      return;
    }

    var labels = UNIT_LABEL[unit] || [unit, unit];
    var label = scaled > 1.0001 ? labels[1] : labels[0];
    var num = toFraction(scaled);
    el.textContent = label ? (num + ' ' + label) : num;
  }

  function initRecipeTools() {
    $$('[data-recipe]').forEach(setupRecipe);
  }

  function setupRecipe(root) {
    var amounts = $$('.amt', root);
    var baseServings = parseFloat(root.dataset.servings) || 4;
    // Some yields step in useful chunks (tacos in twos, cookies in sixes).
    var step = parseFloat(root.dataset.step) || 1;
    var servings = baseServings;
    var system = store.get('sg-units') === 'metric' ? 'metric' : 'us';

    var output = $('[data-role="servings-value"]', root);
    var minus = $('[data-role="servings-minus"]', root);
    var plus = $('[data-role="servings-plus"]', root);
    var unitButtons = $$('.unit-toggle button', root);
    var noun = root.dataset.servingNoun || 'servings';

    function paint() {
      var scale = servings / baseServings;
      amounts.forEach(function (el) { renderAmount(el, system, scale); });
      if (output) {
        output.textContent = servings + ' ' + (servings === 1 ? noun.replace(/s$/, '') : noun);
      }
      if (minus) minus.disabled = servings <= step;
      if (plus) plus.disabled = servings >= baseServings * 4;
      // Yield line and any scaled numbers inside the method text.
      $$('[data-scale-note]', root).forEach(function (el) {
        el.textContent = el.dataset.scaleNote.replace('{n}', servings);
      });
      unitButtons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.system === system));
      });
    }

    if (minus) minus.addEventListener('click', function () {
      servings = Math.max(step, servings - step);
      paint();
    });
    if (plus) plus.addEventListener('click', function () {
      servings = Math.min(baseServings * 4, servings + step);
      paint();
    });

    unitButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        system = b.dataset.system;
        store.set('sg-units', system);
        paint();
      });
    });

    paint();

    // Ingredient checklist: ticks survive a page refresh while cooking.
    var key = 'sg-checked-' + (root.dataset.recipe || window.location.pathname);
    var saved = {};
    try { saved = JSON.parse(store.get(key) || '{}'); } catch (e) { saved = {}; }

    var boxes = $$('.ing-item input[type="checkbox"]', root);
    boxes.forEach(function (box, i) {
      if (saved[i]) box.checked = true;
      box.addEventListener('change', function () {
        saved[i] = box.checked;
        store.set(key, JSON.stringify(saved));
      });
    });

    var clear = $('[data-role="clear-checks"]', root);
    if (clear) {
      clear.addEventListener('click', function () {
        boxes.forEach(function (b) { b.checked = false; });
        store.remove(key);
        saved = {};
      });
    }
  }

  /* ======================================================================
     09b. PAGE-LEVEL UNIT TOGGLE
     Collection pages carry several recipes at once. One toggle at the top
     converts every quantity on the page, at their written yields.
     ====================================================================== */
  function initPageUnits() {
    var scope = $('[data-unit-scope]');
    if (!scope) return;

    var amounts = $$('.amt', scope);
    var buttons = $$('[data-unit-scope] .unit-toggle button');
    var system = store.get('sg-units') === 'metric' ? 'metric' : 'us';

    function paint() {
      amounts.forEach(function (el) { renderAmount(el, system, 1); });
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.system === system));
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        system = b.dataset.system;
        store.set('sg-units', system);
        paint();
      });
    });

    paint();

    // Checklist ticks on collection pages persist per recipe block.
    $$('[data-collection-recipe]', scope).forEach(function (block) {
      var key = 'sg-checked-' + block.dataset.collectionRecipe;
      var saved = {};
      try { saved = JSON.parse(store.get(key) || '{}'); } catch (e) { saved = {}; }
      $$('.ing-item input[type="checkbox"]', block).forEach(function (box, i) {
        if (saved[i]) box.checked = true;
        box.addEventListener('change', function () {
          saved[i] = box.checked;
          store.set(key, JSON.stringify(saved));
        });
      });
    });
  }

  /* ======================================================================
     10. RECIPE INDEX FILTERING
     ====================================================================== */
  function initFilters() {
    var form = $('#recipe-filters');
    if (!form) return;

    var cards = $$('[data-recipe-card]');
    var count = $('#filter-count');
    var empty = $('#no-results');
    var search = $('#f-search');
    var course = $('#f-course');
    var cuisine = $('#f-cuisine');
    var diet = $('#f-diet');
    var timeSel = $('#f-time');

    function apply() {
      var q = (search && search.value || '').trim().toLowerCase();
      var c = course ? course.value : '';
      var cu = cuisine ? cuisine.value : '';
      var d = diet ? diet.value : '';
      var t = timeSel ? parseInt(timeSel.value, 10) : 0;
      var shown = 0;

      cards.forEach(function (card) {
        var haystack = (card.dataset.title + ' ' + card.dataset.keywords).toLowerCase();
        var ok = true;
        if (q && haystack.indexOf(q) === -1) ok = false;
        if (c && card.dataset.course !== c) ok = false;
        if (cu && card.dataset.cuisine !== cu) ok = false;
        if (d && (card.dataset.diet || '').indexOf(d) === -1) ok = false;
        if (t && parseInt(card.dataset.total, 10) > t) ok = false;
        card.hidden = !ok;
        if (ok) shown++;
      });

      if (count) {
        count.textContent = shown === cards.length
          ? 'Showing all ' + cards.length + ' recipes'
          : 'Showing ' + shown + ' of ' + cards.length + ' recipes';
      }
      if (empty) empty.hidden = shown !== 0;
    }

    [search, course, cuisine, diet, timeSel].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });

    form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });

    var reset = $('#filter-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        form.reset();
        apply();
      });
    }

    apply();
  }

  /* ======================================================================
     11. PRINT
     ====================================================================== */
  function initPrint() {
    $$('.js-print').forEach(function (btn) {
      btn.addEventListener('click', function () { window.print(); });
    });
  }

  /* ======================================================================
     12. YEAR STAMPS
     ====================================================================== */
  function initYear() {
    var y = String(new Date().getFullYear());
    $$('.js-year').forEach(function (el) { el.textContent = y; });
  }

  /* ======================================================================
     BOOT
     ====================================================================== */
  function boot() {
    initMobileNav();
    initDropdowns();
    initAccordions();
    initReveals();
    initBackToTop();
    initCookieBanner();
    initForms();
    initRecipeTools();
    initPageUnits();
    initFilters();
    initPrint();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
