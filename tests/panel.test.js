import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('bundled panel mounts once and captures a job using GM storage', async () => {
  const bundle = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', write: false });
  const dom = new JSDOM('<body><main><h1>Software Engineer</h1><article>Job description: Build useful software.</article><a href="/apply/42">Apply now</a></main></body>', { url: 'https://example.com/jobs/42', runScripts: 'dangerously' });
  const storage = new Map();
  storage.set('jc:secrets', { apiKey: 'fixture-stored-secret' });
  dom.window.GM_getValue = (key, fallback) => storage.get(key) ?? fallback;
  dom.window.GM_setValue = (key, value) => storage.set(key, value);
  dom.window.GM_getTab = callback => callback({});
  dom.window.GM_saveTab = () => {};
  dom.window.CSS = { escape: value => value };
  try {
    dom.window.eval(bundle.outputFiles[0].text);
    await new Promise(resolve => setTimeout(resolve, 30));
    const root = dom.window.document.querySelector('#job-copilot-root');
    assert.ok(root?.shadowRoot, 'Persistent Shadow DOM panel mounts');
    root.shadowRoot.querySelector('#jc-toggle-btn').click();
    root.shadowRoot.querySelector('#jc-capture-job').click();
    assert.match(root.shadowRoot.textContent, /Software Engineer/);
    assert.match(root.shadowRoot.textContent, /Company unknown \(uncertain\)/);
    assert.equal(storage.get('jc:job').applicationUrl, 'https://example.com/apply/42');
    assert.equal(storage.get('jc:sessions').length, 1);
    assert.ok(root.shadowRoot.querySelector('#jc-pause-autofill-btn'), 'Pause autofill button is present');
    assert.ok(root.shadowRoot.querySelector('#jc-pause-application'), 'Pause application button is present');
    root.shadowRoot.querySelector('[data-tab=settings]').click();
    assert.equal(root.shadowRoot.querySelector('#jc-api-key-input').value, '');
    assert.equal(root.shadowRoot.innerHTML.includes('fixture-stored-secret'), false);
    root.shadowRoot.querySelector('#jc-settings-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(storage.get('jc:secrets').apiKey, 'fixture-stored-secret');
    assert.equal(root.shadowRoot.querySelector('[name=autoContinue]').checked, true);
    assert.equal(root.shadowRoot.querySelector('[name=autoSubmit]').disabled, true);
    assert.equal(dom.window.document.querySelectorAll('#job-copilot-root').length, 1);
  } finally { dom.window.close(); }
});
