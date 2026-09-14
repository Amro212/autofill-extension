import { FIELD_TYPES } from '../constants.js';
import { extractOptionLabel } from './labels.js';

function setNativeInputValue(element, value) {
  try {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  } catch {
    try {
      element.value = value;
    } catch {}
  }
}

function setNativeChecked(element, checked) {
  try {
    const checkedSetter = Object.getOwnPropertyDescriptor(element, 'checked')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeCheckedSetter = Object.getOwnPropertyDescriptor(prototype, 'checked')?.set;

    if (prototypeCheckedSetter && checkedSetter !== prototypeCheckedSetter) {
      prototypeCheckedSetter.call(element, checked);
    } else if (checkedSetter) {
      checkedSetter.call(element, checked);
    } else {
      element.checked = checked;
    }
  } catch {
    try {
      element.checked = checked;
    } catch {}
  }
}

function dispatchEventSequence(element, eventTypes = ['input', 'change']) {
  try {
    element.dispatchEvent(new Event('focus', { bubbles: true }));
  } catch {}

  for (const type of eventTypes) {
    try {
      const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
      element.dispatchEvent(event);
    } catch {}
  }

  try {
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  } catch {}
}

export function fillTextInput(element, value) {
  if (!element) return false;
  const strVal = value !== null && value !== undefined ? String(value) : '';
  
  try {
    element.focus();
  } catch {}
  setNativeInputValue(element, strVal);
  dispatchEventSequence(element, ['input', 'change']);
  return true;
}

export function fillTextarea(element, value) {
  if (!element) return false;
  const strVal = value !== null && value !== undefined ? String(value) : '';

  try {
    element.focus();
  } catch {}
  setNativeInputValue(element, strVal);
  dispatchEventSequence(element, ['input', 'change']);
  return true;
}

export function fillSelect(element, targetValue) {
  if (!element || !(element instanceof HTMLSelectElement)) return false;
  const targetStr = String(targetValue).trim().toLowerCase();
  if (!targetStr) return false;

  const validOptions = Array.from(element.options).filter((opt) => {
    const isPlaceholder = opt.value === '' || /--|select|choose/i.test(opt.text);
    return !isPlaceholder;
  });

  let matchedOption = null;

  // 1. Match exact value
  for (const opt of validOptions) {
    if (opt.value.trim().toLowerCase() === targetStr) {
      matchedOption = opt;
      break;
    }
  }

  // 2. Match exact label text
  if (!matchedOption) {
    for (const opt of validOptions) {
      if (opt.text.trim().toLowerCase() === targetStr) {
        matchedOption = opt;
        break;
      }
    }
  }

  // 3. Match prefix / contains
  if (!matchedOption) {
    for (const opt of validOptions) {
      const optText = opt.text.trim().toLowerCase();
      if (optText.startsWith(targetStr) || targetStr.startsWith(optText)) {
        matchedOption = opt;
        break;
      }
    }
  }

  // 4. Match substring tokens (e.g. "senior", "mid", "entry", "lead", "yes", "no")
  if (!matchedOption) {
    for (const opt of validOptions) {
      const optText = opt.text.trim().toLowerCase();
      const optVal = opt.value.trim().toLowerCase();
      if (optText.includes(targetStr) || optVal.includes(targetStr) || targetStr.includes(optVal)) {
        matchedOption = opt;
        break;
      }
    }
  }

  if (matchedOption) {
    try {
      element.focus();
    } catch {}
    matchedOption.selected = true;
    element.selectedIndex = matchedOption.index;
    setNativeInputValue(element, matchedOption.value);
    dispatchEventSequence(element, ['input', 'change']);
    return true;
  }

  return false;
}

