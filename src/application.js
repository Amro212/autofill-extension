import { captureJob, safeUrl } from './jobs.js';
import { createSession, restoreSession, saveSession, bindTab } from './sessions.js';
import { classifyPage, isVisible } from './pageClassifier.js';
import { inspectValidation } from './validation.js';
import { findContinue, pageSignature, isDisabled } from './navigation.js';
import { rememberAnswer, recallAnswer } from './memory.js';
import { getSettings } from './storage.js';
import { scanFormFields as scanAllFields, harvestComboboxOptions } from './fields/scanner.js';
import { normalizeFieldsForAI } from './fields/normalize.js';
import { fillField } from './fields/fillers.js';
import { verifyField } from './fields/verify.js';
import { generateAutofillAnswers } from './ai.js';
import { resolveComboboxSearchAnswers } from './autofill.js';
import { logger } from './debug.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const scanFormFields = () => scanAllFields().filter(f => isVisible(f.element) && !f.element.disabled && !f.element.readOnly && f.element.type !== 'file');
const empty = field => field.type === 'checkbox' ? !field.element.checked : !String(field.currentValue ?? '').trim();
const runnable = new Set(['running', 'captcha', 'waiting']);

export function createApplicationEngine({ answer = generateAutofillAnswers, onChange = () => {}, settleMs = 180, transitionMs = 1200, navigationTimeoutMs = transitionMs === 0 ? 0 : 10000 } = {}) {
  let session = null, busy = false, generation = 0, timer = null, observer = null, interval = null, cancelDelay = null;
  const delay = ms => new Promise(resolve => {
    let t = null;
    cancelDelay = () => { clearTimeout(t); cancelDelay = null; resolve(); };
    t = setTimeout(() => { cancelDelay = null; resolve(); }, ms);
  });
  const results = new Map();
  let lastEmission = '';
  function validation(fields = scanFormFields(), control = null) {
    const errors = inspectValidation(fields, control);
    for (const field of fields) {
      const result = results.get(field.id);
      if (result?.status === 'failed' && String(result.value) === String(field.currentValue) && !errors.some(e => e.fieldId === field.id)) {
        errors.push({ fieldId: field.id, message: result.error, kind: 'persistence' });
      }
    }
    return errors;
  }
  function emit() {
    const state = JSON.stringify([session, busy, [...results]]);
    if (state === lastEmission) return;
    lastEmission = state;
    onChange({ session, busy, results, classification: classifyPage() });
  }
  function status(value, reason) {
    if (session.status === value && session.reason === reason) return;
    session.status = value;
    session.reason = reason;
    if (!runnable.has(value)) session.active = false;
    saveSession(session);
    emit();
  }
  function guard(token) {
    if (token !== generation || !session?.active) return false;
    const page = classifyPage();
    if (['captcha', 'boundary', 'review', 'confirmation'].includes(page.type)) {
      status(page.type, page.reason);
      return false;
    }
    return true;
  }
  async function waitForNavigation(signature, token, afterClick) {
    const deadline = Date.now() + navigationTimeoutMs;
    let lastSignature = signature, stableSince = Date.now();
    const stableMs = Math.min(transitionMs, 200);
    status('running', afterClick ? 'Waiting for the next page to finish loading.' : 'Waiting for the page Continue button to become ready.');
    logger.info(`Navigation wait: ${afterClick ? 'after click' : 'button readiness'}, timeout=${navigationTimeoutMs}ms`);
    do {
      if (!guard(token)) return 'stopped';
      const fields = scanFormFields();
      const current = pageSignature(fields);
      if (current !== lastSignature) { lastSignature = current; stableSince = Date.now(); }
      const busy = Array.from(document.querySelectorAll('[aria-busy="true"]')).some(isVisible);
      const control = findContinue();
      if (!busy && Date.now() - stableSince >= stableMs) {
        if (current !== signature && fields.length) {
          logger.info(`Navigation wait: next step ready, ${fields.length} fields`);
          return 'changed';
        }
        if (current === signature) {
          if (inspectValidation(fields).length) return 'validation';
          if (!afterClick && control && !isDisabled(control)) return 'ready';
        }
      }
      if (Date.now() >= deadline) break;
      await delay(Math.min(100, Math.max(1, deadline - Date.now())));
    } while (true);
    logger.warn(`Navigation wait timed out: buttonDisabled=${isDisabled(findContinue())}, path=${window.location.pathname}`);
    return 'timeout';
  }
  function pauseDisabledButton() {
    status('paused', `The page's Continue button stayed disabled after waiting ${navigationTimeoutMs / 1000}s. Auto Continue is still on; inspect the page before resuming.`);
  }
  async function applyAnswers(fields, answers, token, signature) {
    const byId = new Map(answers.map(a => [a.fieldId, a]));
    for (const original of fields) {
      if (!guard(token) || pageSignature(scanFormFields()) !== signature) return false;
      const field = scanFormFields().find(f => f.id === original.id && f.label === original.label && f.type === original.type);
      const entry = byId.get(original.id);
      if (!field || !entry || entry.value === '' || entry.value == null) continue;
      field.options = original.options;
      field.element.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      const filled = await fillField(field, entry.value);
      await delay(settleMs);
      if (!guard(token)) return false;
      if (pageSignature(scanFormFields()) !== signature) {
        logger.warn(`Page changed during field action: id=${field.id}, path=${window.location.pathname}`);
        status('paused', 'Page changed while filling a field. Inspect the current step before resuming.');
        return false;
      }
      const live = scanFormFields().find(f => f.id === field.id && f.label === field.label);
      const verified = filled && live ? await verifyField(live, entry.value) : { verified: false };
      // Phase 2's generic verifier only checks non-empty values. Workflow requires exact persistence.
      let exact = !['text', 'textarea', 'email', 'tel', 'url', 'number', 'contenteditable'].includes(field.type) || String(verified.actualValue ?? '').trim() === String(entry.value).trim();
      if (['select', 'radio'].includes(field.type)) exact = field.options.some(o => (String(o.value) === String(entry.value) || o.label === String(entry.value)) && String(o.value) === String(verified.actualValue));
      const valid = verified.verified && exact && !inspectValidation([live]).some(error => error.fieldId === live.id);
      results.set(field.id, { status: valid ? entry.inferred ? 'inferred' : 'verified' : 'failed', value: verified.actualValue ?? '', inferred: Boolean(entry.inferred), error: valid ? '' : 'Value rejected or failed verification.' });
      if (valid) rememberAnswer(session, field, entry);
      saveSession(session);
      emit();
    }
    return true;
  }
  async function request(fields, context, token, signature) {
    if (!guard(token)) return [];
    await harvestComboboxOptions(fields);
    if (!guard(token) || pageSignature(scanFormFields()) !== signature) return [];
    let response = await answer(normalizeFieldsForAI(fields), { jobContext: session.job, ...context });
    if (!guard(token) || pageSignature(scanFormFields()) !== signature) return [];
    if (response.answers.some(a => a.searchQuery)) response = await resolveComboboxSearchAnswers(fields, response);
    return response.answers;
  }
  async function repair(errors, step, token, signature) {
    if (step.repairs >= 2) { status('paused', 'Repair limit reached (2/2). Review errors and resume manually.'); return false; }
    step.repairs++;
    session.errors.push(...errors.map(error => ({ ...error, attempt: step.repairs, url: window.location.href, at: new Date().toISOString() })));
    session.errors = session.errors.slice(-100);
    status('running', `Repair ${step.repairs}/2: ${errors.map(e => e.message).join(' ').slice(0, 250)}`);
    const targets = scanFormFields().filter(f => errors.some(e => e.fieldId === f.id));
    if (!targets.length) { status('paused', 'Validation needs manual input: ' + errors.map(e => e.message).join(' ').slice(0, 250)); return false; }
    const previous = targets.map(f => ({ fieldId: f.id, ...(step.answers[f.id] || recallAnswer(session, f) || {}) })).filter(a => a.value != null);
    if (!await applyAnswers(targets, previous, token, signature)) return false;
    let remaining = validation();
    if (remaining.some(e => e.fieldId)) {
      const rejected = scanFormFields().filter(f => remaining.some(e => e.fieldId === f.id));
      const repaired = await request(rejected, { repairErrors: remaining, allowSearch: false }, token, signature);
      for (const entry of repaired) step.answers[entry.fieldId] = entry;
      if (!await applyAnswers(rejected, repaired, token, signature)) return false;
      remaining = validation();
    } else if (errors.some(e => e.kind === 'semantic')) {
      // A server error can disappear on input even though the old semantic answer is still rejected.
      const repaired = await request(targets, { repairErrors: errors, allowSearch: false }, token, signature);
      for (const entry of repaired) step.answers[entry.fieldId] = entry;
      if (!await applyAnswers(targets, repaired, token, signature)) return false;
    }
    return guard(token);
  }
  async function tick() {
    if (busy || !session?.active || !runnable.has(session.status)) return;
    busy = true;
    const token = generation;
    try {
      for (let pass = 0; pass < 40; pass++) {
        if (!guard(token)) return;
        if (!getSettings().autofillEnabled) { status('paused', 'AI Autofill is disabled in Settings.'); return; }
        const page = classifyPage();
        if (page.type !== 'application') { status('paused', page.reason); return; }
        const fields = scanFormFields();
        const signature = pageSignature(fields);
        if (new Set(fields.map(f => f.id)).size !== fields.length) { status('paused', 'Ambiguous duplicate field IDs. Fill this page manually.'); return; }
        session.currentUrl = window.location.href;
        session.pendingUrl = '';
        let step = session.steps[signature];
        if (!step) {
          results.clear();
          step = session.steps[signature] = { primary: false, answers: {}, repairs: 0, clicks: 0 };
          session.history.push({ url: window.location.href, signature, at: new Date().toISOString() });
        }
        status('running', `Application step ${session.history.length}. Repair attempts ${step.repairs}/2.`);
        if (!step.primary) {
          const targets = fields.filter(f => getSettings().overwriteExisting || empty(f));
          const missing = [];
          for (const field of targets) {
            const cached = recallAnswer(session, field);
            if (cached) step.answers[field.id] = { fieldId: field.id, ...cached }; else missing.push(field);
          }
          if (missing.length) {
            if ((step.requests || 0) >= 2) { status('paused', 'Primary request limit reached (2/2). Fill this page manually.'); return; }
            step.requests = (step.requests || 0) + 1;
            saveSession(session);
            status('running', `Generating answers for ${missing.length} fields.`);
            const answers = await request(missing, {}, token, signature);
            if (!guard(token) || pageSignature(scanFormFields()) !== signature) return;
            if (!answers.length) throw new Error('AI returned no usable answers. Resume to retry.');
            for (const entry of answers) step.answers[entry.fieldId] = entry;
          }
          step.primary = true;
          saveSession(session);
          if (!await applyAnswers(targets, Object.values(step.answers), token, signature)) return;
        } else {
          // Recover persisted answers after a full document reload without another primary request.
          const missing = fields.filter(empty);
          if (missing.length && !await applyAnswers(missing, Object.values(step.answers), token, signature)) return;
        }
        if (!guard(token) || pageSignature(scanFormFields()) !== signature) continue;
        let control = findContinue();
        const errors = validation(scanFormFields());
        if (errors.length) {
          if (await repair(errors, step, token, signature)) continue;
          return;
        }
        if (!getSettings().autoContinue) { status('paused', 'Page filled. Auto Continue is off.'); return; }
        control = findContinue();
        if (control && isDisabled(control)) {
          const readiness = await waitForNavigation(signature, token, false);
          if (readiness === 'stopped') return;
          if (readiness === 'changed' || readiness === 'validation') continue;
          if (readiness === 'timeout') { pauseDisabledButton(); return; }
          control = findContinue();
        }
        if (!control || isDisabled(control)) { status('paused', 'No unambiguous enabled Continue control. Continue manually.'); return; }
        if (step.clicks >= 3 || session.transitions >= 30) { status('paused', 'Navigation limit reached. Continue manually.'); return; }
        if (!guard(token)) return;
        step.clicks++;
        session.transitions++;
        session.pendingUrl = control.tagName === 'A' ? safeUrl(control.getAttribute('href')) : safeUrl(control.getAttribute('formaction') || control.form?.getAttribute('action') || window.location.href);
        session.pendingAt = Date.now();
        status('running', 'Continuing; waiting for the next step.');
        bindTab(session);
        logger.info(`Navigation action: ${control.textContent?.trim() || control.value || 'Continue'}, path=${window.location.pathname}`);
        control.click();
        const transition = await waitForNavigation(signature, token, true);
        if (transition === 'stopped') return;
        if (transition === 'changed') continue;
        const rejected = inspectValidation(scanFormFields());
        if (rejected.length && await repair(rejected, step, token, signature)) continue;
        if (!session.active) return;
        if (isDisabled(findContinue())) { pauseDisabledButton(); return; }
        if (session.active) status('paused', 'Continue did not change the step. Check the page, then resume.');
        return;
      }
      status('paused', 'Workflow limit reached. Continue manually.');
    } catch (error) {
      if (token === generation && session) status('paused', `Workflow stopped: ${error.message}`);
    } finally { busy = false; emit(); }
  }
  return {
    get session() { return session; },
    get busy() { return busy; },
    async initialize() {
      session = await restoreSession();
      if (session) bindTab(session);
      emit();
      const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void tick(), 300); };
      observer = new MutationObserver(mutations => {
        if (mutations.some(m => !m.target.closest?.('#job-copilot-root,#job-copilot-inline-rewrite'))) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      interval = setInterval(() => void tick(), 1500);
      await tick();
    },
    capture() {
      if (busy) return;
      generation++;
      session = createSession(captureJob());
      emit();
    },
    async start(job) {
      if (busy) return;
      generation++;
      if (job || !session) session = createSession(job || captureJob());
      session.active = true;
      status('running', 'Starting application workflow.');
      await tick();
    },
    pause() {
      generation++;
      clearTimeout(timer);
      cancelDelay?.();
      busy = false;
      if (session) status('paused', 'Paused by user.');
    },
    tick,
    destroy() { generation++; clearTimeout(timer); cancelDelay?.(); clearInterval(interval); observer?.disconnect(); },
  };
}
