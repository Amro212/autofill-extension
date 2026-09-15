import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { captureJob } from '../src/jobs.js';
import { createSession, restoreSession, saveSession } from '../src/sessions.js';
import { rememberAnswer, recallAnswer } from '../src/memory.js';
import { classifyPage } from '../src/pageClassifier.js';
import { inspectValidation } from '../src/validation.js';
import { findContinue } from '../src/navigation.js';
import { createApplicationEngine } from '../src/application.js';
import { scanFormFields } from '../src/fields/scanner.js';
import { saveProfile, saveSettings } from '../src/storage.js';

let dom;
beforeEach(() => {
  dom = new JSDOM('<body><main></main></body>', { url: 'https://example.com/jobs/42/apply' });
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver']) globalThis[key] = dom.window[key];
  globalThis.CSS = { escape: value => value };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get: () => 200 });
  HTMLElement.prototype.scrollIntoView = () => {};
  const storage = new Map();
  globalThis.GM_getValue = (key, fallback) => structuredClone(storage.has(key) ? storage.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => storage.set(key, structuredClone(value));
  globalThis.GM_deleteValue = key => storage.delete(key);
  globalThis.GM_getTab = undefined;
  saveSettings({ autoContinue: true });
  saveProfile({ fullName: 'Test Applicant', email: 'test@example.com' });
});
afterEach(() => dom.window.close());
const render = html => { document.querySelector('main').innerHTML = html; };
const input = (id = 'name', label = 'Full name') => `<label for="${id}">${label}</label><input id="${id}" required>`;
const job = () => ({ title: 'Engineer', company: 'Example', listingUrl: 'https://example.com/jobs/42', applicationUrl: window.location.href });

