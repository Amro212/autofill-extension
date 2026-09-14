import { FIELD_TYPES, UI_IDS } from '../constants.js';
import { extractLabel, extractGroupLabel, extractOptionLabel, extractDescription } from './labels.js';
import { logger } from '../debug.js';

let fieldCounter = 0;

function isVisible(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) {
    if (el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') {
      return true;
    }
    return false;
  }
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
}

function isInsideCopilot(el) {
  return Boolean(el.closest(`#${UI_IDS.CONTAINER}`) || el.closest(`#${UI_IDS.INLINE_REWRITE}`));
}

function isRequired(el, labelText) {
  if (el.hasAttribute('required') || el.required) return true;
  if (el.getAttribute('aria-required') === 'true') return true;
  if (el.getAttribute('data-required') === 'true') return true;
  if (labelText && /\*\s*$/.test(labelText)) return true;
  return false;
}

function extractConstraints(el) {
  const constraints = {};
  if (el.maxLength > 0 && el.maxLength < 100000) constraints.maxLength = el.maxLength;
  if (el.minLength > 0) constraints.minLength = el.minLength;
  if (el.pattern) constraints.pattern = el.pattern;
  if (el.min) constraints.min = el.min;
  if (el.max) constraints.max = el.max;
  return constraints;
}

function buildFieldSelector(el) {
  try {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) return `[name="${CSS.escape(el.name)}"]`;
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;
  } catch {}
  return '';
}

function extractComboboxOptionsAndValue(el, root) {
  const options = [];
  let currentValue = '';
  const fieldLabel = el.getAttribute('aria-label') || el.closest('label')?.textContent?.trim()?.slice(0, 40) || el.id || '(unknown)';

  // 1. Linked listbox via aria-controls / aria-owns (most reliable)
  const controlsId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
  let listbox = controlsId ? (root.getElementById ? root.getElementById(controlsId) : document.getElementById(controlsId)) : null;

  // 2. Find the TIGHT container — avoid overly broad selectors like [class*="-container"]
  //    which can match the entire page wrapper and cross-contaminate options between fields.
  const container =
    el.closest('[data-testid*="select"], [class*="select-shell"], [class*="select__container"]') ||
    el.closest('[role="combobox"]') ||
    el.closest('.form-group, .field') ||
    el.parentElement;

  if (!listbox && container) {
    // Only look for specific dropdown structures, NOT bare 'ul' which matches navigation lists etc.
    listbox = container.querySelector('[role="listbox"], .select__menu, [class*="menu-list"]');
  }

  // NOTE: We intentionally do NOT fall back to document.querySelector here.
  // At scan time, no dropdowns should be open, so a global search would find stale/wrong menus.
  // The harvestComboboxOptions() function handles dynamic discovery at fill time instead.

  // If listbox found, harvest options
  if (listbox) {
    const optEls = listbox.querySelectorAll('[role="option"], .select__option');
    for (const opt of optEls) {
      const text = opt.textContent?.trim();
      const val = opt.getAttribute('data-value') || opt.getAttribute('value') || text;
      if (text && text.length < 200 && !/select|choose|\.\.\./i.test(text)) {
        options.push({ value: val, label: text });
      }
    }
    logger.info(`Scan[${fieldLabel}]: found ${options.length} options from open listbox`);
  }

  // 3. Look for hidden backing <select> element — but ONLY if it's tightly scoped.
  //    Check that the <select> is a direct child or very close descendant, not from another field.
  if (options.length === 0 && container) {
    // Only look within the immediate combobox container (el itself or its direct parent)
    const tightScope = el.closest('[role="combobox"]') || el.parentElement;
    const hiddenSelect = tightScope?.querySelector('select');
    if (hiddenSelect && hiddenSelect.options.length > 0) {
      for (const opt of hiddenSelect.options) {
        if (opt.value && !/select|choose|--/i.test(opt.text)) {
          options.push({ value: opt.value, label: opt.text.trim() });
        }
      }
      if (options.length > 0) {
        logger.info(`Scan[${fieldLabel}]: found ${options.length} options from backing <select>`);
      }
    }
  }

  if (options.length === 0) {
    logger.info(`Scan[${fieldLabel}]: no options found at scan time (will harvest dynamically)`);
  }

  // 4. Current value resolution
  if (container) {
    const singleValueEl = container.querySelector('.select__single-value, [class*="singleValue"]');
    if (singleValueEl && singleValueEl.textContent.trim()) {
      currentValue = singleValueEl.textContent.trim();
    }
  }

  if (!currentValue) {
    const ariaVal = el.getAttribute('aria-valuetext') || el.value || '';
    const rawVal = ariaVal.trim();
    if (rawVal && !/select|choose|\.\.\./i.test(rawVal)) {
      currentValue = rawVal;
    }
  }

  return { options, currentValue };
}

