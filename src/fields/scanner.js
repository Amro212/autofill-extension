import { FIELD_TYPES, UI_IDS } from '../constants.js';
import { extractLabel, extractGroupLabel, extractOptionLabel, extractDescription } from './labels.js';

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
      const rawVal = el.value || el.textContent || '';
      const isPlaceholder = /select|choose|\.\.\./i.test(rawVal);

      detectedFields.push({
        id: el.id || el.getAttribute('name') || `jc_field_${++fieldCounter}`,
        type: FIELD_TYPES.COMBOBOX,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue: isPlaceholder ? '' : rawVal.trim(),
        options: [],
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