export function fillRadioGroup(elements, targetValue) {
  if (!Array.isArray(elements) || elements.length === 0) return false;
  const targetStr = String(targetValue).trim().toLowerCase();
  if (!targetStr) return false;

  let matchedRadio = null;

  // 1. Exact value match
  for (const r of elements) {
    if (r.value.trim().toLowerCase() === targetStr) {
      matchedRadio = r;
      break;
    }
  }

  // 2. Exact label match
  if (!matchedRadio) {
    for (const r of elements) {
      const optLabel = extractOptionLabel(r).toLowerCase();
      if (optLabel === targetStr) {
        matchedRadio = r;
        break;
      }
    }
  }

  // 3. Boolean semantic match (Yes vs No)
  if (!matchedRadio) {
    const isYes = ['yes', 'true', '1', 'authorized', 'eligible', 'agree'].includes(targetStr);
    const isNo = ['no', 'false', '0', 'declined', 'disagree', 'not'].includes(targetStr);

    for (const r of elements) {
      const optVal = r.value.trim().toLowerCase();
      const optLabel = extractOptionLabel(r).toLowerCase();

      if (isYes) {
        if (optVal === 'yes' || optVal === 'true' || optVal === '1' || optLabel.startsWith('yes') || optLabel.startsWith('true') || optLabel.startsWith('i am authorized')) {
          matchedRadio = r;
          break;
        }
      } else if (isNo) {
        if (optVal === 'no' || optVal === 'false' || optVal === '0' || optLabel.startsWith('no') || optLabel.startsWith('false') || optLabel.startsWith('i am not')) {
          matchedRadio = r;
          break;
        }
      }
    }
  }

  // 4. Substring label match
  if (!matchedRadio) {
    for (const r of elements) {
      const optLabel = extractOptionLabel(r).toLowerCase();
      if (optLabel.includes(targetStr) || targetStr.includes(optLabel)) {
        matchedRadio = r;
        break;
      }
    }
  }

  if (matchedRadio) {
    try {
      matchedRadio.focus();
    } catch {}
    setNativeChecked(matchedRadio, true);
    dispatchEventSequence(matchedRadio, ['click', 'input', 'change']);
    return true;
  }

  return false;
}

export function fillCheckbox(element, targetValue) {
  if (!element) return false;
  const targetStr = String(targetValue).trim().toLowerCase();
  const shouldBeChecked = targetValue === true || ['true', 'yes', '1', 'checked', 'agree'].includes(targetStr);

  try {
    element.focus();
  } catch {}
  setNativeChecked(element, shouldBeChecked);
  dispatchEventSequence(element, ['click', 'input', 'change']);
  return true;
}

// --- Combobox helpers ---

const COUNTRY_SYNONYMS = {
  'us': ['united states', 'united states of america', 'usa', 'u.s.', 'u.s.a.'],
  'usa': ['united states', 'united states of america', 'us', 'u.s.', 'u.s.a.'],
  'united states': ['united states of america', 'usa', 'us', 'u.s.', 'u.s.a.'],
  'united states of america': ['united states', 'usa', 'us', 'u.s.', 'u.s.a.'],
  'uk': ['united kingdom', 'great britain', 'england'],
  'united kingdom': ['uk', 'great britain', 'england'],
  'great britain': ['uk', 'united kingdom', 'england'],
  'ca': ['canada'],
  'canada': ['ca'],
  'uae': ['united arab emirates'],
  'united arab emirates': ['uae'],
};

function resolveComboboxParts(element) {
  // Find the outermost container — walk up through common wrapper patterns
  const container =
    element.closest('[data-testid*="select"], [class*="select-shell"], [class*="select__container"]') ||
    element.closest('.form-group, .field, [class*="-container"], [role="combobox"]') ||
    element.parentElement?.closest('.form-group, .field, [class*="-container"]') ||
    element.parentElement ||
    element;

  // The searchable text input
  const input = (element instanceof HTMLInputElement)
    ? element
    : container.querySelector('input:not([type="hidden"])') || element.querySelector?.('input:not([type="hidden"])');

  // Toggle / indicator button
  const toggleBtn =
    container.querySelector('button[aria-label*="toggle" i], button[aria-label*="open" i], .select__indicators button, [class*="indicator"], [class*="arrow"], [class*="dropdown-arrow"]') ||
    container.querySelector('button');

  // The interactive control box (react-select uses .select__control)
  const controlBox =
    container.querySelector('.select__control, [class*="control"], [class*="combobox-input"]') ||
    element;

  return { container, input, toggleBtn, controlBox };
}