test('captures JSON-LD JobPosting and an explicit application link', () => {
  render('<h1>Engineer</h1><a href="/apply/42">Apply now</a><script type="application/ld+json">{"@type":"JobPosting","title":"Engineer","hiringOrganization":{"name":"Example"},"description":"<p>Build useful software.</p>","identifier":{"value":"42"}}</script>');
  const captured = captureJob();
  assert.equal(captured.company, 'Example');
  assert.equal(captured.description, 'Build useful software.');
  assert.equal(captured.applicationUrl, 'https://example.com/apply/42');
});
test('session restores exact known URLs, not unrelated applications on the same host', async () => {
  const session = createSession(job());
  session.answers.example = { value: 'kept' };
  session.pendingUrl = 'https://example.com/jobs/42/step2';
  saveSession(session);
  assert.equal((await restoreSession(session.pendingUrl)).id, session.id);
  assert.equal((await restoreSession(window.location.href)).answers.example.value, 'kept');
  assert.equal(await restoreSession('https://example.com/jobs/99/apply'), null);
});
test('common memory reuses verified profile answers while narratives stay application-specific', () => {
  const a = createSession(job());
  const b = createSession({ ...job(), listingUrl: 'https://example.com/jobs/99' });
  const common = { label: 'Full name', type: 'text', options: [] };
  const narrative = { label: 'Why this company?', type: 'textarea', options: [] };
  rememberAnswer(a, common, { value: 'Test Applicant', inferred: false });
  rememberAnswer(a, narrative, { value: 'Company-specific reason', inferred: false });
  assert.equal(recallAnswer(b, common).value, 'Test Applicant');
  assert.equal(recallAnswer(b, narrative), null);
  saveProfile({ fullName: 'Different Person' });
  assert.equal(recallAnswer(b, common), null);
});
test('required, native and ARIA errors map to their owning field', () => {
  render('<label for="email">Email</label><input id="email" type="email" required value="invalid" aria-invalid="true" aria-describedby="error"><p id="error" role="alert">Use a company email.</p>');
  const errors = inspectValidation(scanFormFields());
  assert.equal(errors[0].fieldId, 'email');
  assert.match(errors[0].message, /company email/);
});
test('final submit cannot become a Continue candidate', () => {
  render('<h1>Review application</h1><button>Submit application</button>');
  assert.equal(classifyPage().type, 'review');
  assert.equal(findContinue(), null);
});
test('hidden boundaries do not pause, visible legal attestations do', () => {
  render(`${input()}<div hidden>Assessment</div><button>Continue</button>`);
  assert.equal(classifyPage().type, 'application');
  render(`${input()}<label><input type="checkbox">I certify that all information is accurate</label><button>Continue</button>`);
  assert.equal(classifyPage().type, 'boundary');
});
test('engine repairs server rejection, advances two steps and stops before submit', async () => {
  render(`${input('answer', 'Describe your skills')}<p id="error" hidden role="alert"></p><button type="button">Continue</button>`);
  let clicks = 0, submitted = false, primary = 0, repairs = 0;
  document.querySelector('button').onclick = () => {
    clicks++;
    if (document.querySelector('input').value !== 'Accepted answer') {
      document.querySelector('input').setAttribute('aria-invalid', 'true');
      document.querySelector('input').setAttribute('aria-describedby', 'error');
      document.querySelector('#error').hidden = false;
      document.querySelector('#error').textContent = 'Answer needs more detail';
    } else {
      render(`${input('email', 'Email')}<button type="button">Review</button>`);
      document.querySelector('button').onclick = () => {
        render('<h1>Review application</h1><button>Submit application</button>');
        document.querySelector('button').onclick = () => { submitted = true; };
      };
    }
  };
  document.querySelector('input').oninput = () => {
    document.querySelector('input').removeAttribute('aria-invalid');
    document.querySelector('#error').hidden = true;
  };
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async (fields, context) => {
    if (context.repairErrors?.length) repairs++; else primary++;
    return { answers: fields.map(f => ({ fieldId: f.fieldId, value: context.repairErrors?.length ? 'Accepted answer' : f.fieldId === 'email' ? 'test@example.com' : 'Short', inferred: false })) };
  }});
  await engine.start(job());
  assert.equal(engine.session.status, 'review');
  assert.equal(submitted, false);
  assert.equal(primary, 2);
  assert.equal(repairs, 1);
  assert.equal(clicks, 2);
  assert.ok(engine.session.errors.some(e => e.fieldId === 'answer'));
  engine.destroy();
});
test('background CAPTCHA does not block filling; assessment still pauses', async () => {
  render(`<iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>${input()}<button>Continue</button>`);
  let calls = 0;
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async fields => { calls++; return { answers: fields.map(f => ({ fieldId: f.fieldId, value: 'Test Applicant' })) }; } });
  document.querySelector('button').onclick = () => render('<h1>Skills assessment</h1><label>Answer<input required></label><button>Continue</button>');
  await engine.start(job());
  assert.equal(engine.session.status, 'boundary');
  assert.equal(document.querySelector('input').value, '');
  assert.equal(calls, 1);
  engine.destroy();
});

test('CAPTCHA response controls are never offered as applicant fields', () => {
  render(`${input()}<textarea name="g-recaptcha-response"></textarea><div class="h-captcha"><input name="challenge-answer"></div>`);
  assert.deepEqual(scanFormFields().map(f => f.id), ['name']);
});
test('unchanged pages have bounded navigation attempts and no repeat primary request', async () => {
  render(`${input()}<button type="button">Continue</button>`);
  let calls = 0, clicks = 0;
  document.querySelector('button').onclick = () => clicks++;
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async fields => { calls++; return { answers: fields.map(f => ({ fieldId: f.fieldId, value: 'Name' })) }; } });
  await engine.start(job());
  await engine.tick();
  assert.equal(calls, 1);
  assert.equal(clicks, 1);
  assert.equal(engine.session.status, 'paused');
  engine.destroy();
});

