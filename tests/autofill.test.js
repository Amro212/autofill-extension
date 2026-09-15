import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { scanFormFields, harvestComboboxOptions } from '../src/fields/scanner.js';
import { openCombobox, closeCombobox, setComboboxSearch, waitForComboboxOptions } from '../src/fields/combobox.js';
import { fillCombobox } from '../src/fields/fillers.js';
import { verifyCombobox } from '../src/fields/verify.js';
import { normalizeFieldsForAI } from '../src/fields/normalize.js';
import { generateAutofillAnswers } from '../src/ai.js';
import { saveApiKey } from '../src/storage.js';

beforeEach(() => {
  const dom = new JSDOM('<body><main class="application-container"></main></body>', { url: 'https://example.com/jobs' });
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Event', 'KeyboardEvent', 'MouseEvent']) globalThis[key] = dom.window[key];
  globalThis.CSS = { escape: value => value };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get: () => 200 });
  globalThis.GM_xmlhttpRequest = undefined;
});

function combo(id, labels, { selected = '', multi = false, delay = 0, portal = true, openEvent = 'mousedown' } = {}) {
  const shell = document.createElement('div');
  shell.innerHTML = `<label for="${id}">${id}</label><div class="select__control"><div class="select__value-container"><input id="${id}" role="combobox" aria-controls="${id}-menu"></div></div>`;
  document.querySelector('main').append(shell);
  const input = shell.querySelector('input');
  let menu, timer;
  const clicked = [];
  const searches = [];
  const close = () => { clearTimeout(timer); menu?.remove(); menu = null; input.setAttribute('aria-expanded', 'false'); };
  const commit = label => {
    shell.querySelectorAll('.select__single-value').forEach(el => el.remove());
    const value = document.createElement('span');
    value.className = multi ? 'select__multi-value__label' : 'select__single-value';
    value.textContent = label;
    input.before(value);
  };
  if (selected) commit(selected);
  const open = () => {
    close();
    input.setAttribute('aria-expanded', 'true');
    menu = document.createElement('div');
    menu.id = `${id}-menu`;
    menu.setAttribute('role', 'listbox');
    (portal ? document.body : shell).append(menu);
    const render = () => {
      if (!menu) return;
      menu.replaceChildren();
      for (const label of labels.filter(label => label.toLowerCase().includes(input.value.toLowerCase()))) {
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        option.textContent = label;
        option.onclick = () => { clicked.push(label); commit(label); input.value = ''; close(); };
        menu.append(option);
      }
      if (!menu.children.length) menu.textContent = 'No options';
    };
    if (delay) { menu.textContent = 'Loading...'; timer = setTimeout(render, delay); } else render();
  };
  input.addEventListener(openEvent, open);
  input.addEventListener('input', () => { searches.push(input.value); open(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
    if (event.key === 'Enter') menu?.querySelector('[role=option]')?.click();
  });
  input.addEventListener('blur', close);
  return { input, shell, clicked, searches, open };
}

test('rerun skips committed multi selections but retries leftover search text', () => {
  combo('nationality', ['Canadian'], { selected: 'Canadian', multi: true });
  const race = combo('race', ['Decline to state']);
  race.input.value = 'Canada+1';
  const fields = scanFormFields();
  assert.equal(fields.find(f => f.id === 'nationality').currentValue, 'Canadian');
  assert.equal(fields.find(f => f.id === 'race').currentValue, '');
});

test('harvest never borrows an unrelated open menu when its linked menu is absent', async () => {
  const country = combo('country', ['Canada+1']);
  country.open();
  const race = combo('race', ['Decline to state']);
  // This control failed to open; another menu remains in the document.
  const replacement = race.input.cloneNode();
  race.input.replaceWith(replacement);
  const field = { id: 'race', label: 'race', type: 'combobox', element: replacement, options: [] };
  await harvestComboboxOptions([field]);
  assert.deepEqual(field.options, []);
});

test('harvest clears failed search filters and waits for asynchronous options', async () => {
  const field = combo('degree', ["Bachelor's Degree", "Master's Degree"], { delay: 700 });
  field.input.value = 'Canada+1';
  const fields = scanFormFields();
  await harvestComboboxOptions(fields);
  assert.deepEqual(fields[0].options.map(o => o.label), ["Bachelor's Degree", "Master's Degree"]);
  assert.equal(field.input.value, '');
});

test('normalization preserves options beyond the first 50', () => {
  const options = Array.from({ length: 225 }, (_, i) => ({ value: String(i), label: `Nationality ${i}` }));
  assert.deepEqual(normalizeFieldsForAI([{ id: 'nationality', type: 'combobox', options }])[0].options, options);
});

test('fill selects the exact rendered country label without searching concatenated display text', async () => {
  const field = combo('country', ['Canada+1', 'United States+1']);
  assert.equal(await fillCombobox(field.input, 'Canada+1'), true);
  assert.deepEqual(field.clicked, ['Canada+1']);
  assert.deepEqual(field.searches.filter(Boolean), []);
});

test('fill rejects ambiguous prefixes without pressing Enter or leaving search residue', async () => {
  const field = combo('location', ['Canada - Alberta', 'Canada - Ontario']);
  assert.equal(await fillCombobox(field.input, 'Canada'), false);
  assert.deepEqual(field.clicked, []);
  assert.equal(field.input.value, '');
});

test('verification rejects a different selected option with the same prefix', async () => {
  const field = combo('location', ['Canada - Alberta'], { selected: 'Canada - Alberta' });
  assert.equal((await verifyCombobox(field.input, 'Canada')).verified, false);
});

test('verification recognizes committed multi chips', async () => {
  const field = combo('nationality', ['Canadian'], { selected: 'Canadian', multi: true });
  assert.equal((await verifyCombobox(field.input, 'Canadian')).verified, true);
});

test('AI answers outside the owning combobox options are rejected at the response boundary', async () => {
  saveApiKey('fixture-key');
  globalThis.GM_xmlhttpRequest = options => options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answers: [{ fieldId: 'race', value: 'Canada+1' }] }) } }] }) });
  const response = await generateAutofillAnswers([{ fieldId: 'race', type: 'combobox', options: [{ value: 'decline', label: 'Decline to state' }] }]);
  assert.deepEqual(response.answers, []);
});