function dispatchPointerAndMouse(el, type, opts = {}) {
  const base = { bubbles: true, cancelable: true, composed: true, ...opts };
  try { el.dispatchEvent(new PointerEvent('pointer' + type, base)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mouse' + type, base)); } catch {}
}

function clickOption(opt) {
  try { opt.scrollIntoView?.({ block: 'nearest' }); } catch {}

  // Full pointer + mouse sequence that works across React, MUI, Radix, Downshift, Headless UI
  dispatchPointerAndMouse(opt, 'over');
  dispatchPointerAndMouse(opt, 'enter');
  dispatchPointerAndMouse(opt, 'move');
  dispatchPointerAndMouse(opt, 'down');
  try { opt.click(); } catch {}
  dispatchPointerAndMouse(opt, 'up');
}

function discoverOptions(container, element) {
  // 1. Use aria-controls/aria-owns to find the CORRECT linked listbox (most reliable for portaled menus)
  const ariaSource = element || container.querySelector('[aria-controls], [aria-owns]');
  if (ariaSource) {
    const controlsId = ariaSource.getAttribute?.('aria-controls') || ariaSource.getAttribute?.('aria-owns');
    if (controlsId) {
      const linked = document.getElementById(controlsId);
      if (linked) {
        const options = Array.from(linked.querySelectorAll('[role="option"], li, .select__option')).filter(el => {
          const text = (el.textContent || '').trim();
          return text.length > 0 && text.length < 200;
        });
        if (options.length > 0) return options;
      }
    }
  }

  // 2. Try inside the container (non-portaled dropdowns)
  const menu = container.querySelector('[role="listbox"], .select__menu, [class*="menu-list"], ul[role="listbox"]');
  if (menu) {
    const options = Array.from(menu.querySelectorAll('[role="option"], li, .select__option, div[id*="option"]')).filter(el => {
      const text = (el.textContent || '').trim();
      return text.length > 0 && text.length < 200;
    });
    if (options.length > 0) return options;
  }

  // 3. Fallback — search for portaled menus on document, but ONLY if there is exactly ONE open menu
  //    (if there are multiple, we can't know which one belongs to this field)
  const allMenus = document.querySelectorAll('[role="listbox"], .select__menu, [class*="menu-list"]');
  if (allMenus.length === 1) {
    const options = Array.from(allMenus[0].querySelectorAll('[role="option"], li, .select__option')).filter(el => {
      const text = (el.textContent || '').trim();
      return text.length > 0 && text.length < 200;
    });
    if (options.length > 0) return options;
  }

  return [];
}

function scoreMatch(optText, optVal, targetLower) {
  // Returns a score — higher is better. 0 = no match.
  if (optText === targetLower || optVal === targetLower) return 100; // exact
  if (optText.startsWith(targetLower)) return 80; // target is prefix of option
  if (targetLower.startsWith(optText) && optText.length > 2) return 70; // option is prefix of target

  // Synonym expansion (countries, etc.)
  const synonyms = COUNTRY_SYNONYMS[targetLower];
  if (synonyms) {
    for (const syn of synonyms) {
      if (optText === syn) return 95;
      if (optText.startsWith(syn)) return 75;
    }
  }

  if (optText.includes(targetLower)) return 50; // substring
  if (targetLower.includes(optText) && optText.length > 3) return 40; // reverse substring

  return 0;
}

function findBestOption(options, targetLower) {
  let bestOpt = null;
  let bestScore = 0;

  for (const opt of options) {
    const optText = (opt.textContent || '').trim().toLowerCase();
    const optVal = (opt.getAttribute('data-value') || opt.getAttribute('value') || '').trim().toLowerCase();

    const score = scoreMatch(optText, optVal, targetLower);
    if (score > bestScore) {
      bestScore = score;
      bestOpt = opt;
      if (score === 100) break; // can't beat exact
    }
  }

  return bestOpt;
}

async function dismissOpenDropdowns() {
  // Close any currently open dropdowns before opening a new one
  // This prevents cross-contamination between combobox fields
  try {
    // Press Escape to close any open menu
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
    }));
  } catch {}

  // Click document body to dismiss portaled dropdowns
  try {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  } catch {}

  // Wait for dropdown to close
  await new Promise(r => setTimeout(r, 100));

  // Blur any focused element
  try {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  } catch {}

  await new Promise(r => setTimeout(r, 50));
}