test('failed persistence never advances even when rejected text remains nonempty', async () => {
  render(`${input()}<button type="button">Continue</button>`);
  let clicks = 0;
  document.querySelector('input').oninput = e => { e.target.value = 'Wrong value'; };
  document.querySelector('button').onclick = () => clicks++;
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async fields => ({ answers: fields.map(f => ({ fieldId: f.fieldId, value: 'Expected value' })) }) });
  await engine.start(job());
  assert.equal(clicks, 0);
  assert.equal(engine.session.status, 'paused');
  assert.match(engine.session.reason, /limit/);
  engine.destroy();
});
test('hidden required controls are never filled', async () => {
  render(`${input()}<section hidden><label for="secret">Private hidden field</label><input id="secret" required></section><button type="button">Continue</button>`);
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async fields => ({ answers: fields.map(f => ({ fieldId: f.fieldId, value: 'Expected value' })) }) });
  await engine.start(job());
  assert.equal(document.querySelector('#secret').value, '');
  engine.destroy();
});
test('pause during AI request prevents delayed writes and navigation', async () => {
  render(`${input()}<button>Continue</button>`);
  let release;
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: () => new Promise(resolve => { release = resolve; }) });
  const pending = engine.start(job());
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  engine.pause();
  release({ answers: [{ fieldId: 'name', value: 'Late answer' }] });
  await pending;
  assert.equal(document.querySelector('input').value, '');
  assert.equal(engine.session.status, 'paused');
  engine.destroy();
});
test('review stays manual even with Auto Submit enabled in old settings', async () => {
  saveSettings({ autoContinue: true, autoSubmit: true });
  render('<h1>Review application</h1><button>Submit application</button>');
  let clicks = 0;
  document.querySelector('button').onclick = () => clicks++;
  const engine = createApplicationEngine();
  await engine.start(job());
  assert.equal(engine.session.status, 'review');
  assert.equal(clicks, 0);
  engine.destroy();
});

test('Auto Continue off fills without clicking', async () => {
  saveSettings({ autoContinue: false });
  render(`${input()}<button type="button">Continue</button>`);
  let clicks = 0;
  document.querySelector('button').onclick = () => clicks++;
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async () => ({ answers: [{ fieldId: 'name', value: 'Test Applicant' }] }) });
  await engine.start(job());
  assert.equal(document.querySelector('input').value, 'Test Applicant');
  assert.equal(clicks, 0);
  engine.destroy();
});
test('required upload and disabled Continue prevent navigation', () => {
  render('<input type="file" required><button disabled>Continue</button>');
  const errors = inspectValidation([], findContinue());
  assert.equal(errors.length, 2);
  assert.ok(errors.every(e => e.fieldId === null));
});
test('ambiguous navigation controls require manual action', () => {
  render('<button>Next</button><button>Continue</button>');
  assert.equal(findContinue(), null);
});
test('boundary appearing during AI request prevents filling', async () => {
  render(input());
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async () => {
    document.querySelector('main').insertAdjacentHTML('afterbegin', '<h1>Identity verification</h1>');
    return { answers: [{ fieldId: 'name', value: 'Test Applicant' }] };
  } });
  await engine.start(job());
  assert.equal(document.querySelector('input').value, '');
  assert.equal(engine.session.status, 'boundary');
  engine.destroy();
});
test('full document reload restores active session and saved answers without a primary request', async () => {
  render(`${input()}<button>Continue</button>`);
  let requests = 0;
  const options = { settleMs: 0, transitionMs: 0, answer: async () => { requests++; return { answers: [{ fieldId: 'name', value: 'Test Applicant' }] }; } };
  const first = createApplicationEngine(options);
  await first.start(job());
  const id = first.session.id;
  first.session.active = true;
  first.session.status = 'running';
  saveSession(first.session);
  first.destroy();
  render(`${input()}<button>Continue</button>`);
  document.querySelector('button').onclick = () => render('<h1>Review application</h1><button>Submit application</button>');
  const restored = createApplicationEngine(options);
  await restored.initialize();
  assert.equal(restored.session.id, id);
  assert.equal(restored.session.status, 'review');
  assert.equal(requests, 1);
  restored.destroy();
});
test('real multi-step fixture reaches review after a semantic rejection', async () => {
  const fixture = await readFile(new URL('../fixtures/phase3-application-fixture.html', import.meta.url), 'utf8');
  const fixtureDom = new JSDOM(fixture, { url: 'https://example.com/fixture?scenario=validation&step=1', runScripts: 'dangerously' });
  dom.window.close(); dom = fixtureDom;
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver']) globalThis[key] = dom.window[key];
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get: () => 200 });
  let repairs = 0;
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async (fields, context) => {
    if (context.repairErrors?.length) repairs++;
    return { answers: fields.map(f => ({ fieldId: f.fieldId, value: f.fieldId === 'email' ? 'test@example.com' : f.fieldId === 'fullName' ? 'Test Applicant' : 'I have built accessible web applications using my documented software skills.' })) };
  } });
  await engine.start(job());
  assert.equal(engine.session.status, 'review');
  assert.equal(repairs, 1);
  assert.equal(new URL(window.location.href).searchParams.get('step'), 'review');
  engine.destroy();
});