test('AI autofill allows a response taking more than the old 35-second cutoff', async () => {
  saveApiKey('fixture-key');
  globalThis.GM_xmlhttpRequest = options => {
    if (options.timeout <= 35000) options.ontimeout();
    else options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answers":[]}' } }] }) });
  };
  assert.deepEqual((await generateAutofillAnswers([])).answers, []);
});

test('fetch fallback also aborts a stalled request at the autofill deadline', async t => {
  saveApiKey('fixture-key');
  let signal;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason)));
  });
  const pending = generateAutofillAnswers([]);
  assert.ok(signal, 'fetch must receive a cancellation signal');
  const rejected = assert.rejects(pending, /timed out.*120s/);
  t.mock.timers.tick(120001);
  await rejected;
  assert.equal(signal.aborted, true);
});

test('hidden options cannot be harvested or selected', async () => {
  const field = combo('degree', ['Visible', 'Hidden'], { portal: false });
  field.open();
  document.querySelectorAll('[role=option]')[1].style.display = 'none';
  assert.deepEqual(scanFormFields()[0].options.map(o => o.label), ['Visible']);
});

test('failed search text by itself never counts as a saved field', () => {
  const field = combo('race', ['Decline to state']);
  field.input.value = 'Canada+1';
  assert.equal(scanFormFields()[0].currentValue, '');
});

test('known field options reject another field answer before typing', async () => {
  const field = combo('race', ['Decline to state']);
  assert.equal(await fillCombobox(field.input, 'Canada+1', [{ value: 'decline', label: 'Decline to state' }]), false);
  assert.deepEqual(field.searches, []);
  assert.deepEqual(field.clicked, []);
});

test('Greenhouse controls open on mouseup', async () => {
  const field = combo('country', ['Canada +1'], { openEvent: 'mouseup' });
  assert.equal(await fillCombobox(field.input, 'Canada +1'), true);
});

test('opening an already open toggle does not close its menu', async () => {
  const field = combo('country', ['Canada +1'], { openEvent: 'unused' });
  field.input.addEventListener('mouseup', () => {
    if (field.input.getAttribute('aria-expanded') === 'true') closeCombobox(field.input);
    else field.open();
  });
  field.open();
  await openCombobox(field.input);
  assert.equal(field.input.getAttribute('aria-expanded'), 'true');
});

test('search harvesting retrieves a remote result and never commits the query', async () => {
  const field = combo('school', ['University of Guelph']);
  const fields = scanFormFields();
  await harvestComboboxOptions(fields, new Map([['school', 'Guelph']]));
  assert.ok(field.searches.includes('Guelph'));
  assert.equal(fields[0].options[0].label, 'University of Guelph');
  assert.deepEqual(field.clicked, []);
  assert.equal(field.input.value, '');
});

test('a temporary No options state is not mistaken for a finished async search', async () => {
  const field = combo('school', ['University of Guelph']);
  field.open();
  const menu = document.querySelector('[role=listbox]');
  menu.textContent = 'No options';
  setTimeout(() => { menu.innerHTML = '<div role="option">University of Guelph</div>'; }, 500);
  assert.equal((await waitForComboboxOptions(field.input))[0]?.textContent, 'University of Guelph');
});

test('search emits keyup for Greenhouse custom query handling', () => {
  const field = combo('school', ['University of Guelph']);
  let sawQuery;
  field.input.addEventListener('keyup', () => { sawQuery = field.input.value; });
  setComboboxSearch(field.input, 'Guelph');
  assert.equal(sawQuery, 'Guelph');
});