async function openDropdown(input, controlBox, toggleBtn) {
  // Strategy 1: Click the control box (works for react-select, MUI)
  if (controlBox && controlBox !== input) {
    dispatchPointerAndMouse(controlBox, 'down');
    try { controlBox.click(); } catch {}
  }

  // Strategy 2: Focus + mousedown on input (works for searchable combos)
  if (input) {
    try { input.focus(); } catch {}
    dispatchPointerAndMouse(input, 'down');
    try { input.click(); } catch {}
  }

  // Brief wait for dropdown to start rendering
  await new Promise(r => setTimeout(r, 80));

  // Strategy 3: If no listbox appeared yet, try the toggle button
  const hasMenu = document.querySelector('[role="listbox"], .select__menu, [class*="menu-list"]');
  if (!hasMenu && toggleBtn && toggleBtn !== controlBox) {
    try { toggleBtn.click(); } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
}

async function typeSearchText(input, searchText) {
  if (!input) return;

  // Clear existing text first
  setNativeInputValue(input, '');
  try {
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
  } catch {}

  await new Promise(r => setTimeout(r, 30));

  // Type the search text
  setNativeInputValue(input, searchText);
  try {
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
    // Also fire keydown for frameworks that listen to key events for filtering
    for (const ch of searchText.slice(0, 3)) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, composed: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true, composed: true }));
    }
  } catch {}
}

function checkSelectionStuck(container) {
  // Check if the combobox now shows a selected value — scoped to THIS container only
  const singleVal = container.querySelector('.select__single-value, [class*="singleValue"], [class*="single-value"]');
  if (singleVal) {
    const text = (singleVal.textContent || '').trim().toLowerCase();
    if (text && !/select|choose|\.\.\./i.test(text)) return true;
  }

  // Check aria-selected WITHIN this container's linked listbox only
  const ariaControls = container.querySelector('[aria-controls]')?.getAttribute('aria-controls');
  if (ariaControls) {
    const linked = document.getElementById(ariaControls);
    if (linked) {
      const selectedOpt = linked.querySelector('[role="option"][aria-selected="true"]');
      if (selectedOpt) return true;
    }
  }
  // Also check inside the container itself
  const selectedInContainer = container.querySelector('[role="option"][aria-selected="true"]');
  if (selectedInContainer) return true;

  // Check hidden select
  const hiddenSelect = container.querySelector('select');
  if (hiddenSelect && hiddenSelect.selectedIndex >= 0) {
    const opt = hiddenSelect.options[hiddenSelect.selectedIndex];
    if (opt && opt.value && !/--|select|choose/i.test(opt.text)) return true;
  }

  return false;
}