test('visible inline errors map to a unique field container without ARIA linkage', () => {
  render('<div class="form-group"><label for="name">Full name</label><input id="name" value="Name"><span class="error-message">Enter your full legal name</span></div>');
  const errors = inspectValidation(scanFormFields());
  assert.equal(errors.length, 1);
  assert.equal(errors[0].fieldId, 'name');
});
test('captured jobs with unknown company mark uncertainty explicitly', () => {
  render('<h1>Engineer</h1><article>Job description: Build useful software.</article>');
  const captured = captureJob();
  assert.equal(captured.companyUncertain, true);
  assert.equal(captured.company, '');
});
test('inferred and incompatible answers never become global memory', () => {
  const a = createSession(job()), b = createSession({ ...job(), listingUrl: 'https://example.com/jobs/99' });
  const field = { label: 'Full name', type: 'text', options: [] };
  rememberAnswer(a, field, { value: 'Guess', inferred: true });
  assert.equal(recallAnswer(b, field), null);
  const choice = { label: 'Availability', type: 'select', options: [{ value: 'now', label: 'Now' }] };
  rememberAnswer(a, choice, { value: 'now' });
  assert.equal(recallAnswer(a, { ...choice, options: [{ value: 'later', label: 'Later' }] }), null);
});

test('Resume retries a failed primary instead of advancing unanswered optional fields', async () => {
  render('<label for="essay">Describe your experience</label><textarea id="essay"></textarea><button type="button">Continue</button>');
  let requests = 0;
  document.querySelector('button').onclick = () => render('<h1>Review application</h1>');
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async () => {
    if (++requests === 1) throw new Error('Temporary network failure');
    return { answers: [{ fieldId: 'essay', value: 'Grounded answer' }] };
  } });
  await engine.start(job());
  assert.equal(engine.session.status, 'paused');
  await engine.start();
  assert.equal(requests, 2);
  assert.equal(engine.session.status, 'review');
  assert.ok(Object.values(engine.session.answers).some(a => a.value === 'Grounded answer'));
  engine.destroy();
});
test('tab-bound recent navigation recovers a same-application POST redirect only', async () => {
  const session = createSession({ ...job(), applicationUrl: 'https://example.com/apply/42/step1' });
  session.active = true;
  session.pendingUrl = 'https://example.com/apply/42/step1';
  session.pendingAt = Date.now();
  saveSession(session);
  globalThis.GM_getTab = callback => callback({ jobCopilotSession: session.id });
  assert.equal((await restoreSession('https://example.com/apply/42/step2'))?.id, session.id);
  assert.equal(await restoreSession('https://example.com/apply/99/step2'), null);
  assert.equal(await restoreSession('https://other.example/apply/42/step2'), null);
  session.pendingAt = Date.now() - 180000;
  saveSession(session);
  assert.equal(await restoreSession('https://example.com/apply/42/step2'), null);
});

test('unexpected step change during a field action pauses instead of filling the previous step', async () => {
  render(`${input()}<button>Continue</button>`);
  document.querySelector('input').oninput = () => {
    window.history.replaceState({}, '', '/apply/autofillWithResume');
    render('<h1>Autofill with Resume</h1><input id="resume" type="file">');
  };
  const engine = createApplicationEngine({ settleMs: 0, transitionMs: 0, answer: async () => ({ answers: [{ fieldId: 'name', value: 'Applicant' }] }) });
  await engine.start(job());
  assert.equal(engine.session.status, 'paused');
  assert.match(engine.session.reason, /Page changed while filling/);
  engine.destroy();
});