test('AI is asked for a grounded search query when the candidate option is outside the loaded page', async () => {
  saveApiKey('fixture-key');
  let prompt;
  globalThis.GM_xmlhttpRequest = options => {
    prompt = JSON.parse(options.data).messages[0].content;
    options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answers":[]}' } }] }) });
  };
  await generateAutofillAnswers([{ fieldId: 'school', type: 'combobox', options: [{ value: 'aalborg', label: 'Aalborg University' }] }]);
  assert.match(prompt, /searchQuery/);
});

test('second AI pass cannot request another search loop', async () => {
  saveApiKey('fixture-key');
  globalThis.GM_xmlhttpRequest = options => options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answers: [{ fieldId: 'school', value: '', searchQuery: 'Guelph' }] }) } }] }) });
  const response = await generateAutofillAnswers([{ fieldId: 'school', type: 'combobox', options: [] }], { allowSearch: false });
  assert.equal(response.answers[0].searchQuery, undefined);
});

test('workflow requests include job and validation context without putting the API key in the prompt', async () => {
  saveApiKey('fixture-private-key');
  let payload;
  globalThis.GM_xmlhttpRequest = options => {
    payload = JSON.parse(options.data);
    options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answers":[]}' } }] }) });
  };
  await generateAutofillAnswers([], { jobContext: { title: 'Engineer', company: 'Example' }, repairErrors: [{ fieldId: 'essay', message: 'Too short' }] });
  const content = JSON.parse(payload.messages[1].content);
  assert.equal(content.jobContext.company, 'Example');
  assert.equal(content.repairErrors[0].fieldId, 'essay');
  assert.equal(JSON.stringify(payload).includes('fixture-private-key'), false);
});

test('query resolution asks AI to choose only from newly harvested options', async () => {
  const { resolveComboboxSearchAnswers } = await import('../src/autofill.js');
  saveApiKey('fixture-key');
  const field = combo('school', ['University of Guelph']);
  const fields = scanFormFields();
  let requestedOptions;
  globalThis.GM_xmlhttpRequest = options => {
    requestedOptions = JSON.parse(JSON.parse(options.data).messages[1].content).fieldsToFill[0].options;
    options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answers":[{"fieldId":"school","value":"University of Guelph"}]}' } }] }) });
  };
  const response = await resolveComboboxSearchAnswers(fields, { answers: [{ fieldId: 'school', value: '', searchQuery: 'Guelph' }] });
  assert.deepEqual(requestedOptions, [{ value: 'University of Guelph', label: 'University of Guelph' }]);
  assert.equal(response.answers[0].value, 'University of Guelph');
  assert.deepEqual(field.clicked, []);
});

test('country verification distinguishes Canada and US when the selected display only shows +1', async () => {
  const field = combo('country', ['Canada +1', 'United States +1']);
  field.input.addEventListener('mousedown', () => {
    document.querySelectorAll('[role=option]').forEach((option, index) => {
      const flag = document.createElement('div');
      flag.className = `iti__flag iti__${index === 0 ? 'ca' : 'us'}`;
      option.prepend(flag);
      option.addEventListener('click', () => {
        field.shell.querySelector('.select__single-value').innerHTML = `<div class="${flag.className}"></div><span>+1</span>`;
      });
    });
  });
  assert.equal(await fillCombobox(field.input, 'Canada +1'), true);
  assert.equal((await verifyCombobox(field.input, 'Canada +1')).verified, true);
  field.shell.querySelector('.iti__flag').className = 'iti__flag iti__us';
  assert.equal((await verifyCombobox(field.input, 'Canada +1')).verified, false);
});

test('selected React inputs with opacity zero remain scannable for overwrite mode', () => {
  const field = combo('degree', ["Bachelor's Degree"], { selected: "Bachelor's Degree" });
  field.input.style.opacity = '0';
  assert.equal(scanFormFields()[0]?.currentValue, "Bachelor's Degree");
});

test('dropdown cleanup does not send Escape to page navigation handlers', async () => {
  const field = combo('country', ['Canada']);
  const back = document.createElement('button');
  document.body.append(back);
  back.focus();
  let navigationKeys = 0;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') navigationKeys++; });
  await openCombobox(field.input);
  closeCombobox(field.input);
  assert.equal(navigationKeys, 0);
});

test('button dropdown is scanned and its selected label is recognized', () => {
  document.querySelector('main').innerHTML = '<label for="country">Country</label><button id="country" type="button" aria-haspopup="listbox" aria-expanded="false">Canada</button>';
  const fields = scanFormFields();
  assert.equal(fields.length, 1);
  assert.equal(fields[0].type, 'combobox');
  assert.equal(fields[0].currentValue, 'Canada');
});

test('opening a dropdown button never triggers native form submission', async () => {
  document.querySelector('main').innerHTML = '<form><button id="country" aria-haspopup="listbox" aria-controls="menu">Select One</button><div id="menu" role="listbox"><div role="option">Canada</div></div></form>';
  let submissions = 0;
  document.querySelector('form').onsubmit = e => { e.preventDefault(); submissions++; };
  await openCombobox(document.querySelector('#country'));
  assert.equal(submissions, 0);
});