export async function fillCombobox(element, targetValue) {
  if (!element) return false;
  const strVal = String(targetValue || '').trim();
  if (!strVal) return false;

  const targetLower = strVal.toLowerCase();

  try {
    const { container, input, toggleBtn, controlBox } = resolveComboboxParts(element);

    // === Step 0: Dismiss any previously open dropdowns ===
    await dismissOpenDropdowns();

    // === Step 1: Open THIS dropdown ===
    await openDropdown(input, controlBox, toggleBtn);

    // === Step 2: Type search text to filter options ===
    // Use a short prefix first (3-6 chars) — enough to narrow, not so much it over-filters
    const searchPrefix = strVal.length > 6 ? strVal.slice(0, 6) : strVal;
    if (input) {
      await typeSearchText(input, searchPrefix);
    }

    // Wait for framework to filter/render options
    await new Promise(r => setTimeout(r, 200));

    // === Step 3: Discover available options (scoped to THIS field) ===
    let options = discoverOptions(container, element);

    // If no options found with prefix, retry with full text
    if (options.length === 0 && input && searchPrefix !== strVal) {
      await typeSearchText(input, strVal);
      await new Promise(r => setTimeout(r, 200));
      options = discoverOptions(container, element);
    }

    // If still no options, try re-opening (some frameworks close on input clear)
    if (options.length === 0) {
      await openDropdown(input, controlBox, toggleBtn);
      await new Promise(r => setTimeout(r, 150));
      options = discoverOptions(container, element);
    }

    // === Step 4: Find the best matching option ===
    let matchedOpt = findBestOption(options, targetLower);

    // If no match with search-filtered options, clear input and try all options
    if (!matchedOpt && input && options.length > 0) {
      // The typed text may have over-filtered — try with broader text
      setNativeInputValue(input, '');
      try {
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      } catch {}
      await new Promise(r => setTimeout(r, 200));
      const allOptions = discoverOptions(container, element);
      matchedOpt = findBestOption(allOptions, targetLower);
    }

    // === Step 5: Click the matched option ===
    let didSelect = false;

    if (matchedOpt) {
      clickOption(matchedOpt);

      // Wait for framework state to settle
      await new Promise(r => setTimeout(r, 150));

      // Verify the click actually registered
      didSelect = checkSelectionStuck(container);
      if (!didSelect) {
        // Retry click once more
        clickOption(matchedOpt);
        await new Promise(r => setTimeout(r, 100));
        didSelect = checkSelectionStuck(container);
      }
    } else if (input) {
      // === Fallback: No matching option found ===
      // Type full value and try Enter key
      await typeSearchText(input, strVal);
      await new Promise(r => setTimeout(r, 150));

      // Check if typing revealed a matching option we can click
      const lastChanceOptions = discoverOptions(container, element);
      const lastChanceMatch = findBestOption(lastChanceOptions, targetLower);
      if (lastChanceMatch) {
        clickOption(lastChanceMatch);
        await new Promise(r => setTimeout(r, 100));
        didSelect = checkSelectionStuck(container);
      } else {
        // Absolute last resort — Enter key to commit typed text
        try {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        } catch {}
        await new Promise(r => setTimeout(r, 100));
        didSelect = checkSelectionStuck(container);
      }
    }

    // === Step 6: Update backing hidden <select> if present ===
    if (didSelect) {
      const hiddenSelect = container.querySelector('select');
      if (hiddenSelect) {
        fillSelect(hiddenSelect, strVal);
      }
    }

    // === Step 7: Close / blur cleanly ===
    if (input) {
      try {
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      } catch {}
    }
    try {
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    } catch {}

    // Final settle wait
    await new Promise(r => setTimeout(r, 100));

    return didSelect;
  } catch (err) {
    console.warn('[JobCopilot:Filler] fillCombobox error:', err);
    return false;
  }
}

export function fillContentEditable(element, value) {
  if (!element) return false;
  const strVal = value !== null && value !== undefined ? String(value) : '';
  
  try {
    element.focus();
  } catch {}
  element.textContent = strVal;
  dispatchEventSequence(element, ['input', 'change']);
  return true;
}

export async function fillField(field, targetValue) {
  if (!field || !field.element) return false;

  switch (field.type) {
    case FIELD_TYPES.TEXTAREA:
      return fillTextarea(field.element, targetValue);

    case FIELD_TYPES.SELECT:
      return fillSelect(field.element, targetValue);

    case FIELD_TYPES.RADIO:
      return fillRadioGroup(field.elements || [field.element], targetValue);

    case FIELD_TYPES.CHECKBOX:
      return fillCheckbox(field.element, targetValue);

    case FIELD_TYPES.COMBOBOX:
      return await fillCombobox(field.element, targetValue);

    case FIELD_TYPES.CONTENTEDITABLE:
      return fillContentEditable(field.element, targetValue);

    case FIELD_TYPES.TEXT:
    case FIELD_TYPES.EMAIL:
    case FIELD_TYPES.TEL:
    case FIELD_TYPES.URL:
    case FIELD_TYPES.NUMBER:
    default:
      return fillTextInput(field.element, targetValue);
  }
}