export function scanFormFields(root = document) {
  fieldCounter = 0;
  const detectedFields = [];
  const processedElements = new Set();
  const processedRadioGroups = new Set();

  const candidates = Array.from(root.querySelectorAll(`
    input,
    textarea,
    select,
    [contenteditable="true"],
    [role="combobox"],
    button[aria-haspopup="listbox"]
  `)).filter((el) => !isInsideCopilot(el));

  for (const el of candidates) {
    if (processedElements.has(el)) continue;

    const tagName = el.tagName.toLowerCase();
    const typeAttr = (el.getAttribute('type') || '').toLowerCase();

    // Skip non-fillable inputs
    if (typeAttr === 'hidden' || typeAttr === 'submit' || typeAttr === 'button' || typeAttr === 'reset' || typeAttr === 'image' || typeAttr === 'password') {
      continue;
    }

    if (!isVisible(el) && !['select', 'radio', 'checkbox'].includes(typeAttr)) {
      continue;
    }

    // 1. Radio button groups
    if (typeAttr === 'radio') {
      const groupName = el.getAttribute('name');
      if (groupName && processedRadioGroups.has(groupName)) {
        continue;
      }
      if (groupName) processedRadioGroups.add(groupName);

      const radioEls = groupName
        ? Array.from(root.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`)).filter((r) => !isInsideCopilot(r))
        : [el];

      radioEls.forEach((r) => processedElements.add(r));

      const groupLabel = extractGroupLabel(radioEls, groupName);
      const description = extractDescription(el);
      const options = radioEls.map((r) => {
        const optionLabel = extractOptionLabel(r);
        return {
          value: r.value || optionLabel,
          label: optionLabel || r.value,
          checked: r.checked,
        };
      });

      const checkedRadio = radioEls.find((r) => r.checked);
      const currentValue = checkedRadio ? (checkedRadio.value || extractOptionLabel(checkedRadio)) : '';

      detectedFields.push({
        id: el.name || el.id || `jc_field_${++fieldCounter}`,
        name: el.name || '',
        selector: buildFieldSelector(el),
        type: FIELD_TYPES.RADIO,
        element: el,
        elements: radioEls,
        label: groupLabel,
        description,
        required: radioEls.some((r) => isRequired(r, groupLabel)),
        currentValue,
        options,
        constraints: {},
        isNarrative: false,
      });
      continue;
    }

    // 2. Checkboxes
    if (typeAttr === 'checkbox') {
      processedElements.add(el);
      const label = extractOptionLabel(el) || extractLabel(el);
      const description = extractDescription(el);

      detectedFields.push({
        id: el.id || el.name || `jc_field_${++fieldCounter}`,
        name: el.name || '',
        selector: buildFieldSelector(el),
        type: FIELD_TYPES.CHECKBOX,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue: el.checked ? 'true' : 'false',
        checked: el.checked,
        options: [
          { value: 'true', label: 'Yes / Checked' },
          { value: 'false', label: 'No / Unchecked' },
        ],
        constraints: {},
        isNarrative: false,
      });
      continue;
    }

    // 3. Native Select
    if (tagName === 'select') {
      processedElements.add(el);
      const label = extractLabel(el);
      const description = extractDescription(el);
      const options = Array.from(el.options).map((opt) => ({
        value: opt.value,
        label: opt.text.trim(),
        selected: opt.selected,
      })).filter((opt) => opt.value || opt.label);

      const selectedOption = el.options[el.selectedIndex];
      const isPlaceholder = !selectedOption || selectedOption.value === '' || /--|select|choose/i.test(selectedOption.text);
      const currentValue = !isPlaceholder && selectedOption ? (selectedOption.value || selectedOption.text.trim()) : '';

      detectedFields.push({
        id: el.id || el.name || `jc_field_${++fieldCounter}`,
        name: el.name || '',
        selector: buildFieldSelector(el),
        type: FIELD_TYPES.SELECT,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue,
        options,
        constraints: {},
        isNarrative: false,
      });
      continue;
    }

    // 4. Textarea
    if (tagName === 'textarea') {
      processedElements.add(el);
      const label = extractLabel(el);
      const description = extractDescription(el);

      detectedFields.push({
        id: el.id || el.name || `jc_field_${++fieldCounter}`,
        name: el.name || '',
        selector: buildFieldSelector(el),
        type: FIELD_TYPES.TEXTAREA,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue: el.value || '',
        options: [],
        constraints: extractConstraints(el),
        isNarrative: true,
      });
      continue;
    }

    // 5. Contenteditable
    if (el.getAttribute('contenteditable') === 'true') {
      processedElements.add(el);
      const label = extractLabel(el);
      const description = extractDescription(el);

      detectedFields.push({
        id: el.id || `jc_field_${++fieldCounter}`,
        name: '',
        selector: buildFieldSelector(el),
        type: FIELD_TYPES.CONTENTEDITABLE,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue: el.textContent || '',
        options: [],
        constraints: {},
        isNarrative: true,
      });
      continue;
    }

    // 6. Custom Combobox [role="combobox"] or aria-haspopup="listbox"
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox') {
      processedElements.add(el);
      const label = extractLabel(el);
      const description = extractDescription(el);
      const { options, currentValue } = extractComboboxOptionsAndValue(el, root);

      detectedFields.push({
        id: el.id || el.getAttribute('name') || `jc_field_${++fieldCounter}`,
        name: el.getAttribute('name') || '',
        selector: buildFieldSelector(el),
        type: FIELD_TYPES.COMBOBOX,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue,
        options,
        constraints: {},
        isNarrative: false,
      });
      continue;
    }

    // 7. Standard text-like inputs
    processedElements.add(el);
    const label = extractLabel(el);
    const description = extractDescription(el);
    
    let fieldType = FIELD_TYPES.TEXT;
    if (typeAttr === 'email') fieldType = FIELD_TYPES.EMAIL;
    else if (typeAttr === 'tel') fieldType = FIELD_TYPES.TEL;
    else if (typeAttr === 'url') fieldType = FIELD_TYPES.URL;
    else if (typeAttr === 'number') fieldType = FIELD_TYPES.NUMBER;

    const isNarrative = label.length > 50 || /describe|explain|why|tell us about|cover letter/i.test(label);

    detectedFields.push({
      id: el.id || el.name || `jc_field_${++fieldCounter}`,
      name: el.name || '',
      selector: buildFieldSelector(el),
      type: fieldType,
      element: el,
      label,
      description,
      required: isRequired(el, label),
      currentValue: el.value || '',
      options: [],
      constraints: extractConstraints(el),
      isNarrative,
    });
  }

  return detectedFields;
}

/**
 * Dynamically harvests options for combobox fields that returned zero options
 * from the static scan. Opens each dropdown briefly, reads the rendered options,
 * then closes it — all before the AI request so it receives exact option labels.
 */
export async function harvestComboboxOptions(fields) {
  const comboboxesNeedingOptions = fields.filter(
    (f) => f.type === FIELD_TYPES.COMBOBOX && (!f.options || f.options.length === 0)
  );

  if (comboboxesNeedingOptions.length === 0) {
    logger.info('Harvest: all comboboxes already have options, skipping.');
    return fields;
  }

  logger.info(`Harvest: ${comboboxesNeedingOptions.length} combobox(es) need dynamic option discovery.`);

  for (const field of comboboxesNeedingOptions) {
    try {
      const el = field.element;
      if (!el) {
        logger.warn(`Harvest: skipping "${field.label}" — element is null.`);
        continue;
      }

      logger.info(`Harvest: opening dropdown for "${field.label}"...`);

      // --- Resolve combobox parts (mirrors fillers.js resolveComboboxParts) ---
      const container =
        el.closest('[data-testid*="select"], [class*="select-shell"], [class*="select__container"]') ||
        el.closest('.form-group, .field, [class*="-container"], [role="combobox"]') ||
        el.parentElement?.closest('.form-group, .field, [class*="-container"]') ||
        el.parentElement ||
        el;

      const input = (el instanceof HTMLInputElement)
        ? el
        : container.querySelector('input:not([type="hidden"])') || el.querySelector?.('input:not([type="hidden"])');

      const toggleBtn =
        container.querySelector('button[aria-label*="toggle" i], button[aria-label*="open" i], .select__indicators button, [class*="indicator"], [class*="arrow"], [class*="dropdown-arrow"]') ||
        container.querySelector('button');

      const controlBox =
        container.querySelector('.select__control, [class*="control"], [class*="combobox-input"]') ||
        el;

      // --- Dismiss any currently open dropdowns ---
      try {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
        }));
      } catch {}
      try {
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));

      // --- Open this dropdown ---
      if (controlBox && controlBox !== input) {
        try {
          controlBox.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true }));
          controlBox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
          controlBox.click();
        } catch {}
      }
      if (input) {
        try { input.focus(); } catch {}
        try {
          input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true }));
          input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
          input.click();
        } catch {}
      }

      // Wait for dropdown to render
      await new Promise((r) => setTimeout(r, 300));

      // If no listbox appeared, try the toggle button
      let hasMenu = document.querySelector('[role="listbox"], .select__menu, [class*="menu-list"]');
      if (!hasMenu && toggleBtn && toggleBtn !== controlBox) {
        try { toggleBtn.click(); } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }

      // --- Discover options ---
      const harvested = [];

      // 1. Via aria-controls/aria-owns
      const ariaSource = el.getAttribute?.('aria-controls') || el.getAttribute?.('aria-owns') ||
        container.querySelector('[aria-controls], [aria-owns]')?.getAttribute?.('aria-controls') ||
        container.querySelector('[aria-controls], [aria-owns]')?.getAttribute?.('aria-owns');
      let listbox = ariaSource ? document.getElementById(ariaSource) : null;

      // 2. Inside the container
      if (!listbox) {
        listbox = container.querySelector('[role="listbox"], .select__menu, [class*="menu-list"], ul[role="listbox"]');
      }

      // 3. Portaled menu fallback (only if exactly one is open)
      if (!listbox) {
        const allMenus = document.querySelectorAll('[role="listbox"], .select__menu, [class*="menu-list"]');
        if (allMenus.length === 1) listbox = allMenus[0];
      }

      if (listbox) {
        const optEls = listbox.querySelectorAll('[role="option"], li, .select__option');
        for (const opt of optEls) {
          const text = (opt.textContent || '').trim();
          const val = opt.getAttribute('data-value') || opt.getAttribute('value') || text;
          if (text && text.length < 200 && !/select\.\.\.|choose\.\.\./i.test(text)) {
            // Deduplicate by label
            if (!harvested.some((h) => h.label === text)) {
              harvested.push({ value: val, label: text });
            }
          }
        }
      }

      // --- Close the dropdown ---
      try {
        (input || el).dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
        }));
      } catch {}
      try {
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));

      // --- Attach harvested options to the field ---
      if (harvested.length > 0) {
        field.options = harvested;
        logger.info(`Harvest: found ${harvested.length} options for "${field.label}" (first: "${harvested[0].label}")`);
      } else {
        logger.warn(`Harvest: no options found for "${field.label}" after opening dropdown.`);
      }
    } catch (err) {
      logger.warn(`Harvest: error processing "${field.label}": ${err.message}`);
    }
  }

  logger.info('Harvest: dynamic option discovery complete.');
  return fields;
}
