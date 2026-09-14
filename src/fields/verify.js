import { FIELD_TYPES } from '../constants.js';

export async function verifyField(field, expectedValue) {
  if (!field || !field.element) {
    return { verified: false, actualValue: '', error: 'Element missing' };
  }

  // Artificial rejection check for test fixtures / validation gates
  if (field.element.getAttribute('data-reject-fill') === 'true') {
    return {
      verified: false,
      actualValue: field.element.value || '',
      error: 'Form field rejected programmatic input (Gate 4)',
    };
  }

  const expectedStr = String(expectedValue || '').trim().toLowerCase();

  switch (field.type) {
    case FIELD_TYPES.RADIO: {
      const radios = field.elements || [field.element];
      const checkedRadio = radios.find((r) => r.checked);
      if (!checkedRadio) {
        return { verified: false, actualValue: '', error: 'No option selected' };
      }
      const actualVal = checkedRadio.value || checkedRadio.closest('label')?.textContent?.trim() || '';
      return { verified: true, actualValue: actualVal };
    }

    case FIELD_TYPES.CHECKBOX: {
      const isChecked = field.element.checked;
      const expectedChecked = expectedValue === true || ['true', 'yes', '1', 'checked'].includes(expectedStr);
      const matches = isChecked === expectedChecked;
      return {
        verified: matches,
        actualValue: String(isChecked),
        error: matches ? undefined : `Expected checked=${expectedChecked}, found ${isChecked}`,
      };
    }

    case FIELD_TYPES.SELECT: {
      const select = field.element;
      const selectedOption = select.options[select.selectedIndex];
      if (!selectedOption) {
        return { verified: false, actualValue: '', error: 'No option selected' };
      }

      const isPlaceholder = selectedOption.value === '' || /--|select|choose/i.test(selectedOption.text);
      const actualVal = selectedOption.value || selectedOption.text.trim();

      if (isPlaceholder) {
        return {
          verified: false,
          actualValue: selectedOption.text.trim(),
          error: 'Dropdown remained on placeholder',
        };
      }

      return {
        verified: true,
        actualValue: actualVal,
      };
    }

    case FIELD_TYPES.CONTENTEDITABLE: {
      const actualVal = (field.element.textContent || '').trim();
      const verified = actualVal.length > 0;
      return {
        verified,
        actualValue: actualVal,
        error: verified ? undefined : 'Contenteditable text remained empty',
      };
    }

    case FIELD_TYPES.COMBOBOX: {
      return await verifyCombobox(field.element, expectedValue);
    }

    case FIELD_TYPES.TEXT:
    case FIELD_TYPES.TEXTAREA:
    case FIELD_TYPES.EMAIL:
    case FIELD_TYPES.TEL:
    case FIELD_TYPES.URL:
    case FIELD_TYPES.NUMBER:
    default: {
      const actualVal = (field.element.value || field.element.textContent || '').trim();
      if (!expectedStr) {
        return { verified: true, actualValue: actualVal };
      }
      const verified = actualVal.length > 0;
      return {
        verified,
        actualValue: actualVal,
        error: verified ? undefined : 'Value did not persist in DOM',
      };
    }
  }
}

export async function verifyCombobox(element, expectedValue) {
  if (!element) {
    return { verified: false, actualValue: '', error: 'Element missing' };
  }

  const result = _checkComboboxState(element, expectedValue);
  if (result.verified) return result;

  // Retry after framework state settles (React setState is async)
  await new Promise(r => setTimeout(r, 120));
  return _checkComboboxState(element, expectedValue);
}

function _checkComboboxState(element, expectedValue) {
  const expectedNorm = String(expectedValue || '').trim().toLowerCase();

  try {
    const container =
      element.closest('[data-testid*="select"], [class*="select-shell"], [class*="select__container"]') ||
      element.closest('.form-group, .field, [class*="-container"], [role="combobox"]') ||
      element.parentElement ||
      element;

    // 1. Check react-select single-value display (most reliable signal)
    const singleValueEl = container.querySelector('.select__single-value, [class*="singleValue"], [class*="single-value"]');
    if (singleValueEl) {
      const text = (singleValueEl.textContent || '').trim();
      if (text && !/select|choose|\.\.\./i.test(text)) {
        const match = !expectedNorm || text.toLowerCase().includes(expectedNorm) || expectedNorm.includes(text.toLowerCase());
        return {
          verified: match,
          actualValue: text,
          error: match ? undefined : `Selected option "${text}" does not match expected "${expectedValue}"`,
        };
      }
    }

    // 2. Check aria-valuetext or [aria-selected="true"]
    const ariaVal = element.getAttribute('aria-valuetext') || container.querySelector('[aria-selected="true"]')?.textContent?.trim();
    if (ariaVal && !/select|choose|\.\.\./i.test(ariaVal)) {
      const match = !expectedNorm || ariaVal.toLowerCase().includes(expectedNorm) || expectedNorm.includes(ariaVal.toLowerCase());
      return {
        verified: match,
        actualValue: ariaVal,
        error: match ? undefined : `Combobox value "${ariaVal}" does not match expected "${expectedValue}"`,
      };
    }

    // 3. Check hidden backing select element
    const hiddenSelect = container.querySelector('select');
    if (hiddenSelect && hiddenSelect.selectedIndex >= 0) {
      const opt = hiddenSelect.options[hiddenSelect.selectedIndex];
      if (opt && opt.value && !/select|choose|--/i.test(opt.text)) {
        const text = opt.text.trim() || opt.value;
        const match = !expectedNorm || text.toLowerCase().includes(expectedNorm) || expectedNorm.includes(text.toLowerCase());
        return {
          verified: match,
          actualValue: text,
          error: match ? undefined : `Underlying select "${text}" does not match expected "${expectedValue}"`,
        };
      }
    }

    // 4. Check for selected text inside value container that is NOT a placeholder
    const placeholderEl = container.querySelector('.select__placeholder, [class*="placeholder"]');
    const valueContainer = container.querySelector('.select__value-container, [class*="value-container"]');
    if (valueContainer && !placeholderEl) {
      const text = (valueContainer.textContent || '').trim();
      if (text && !/select|choose|\.\.\./i.test(text)) {
        return {
          verified: true,
          actualValue: text,
        };
      }
    }

    // 5. If input itself retained value — but ONLY trust this if a single-value element
    //    also appeared (otherwise the framework didn't actually register the selection)
    if (element instanceof HTMLInputElement && element.value) {
      const val = element.value.trim();
      if (val && !/select|choose|\.\.\./i.test(val)) {
        // Check if there's evidence the framework accepted the selection
        const hasFrameworkSelection = Boolean(
          singleValueEl ||
          container.querySelector('[aria-selected="true"]') ||
          (hiddenSelect && hiddenSelect.selectedIndex > 0)
        );

        if (hasFrameworkSelection) {
          const match = !expectedNorm || val.toLowerCase().includes(expectedNorm) || expectedNorm.includes(val.toLowerCase());
          return {
            verified: match,
            actualValue: val,
            error: match ? undefined : `Input value "${val}" does not match expected "${expectedValue}"`,
          };
        }

        // Input has text but no framework selection — this is a FALSE POSITIVE
        // The user typed into the input but never actually selected an option
        return {
          verified: false,
          actualValue: val,
          error: `Input contains "${val}" but no option was actually selected by the framework`,
        };
      }
    }

    return {
      verified: false,
      actualValue: '',
      error: 'Combobox option was not selected or remained on placeholder',
    };
  } catch (err) {
    return {
      verified: false,
      actualValue: '',
      error: `Combobox verification failed: ${err.message}`,
    };
  }
}
