import { APP_VERSION, APP_NAME, POPULAR_MODELS, UI_IDS } from './constants.js';
import {
  getSettings,
  saveSettings,
  getProfile,
  saveProfile,
  getApiKey,
  saveApiKey,
  getSanitizedState,
} from './storage.js';
import { logger } from './debug.js';
import { testConnection } from './ai.js';

let shadowRootRef = null;
let currentTab = 'home';
let panelVisible = false;
let lastAiTestResult = null;
let isAiTesting = false;

const STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #e2e8f0;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.jc-widget-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}

.jc-pill-btn {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #f8fafc;
  border: 1px solid #334155;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.jc-pill-btn:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  border-color: #475569;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}

.jc-pill-btn:active {
  transform: translateY(0);
}

.jc-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.jc-status-dot.no-key {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.jc-status-dot.error {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

.jc-panel {
  pointer-events: auto;
  width: 440px;
  max-width: calc(100vw - 40px);
  height: 580px;
  max-height: calc(100vh - 100px);
  background: #0f172a;
  background-image: radial-gradient(at 0% 0%, rgba(30, 41, 59, 0.7) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, rgba(15, 23, 42, 0.9) 0px, transparent 50%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: jc-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes jc-slide-up {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.jc-header {
  padding: 14px 18px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.jc-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  color: #f8fafc;
}

.jc-version-tag {
  background: #1e293b;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #334155;
}

.jc-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.jc-close-btn:hover {
  background: #1e293b;
  color: #f8fafc;
}

.jc-nav-tabs {
  display: flex;
  background: #090d16;
  border-bottom: 1px solid #1e293b;
  padding: 0 8px;
}

.jc-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  padding: 10px 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.jc-tab-btn:hover {
  color: #f1f5f9;
}

.jc-tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}

.jc-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.jc-content::-webkit-scrollbar {
  width: 6px;
}
.jc-content::-webkit-scrollbar-track {
  background: transparent;
}
.jc-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

.jc-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.jc-card-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.jc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.jc-label {
  font-size: 12px;
  color: #cbd5e1;
  font-weight: 500;
}

.jc-val {
  font-size: 12px;
  color: #f8fafc;
  font-weight: 600;
  word-break: break-all;
}

.jc-form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.jc-form-group label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.jc-input, .jc-select, .jc-textarea {
  width: 100%;
  background: #090d16;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f8fafc;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.jc-input:focus, .jc-select:focus, .jc-textarea:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px #38bdf8;
}

.jc-textarea {
  min-height: 70px;
  resize: vertical;
}

.jc-btn {
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.jc-btn:hover {
  background: #1d4ed8;
}

.jc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.jc-btn-secondary {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
}

.jc-btn-secondary:hover {
  background: #334155;
  color: #f8fafc;
}

.jc-btn-danger {
  background: #991b1b;
  color: #fecaca;
}

.jc-btn-danger:hover {
  background: #b91c1c;
}

.jc-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(51, 65, 85, 0.3);
}

.jc-toggle-row:last-child {
  border-bottom: none;
}

.jc-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.jc-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.jc-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #334155;
  transition: 0.2s;
  border-radius: 20px;
}

.jc-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .jc-slider {
  background-color: #2563eb;
}

input:checked + .jc-slider:before {
  transform: translateX(16px);
}

.jc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.jc-badge-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.jc-badge-amber {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.jc-badge-red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.jc-alert {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
}

.jc-alert-success {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #a7f3d0;
}

.jc-alert-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fecaca;
}

.jc-log-box {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 8px;
  max-height: 180px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.jc-log-item {
  line-height: 1.3;
  word-break: break-all;
}

.jc-log-time {
  color: #64748b;
  margin-right: 4px;
}

.jc-log-level-INFO { color: #38bdf8; }
.jc-log-level-WARN { color: #fbbf24; }
.jc-log-level-ERROR { color: #f87171; }
.jc-log-level-DEBUG { color: #94a3b8; }

.jc-save-feedback {
  font-size: 11px;
  color: #34d399;
  display: none;
}
`;

function getStatusInfo() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      label: 'No API Key',
      dotClass: 'no-key',
      badgeClass: 'jc-badge-amber',
      text: 'Configure your OpenRouter API key in Settings.',
    };
  }
  if (lastAiTestResult && !lastAiTestResult.ok) {
    return {
      label: 'API Error',
      dotClass: 'error',
      badgeClass: 'jc-badge-red',
      text: lastAiTestResult.error || 'OpenRouter connection failed',
    };
  }
  return {
    label: 'Ready',
    dotClass: '',
    badgeClass: 'jc-badge-green',
    text: 'Connected and ready for action.',
  };
}

function renderPill() {
  const status = getStatusInfo();
  return `
    <div class="jc-pill-btn" id="jc-toggle-btn" title="Toggle Job Copilot Panel">
      <div class="jc-status-dot ${status.dotClass}"></div>
      <span>Job Copilot</span>
    </div>
  `;
}

function renderHomeTab() {
  const status = getStatusInfo();
  const settings = getSettings();
  const currentUrl = window.location.href;
  const currentHost = window.location.hostname;

  let testResultHtml = '';
  if (lastAiTestResult) {
    if (lastAiTestResult.ok) {
      testResultHtml = `
        <div class="jc-alert jc-alert-success">
          <strong>✓ AI Connected</strong> (${lastAiTestResult.latencyMs}ms)<br/>
          <span style="font-size: 11px; color: #cbd5e1;">Model: ${lastAiTestResult.model}</span><br/>
          <span style="font-size: 11px; color: #94a3b8;">Response: "${lastAiTestResult.reply}"</span>
        </div>
      `;
    } else {
      testResultHtml = `
        <div class="jc-alert jc-alert-error">
          <strong>✗ Connection Failed</strong> (${lastAiTestResult.latencyMs}ms)<br/>
          <span style="font-size: 11px;">${lastAiTestResult.error}</span>
        </div>
      `;
    }
  }

  return `
    <div class="jc-card">
      <div class="jc-row">
        <span class="jc-card-title">Status</span>
        <span class="jc-badge ${status.badgeClass}">${status.label}</span>
      </div>
      <div style="font-size: 12px; color: #94a3b8;">
        ${status.text}
      </div>
    </div>

    <div class="jc-card">
      <span class="jc-card-title">Current Context</span>
      <div class="jc-row">
        <span class="jc-label">Host</span>
        <span class="jc-val">${currentHost}</span>
      </div>
      <div class="jc-row">
        <span class="jc-label">Active Model</span>
        <span class="jc-val" style="font-family: monospace; font-size: 11px;">${settings.model}</span>
      </div>
    </div>

    <div class="jc-card">
      <span class="jc-card-title">OpenRouter Connectivity</span>
      <button class="jc-btn" id="jc-test-ai-btn" ${isAiTesting ? 'disabled' : ''}>
        ${isAiTesting ? 'Testing Connection...' : '⚡ Test AI Connection'}
      </button>
      ${testResultHtml}
    </div>
  `;
}

function renderProfileTab() {
  const profile = getProfile();

  return `
    <form id="jc-profile-form" style="display: flex; flex-direction: column; gap: 12px;">
      <div class="jc-form-group">
        <label>Full Name</label>
        <input class="jc-input" type="text" name="fullName" value="${escapeHtml(profile.fullName)}" placeholder="e.g. Jane Doe" />
      </div>

      <div class="jc-row" style="gap: 10px;">
        <div class="jc-form-group" style="flex: 1;">
          <label>Email</label>
          <input class="jc-input" type="email" name="email" value="${escapeHtml(profile.email)}" placeholder="jane@example.com" />
        </div>
        <div class="jc-form-group" style="flex: 1;">
          <label>Phone</label>
          <input class="jc-input" type="tel" name="phone" value="${escapeHtml(profile.phone)}" placeholder="+1 555 123 4567" />
        </div>
      </div>

      <div class="jc-form-group">
        <label>Location</label>
        <input class="jc-input" type="text" name="location" value="${escapeHtml(profile.location)}" placeholder="e.g. San Francisco, CA" />
      </div>

      <div class="jc-form-group">
        <label>LinkedIn URL</label>
        <input class="jc-input" type="url" name="linkedin" value="${escapeHtml(profile.linkedin)}" placeholder="https://linkedin.com/in/..." />
      </div>

      <div class="jc-row" style="gap: 10px;">
        <div class="jc-form-group" style="flex: 1;">
          <label>GitHub URL</label>
          <input class="jc-input" type="url" name="github" value="${escapeHtml(profile.github)}" placeholder="https://github.com/..." />
        </div>
        <div class="jc-form-group" style="flex: 1;">
          <label>Portfolio URL</label>
          <input class="jc-input" type="url" name="portfolio" value="${escapeHtml(profile.portfolio)}" placeholder="https://..." />
        </div>
      </div>

      <div class="jc-form-group">
        <label>Resume / Background Summary</label>
        <textarea class="jc-textarea" name="resumeContext" rows="4" placeholder="Paste your core resume highlights, skills, and background summary...">${escapeHtml(profile.resumeContext)}</textarea>
      </div>

      <div class="jc-form-group">
        <label>Applicant Notes / Custom Rules</label>
        <textarea class="jc-textarea" name="applicantNotes" rows="2" placeholder="e.g. Prefer Remote, US Citizen, Target salary $180k+">${escapeHtml(profile.applicantNotes)}</textarea>
      </div>

      <div class="jc-row" style="margin-top: 4px;">
        <button class="jc-btn" type="submit" style="flex: 1;">Save Profile</button>
        <span class="jc-save-feedback" id="jc-profile-feedback">Saved ✓</span>
      </div>
    </form>
  `;
}

function renderSettingsTab() {
  const settings = getSettings();
  const apiKey = getApiKey();

  const modelOptions = POPULAR_MODELS.map((m) => {
    const selected = settings.model === m ? 'selected' : '';
    return `<option value="${m}" ${selected}>${m}</option>`;
  }).join('');

  return `
    <form id="jc-settings-form" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="jc-form-group">
        <label>OpenRouter API Key</label>
        <div class="jc-row">
          <input class="jc-input" id="jc-api-key-input" type="password" placeholder="sk-or-v1-..." value="${escapeHtml(apiKey)}" />
          <button type="button" class="jc-btn jc-btn-secondary" id="jc-toggle-key-btn" style="padding: 8px 10px;">👁</button>
        </div>
        <span style="font-size: 11px; color: #64748b;">
          Stored exclusively in GM userscript storage. Never exposed to page DOM.
        </span>
      </div>

      <div class="jc-form-group">
        <label>AI Model</label>
        <select class="jc-select" name="model" id="jc-model-select">
          ${modelOptions}
          <option value="custom" ${!POPULAR_MODELS.includes(settings.model) ? 'selected' : ''}>Custom Model...</option>
        </select>
        <input class="jc-input" id="jc-custom-model-input" type="text" placeholder="Enter custom model ID" value="${escapeHtml(settings.model)}" style="margin-top: 6px; display: ${!POPULAR_MODELS.includes(settings.model) ? 'block' : 'none'};" />
      </div>

      <div class="jc-card">
        <span class="jc-card-title">Behavior Controls</span>
        
        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">AI Autofill</div>
            <div style="font-size: 11px; color: #64748b;">Scan and auto-fill form fields</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autofillEnabled" ${settings.autofillEnabled ? 'checked' : ''} />
            <span class="jc-slider"></span>
          </label>
        </div>

        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">Auto Continue</div>
            <div style="font-size: 11px; color: #64748b;">Advance to next step on valid page</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autoContinue" ${settings.autoContinue ? 'checked' : ''} />
            <span class="jc-slider"></span>
          </label>
        </div>

        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">Auto Submit</div>
            <div style="font-size: 11px; color: #64748b;">Final application submission (Default OFF)</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autoSubmit" ${settings.autoSubmit ? 'checked' : ''} />
            <span class="jc-slider"></span>
          </label>
        </div>

        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">Autopilot Mode</div>
            <div style="font-size: 11px; color: #64748b;">Autonomous multi-step progression</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autopilot" ${settings.autopilot ? 'checked' : ''} />
            <span class="jc-slider"></span>
          </label>
        </div>
      </div>

      <div class="jc-row">
        <button class="jc-btn" type="submit" style="flex: 1;">Save Settings</button>
        <span class="jc-save-feedback" id="jc-settings-feedback">Saved ✓</span>
      </div>
    </form>
  `;
}

function renderDebugTab() {
  const state = getSanitizedState();
  const logs = logger.getLogs();

  const logsHtml = logs.length === 0
    ? '<span style="color: #64748b;">No debug logs recorded yet.</span>'
    : logs.slice().reverse().map((l) => {
        const time = l.timestamp.split('T')[1]?.slice(0, 8) || '';
        return `
          <div class="jc-log-item">
            <span class="jc-log-time">[${time}]</span>
            <span class="jc-log-level-${l.level}">[${l.level}]</span>
            <span>${escapeHtml(l.message)}</span>
          </div>
        `;
      }).join('');

  return `
    <div class="jc-card">
      <div class="jc-row">
        <span class="jc-card-title">System Information</span>
        <span class="jc-val" style="font-size: 11px;">v${state.version}</span>
      </div>
      <div class="jc-row">
        <span class="jc-label">API Key Stored</span>
        <span class="jc-badge ${state.hasApiKey ? 'jc-badge-green' : 'jc-badge-amber'}">
          ${state.hasApiKey ? 'Present (Isolated in Secrets)' : 'Not Configured'}
        </span>
      </div>
      <div class="jc-row">
        <span class="jc-label">Current Host</span>
        <span class="jc-val" style="font-size: 11px;">${state.host}</span>
      </div>
    </div>

    <div class="jc-card">
      <div class="jc-row">
        <span class="jc-card-title">Sanitized Settings</span>
      </div>
      <pre style="margin: 0; font-family: monospace; font-size: 11px; color: #94a3b8; background: #090d16; padding: 8px; border-radius: 6px; overflow-x: auto;">${escapeHtml(JSON.stringify(state.settings, null, 2))}</pre>
    </div>

    <div class="jc-card">
      <div class="jc-row">
        <span class="jc-card-title">Recent Activity Logs (${logs.length})</span>
        <button class="jc-btn jc-btn-secondary" id="jc-clear-logs-btn" style="padding: 4px 8px; font-size: 10px;">Clear</button>
      </div>
      <div class="jc-log-box" id="jc-log-container">
        ${logsHtml}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let ttPolicy = null;

function getTrustedHTML(htmlString) {
  if (typeof window !== 'undefined' && window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
    if (!ttPolicy) {
      try {
        ttPolicy = window.trustedTypes.createPolicy('job-copilot-ui', {
          createHTML: (s) => s,
        });
      } catch {
        ttPolicy = window.trustedTypes.defaultPolicy || { createHTML: (s) => s };
      }
    }
    try {
      return ttPolicy.createHTML ? ttPolicy.createHTML(htmlString) : htmlString;
    } catch {
      return htmlString;
    }
  }
  return htmlString;
}

function setSafeHTML(element, htmlString) {
  try {
    element.innerHTML = getTrustedHTML(htmlString);
  } catch (err) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      element.replaceChildren(...doc.body.childNodes);
    } catch (parseErr) {
      console.warn('[JobCopilot:UI] Fallback HTML assignment failed:', parseErr);
    }
  }
}

function updatePanelDOM() {
  if (!shadowRootRef) return;

  const container = shadowRootRef.querySelector('.jc-widget-container');
  if (!container) return;

  const status = getStatusInfo();

  let panelHtml = '';
  if (panelVisible) {
    let tabContent = '';
    if (currentTab === 'home') tabContent = renderHomeTab();
    else if (currentTab === 'profile') tabContent = renderProfileTab();
    else if (currentTab === 'settings') tabContent = renderSettingsTab();
    else if (currentTab === 'debug') tabContent = renderDebugTab();

    panelHtml = `
      <div class="jc-panel" id="jc-main-panel">
        <div class="jc-header">
          <div class="jc-header-title">
            <span>✨</span>
            <span>${APP_NAME}</span>
            <span class="jc-version-tag">v${APP_VERSION}</span>
          </div>
          <button class="jc-close-btn" id="jc-close-panel-btn" title="Minimize panel">✕</button>
        </div>

        <div class="jc-nav-tabs">
          <button class="jc-tab-btn ${currentTab === 'home' ? 'active' : ''}" data-tab="home">Home</button>
          <button class="jc-tab-btn ${currentTab === 'profile' ? 'active' : ''}" data-tab="profile">Profile</button>
          <button class="jc-tab-btn ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">Settings</button>
          <button class="jc-tab-btn ${currentTab === 'debug' ? 'active' : ''}" data-tab="debug">Debug</button>
        </div>

        <div class="jc-content">
          ${tabContent}
        </div>
      </div>
    `;
  }

  setSafeHTML(container, `
    ${panelHtml}
    ${renderPill()}
  `);

  attachEventHandlers();
}

function attachEventHandlers() {
  if (!shadowRootRef) return;

  // Toggle button handler
  const toggleBtn = shadowRootRef.querySelector('#jc-toggle-btn');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      panelVisible = !panelVisible;
      updatePanelDOM();
    };
  }

  // Close panel handler
  const closeBtn = shadowRootRef.querySelector('#jc-close-panel-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      panelVisible = false;
      updatePanelDOM();
    };
  }

  // Tab buttons
  const tabBtns = shadowRootRef.querySelectorAll('.jc-tab-btn');
  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        currentTab = targetTab;
        updatePanelDOM();
      }
    };
  });

  // Home: Test AI button
  const testAiBtn = shadowRootRef.querySelector('#jc-test-ai-btn');
  if (testAiBtn) {
    testAiBtn.onclick = async () => {
      isAiTesting = true;
      updatePanelDOM();
      try {
        lastAiTestResult = await testConnection();
      } catch (err) {
        lastAiTestResult = { ok: false, error: err.message, latencyMs: 0 };
      } finally {
        isAiTesting = false;
        updatePanelDOM();
      }
    };
  }

  // Profile Form submit
  const profileForm = shadowRootRef.querySelector('#jc-profile-form');
  if (profileForm) {
    profileForm.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(profileForm);
      const newProfile = {
        fullName: formData.get('fullName') || '',
        email: formData.get('email') || '',
        phone: formData.get('phone') || '',
        location: formData.get('location') || '',
        linkedin: formData.get('linkedin') || '',
        github: formData.get('github') || '',
        portfolio: formData.get('portfolio') || '',
        resumeContext: formData.get('resumeContext') || '',
        applicantNotes: formData.get('applicantNotes') || '',
      };
      saveProfile(newProfile);
      logger.info('Profile saved successfully.');

      const feedback = shadowRootRef.querySelector('#jc-profile-feedback');
      if (feedback) {
        feedback.style.display = 'inline';
        setTimeout(() => { feedback.style.display = 'none'; }, 2000);
      }
    };
  }

  // Settings Form submit
  const settingsForm = shadowRootRef.querySelector('#jc-settings-form');
  if (settingsForm) {
    // Model dropdown dynamic switch
    const modelSelect = shadowRootRef.querySelector('#jc-model-select');
    const customInput = shadowRootRef.querySelector('#jc-custom-model-input');
    if (modelSelect && customInput) {
      modelSelect.onchange = () => {
        if (modelSelect.value === 'custom') {
          customInput.style.display = 'block';
        } else {
          customInput.style.display = 'none';
          customInput.value = modelSelect.value;
        }
      };
    }

    // Toggle API Key visibility
    const toggleKeyBtn = shadowRootRef.querySelector('#jc-toggle-key-btn');
    const apiKeyInput = shadowRootRef.querySelector('#jc-api-key-input');
    if (toggleKeyBtn && apiKeyInput) {
      toggleKeyBtn.onclick = () => {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
        toggleKeyBtn.textContent = apiKeyInput.type === 'password' ? '👁' : '🔒';
      };
    }

    settingsForm.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(settingsForm);

      let selectedModel = modelSelect?.value || 'google/gemini-2.0-flash';
      if (selectedModel === 'custom' && customInput) {
        selectedModel = customInput.value.trim() || 'google/gemini-2.0-flash';
      }

      const newSettings = {
        model: selectedModel,
        autofillEnabled: formData.get('autofillEnabled') === 'on',
        autoContinue: formData.get('autoContinue') === 'on',
        autoSubmit: formData.get('autoSubmit') === 'on',
        autopilot: formData.get('autopilot') === 'on',
      };

      saveSettings(newSettings);

      if (apiKeyInput) {
        saveApiKey(apiKeyInput.value);
      }

      logger.info('Settings saved.');

      const feedback = shadowRootRef.querySelector('#jc-settings-feedback');
      if (feedback) {
        feedback.style.display = 'inline';
        setTimeout(() => { feedback.style.display = 'none'; }, 2000);
      }
    };
  }

  // Debug: Clear logs
  const clearLogsBtn = shadowRootRef.querySelector('#jc-clear-logs-btn');
  if (clearLogsBtn) {
    clearLogsBtn.onclick = () => {
      logger.clear();
      updatePanelDOM();
    };
  }
}

export function mountUI() {
  if (document.getElementById(UI_IDS.CONTAINER)) {
    return;
  }

  const rootElement = document.createElement('div');
  rootElement.id = UI_IDS.CONTAINER;
  rootElement.style.position = 'absolute';
  rootElement.style.top = '0';
  rootElement.style.left = '0';
  rootElement.style.zIndex = '2147483647';

  const shadow = rootElement.attachShadow({ mode: 'open' });
  shadowRootRef = shadow;

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  shadow.appendChild(styleEl);

  const container = document.createElement('div');
  container.className = 'jc-widget-container';
  shadow.appendChild(container);

  const target = document.body || document.documentElement;
  if (target) {
    target.appendChild(rootElement);
    updatePanelDOM();
    logger.info('Job Copilot Shadow DOM UI mounted successfully.');
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      (document.body || document.documentElement).appendChild(rootElement);
      updatePanelDOM();
      logger.info('Job Copilot Shadow DOM UI mounted on DOMContentLoaded.');
    });
  }
}

export function toggleUIVisibility() {
  panelVisible = !panelVisible;
  updatePanelDOM();
}
