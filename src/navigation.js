import { isVisible, visibleText } from './pageClassifier.js';

export function findContinue(doc = document) {
  const candidates = Array.from(doc.querySelectorAll('button,input[type=submit],input[type=button],a[href],[role=button]')).filter(isVisible).filter(el => {
    const label = visibleText(el) || el.value || el.getAttribute('aria-label') || '';
    return /^(?:next(?: step)?|continue|save (?:and|&) continue|review(?: application)?|proceed)$/i.test(label.trim());
  });
  return candidates.length === 1 ? candidates[0] : null;
}
export function pageSignature(fields, doc = document) {
  return JSON.stringify([doc.location.href, Array.from(doc.querySelectorAll('h1,h2,[aria-current=step]')).filter(isVisible).map(visibleText), fields.map(f => [f.id, f.label, f.type])]);
}
export function isDisabled(control) {
  return Boolean(control?.disabled || control?.getAttribute('aria-disabled') === 'true');
}
