import { isVisible, visibleText } from './pageClassifier.js';
import { isDisabled } from './navigation.js';

export function inspectValidation(fields, control = null, doc = document) {
  const errors = [];
  const owned = new Set();
  for (const field of fields) {
    const el = field.element;
    if (!isVisible(el) || el.disabled) continue;
    const ids = `${el.getAttribute('aria-errormessage') || ''} ${el.getAttribute('aria-describedby') || ''}`.trim().split(/\s+/);
    const nodes = ids.map(id => doc.getElementById(id)).filter(node => node && isVisible(node));
    const invalid = el.getAttribute('aria-invalid') === 'true' || el.validity?.valid === false;
    const missing = field.required && (field.type === 'checkbox' ? !el.checked : field.type === 'radio' ? !(field.elements || [el]).some(r => r.checked) : !String(field.currentValue ?? '').trim());
    const messages = nodes.filter(node => invalid || node.matches('[role=alert],.error,.field-error,[data-error]'));
    messages.forEach(node => owned.add(node));
    if (invalid || missing || messages.some(node => visibleText(node))) errors.push({ fieldId: field.id, label: field.label, kind: el.getAttribute('aria-invalid') === 'true' || messages.length ? 'semantic' : 'native', message: messages.map(visibleText).filter(Boolean).join(' ') || el.validationMessage || 'Required value missing or rejected.' });
  }
  for (const el of doc.querySelectorAll('[role=alert],.field-error,.validation-error,.error-message,[data-error]')) {
    if (!isVisible(el) || owned.has(el) || !visibleText(el)) continue;
    const container = el.closest('.form-group,.field,.form-field,fieldset,[data-field]');
    const candidates = container ? fields.filter(field => container.contains(field.element)) : [];
    const field = candidates.length === 1 ? candidates[0] : null;
    const existing = field && errors.find(error => error.fieldId === field.id);
    if (existing) { existing.message = visibleText(el).slice(0, 500); existing.kind = 'semantic'; }
    else errors.push({ fieldId: field?.id || null, kind: 'semantic', message: visibleText(el).slice(0, 500) });
  }
  // Required uploads and unsupported native controls must still prevent navigation.
  for (const el of doc.querySelectorAll('input,select,textarea')) {
    if (isVisible(el) && !el.disabled && el.validity?.valid === false && !fields.some(f => f.element === el || f.elements?.includes(el))) errors.push({ fieldId: null, message: el.validationMessage || 'A required control needs manual input.' });
  }
  if (control && isDisabled(control)) errors.push({ fieldId: null, message: 'Continue is disabled.' });
  return errors;
}
