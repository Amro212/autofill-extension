// ==UserScript==
// @name         Job Copilot
// @namespace    https://github.com/Amro212/autofill-extension
// @version      0.3.8
// @description  Job Copilot — Tampermonkey userscript for AI job applications
// @author       Job Copilot Team
// @updateURL    https://raw.githubusercontent.com/Amro212/autofill-extension/main/dist/job-copilot.user.js
// @downloadURL  https://raw.githubusercontent.com/Amro212/autofill-extension/main/dist/job-copilot.user.js
// @match        *://*/*
// @connect      openrouter.ai
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getTab
// @grant        GM_saveTab
// @run-at       document-idle
// ==/UserScript==

(() => {
  // src/profile.js
  var yesNo = ["Yes", "No"];
  var disclosure = ["Yes", "No", "Prefer not to answer"];
  var PROFILE_SECTIONS = [
    { title: "Work eligibility", description: "Authorization and sponsorship answers apply only to this work country. Leave unknown answers unset.", fields: [
      { name: "workCountry", label: "Work country", placeholder: "e.g. Canada" },
      { name: "workAuthorization", label: "Authorized to work in this country?", options: yesNo },
      { name: "sponsorshipNow", label: "Require sponsorship now?", options: yesNo },
      { name: "sponsorshipFuture", label: "Require sponsorship in the future?", options: yesNo }
    ] },
    { title: "Work preferences", description: "Save answers you want reused across applications.", fields: [
      { name: "workArrangement", label: "Preferred work arrangement", options: ["Remote", "Hybrid", "Onsite", "Flexible"] },
      { name: "willingToRelocate", label: "Willing to relocate?", options: [...yesNo, "Depends on the opportunity"] },
      { name: "travelAvailability", label: "Willingness to travel", placeholder: "e.g. Up to 25%" },
      { name: "startDate", label: "Earliest start date", type: "date" },
      { name: "noticePeriod", label: "Notice period", placeholder: "e.g. Two weeks or available immediately" }
    ] },
    { title: "Compensation", description: "Include currency and pay period so your expectations are unambiguous.", fields: [
      { name: "expectedSalary", label: "Expected salary or range", placeholder: "e.g. 90000\u2013110000" },
      { name: "salaryCurrency", label: "Currency", placeholder: "e.g. CAD, USD, GBP" },
      { name: "salaryPeriod", label: "Pay period", options: ["Annual", "Monthly", "Hourly"] }
    ] },
    { title: "Background", description: "Your context below still supplies detailed experience, projects and qualifications.", fields: [
      { name: "educationLevel", label: "Highest education level", options: ["High school", "Associate degree", "Bachelor's degree", "Master's degree", "Doctorate", "Professional degree", "Other"] },
      { name: "yearsExperience", label: "Total years of professional experience", type: "number", placeholder: "e.g. 3", min: "0", step: "0.5" },
      { name: "languages", label: "Languages and proficiency", placeholder: "e.g. English (fluent), French (intermediate)" }
    ] },
    { title: "Optional self-identification", description: "Not set leaves the answer blank. Choose \u201CPrefer not to answer\u201D to decline disclosure. These answers are never guessed.", fields: [
      { name: "gender", label: "Gender", options: ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to answer"] },
      { name: "genderDescription", label: "Gender self-description (if selected)", placeholder: "Your own description" },
      { name: "pronouns", label: "Pronouns", placeholder: "e.g. she/her, he/him, they/them, Prefer not to answer" },
      { name: "raceEthnicity", label: "Race / ethnicity", placeholder: "Your self-description or Prefer not to answer" },
      { name: "disabilityStatus", label: "Disability (current or past)", options: disclosure },
      { name: "veteranStatus", label: "Veteran status", options: disclosure }
    ] }
  ];
  var PROFILE_FIELDS = PROFILE_SECTIONS.flatMap((section) => section.fields);
  var STRUCTURED_PROFILE_DEFAULTS = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.name, ""]));
  function profileForAI(profile) {
    const keys = ["fullName", "email", "phone", "location", "linkedin", "github", "portfolio", ...PROFILE_FIELDS.map((field) => field.name)];
    return Object.fromEntries(keys.map((key2) => [key2, profile[key2] || ""]));
  }
  var normalize = (value) => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  var isDecline = (value) => /^(prefer not to (?:answer|say|disclose)|(?:i )?(?:do not|dont) (?:wish|want) to (?:answer|disclose)|decline(?: to (?:state|answer|identify|disclose))?)$/.test(normalize(value));
  function matchesDemographicOption(key2, value, label) {
    const option = normalize(label);
    if (key2 === "gender") {
      return value === "Woman" && option === "female" || value === "Man" && option === "male";
    }
    if (key2 === "disabilityStatus") {
      return value === "Yes" && /^yes i have a disability\b/.test(option) || value === "No" && /^no i (?:do not|dont) have a disability\b/.test(option);
    }
    return false;
  }
  function fixedProfileAnswer(field, profile, { allowSearch = true } = {}) {
    const label = normalize(field.label);
    const source = /^(?:how (?:did|do) you (?:hear|learn) about\b|where did you (?:hear about|find|learn about|see) (?:us|this (?:job|role|position|opportunity|opening)|(?:the|our) (?:job|company|role|position|opportunity|opening))\b|(?:application|applicant|referral|recruitment|job) source$|source$)/.test(label);
    let key2;
    if (/^(?:what (?:is|are) your |your |please (?:select|specify|indicate) your )?(?:gender(?: identity)?|pronouns|race(?: (?:and )?ethnicity)?|ethnicity|disability(?: status)?|veteran(?: status)?)(?: optional)?$/.test(label)) {
      if (/\bgender\b/.test(label)) key2 = "gender";
      else if (/\bpronouns\b/.test(label)) key2 = "pronouns";
      else if (/\b(?:race|ethnicity)\b/.test(label)) key2 = "raceEthnicity";
      else if (/\bdisability\b/.test(label)) key2 = "disabilityStatus";
      else if (/\bveteran\b/.test(label)) key2 = "veteranStatus";
    }
    if (/^do you have (?:a |any )?disabilit(?:y|ies)$/.test(label)) key2 = "disabilityStatus";
    if (!source && !key2) return null;
    let value = source ? "LinkedIn" : profile[key2] || "";
    if (key2 === "gender" && value === "Self-describe") value = profile.genderDescription || "";
    const answer = { fieldId: field.fieldId, value, inferred: false };
    if (!value || !["select", "combobox", "radio", "checkbox"].includes(field.type)) return answer;
    const options = field.options || [];
    const matches = options.filter((option) => normalize(option.label) === normalize(value) || normalize(option.value) === normalize(value) || source && /^(?:linkedin jobs|linkedincom)$/.test(normalize(option.label)) || isDecline(value) && isDecline(option.label) || matchesDemographicOption(key2, value, option.label));
    const match = matches.length === 1 ? matches[0] : null;
    answer.value = match ? field.type === "combobox" ? match.label : match.value : "";
    if (source && !match && field.type === "combobox" && allowSearch) answer.searchQuery = "LinkedIn";
    return answer;
  }

  // src/constants.js
  var APP_VERSION = true ? "0.3.8" : "0.3.0";
  var APP_NAME = "Job Copilot";
  var STORAGE_KEYS = {
    SETTINGS: "jc:settings",
    PROFILE: "jc:profile",
    SECRETS: "jc:secrets",
    DEBUG: "jc:debug",
    VERSION: "jc:version",
    JOB: "jc:job",
    SESSIONS: "jc:sessions",
    MEMORY: "jc:memory"
  };
  var DEFAULT_SETTINGS = {
    model: "google/gemini-2.0-flash",
    autofillEnabled: true,
    overwriteExisting: false,
    autoContinue: true,
    autoSubmit: false,
    autopilot: false
  };
  var DEFAULT_PROFILE = {
    ...STRUCTURED_PROFILE_DEFAULTS,
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
    resumeContext: "",
    applicantNotes: ""
  };
  var POPULAR_MODELS = [
    "google/gemini-2.0-flash",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat"
  ];
  var UI_IDS = {
    CONTAINER: "job-copilot-root",
    INLINE_REWRITE: "job-copilot-inline-rewrite"
  };
  var FIELD_TYPES2 = {
    TEXT: "text",
    TEXTAREA: "textarea",
    EMAIL: "email",
    TEL: "tel",
    URL: "url",
    NUMBER: "number",
    SELECT: "select",
    RADIO: "radio",
    CHECKBOX: "checkbox",
    COMBOBOX: "combobox",
    CONTENTEDITABLE: "contenteditable"
  };
  var FILL_STATUS = {
    IDLE: "idle",
    DETECTED: "detected",
    FILLING: "filling",
    VERIFIED: "verified",
    FAILED: "failed",
    SKIPPED: "skipped",
    INFERRED: "inferred"
  };

  // src/storage.js
  var memoryStore = /* @__PURE__ */ new Map();
  function isGMAvailable() {
    return typeof GM_getValue === "function" && typeof GM_setValue === "function";
  }
  function gmGet(key2, defaultValue = null) {
    try {
      if (isGMAvailable()) {
        const val = GM_getValue(key2, defaultValue);
        return val !== void 0 ? val : defaultValue;
      }
      return memoryStore.has(key2) ? memoryStore.get(key2) : defaultValue;
    } catch (err) {
      console.error(`[JobCopilot:Storage] Failed to read "${key2}":`, err);
      return defaultValue;
    }
  }
  function gmSet(key2, value) {
    try {
      if (isGMAvailable()) {
        GM_setValue(key2, value);
      } else {
        memoryStore.set(key2, value);
      }
    } catch (err) {
      console.error(`[JobCopilot:Storage] Failed to write "${key2}":`, err);
    }
  }
  function gmDelete(key2) {
    try {
      if (typeof GM_deleteValue === "function") {
        GM_deleteValue(key2);
      } else {
        memoryStore.delete(key2);
      }
    } catch (err) {
      console.error(`[JobCopilot:Storage] Failed to delete "${key2}":`, err);
    }
  }
  function getSettings() {
    const stored = gmGet(STORAGE_KEYS.SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  function saveSettings(settings) {
    const cleanSettings = { ...settings };
    delete cleanSettings.apiKey;
    delete cleanSettings.openRouterApiKey;
    gmSet(STORAGE_KEYS.SETTINGS, cleanSettings);
    return getSettings();
  }
  function getProfile() {
    const stored = gmGet(STORAGE_KEYS.PROFILE, {});
    return { ...DEFAULT_PROFILE, ...stored };
  }
  function saveProfile(profile) {
    const cleanProfile = { ...DEFAULT_PROFILE, ...profile };
    gmSet(STORAGE_KEYS.PROFILE, cleanProfile);
    return getProfile();
  }
  function getApiKey() {
    const secrets = gmGet(STORAGE_KEYS.SECRETS, {});
    return secrets && secrets.apiKey ? String(secrets.apiKey).trim() : "";
  }
  function saveApiKey(apiKey) {
    const cleanKey = typeof apiKey === "string" ? apiKey.trim() : "";
    gmSet(STORAGE_KEYS.SECRETS, { apiKey: cleanKey });
  }
  function getDebugLogs() {
    return gmGet(STORAGE_KEYS.DEBUG, []);
  }
  function saveDebugLogs(logs) {
    gmSet(STORAGE_KEYS.DEBUG, logs);
  }
  function clearDebugLogs() {
    gmSet(STORAGE_KEYS.DEBUG, []);
  }
  function initializeStorage() {
    const currentVer = gmGet(STORAGE_KEYS.VERSION);
    if (!currentVer) {
      gmSet(STORAGE_KEYS.VERSION, APP_VERSION);
    }
  }
  function getSanitizedState() {
    const settings = getSettings();
    const profile = getProfile();
    const hasKey = Boolean(getApiKey());
    return {
      version: APP_VERSION,
      hasApiKey: hasKey,
      settings,
      profileSummary: {
        hasFullName: Boolean(profile.fullName),
        hasEmail: Boolean(profile.email),
        hasResumeContext: Boolean(profile.resumeContext)
      },
      url: window.location.href,
      host: window.location.hostname,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function resetAll() {
    for (const id of gmGet(STORAGE_KEYS.SESSIONS, [])) gmDelete(`${STORAGE_KEYS.SESSIONS}:${id}`);
    gmDelete(STORAGE_KEYS.SESSIONS);
    gmDelete(STORAGE_KEYS.JOB);
    gmDelete(STORAGE_KEYS.MEMORY);
    gmDelete(STORAGE_KEYS.SETTINGS);
    gmDelete(STORAGE_KEYS.PROFILE);
    gmDelete(STORAGE_KEYS.SECRETS);
    gmDelete(STORAGE_KEYS.DEBUG);
    gmSet(STORAGE_KEYS.VERSION, APP_VERSION);
  }

  // src/debug.js
  var MAX_LOG_ENTRIES = 100;
  function sanitizeString(str) {
    if (typeof str !== "string") return str;
    let sanitized = str;
    const currentKey = getApiKey();
    if (currentKey && currentKey.length > 5) {
      sanitized = sanitized.replaceAll(currentKey, "[REDACTED_API_KEY]");
    }
    sanitized = sanitized.replace(/sk-or-v1-[a-zA-Z0-9]{20,}/g, "[REDACTED_OPENROUTER_KEY]");
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, "Bearer [REDACTED_TOKEN]");
    sanitized = sanitized.replace(/("Authorization"|Authorization):\s*"[^"]+"/gi, '$1: "[REDACTED]"');
    return sanitized;
  }
  function sanitizeMeta(meta) {
    if (!meta) return void 0;
    try {
      const stringified = JSON.stringify(meta);
      return JSON.parse(sanitizeString(stringified));
    } catch {
      return String(meta);
    }
  }
  var DebugLogger = class {
    constructor() {
      this.inMemoryLogs = [];
      this.loaded = false;
    }
    _load() {
      if (!this.loaded) {
        try {
          const stored = getDebugLogs();
          if (Array.isArray(stored)) {
            this.inMemoryLogs = stored;
          }
        } catch (err) {
          console.error("[JobCopilot:Logger] Error loading stored logs:", err);
        }
        this.loaded = true;
      }
    }
    _addEntry(level, message, meta) {
      this._load();
      const cleanMessage = sanitizeString(String(message));
      const cleanMeta = sanitizeMeta(meta);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        level: level.toUpperCase(),
        message: cleanMessage,
        meta: cleanMeta
      };
      this.inMemoryLogs.push(entry);
      if (this.inMemoryLogs.length > MAX_LOG_ENTRIES) {
        this.inMemoryLogs = this.inMemoryLogs.slice(-MAX_LOG_ENTRIES);
      }
      try {
        saveDebugLogs(this.inMemoryLogs);
      } catch (err) {
        console.error("[JobCopilot:Logger] Error saving logs:", err);
      }
      const consoleMsg = `[JobCopilot:${entry.level}] ${entry.message}`;
      if (level === "error") {
        console.error(consoleMsg, cleanMeta || "");
      } else if (level === "warn") {
        console.warn(consoleMsg, cleanMeta || "");
      } else {
        console.log(consoleMsg, cleanMeta || "");
      }
      return entry;
    }
    info(message, meta) {
      return this._addEntry("info", message, meta);
    }
    warn(message, meta) {
      return this._addEntry("warn", message, meta);
    }
    error(message, meta) {
      return this._addEntry("error", message, meta);
    }
    debug(message, meta) {
      return this._addEntry("debug", message, meta);
    }
    getLogs() {
      this._load();
      return [...this.inMemoryLogs];
    }
    clear() {
      this.inMemoryLogs = [];
      clearDebugLogs();
      this.info("Debug logs cleared.");
    }
  };
  var logger = new DebugLogger();

  // src/fields/combobox.js
  var COMBO = '[role="combobox"], button[aria-haspopup="listbox"]';
  var MENU = '[role="listbox"], .select__menu, [class*="menu-list"]';
  var OPTION = '[role="option"], .select__option';
  var VALUE = '.select__single-value, [class*="singleValue"], [class*="single-value"], .select__multi-value__label, [class*="multiValueLabel"], [class*="multi-value__label"]';
  var countryLabelsByInput = /* @__PURE__ */ new WeakMap();
  function countryDisplayKey(node) {
    const flag = node.querySelector(".iti__flag");
    const countryClass = flag && Array.from(flag.classList).find((name) => /^iti__[a-z]{2}$/.test(name));
    const dialCode = node.textContent.trim().match(/\+\d[\d -]*$/)?.[0];
    return countryClass && dialCode ? `${countryClass}:${dialCode.replace(/\s/g, "")}` : null;
  }
  var optionKey = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function resolveComboboxParts(element) {
    let container = element;
    for (let parent = element.parentElement; parent && !parent.matches("body, html, form, main"); parent = parent.parentElement) {
      const others = Array.from(parent.querySelectorAll(`${COMBO}, input:not([type="hidden"]), textarea`)).filter((node) => node !== element && !element.contains(node) && !node.contains(element));
      if (others.length) break;
      container = parent;
      if (parent.matches('.field, .form-group, [class*="select-shell"], .select__container')) break;
    }
    const input = element.matches("input") ? element : container.querySelector('input:not([type="hidden"])');
    const controlBox = container.querySelector('.select__control, [class*="-control"], [class*="combobox-input"]') || element;
    const toggleBtn = container.querySelector('button[aria-label*="toggle" i], button[aria-label*="open" i], [class*="dropdown-indicator"], [class*="indicatorContainer"], [class*="dropdown-arrow"]');
    return { container, input, controlBox, toggleBtn };
  }
  function getComboboxMenus(element) {
    const { container, input } = resolveComboboxParts(element);
    const ids = new Set([element, input].filter(Boolean).flatMap((node) => `${node.getAttribute("aria-controls") || ""} ${node.getAttribute("aria-owns") || ""}`.trim().split(/\s+/).filter(Boolean)));
    const root = element.getRootNode();
    if (ids.size) return [...ids].map((id) => root.getElementById?.(id) || element.ownerDocument.getElementById(id)).filter(Boolean);
    return Array.from(container.querySelectorAll(MENU));
  }
  function discoverComboboxOptions(element) {
    const options = [...new Set(getComboboxMenus(element).flatMap((menu) => {
      if (menu.hidden || menu.getAttribute("aria-hidden") === "true" || menu.style.display === "none") return [];
      return Array.from(menu.querySelectorAll(OPTION)).filter((option) => option.textContent?.trim() && !option.hidden && option.style.display !== "none" && option.ownerDocument.defaultView.getComputedStyle(option).visibility !== "hidden" && !option.hasAttribute("disabled") && option.getAttribute("aria-disabled") !== "true");
    }))];
    const input = resolveComboboxParts(element).input || element;
    const labels = countryLabelsByInput.get(input) || /* @__PURE__ */ new Map();
    for (const option of options) {
      const key2 = countryDisplayKey(option);
      if (key2) labels.set(key2, option.textContent.trim());
    }
    countryLabelsByInput.set(input, labels);
    return options;
  }
  function optionData(option) {
    const label = option.textContent.trim();
    return { value: option.getAttribute("data-value") || option.getAttribute("value") || label, label };
  }
  function findExactOption(options, target) {
    const key2 = optionKey(target);
    if (!key2) return null;
    const matches = options.filter((option) => optionKey(option.label) === key2 || optionKey(option.value) === key2);
    return matches.length === 1 ? matches[0] : null;
  }
  function readComboboxSelection(element) {
    const { container, input } = resolveComboboxParts(element);
    const labels = countryLabelsByInput.get(input || element);
    const values = Array.from(container.querySelectorAll(VALUE)).map((node) => labels?.get(countryDisplayKey(node)) || node.textContent.trim()).filter(Boolean);
    if (values.length) return values;
    const ariaValue = element.getAttribute("aria-valuetext");
    if (ariaValue?.trim()) return [ariaValue.trim()];
    const backingSelect = container.querySelector("select");
    if (backingSelect) return Array.from(backingSelect.selectedOptions).filter((option) => option.value).map((option) => option.text.trim() || option.value);
    if (element.matches('button[aria-haspopup="listbox"],button[role="combobox"]')) {
      const label = element.textContent.trim();
      if (label && !/^(?:select(?: one| an? option)?|choose(?: one| an? option)?|--.*--)\s*$/i.test(label)) return [label];
    }
    return discoverComboboxOptions(element).filter((option) => option.getAttribute("aria-selected") === "true").map((option) => optionData(option).label);
  }
  function setComboboxSearch(input, value) {
    if (!input || input.value === value) return;
    const setter = Object.getOwnPropertyDescriptor(input.ownerDocument.defaultView.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: value ? value.slice(-1) : "Backspace", bubbles: true, composed: true }));
  }
  function closeCombobox(element) {
    const { input } = resolveComboboxParts(element);
    const target = input || element;
    target.blur?.();
  }
  function clickFieldControl(element) {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, button: 0 });
    if (element.closest("button")?.type === "submit" || element.closest("a[href]")) event.preventDefault();
    element.dispatchEvent(event);
  }
  async function openCombobox(element) {
    if (element.getAttribute("aria-expanded") === "true" && getComboboxMenus(element).length) return;
    const active = element.ownerDocument.activeElement;
    if (active && active !== element && active !== element.ownerDocument.body) {
      active.blur?.();
    }
    const { input, controlBox, toggleBtn } = resolveComboboxParts(element);
    const target = input || controlBox;
    target.focus?.();
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    clickFieldControl(target);
    await delay(80);
    if (!getComboboxMenus(element).length && toggleBtn) clickFieldControl(toggleBtn);
  }
  async function waitForComboboxOptions(element, timeoutMs = 3e3) {
    const deadline = Date.now() + timeoutMs;
    await delay(150);
    do {
      const menus = getComboboxMenus(element);
      const loading = menus.some((menu) => menu.getAttribute("aria-busy") === "true" || /\bloading\b/i.test(menu.textContent));
      const options = discoverComboboxOptions(element);
      if (!loading && options.length) return options;
      await delay(100);
    } while (Date.now() < deadline);
    return [];
  }

  // src/ai.js
  var OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  var AUTOFILL_TIMEOUT_MS = 12e4;
  var OPTION_FIELD_TYPES = /* @__PURE__ */ new Set(["select", "combobox", "radio", "checkbox"]);
  var NARRATIVE_VOICE_RULES = `NARRATIVE VOICE (all free-text and open-ended answers):
Write like a real candidate filling a form: first-person, specific, and natural. Professional enough for a hiring manager, never brochure or chatbot copy. Vary sentence length. Every sentence must add a fact, not emphasis.

Hard bans:
- Never use em dashes (\u2014), en dashes (\u2013), or spaced double hyphens as dashes. Use a period, comma, colon, or parentheses.
- Do not use not-X-but-Y contrasts ("It's not just X, it's Y"). State the point.
- No staged openers or closers ("Here's the thing", "At its core", "That's what I bring").
- No inflated or sales wording (pivotal, crucial, testament, landscape, delve, underscore, showcase, robust, meticulous, vibrant, groundbreaking, foster, leverage, boasts, serves as, stands as). Prefer is/have and concrete verbs.
- Do not pad ideas into forced groups of three.
- No bold, emoji, or chatbot wrappers.`;
  function stripModelDashes(text) {
    if (typeof text !== "string" || !text) return text;
    return text.replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+--\s+/g, ", ");
  }
  function sendGMRequest(options) {
    const timeoutError = () => new Error(`OpenRouter request timed out after ${options.timeout / 1e3}s. Try again or choose a faster model.`);
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest({
          ...options,
          onload: (response) => resolve(response),
          onerror: (err) => reject(err),
          ontimeout: () => reject(timeoutError())
        });
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(timeoutError()), options.timeout);
        fetch(options.url, {
          method: options.method,
          headers: options.headers,
          body: options.data,
          signal: controller.signal
        }).then(async (res) => {
          const text = await res.text();
          resolve({
            status: res.status,
            responseText: text,
            responseHeaders: ""
          });
        }).catch(reject).finally(() => clearTimeout(timer));
      }
    });
  }
  function cleanJsonFence(text) {
    if (!text) return "";
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    }
    return cleaned;
  }
  async function testConnection() {
    const apiKey = getApiKey();
    const settings = getSettings();
    const model = settings.model || "google/gemini-2.0-flash";
    if (!apiKey) {
      logger.warn("Test AI invoked without an API key configured.");
      return {
        ok: false,
        model,
        latencyMs: 0,
        error: "No OpenRouter API key found. Please add your key in Settings.",
        status: "NO_KEY"
      };
    }
    const startTime = Date.now();
    try {
      logger.info(`Testing OpenRouter connection using model: ${model}`);
      const payload = JSON.stringify({
        model,
        messages: [
          { role: "user", content: "Ping test. Respond with the single word 'OK'." }
        ],
        max_tokens: 10
      });
      const response = await sendGMRequest({
        method: "POST",
        url: OPENROUTER_ENDPOINT,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/Amro212/autofill-extension",
          "X-Title": "Job Copilot Tampermonkey"
        },
        data: payload,
        timeout: 15e3
      });
      const latencyMs = Date.now() - startTime;
      const statusCode = response.status;
      if (statusCode === 200) {
        let reply = "OK";
        try {
          const data = JSON.parse(response.responseText);
          reply = data.choices?.[0]?.message?.content?.trim() || "OK";
        } catch {
        }
        logger.info(`OpenRouter connection test succeeded in ${latencyMs}ms. Response: "${reply}"`);
        return {
          ok: true,
          model,
          latencyMs,
          reply,
          status: 200
        };
      }
      let errorDetail = `HTTP ${statusCode}`;
      try {
        const errorJson = JSON.parse(response.responseText);
        if (errorJson.error && errorJson.error.message) {
          errorDetail = errorJson.error.message;
        }
      } catch {
        if (response.responseText) {
          errorDetail = response.responseText.slice(0, 150);
        }
      }
      if (statusCode === 401) {
        errorDetail = "Invalid API key or unauthorized (401). Please check your key in Settings.";
      } else if (statusCode === 402) {
        errorDetail = "Insufficient OpenRouter credits / balance (402).";
      } else if (statusCode === 429) {
        errorDetail = "Rate limit exceeded (429). Please try again shortly.";
      }
      logger.error(`OpenRouter connection test failed with status ${statusCode}: ${errorDetail}`);
      return {
        ok: false,
        model,
        latencyMs,
        error: errorDetail,
        status: statusCode
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err?.message || "Network error or connection timeout";
      logger.error(`OpenRouter request encountered network exception: ${errorMsg}`);
      return {
        ok: false,
        model,
        latencyMs,
        error: `Network Error: ${errorMsg}`,
        status: "NETWORK_ERROR"
      };
    }
  }
  async function generateAutofillAnswers(normalizedFields, { allowSearch = true, jobContext = null, repairErrors = [] } = {}) {
    const apiKey = getApiKey();
    const settings = getSettings();
    const profile = getProfile();
    const model = settings.model || "google/gemini-2.0-flash";
    if (!apiKey) {
      throw new Error("No OpenRouter API key configured. Please set your key in Settings.");
    }
    const systemPrompt = `You are Job Copilot, filling an online job application for a candidate.

CRITICAL OPERATING RULES:
1. Ground all candidate claims strictly in the provided applicant profile, resume highlights, and applicant notes.
2. NEVER fabricate or invent unlisted jobs, employers, dates, metrics, degrees, tools, or certifications (Rule 11).
3. For structured questions (radio, select, checkbox, short text) where candidate preferences or standard defaults apply:
   - Explicit structured applicantProfile answers have priority over conflicting resume context, applicant notes, previous answers, and generic defaults. Preserve explicit No answers.
   - Work authorization and sponsorshipNow/sponsorshipFuture apply ONLY to applicantProfile.workCountry. Match the question's country, or the confirmed job work country when implicit. Do not transfer eligibility across countries or infer it from residence, nationality, or a phone number. Unknown country or unsupported eligibility: return an empty string. When structured eligibility is unset, only use unambiguous, country-specific facts from applicant context; never guess Yes or No.
   - For sponsorship "now OR in the future", answer Yes if either scoped answer is Yes; answer No only when BOTH scoped answers are No. Otherwise leave empty. Distinguish current from future sponsorship.
   - Years of experience dropdowns: infer the candidate's level (e.g. Senior, Mid, 5+ years) from their resume context and select the best matching option. Set "inferred": true.
   - Demographic surveys / EEOD / gender / pronouns / race or ethnicity / disability / veteran status: use ONLY the corresponding explicit structured profile answer. Not set means return an empty string, never a guessed identity or guessed No. Prefer not to answer means choose an actual decline option; if absent leave empty. Match meaning precisely: general veteran status does not establish protected veteran status, race does not establish Hispanic ethnicity, and gender does not establish sex assigned at birth. Use genderDescription only when gender is Self-describe. Do not mention demographics in unrelated narrative answers.
   - "How did you hear about us?" and equivalent job discovery/source questions: always LinkedIn. For option fields choose only an offered LinkedIn option; if unavailable return empty (combobox may search LinkedIn). Do not invent a referrer or replace a LinkedIn profile URL with this source answer.
   - Compensation must preserve expectedSalary, salaryCurrency and salaryPeriod together. Do not silently convert currency or annual/hourly pay. Total yearsExperience is not years with a particular tool. A preferred work arrangement does not imply willingness to accept all other arrangements. Past start dates require review, not a made-up new date.
   - Consent / Privacy / Background check agreement checkboxes: set value to true.
   - General, custom, or simulation text fields: provide a concise, relevant response based on the candidate's software background or profile. Follow NARRATIVE VOICE.
4. For narrative / open-ended questions (e.g. "Why do you want to work here?", "Describe your experience with X"):
   - Write a natural first-person answer using real facts from the resume context. Follow NARRATIVE VOICE.
   - Respect character limits if specified.
${NARRATIVE_VOICE_RULES}
5. For "select", "combobox", "radio", or "checkbox" fields:
   - Your "value" MUST be chosen strictly from the provided "options" list (matching either the option value or option label). Never leave a select on a placeholder like "-- Please Select --" or "Select...".
   - Options belong ONLY to their own fieldId. Never reuse a choice from another field.
   - For comboboxes, return the exact option label. If no options were discovered, or the candidate context does not support any available option, return an empty string. Never invent a label or choose the first/closest option just to fill the field.
   - Match the specific question against applicant context (phone dialing country, work location, nationality, degree and discipline are separate questions).
   - ${allowSearch ? `Some comboboxes load only the first page of options. If the candidate's known answer is missing, leave value empty and include an optional "searchQuery" with a short search term grounded in the applicant context (e.g. the actual university name). A search query is NOT a selection. Omit it when the answer is unknown.` : "These options are final search results. Do not request another search; leave value empty if there is no supported choice."}
6. Return an answer object for EVERY field provided in "fieldsToFill".
7. Respond ONLY with a valid JSON object in this exact schema, without markdown code blocks:
{
  "answers": [
    {
      "fieldId": "string (must match fieldId from input)",
      "value": "string or boolean",
      "inferred": boolean${allowSearch ? ',\n      "searchQuery": "optional; only for an empty value requiring option discovery"' : ""}
    }
  ]
}`;
    const userContent = JSON.stringify({
      applicantProfile: profileForAI(profile),
      resumeContext: profile.resumeContext,
      applicantNotes: profile.applicantNotes,
      pageContext: {
        url: window.location.href,
        host: window.location.hostname
      },
      jobContext,
      repairErrors,
      fieldsToFill: normalizedFields
    });
    logger.info(`Sending unified autofill AI request for ${normalizedFields.length} fields using ${model}`);
    const startTime = Date.now();
    const payload = JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });
    logger.info(`AI request: ${payload.length} characters, timeout ${AUTOFILL_TIMEOUT_MS / 1e3}s`);
    const response = await sendGMRequest({
      method: "POST",
      url: OPENROUTER_ENDPOINT,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/Amro212/autofill-extension",
        "X-Title": "Job Copilot Tampermonkey"
      },
      data: payload,
      timeout: AUTOFILL_TIMEOUT_MS
    }).catch((err) => {
      logger.warn(`AI request failed after ${Date.now() - startTime}ms using ${model}: ${err.message}`);
      throw err;
    });
    const latencyMs = Date.now() - startTime;
    if (response.status !== 200) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(response.responseText);
        if (errJson.error?.message) errorDetail = errJson.error.message;
      } catch {
      }
      throw new Error(`OpenRouter Error (${response.status}): ${errorDetail}`);
    }
    let rawContent = "";
    try {
      const data = JSON.parse(response.responseText);
      rawContent = data.choices?.[0]?.message?.content || "";
    } catch (err) {
      throw new Error(`Failed to parse OpenRouter response: ${err.message}`);
    }
    const cleaned = cleanJsonFence(rawContent);
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.error("Failed to parse AI answers JSON:", cleaned);
      throw new Error(`AI returned invalid JSON: ${err.message}`);
    }
    if (!parsed || !Array.isArray(parsed.answers)) {
      throw new Error('AI response missing "answers" array');
    }
    const fieldsById = new Map(normalizedFields.map((f) => [f.fieldId, f]));
    const seenIds = /* @__PURE__ */ new Set();
    const fixedAnswers = new Map(normalizedFields.map((field) => [field.fieldId, fixedProfileAnswer(field, profile, { allowSearch })]).filter(([, answer]) => answer));
    const candidateAnswers = [...parsed.answers.filter((ans) => !fixedAnswers.has(ans?.fieldId)), ...fixedAnswers.values()];
    const validatedAnswers = candidateAnswers.filter((ans) => {
      if (!ans || !fieldsById.has(ans.fieldId) || seenIds.has(ans.fieldId)) {
        logger.warn("AI returned an unknown or duplicate field ID (omitted)");
        return false;
      }
      seenIds.add(ans.fieldId);
      const field = fieldsById.get(ans.fieldId);
      if (!allowSearch || field.type !== "combobox" || ans.value !== "" || typeof ans.searchQuery !== "string" || !ans.searchQuery.trim() || ans.searchQuery.length > 200) {
        delete ans.searchQuery;
      } else {
        ans.searchQuery = ans.searchQuery.trim();
      }
      if (field.type === "combobox" && ans.value !== "") {
        const option = findExactOption(field.options || [], ans.value);
        if (!option) {
          logger.warn(`AI[${ans.fieldId}]: rejected answer outside ${field.options?.length || 0} owned options`);
          return false;
        }
        ans.value = option.label;
      }
      if (!OPTION_FIELD_TYPES.has(field.type) && typeof ans.value === "string") {
        ans.value = stripModelDashes(ans.value);
      }
      return true;
    });
    logger.info(`Received ${validatedAnswers.length} valid answers from AI in ${latencyMs}ms`);
    return {
      answers: validatedAnswers,
      latencyMs,
      model
    };
  }
  async function rewriteNarrativeField({ fieldLabel, currentValue, feedback, constraints }) {
    const apiKey = getApiKey();
    const settings = getSettings();
    const profile = getProfile();
    const model = settings.model || "google/gemini-2.0-flash";
    if (!apiKey) {
      throw new Error("No OpenRouter API key configured.");
    }
    const systemPrompt = `You are Job Copilot. You are rewriting a single narrative response in a job application for the candidate.
Rules:
1. Stay strictly faithful to the candidate's actual experience from their resume highlights.
2. Incorporate the candidate's specific feedback and revision instructions.
3. Follow NARRATIVE VOICE. First-person. Stay concise.
4. Output ONLY the rewritten answer text with no surrounding quotes or commentary.
5. Explicit structured profile answers take precedence over conflicting notes. Eligibility applies only to workCountry. Do not guess unknown eligibility or demographics, expose demographics in unrelated answers, or convert compensation units. Job discovery source is always LinkedIn.
${NARRATIVE_VOICE_RULES}`;
    const userPrompt = `Question Label: ${fieldLabel}
Current Answer:
${currentValue}

Explicit Applicant Profile:
${JSON.stringify(profileForAI(profile))}

Candidate Resume Highlights:
${profile.resumeContext}

Applicant Notes / Rules:
${profile.applicantNotes}

User Revision Instructions:
${feedback || "Make it clearer and more specific to this job."}
${constraints?.maxLength ? `Maximum Length: ${constraints.maxLength} characters` : ""}`;
    logger.info(`Sending narrative rewrite request for "${fieldLabel}" using ${model}`);
    const startTime = Date.now();
    const payload = JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4
    });
    const response = await sendGMRequest({
      method: "POST",
      url: OPENROUTER_ENDPOINT,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/Amro212/autofill-extension",
        "X-Title": "Job Copilot Tampermonkey"
      },
      data: payload,
      timeout: 25e3
    });
    const latencyMs = Date.now() - startTime;
    if (response.status !== 200) {
      throw new Error(`Rewrite request failed (HTTP ${response.status})`);
    }
    const data = JSON.parse(response.responseText);
    const rewrittenText = data.choices?.[0]?.message?.content?.trim() || "";
    logger.info(`Narrative rewritten in ${latencyMs}ms (${rewrittenText.length} chars)`);
    return stripModelDashes(rewrittenText);
  }

  // src/fields/labels.js
  function cleanText(text) {
    if (!text) return "";
    return text.replace(/[\n\r\t]+/g, " ").replace(/\s{2,}/g, " ").replace(/[*:]+$/, "").trim();
  }
  function nameToLabel(name) {
    if (!name) return "";
    return name.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }
  function extractLabel(element) {
    if (!element || !(element instanceof Element)) return "";
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      return cleanText(ariaLabel);
    }
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/);
      const textParts = ids.map((id) => document.getElementById(id)).filter((el) => el && el !== element && !element.contains(el)).map((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('input,textarea,select,button,[role="combobox"],[role="listbox"]').forEach((control) => control.remove());
        return clone.textContent || "";
      }).join(" ");
      if (textParts.trim()) {
        return cleanText(textParts);
      }
    }
    if (element.id) {
      try {
        const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (labelEl && labelEl.textContent) {
          return cleanText(labelEl.textContent);
        }
      } catch {
      }
    }
    const parentLabel = element.closest("label");
    if (parentLabel && parentLabel.textContent) {
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => input.remove());
      const text = cleanText(clone.textContent);
      if (text) return text;
    }
    const fieldset = element.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend && legend.textContent) {
        return cleanText(legend.textContent);
      }
    }
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      if (index > 0) {
        for (let i = index - 1; i >= 0; i--) {
          const sib = siblings[i];
          if (sib.matches("label, .label, .form-label, .field-label, h3, h4, h5, p, span, strong")) {
            const text = cleanText(sib.textContent);
            if (text && text.length < 150) return text;
          }
        }
      }
      const grandParent = parent.parentElement;
      if (grandParent) {
        const heading = grandParent.querySelector(".label, .form-label, .field-label, label, legend");
        if (heading && heading.textContent) {
          const text = cleanText(heading.textContent);
          if (text && text.length < 150) return text;
        }
      }
    }
    const placeholder = element.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      return cleanText(placeholder);
    }
    const name = element.getAttribute("name");
    if (name) return nameToLabel(name);
    if (element.id) return nameToLabel(element.id);
    return "Unknown Field";
  }
  function extractGroupLabel(elements = [], groupName = "") {
    if (!elements || elements.length === 0) return nameToLabel(groupName);
    const firstEl = elements[0];
    const fieldset = firstEl.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend && legend.textContent.trim()) {
        return cleanText(legend.textContent);
      }
    }
    const container = firstEl.closest('.form-group, .field, [role="radiogroup"], [role="group"], .question, div');
    if (container) {
      const ariaLabel = container.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.trim()) return cleanText(ariaLabel);
      const headings = Array.from(container.querySelectorAll("label, legend, .label, .form-label, .field-label, h3, h4, h5, p, strong, span"));
      for (const h of headings) {
        const containsRadio = elements.some((el) => h.contains(el));
        if (!containsRadio) {
          const text = cleanText(h.textContent);
          if (text && text.length > 2 && text.length < 250) {
            return text;
          }
        }
      }
      try {
        const clone = container.cloneNode(true);
        clone.querySelectorAll("input, .radio-group, .checkbox-group, .radio-item, .checkbox-item, ul, li").forEach((el) => el.remove());
        const remainingText = cleanText(clone.textContent);
        if (remainingText && remainingText.length > 3 && remainingText.length < 250) {
          return remainingText;
        }
      } catch {
      }
    }
    if (groupName) return nameToLabel(groupName);
    return extractLabel(firstEl);
  }
  function extractOptionLabel(element) {
    if (!element) return "";
    const parentLabel = element.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input").forEach((input) => input.remove());
      const text = cleanText(clone.textContent);
      if (text) return text;
    }
    if (element.id) {
      try {
        const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (labelEl && labelEl.textContent) {
          return cleanText(labelEl.textContent);
        }
      } catch {
      }
    }
    if (element.nextSibling && element.nextSibling.textContent) {
      const text = cleanText(element.nextSibling.textContent);
      if (text) return text;
    }
    if (element.value && element.value !== "on") {
      return cleanText(element.value);
    }
    return cleanText(element.id || "Option");
  }
  function extractDescription(element) {
    if (!element || !(element instanceof Element)) return "";
    const describedBy = element.getAttribute("aria-describedby");
    if (describedBy) {
      const ids = describedBy.split(/\s+/);
      const textParts = ids.map((id) => document.getElementById(id)).filter(Boolean).map((el) => el.textContent || "").join(" ");
      if (textParts.trim()) {
        return cleanText(textParts);
      }
    }
    const container = element.closest(".form-group, .field, .input-wrapper, fieldset, div");
    if (container) {
      const helpEl = container.querySelector(".help-text, .form-text, .description, .hint, small");
      if (helpEl && helpEl !== element && !helpEl.contains(element)) {
        return cleanText(helpEl.textContent);
      }
    }
    return "";
  }

  // src/fields/scanner.js
  var fieldCounter = 0;
  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) {
      if (el.tagName === "SELECT" || el.type === "radio" || el.type === "checkbox") {
        return true;
      }
      return false;
    }
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && (parseFloat(style.opacity) > 0 || el.getAttribute("role") === "combobox");
  }
  function isInsideCopilot(el) {
    return Boolean(el.closest(`#${UI_IDS.CONTAINER}`) || el.closest(`#${UI_IDS.INLINE_REWRITE}`));
  }
  function isRequired(el, labelText) {
    if (el.hasAttribute("required") || el.required) return true;
    if (el.getAttribute("aria-required") === "true") return true;
    if (el.getAttribute("data-required") === "true") return true;
    if (labelText && /\*\s*$/.test(labelText)) return true;
    return false;
  }
  function extractConstraints(el) {
    const constraints = {};
    if (el.maxLength > 0 && el.maxLength < 1e5) constraints.maxLength = el.maxLength;
    if (el.minLength > 0) constraints.minLength = el.minLength;
    if (el.pattern) constraints.pattern = el.pattern;
    if (el.min) constraints.min = el.min;
    if (el.max) constraints.max = el.max;
    return constraints;
  }
  function buildFieldSelector(el) {
    try {
      if (el.id) return `#${CSS.escape(el.id)}`;
      if (el.name) return `[name="${CSS.escape(el.name)}"]`;
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;
    } catch {
    }
    return "";
  }
  function extractComboboxOptionsAndValue(el) {
    const options = discoverComboboxOptions(el).map(optionData);
    const currentValue = readComboboxSelection(el).join(", ");
    logger.info(`Scan[${el.id || "(combobox)"}]: ${options.length} owned options, committed=${Boolean(currentValue)}`);
    return { options, currentValue };
  }
  function scanFormFields(root = document) {
    fieldCounter = 0;
    const detectedFields = [];
    const processedElements = /* @__PURE__ */ new Set();
    const processedRadioGroups = /* @__PURE__ */ new Set();
    const candidates = Array.from(root.querySelectorAll(`
    input,
    textarea,
    select,
    [contenteditable="true"],
    [role="combobox"],
    button[aria-haspopup="listbox"]
  `)).filter((el) => !isInsideCopilot(el) && !el.closest('header,nav,footer,[role="banner"],[role="navigation"],[role="contentinfo"],.g-recaptcha,.h-captcha,[data-captcha]') && !/^(g-recaptcha-response|h-captcha-response|cf-turnstile-response)(?:$|-)/i.test(el.name || el.id || ""));
    for (const el of candidates) {
      if (processedElements.has(el)) continue;
      const tagName = el.tagName.toLowerCase();
      const typeAttr = (el.getAttribute("type") || "").toLowerCase();
      const isCombobox = el.matches('[role="combobox"],button[aria-haspopup="listbox"]');
      if (typeAttr === "hidden" || typeAttr === "submit" || typeAttr === "button" && !isCombobox || typeAttr === "reset" || typeAttr === "image" || typeAttr === "password" || typeAttr === "file") {
        continue;
      }
      if (!isVisible(el) && !["select", "radio", "checkbox"].includes(typeAttr)) {
        continue;
      }
      if (typeAttr === "radio") {
        const groupName = el.getAttribute("name");
        if (groupName && processedRadioGroups.has(groupName)) {
          continue;
        }
        if (groupName) processedRadioGroups.add(groupName);
        const radioEls = groupName ? Array.from(root.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`)).filter((r) => !isInsideCopilot(r)) : [el];
        radioEls.forEach((r) => processedElements.add(r));
        const groupLabel = extractGroupLabel(radioEls, groupName);
        const description2 = extractDescription(el);
        const options = radioEls.map((r) => {
          const optionLabel = extractOptionLabel(r);
          return {
            value: r.value || optionLabel,
            label: optionLabel || r.value,
            checked: r.checked
          };
        });
        const checkedRadio = radioEls.find((r) => r.checked);
        const currentValue = checkedRadio ? checkedRadio.value || extractOptionLabel(checkedRadio) : "";
        detectedFields.push({
          id: el.name || el.id || `jc_field_${++fieldCounter}`,
          name: el.name || "",
          selector: buildFieldSelector(el),
          type: FIELD_TYPES2.RADIO,
          element: el,
          elements: radioEls,
          label: groupLabel,
          description: description2,
          required: radioEls.some((r) => isRequired(r, groupLabel)),
          currentValue,
          options,
          constraints: {},
          isNarrative: false
        });
        continue;
      }
      if (typeAttr === "checkbox") {
        processedElements.add(el);
        const label2 = extractOptionLabel(el) || extractLabel(el);
        const description2 = extractDescription(el);
        detectedFields.push({
          id: el.id || el.name || `jc_field_${++fieldCounter}`,
          name: el.name || "",
          selector: buildFieldSelector(el),
          type: FIELD_TYPES2.CHECKBOX,
          element: el,
          label: label2,
          description: description2,
          required: isRequired(el, label2),
          currentValue: el.checked ? "true" : "false",
          checked: el.checked,
          options: [
            { value: "true", label: "Yes / Checked" },
            { value: "false", label: "No / Unchecked" }
          ],
          constraints: {},
          isNarrative: false
        });
        continue;
      }
      if (tagName === "select") {
        processedElements.add(el);
        const label2 = extractLabel(el);
        const description2 = extractDescription(el);
        const options = Array.from(el.options).map((opt) => ({
          value: opt.value,
          label: opt.text.trim(),
          selected: opt.selected
        })).filter((opt) => opt.value || opt.label);
        const selectedOption = el.options[el.selectedIndex];
        const isPlaceholder = !selectedOption || selectedOption.value === "" || /--|select|choose/i.test(selectedOption.text);
        const currentValue = !isPlaceholder && selectedOption ? selectedOption.value || selectedOption.text.trim() : "";
        detectedFields.push({
          id: el.id || el.name || `jc_field_${++fieldCounter}`,
          name: el.name || "",
          selector: buildFieldSelector(el),
          type: FIELD_TYPES2.SELECT,
          element: el,
          label: label2,
          description: description2,
          required: isRequired(el, label2),
          currentValue,
          options,
          constraints: {},
          isNarrative: false
        });
        continue;
      }
      if (tagName === "textarea") {
        processedElements.add(el);
        const label2 = extractLabel(el);
        const description2 = extractDescription(el);
        detectedFields.push({
          id: el.id || el.name || `jc_field_${++fieldCounter}`,
          name: el.name || "",
          selector: buildFieldSelector(el),
          type: FIELD_TYPES2.TEXTAREA,
          element: el,
          label: label2,
          description: description2,
          required: isRequired(el, label2),
          currentValue: el.value || "",
          options: [],
          constraints: extractConstraints(el),
          isNarrative: true
        });
        continue;
      }
      if (el.getAttribute("contenteditable") === "true") {
        processedElements.add(el);
        const label2 = extractLabel(el);
        const description2 = extractDescription(el);
        detectedFields.push({
          id: el.id || `jc_field_${++fieldCounter}`,
          name: "",
          selector: buildFieldSelector(el),
          type: FIELD_TYPES2.CONTENTEDITABLE,
          element: el,
          label: label2,
          description: description2,
          required: isRequired(el, label2),
          currentValue: el.textContent || "",
          options: [],
          constraints: {},
          isNarrative: true
        });
        continue;
      }
      if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox") {
        processedElements.add(el);
        const label2 = extractLabel(el);
        const description2 = extractDescription(el);
        const { options, currentValue } = extractComboboxOptionsAndValue(el);
        detectedFields.push({
          id: el.id || el.getAttribute("name") || `jc_field_${++fieldCounter}`,
          name: el.getAttribute("name") || "",
          selector: buildFieldSelector(el),
          type: FIELD_TYPES2.COMBOBOX,
          element: el,
          label: label2,
          description: description2,
          required: isRequired(el, label2),
          currentValue,
          options,
          constraints: {},
          isNarrative: false
        });
        continue;
      }
      processedElements.add(el);
      const label = extractLabel(el);
      const description = extractDescription(el);
      let fieldType = FIELD_TYPES2.TEXT;
      if (typeAttr === "email") fieldType = FIELD_TYPES2.EMAIL;
      else if (typeAttr === "tel") fieldType = FIELD_TYPES2.TEL;
      else if (typeAttr === "url") fieldType = FIELD_TYPES2.URL;
      else if (typeAttr === "number") fieldType = FIELD_TYPES2.NUMBER;
      const isNarrative = label.length > 50 || /describe|explain|why|tell us about|cover letter/i.test(label);
      detectedFields.push({
        id: el.id || el.name || `jc_field_${++fieldCounter}`,
        name: el.name || "",
        selector: buildFieldSelector(el),
        type: fieldType,
        element: el,
        label,
        description,
        required: isRequired(el, label),
        currentValue: el.value || "",
        options: [],
        constraints: extractConstraints(el),
        isNarrative
      });
    }
    return detectedFields;
  }
  async function harvestComboboxOptions(fields, searchQueries = /* @__PURE__ */ new Map()) {
    for (const field of fields.filter((field2) => field2.type === FIELD_TYPES2.COMBOBOX)) {
      const element = field.element;
      if (!element) continue;
      const { input } = resolveComboboxParts(element);
      try {
        await openCombobox(element);
        setComboboxSearch(input, searchQueries.get(field.id) || "");
        field.options = (await waitForComboboxOptions(element)).map(optionData);
        logger.info(`Harvest[${field.id}]: ${field.options.length} owned options`);
      } catch (err) {
        field.options = [];
        logger.warn(`Harvest[${field.id}]: ${err.message}`);
      } finally {
        setComboboxSearch(input, "");
        closeCombobox(element);
      }
    }
    return fields;
  }

  // src/fields/normalize.js
  function normalizeFieldsForAI(detectedFields, options = {}) {
    const { overwriteExisting = false } = options;
    return detectedFields.map((field) => {
      const isFilled = Boolean(
        field.currentValue && field.currentValue !== "false" && field.currentValue !== "0" && String(field.currentValue).trim().length > 0
      );
      const normalized = {
        fieldId: field.id,
        type: field.type,
        label: field.label,
        required: Boolean(field.required),
        currentValue: field.currentValue || "",
        isAlreadyFilled: isFilled
      };
      if (field.description) {
        normalized.description = field.description;
      }
      if (field.options && field.options.length > 0) {
        normalized.options = field.options.map((opt) => ({
          value: opt.value,
          label: opt.label
        }));
      }
      if (field.constraints && Object.keys(field.constraints).length > 0) {
        normalized.constraints = field.constraints;
      }
      return normalized;
    });
  }

  // src/autofill.js
  async function resolveComboboxSearchAnswers(fields, response) {
    const queries = new Map(response.answers.filter((answer) => answer.value === "" && typeof answer.searchQuery === "string" && answer.searchQuery.trim()).map((answer) => [answer.fieldId, answer.searchQuery]));
    const searchFields = fields.filter((field) => field.type === "combobox" && queries.has(field.id));
    if (!searchFields.length) return response;
    await harvestComboboxOptions(searchFields, queries);
    const discovered = searchFields.filter((field) => field.options.length);
    if (!discovered.length) return response;
    try {
      const resolved = await generateAutofillAnswers(normalizeFieldsForAI(discovered), { allowSearch: false });
      const byId = new Map(resolved.answers.map((answer) => [answer.fieldId, answer]));
      return { ...response, answers: response.answers.map((answer) => byId.get(answer.fieldId) || answer) };
    } catch (err) {
      logger.warn(`Combobox search resolution failed: ${err.message}`);
      return response;
    }
  }

  // src/fields/fillers.js
  function setNativeInputValue(element, value) {
    try {
      const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
      const prototype = Object.getPrototypeOf(element);
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
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
      } catch {
      }
    }
  }
  function setNativeChecked(element, checked) {
    try {
      const checkedSetter = Object.getOwnPropertyDescriptor(element, "checked")?.set;
      const prototype = Object.getPrototypeOf(element);
      const prototypeCheckedSetter = Object.getOwnPropertyDescriptor(prototype, "checked")?.set;
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
      } catch {
      }
    }
  }
  function dispatchEventSequence(element, eventTypes = ["input", "change"]) {
    try {
      element.dispatchEvent(new Event("focus", { bubbles: true }));
    } catch {
    }
    for (const type of eventTypes) {
      try {
        const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
        element.dispatchEvent(event);
      } catch {
      }
    }
    try {
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch {
    }
  }
  function fillTextInput(element, value) {
    if (!element) return false;
    const strVal = value !== null && value !== void 0 ? String(value) : "";
    try {
      element.focus();
    } catch {
    }
    setNativeInputValue(element, strVal);
    dispatchEventSequence(element, ["input", "change"]);
    return true;
  }
  function fillTextarea(element, value) {
    if (!element) return false;
    const strVal = value !== null && value !== void 0 ? String(value) : "";
    try {
      element.focus();
    } catch {
    }
    setNativeInputValue(element, strVal);
    dispatchEventSequence(element, ["input", "change"]);
    return true;
  }
  function fillSelect(element, targetValue) {
    if (!element || !(element instanceof HTMLSelectElement)) return false;
    const targetStr = String(targetValue).trim().toLowerCase();
    if (!targetStr) return false;
    const validOptions = Array.from(element.options).filter((opt) => {
      const isPlaceholder = opt.value === "" || /--|select|choose/i.test(opt.text);
      return !isPlaceholder;
    });
    let matchedOption = null;
    for (const opt of validOptions) {
      if (opt.value.trim().toLowerCase() === targetStr) {
        matchedOption = opt;
        break;
      }
    }
    if (!matchedOption) {
      for (const opt of validOptions) {
        if (opt.text.trim().toLowerCase() === targetStr) {
          matchedOption = opt;
          break;
        }
      }
    }
    if (!matchedOption) {
      for (const opt of validOptions) {
        const optText = opt.text.trim().toLowerCase();
        if (optText.startsWith(targetStr) || targetStr.startsWith(optText)) {
          matchedOption = opt;
          break;
        }
      }
    }
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
      } catch {
      }
      matchedOption.selected = true;
      element.selectedIndex = matchedOption.index;
      setNativeInputValue(element, matchedOption.value);
      dispatchEventSequence(element, ["input", "change"]);
      return true;
    }
    return false;
  }
  function fillRadioGroup(elements, targetValue) {
    if (!Array.isArray(elements) || elements.length === 0) return false;
    const targetStr = String(targetValue).trim().toLowerCase();
    if (!targetStr) return false;
    let matchedRadio = null;
    for (const r of elements) {
      if (r.value.trim().toLowerCase() === targetStr) {
        matchedRadio = r;
        break;
      }
    }
    if (!matchedRadio) {
      for (const r of elements) {
        const optLabel = extractOptionLabel(r).toLowerCase();
        if (optLabel === targetStr) {
          matchedRadio = r;
          break;
        }
      }
    }
    if (!matchedRadio) {
      const isYes = ["yes", "true", "1", "authorized", "eligible", "agree"].includes(targetStr);
      const isNo = ["no", "false", "0", "declined", "disagree", "not"].includes(targetStr);
      for (const r of elements) {
        const optVal = r.value.trim().toLowerCase();
        const optLabel = extractOptionLabel(r).toLowerCase();
        if (isYes) {
          if (optVal === "yes" || optVal === "true" || optVal === "1" || optLabel.startsWith("yes") || optLabel.startsWith("true") || optLabel.startsWith("i am authorized")) {
            matchedRadio = r;
            break;
          }
        } else if (isNo) {
          if (optVal === "no" || optVal === "false" || optVal === "0" || optLabel.startsWith("no") || optLabel.startsWith("false") || optLabel.startsWith("i am not")) {
            matchedRadio = r;
            break;
          }
        }
      }
    }
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
      } catch {
      }
      setNativeChecked(matchedRadio, true);
      dispatchEventSequence(matchedRadio, ["click", "input", "change"]);
      return true;
    }
    return false;
  }
  function fillCheckbox(element, targetValue) {
    if (!element) return false;
    const targetStr = String(targetValue).trim().toLowerCase();
    const shouldBeChecked = targetValue === true || ["true", "yes", "1", "checked", "agree"].includes(targetStr);
    try {
      element.focus();
    } catch {
    }
    setNativeChecked(element, shouldBeChecked);
    dispatchEventSequence(element, ["click", "input", "change"]);
    return true;
  }
  async function fillCombobox(element, targetValue, knownOptions) {
    if (!element || !optionKey(targetValue)) return false;
    const known = knownOptions ? findExactOption(knownOptions, targetValue) : null;
    if (knownOptions && !known) {
      logger.warn(`Fill[${element.id}]: rejected answer outside this field's options`);
      return false;
    }
    const target = known?.label || String(targetValue);
    const { input } = resolveComboboxParts(element);
    try {
      if (readComboboxSelection(element).some((value) => optionKey(value) === optionKey(target))) return true;
      await openCombobox(element);
      setComboboxSearch(input, "");
      let options = await waitForComboboxOptions(element);
      let match = findExactOption(options.map((option) => ({ ...optionData(option), element: option })), target);
      if (!match && known && input) {
        setComboboxSearch(input, known.label);
        options = await waitForComboboxOptions(element);
        match = findExactOption(options.map((option) => ({ ...optionData(option), element: option })), target);
      }
      if (!match) {
        logger.warn(`Fill[${element.id}]: no exact owned option for "${target}"`);
        return false;
      }
      logger.info(`Fill[${element.id}]: selecting exact option "${match.label}"`);
      match.element.scrollIntoView?.({ block: "nearest" });
      match.element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      match.element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      clickFieldControl(match.element);
      for (let attempt = 0; attempt < 10; attempt++) {
        if (readComboboxSelection(element).some((value) => optionKey(value) === optionKey(target))) return true;
        await delay(100);
      }
      return false;
    } catch (err) {
      logger.warn(`Fill[${element.id}]: ${err.message}`);
      return false;
    } finally {
      setComboboxSearch(input, "");
      closeCombobox(element);
    }
  }
  function fillContentEditable(element, value) {
    if (!element) return false;
    const strVal = value !== null && value !== void 0 ? String(value) : "";
    try {
      element.focus();
    } catch {
    }
    element.textContent = strVal;
    dispatchEventSequence(element, ["input", "change"]);
    return true;
  }
  async function fillField(field, targetValue) {
    if (!field || !field.element) return false;
    logger.info(`Field action: id=${field.id || "(none)"}, type=${field.type}, tag=${field.element.tagName}, path=${window.location.pathname}`);
    switch (field.type) {
      case FIELD_TYPES2.TEXTAREA:
        return fillTextarea(field.element, targetValue);
      case FIELD_TYPES2.SELECT:
        return fillSelect(field.element, targetValue);
      case FIELD_TYPES2.RADIO:
        return fillRadioGroup(field.elements || [field.element], targetValue);
      case FIELD_TYPES2.CHECKBOX:
        return fillCheckbox(field.element, targetValue);
      case FIELD_TYPES2.COMBOBOX:
        return await fillCombobox(field.element, targetValue, field.options || []);
      case FIELD_TYPES2.CONTENTEDITABLE:
        return fillContentEditable(field.element, targetValue);
      case FIELD_TYPES2.TEXT:
      case FIELD_TYPES2.EMAIL:
      case FIELD_TYPES2.TEL:
      case FIELD_TYPES2.URL:
      case FIELD_TYPES2.NUMBER:
      default:
        return fillTextInput(field.element, targetValue);
    }
  }

  // src/fields/verify.js
  async function verifyField(field, expectedValue) {
    if (!field || !field.element) {
      return { verified: false, actualValue: "", error: "Element missing" };
    }
    if (field.element.getAttribute("data-reject-fill") === "true") {
      return {
        verified: false,
        actualValue: field.element.value || "",
        error: "Form field rejected programmatic input (Gate 4)"
      };
    }
    const expectedStr = String(expectedValue || "").trim().toLowerCase();
    switch (field.type) {
      case FIELD_TYPES2.RADIO: {
        const radios = field.elements || [field.element];
        const checkedRadio = radios.find((r) => r.checked);
        if (!checkedRadio) {
          return { verified: false, actualValue: "", error: "No option selected" };
        }
        const actualVal = checkedRadio.value || checkedRadio.closest("label")?.textContent?.trim() || "";
        return { verified: true, actualValue: actualVal };
      }
      case FIELD_TYPES2.CHECKBOX: {
        const isChecked = field.element.checked;
        const expectedChecked = expectedValue === true || ["true", "yes", "1", "checked"].includes(expectedStr);
        const matches = isChecked === expectedChecked;
        return {
          verified: matches,
          actualValue: String(isChecked),
          error: matches ? void 0 : `Expected checked=${expectedChecked}, found ${isChecked}`
        };
      }
      case FIELD_TYPES2.SELECT: {
        const select = field.element;
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption) {
          return { verified: false, actualValue: "", error: "No option selected" };
        }
        const isPlaceholder = selectedOption.value === "" || /--|select|choose/i.test(selectedOption.text);
        const actualVal = selectedOption.value || selectedOption.text.trim();
        if (isPlaceholder) {
          return {
            verified: false,
            actualValue: selectedOption.text.trim(),
            error: "Dropdown remained on placeholder"
          };
        }
        return {
          verified: true,
          actualValue: actualVal
        };
      }
      case FIELD_TYPES2.CONTENTEDITABLE: {
        const actualVal = (field.element.textContent || "").trim();
        const verified = actualVal.length > 0;
        return {
          verified,
          actualValue: actualVal,
          error: verified ? void 0 : "Contenteditable text remained empty"
        };
      }
      case FIELD_TYPES2.COMBOBOX: {
        return await verifyCombobox(field.element, expectedValue);
      }
      case FIELD_TYPES2.TEXT:
      case FIELD_TYPES2.TEXTAREA:
      case FIELD_TYPES2.EMAIL:
      case FIELD_TYPES2.TEL:
      case FIELD_TYPES2.URL:
      case FIELD_TYPES2.NUMBER:
      default: {
        const actualVal = (field.element.value || field.element.textContent || "").trim();
        if (!expectedStr) {
          return { verified: true, actualValue: actualVal };
        }
        const verified = actualVal.length > 0;
        return {
          verified,
          actualValue: actualVal,
          error: verified ? void 0 : "Value did not persist in DOM"
        };
      }
    }
  }
  async function verifyCombobox(element, expectedValue) {
    if (!element) {
      return { verified: false, actualValue: "", error: "Element missing" };
    }
    const result = _checkComboboxState(element, expectedValue);
    if (result.verified) return result;
    await new Promise((r) => setTimeout(r, 120));
    return _checkComboboxState(element, expectedValue);
  }
  function _checkComboboxState(element, expectedValue) {
    const values = readComboboxSelection(element);
    const expected = optionKey(expectedValue);
    const verified = values.some((value) => optionKey(value) === expected);
    return {
      verified,
      actualValue: values.join(", "),
      error: verified ? void 0 : values.length ? `Selected option "${values.join(", ")}" does not match expected "${expectedValue}"` : "Combobox has no committed selection"
    };
  }

  // src/fields/highlight.js
  var inlineRewriteEl = null;
  var currentFocusedNarrativeField = null;
  function scrollToField(element) {
    try {
      if (!element || !element.isConnected) return;
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    } catch {
      try {
        element?.scrollIntoView?.(true);
      } catch {
      }
    }
  }
  function highlightActiveField(element) {
    try {
      if (!element || !element.isConnected) return;
      element.style.transition = "box-shadow 0.2s ease, outline 0.2s ease";
      element.style.outline = "2px solid #38bdf8";
      element.style.outlineOffset = "2px";
    } catch {
    }
  }
  function highlightVerifiedField(element) {
    try {
      if (!element || !element.isConnected) return;
      element.style.outline = "2px solid #10b981";
      element.style.outlineOffset = "2px";
      setTimeout(() => {
        try {
          if (element && element.isConnected) {
            element.style.outline = "";
            element.style.outlineOffset = "";
          }
        } catch {
        }
      }, 2e3);
    } catch {
    }
  }
  function highlightFailedField(element) {
    try {
      if (!element || !element.isConnected) return;
      element.style.outline = "2px solid #ef4444";
      element.style.outlineOffset = "2px";
    } catch {
    }
  }
  function initInlineRewriteBadge(onRewriteClick) {
    if (document.getElementById(UI_IDS.INLINE_REWRITE)) {
      return;
    }
    inlineRewriteEl = document.createElement("div");
    inlineRewriteEl.id = UI_IDS.INLINE_REWRITE;
    inlineRewriteEl.innerHTML = "\u2728 Rewrite with AI";
    inlineRewriteEl.style.cssText = `
    position: absolute;
    display: none;
    z-index: 2147483645;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    user-select: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
    opacity: 0;
    transform: translateY(4px);
  `;
    inlineRewriteEl.addEventListener("mouseenter", () => {
      inlineRewriteEl.style.transform = "translateY(0) scale(1.05)";
    });
    inlineRewriteEl.addEventListener("mouseleave", () => {
      inlineRewriteEl.style.transform = "translateY(0) scale(1)";
    });
    inlineRewriteEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentFocusedNarrativeField && typeof onRewriteClick === "function") {
        onRewriteClick(currentFocusedNarrativeField);
      }
    });
    document.body.appendChild(inlineRewriteEl);
    document.addEventListener("focusin", (e) => {
      const target = e.target;
      if (target instanceof HTMLTextAreaElement || target.getAttribute("contenteditable") === "true") {
        currentFocusedNarrativeField = target;
        positionRewriteBadge(target);
      }
    });
    document.addEventListener("focusout", (e) => {
      setTimeout(() => {
        if (document.activeElement !== currentFocusedNarrativeField && !inlineRewriteEl?.matches(":hover")) {
          hideRewriteBadge();
        }
      }, 250);
    });
  }
  function positionRewriteBadge(target) {
    if (!inlineRewriteEl || !target) return;
    const rect = target.getBoundingClientRect();
    const top = window.scrollY + rect.top - 28;
    const left = window.scrollX + rect.right - 130;
    inlineRewriteEl.style.top = `${Math.max(10, top)}px`;
    inlineRewriteEl.style.left = `${Math.max(10, left)}px`;
    inlineRewriteEl.style.display = "block";
    requestAnimationFrame(() => {
      inlineRewriteEl.style.opacity = "1";
      inlineRewriteEl.style.transform = "translateY(0)";
    });
  }
  function hideRewriteBadge() {
    if (!inlineRewriteEl) return;
    inlineRewriteEl.style.opacity = "0";
    inlineRewriteEl.style.transform = "translateY(4px)";
    setTimeout(() => {
      if (inlineRewriteEl.style.opacity === "0") {
        inlineRewriteEl.style.display = "none";
      }
    }, 150);
  }

  // src/observer.js
  var mutationObserver = null;
  var debounceTimeout = null;
  var onFormChangeCallback = null;
  function isInsideCopilot2(node) {
    if (!node || !(node instanceof Element)) return false;
    return Boolean(node.closest(`#${UI_IDS.CONTAINER}`) || node.closest(`#${UI_IDS.INLINE_REWRITE}`));
  }
  var isPaused = false;
  function pauseFormObserver() {
    isPaused = true;
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
  }
  function resumeFormObserver() {
    isPaused = false;
  }
  function startFormObserver(callback) {
    onFormChangeCallback = callback;
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    mutationObserver = new MutationObserver((mutations) => {
      if (isPaused) return;
      let hasRelevantMutation = false;
      for (const m of mutations) {
        if (isInsideCopilot2(m.target)) continue;
        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node instanceof Element && !isInsideCopilot2(node)) {
              if (node.matches("input, textarea, select, form") || node.querySelector("input, textarea, select, form")) {
                hasRelevantMutation = true;
                break;
              }
            }
          }
        }
        if (hasRelevantMutation) break;
      }
      if (hasRelevantMutation) {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          if (typeof onFormChangeCallback === "function") {
            onFormChangeCallback();
          }
        }, 600);
      }
    });
    mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // src/pageClassifier.js
  function isVisible2(element) {
    if (!element || element.closest(`#${UI_IDS.CONTAINER}, #${UI_IDS.INLINE_REWRITE}, script, style, template`)) return false;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.getAttribute("aria-hidden") === "true") return false;
      const style = node.ownerDocument.defaultView.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }
  function visibleText(root = document.body) {
    if (!root || !isVisible2(root)) return "";
    return Array.from(root.childNodes).map((node) => node.nodeType === 3 ? node.textContent : node.nodeType === 1 ? visibleText(node) : "").join(" ").replace(/\s+/g, " ").trim();
  }
  function classifyPage(doc = document) {
    const text = visibleText(doc.body);
    const headings = Array.from(doc.querySelectorAll("h1,h2,[role=heading]")).filter(isVisible2).map(visibleText).join(" ");
    const boundary = /assessment|identity verification|verify your identity|(?:recorded|video) interview|e-signature|electronic signature/i.exec(headings) || /\bI (?:certify|attest|declare under penalty)|\b(?:sign electronically|provide your electronic signature|start (?:the |your )?(?:assessment|video interview)|verify your identity)\b/i.exec(text);
    if (boundary) return { type: "boundary", reason: `Manual action required: ${boundary[0]}.` };
    if (/application (?:has been |was )?(?:submitted|received)|thank you for applying/i.test(text)) return { type: "confirmation", reason: "Application confirmation detected." };
    const final = Array.from(doc.querySelectorAll("button,input[type=submit],[role=button]")).filter(isVisible2).some((el) => /\bsubmit (?:my |your |the )?application\b|\bfinal submit\b|^submit$|^apply now$/i.test(visibleText(el) || el.value || el.getAttribute("aria-label") || ""));
    if (/review (?:your )?application|final review|review and submit/i.test(headings) || final && doc.querySelector("form,input,textarea")) return { type: "review", reason: "Ready for review. Final submission is manual." };
    const fields = Array.from(doc.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]),textarea,select,[role=combobox],[contenteditable=true]")).some(isVisible2);
    if (fields) return { type: "application", reason: "Application fields detected." };
    if (final) return { type: "review", reason: "Ready for review. Final submission is manual." };
    if (doc.querySelector('script[type="application/ld+json"]') && /JobPosting/.test(doc.querySelector('script[type="application/ld+json"]')?.textContent || "") || /job description|about (?:the|this) (?:role|job)/i.test(text)) return { type: "listing", reason: "Job listing detected." };
    return { type: "unrelated", reason: "No application step detected." };
  }

  // src/jobs.js
  function safeUrl(value, base = window.location.href) {
    try {
      const url = new URL(value, base);
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }
  function captureJob(doc = document) {
    let posting;
    const visit = (value) => {
      if (!value || typeof value !== "object" || posting) return;
      if ([value["@type"]].flat().includes("JobPosting")) {
        posting = value;
        return;
      }
      for (const child of Object.values(value)) if (typeof child === "object") {
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
      }
    };
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        visit(JSON.parse(script.textContent));
      } catch {
      }
    }
    const plain = (html) => {
      const el = doc.createElement("div");
      el.innerHTML = String(html || "");
      return el.textContent.replace(/\s+/g, " ").trim().slice(0, 3e4);
    };
    const apply = Array.from(doc.querySelectorAll("a[href]")).find((el) => isVisible2(el) && /^(?:apply|apply now|apply for (?:this )?(?:job|position)|start application)$/i.test(visibleText(el)));
    const company = posting?.hiringOrganization?.name || doc.querySelector("[itemprop=hiringOrganization]")?.textContent?.trim() || "";
    const address = [posting?.jobLocation].flat()[0]?.address;
    const job = {
      title: plain(posting?.title || doc.querySelector("h1")?.textContent || doc.title),
      company: plain(company),
      companyUncertain: !company,
      location: plain(typeof address === "string" ? address : [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(", ")),
      jobId: plain(posting?.identifier?.value || (typeof posting?.identifier === "string" ? posting.identifier : "")),
      description: plain(posting?.description || visibleText(doc.querySelector("[itemprop=description],.job-description,#job-description,article,main") || doc.body)),
      listingUrl: doc.location.href,
      applicationUrl: apply ? safeUrl(apply.getAttribute("href"), doc.location.href) : "",
      capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    gmSet(STORAGE_KEYS.JOB, job);
    return job;
  }

  // src/sessions.js
  var key = (id) => `${STORAGE_KEYS.SESSIONS}:${id}`;
  var now = () => (/* @__PURE__ */ new Date()).toISOString();
  function saveSession(session) {
    session.updatedAt = now();
    gmSet(key(session.id), session);
    const ids = gmGet(STORAGE_KEYS.SESSIONS, []);
    gmSet(STORAGE_KEYS.SESSIONS, [session.id, ...ids.filter((id) => id !== session.id)].slice(0, 100));
    return session;
  }
  function bindTab(session) {
    if (typeof GM_getTab === "function" && typeof GM_saveTab === "function") {
      GM_getTab((tab) => GM_saveTab({ ...tab, jobCopilotSession: session.id }));
    }
  }
  function createSession(job) {
    const session = {
      id: globalThis.crypto.randomUUID(),
      job,
      currentUrl: window.location.href,
      history: [],
      answers: {},
      errors: [],
      steps: {},
      status: "idle",
      reason: "Ready to start.",
      active: false,
      createdAt: now(),
      updatedAt: now(),
      pendingUrl: "",
      transitions: 0
    };
    saveSession(session);
    bindTab(session);
    return session;
  }
  function matchesSession(session, url) {
    return Boolean(session && [session.currentUrl, session.pendingUrl, session.job?.listingUrl, session.job?.applicationUrl, ...(session.history || []).map((page) => page.url)].filter(Boolean).includes(url));
  }
  function pendingRedirectMatches(session, url) {
    if (!session?.active || !session.pendingUrl || !session.pendingAt || Date.now() - session.pendingAt > 12e4) return false;
    try {
      const pending = new URL(session.pendingUrl), target = new URL(url);
      if (pending.origin !== target.origin) return false;
      const parts = pending.pathname.split("/").filter(Boolean);
      if (/^(?:step|page|stage)[-_]?\d+$/i.test(parts.at(-1))) parts.pop();
      if (parts.length < 2) return false;
      const prefix = "/" + parts.join("/");
      if (target.pathname !== prefix && !target.pathname.startsWith(prefix + "/")) return false;
      for (const [name, value] of pending.searchParams) {
        if (!/^(step|page|stage)$/i.test(name) && target.searchParams.get(name) !== value) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  async function restoreSession(url = window.location.href) {
    if (typeof GM_getTab === "function") {
      const tab = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 500);
        GM_getTab((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
      const session = tab?.jobCopilotSession ? gmGet(key(tab.jobCopilotSession)) : null;
      if (matchesSession(session, url) || pendingRedirectMatches(session, url)) return session;
    }
    const candidates = gmGet(STORAGE_KEYS.SESSIONS, []).map((id) => gmGet(key(id))).filter((s) => matchesSession(s, url));
    return candidates.length === 1 ? candidates[0] : null;
  }

  // src/navigation.js
  function findContinue(doc = document) {
    const candidates = Array.from(doc.querySelectorAll("button,input[type=submit],input[type=button],a[href],[role=button]")).filter(isVisible2).filter((el) => {
      const label = visibleText(el) || el.value || el.getAttribute("aria-label") || "";
      return /^(?:next(?: step)?|continue|save (?:and|&) continue|review(?: application)?|proceed)$/i.test(label.trim());
    });
    return candidates.length === 1 ? candidates[0] : null;
  }
  function pageSignature(fields, doc = document) {
    return JSON.stringify([doc.location.href, Array.from(doc.querySelectorAll("h1,h2,h3,[aria-current=step]")).filter(isVisible2).map(visibleText), fields.map((f) => [f.id, f.label, f.type])]);
  }
  function isDisabled(control) {
    return Boolean(control?.disabled || control?.getAttribute("aria-disabled") === "true");
  }

  // src/validation.js
  function inspectValidation(fields, control = null, doc = document) {
    const errors = [];
    const owned = /* @__PURE__ */ new Set();
    for (const field of fields) {
      const el = field.element;
      if (!isVisible2(el) || el.disabled) continue;
      const ids = `${el.getAttribute("aria-errormessage") || ""} ${el.getAttribute("aria-describedby") || ""}`.trim().split(/\s+/);
      const nodes = ids.map((id) => doc.getElementById(id)).filter((node) => node && isVisible2(node));
      const invalid = el.getAttribute("aria-invalid") === "true" || el.validity?.valid === false;
      const missing = field.required && (field.type === "checkbox" ? !el.checked : field.type === "radio" ? !(field.elements || [el]).some((r) => r.checked) : !String(field.currentValue ?? "").trim());
      const messages = nodes.filter((node) => invalid || node.matches("[role=alert],.error,.field-error,[data-error]"));
      messages.forEach((node) => owned.add(node));
      if (invalid || missing || messages.some((node) => visibleText(node))) errors.push({ fieldId: field.id, label: field.label, kind: el.getAttribute("aria-invalid") === "true" || messages.length ? "semantic" : "native", message: messages.map(visibleText).filter(Boolean).join(" ") || el.validationMessage || "Required value missing or rejected." });
    }
    for (const el of doc.querySelectorAll("[role=alert],.field-error,.validation-error,.error-message,[data-error]")) {
      if (!isVisible2(el) || owned.has(el) || !visibleText(el)) continue;
      const container = el.closest(".form-group,.field,.form-field,fieldset,[data-field]");
      const candidates = container ? fields.filter((field2) => container.contains(field2.element)) : [];
      const field = candidates.length === 1 ? candidates[0] : null;
      const existing = field && errors.find((error) => error.fieldId === field.id);
      if (existing) {
        existing.message = visibleText(el).slice(0, 500);
        existing.kind = "semantic";
      } else errors.push({ fieldId: field?.id || null, kind: "semantic", message: visibleText(el).slice(0, 500) });
    }
    for (const el of doc.querySelectorAll("input,select,textarea")) {
      if (isVisible2(el) && !el.disabled && el.validity?.valid === false && !fields.some((f) => f.element === el || f.elements?.includes(el))) errors.push({ fieldId: null, message: el.validationMessage || "A required control needs manual input." });
    }
    if (control && isDisabled(control)) errors.push({ fieldId: null, message: "Continue is disabled." });
    return errors;
  }

  // src/memory.js
  var normalizeQuestion = (label) => String(label || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  var questionKey = (field) => JSON.stringify([normalizeQuestion(field.label), field.type, field.description || ""]);
  var profileKey = () => JSON.stringify(getProfile());
  var common = (field) => /^(full name|first name|last name|email|email address|phone|phone number|linkedin|linkedin url|github|github url|portfolio|portfolio url)$/.test(normalizeQuestion(field.label));
  var compatible = (field, answer) => answer && (!field.options?.length || field.type === "checkbox" || field.options.some((o) => String(o.value) === String(answer.value) || String(o.label) === String(answer.value)));
  function rememberAnswer(session, field, answer) {
    const entry = { value: answer.value, inferred: Boolean(answer.inferred), profileKey: profileKey(), label: field.label, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (session?.answers) session.answers[questionKey(field)] = entry;
    if (common(field) && !entry.inferred) {
      const memory = gmGet(STORAGE_KEYS.MEMORY, {});
      memory[questionKey(field)] = entry;
      gmSet(STORAGE_KEYS.MEMORY, memory);
    }
  }
  function recallAnswer(session, field) {
    const entry = session.answers[questionKey(field)] || (common(field) ? gmGet(STORAGE_KEYS.MEMORY, {})[questionKey(field)] : null);
    return entry?.profileKey === profileKey() && compatible(field, entry) ? { value: entry.value, inferred: entry.inferred } : null;
  }

  // src/application.js
  var scanFormFields2 = () => scanFormFields().filter((f) => isVisible2(f.element) && !f.element.disabled && !f.element.readOnly && f.element.type !== "file");
  var empty = (field) => field.type === "checkbox" ? !field.element.checked : !String(field.currentValue ?? "").trim();
  var runnable = /* @__PURE__ */ new Set(["running", "captcha", "waiting"]);
  function createApplicationEngine({ answer = generateAutofillAnswers, onChange = () => {
  }, settleMs = 180, transitionMs = 1200, navigationTimeoutMs = transitionMs === 0 ? 0 : 1e4 } = {}) {
    let session = null, busy = false, generation = 0, timer = null, observer = null, interval = null, cancelDelay = null;
    const delay2 = (ms) => new Promise((resolve) => {
      let t = null;
      cancelDelay = () => {
        clearTimeout(t);
        cancelDelay = null;
        resolve();
      };
      t = setTimeout(() => {
        cancelDelay = null;
        resolve();
      }, ms);
    });
    const results = /* @__PURE__ */ new Map();
    let lastEmission = "";
    function validation(fields = scanFormFields2(), control = null) {
      const errors = inspectValidation(fields, control);
      for (const field of fields) {
        const result = results.get(field.id);
        if (result?.status === "failed" && String(result.value) === String(field.currentValue) && !errors.some((e) => e.fieldId === field.id)) {
          errors.push({ fieldId: field.id, message: result.error, kind: "persistence" });
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
      if (["captcha", "boundary", "review", "confirmation"].includes(page.type)) {
        status(page.type, page.reason);
        return false;
      }
      return true;
    }
    async function waitForNavigation(signature, token, afterClick) {
      const deadline = Date.now() + navigationTimeoutMs;
      let lastSignature = signature, stableSince = Date.now();
      const stableMs = Math.min(transitionMs, 200);
      status("running", afterClick ? "Waiting for the next page to finish loading." : "Waiting for the page Continue button to become ready.");
      logger.info(`Navigation wait: ${afterClick ? "after click" : "button readiness"}, timeout=${navigationTimeoutMs}ms`);
      do {
        if (!guard(token)) return "stopped";
        const fields = scanFormFields2();
        const current = pageSignature(fields);
        if (current !== lastSignature) {
          lastSignature = current;
          stableSince = Date.now();
        }
        const busy2 = Array.from(document.querySelectorAll('[aria-busy="true"]')).some(isVisible2);
        const control = findContinue();
        if (!busy2 && Date.now() - stableSince >= stableMs) {
          if (current !== signature && fields.length) {
            logger.info(`Navigation wait: next step ready, ${fields.length} fields`);
            return "changed";
          }
          if (current === signature) {
            if (inspectValidation(fields).length) return "validation";
            if (!afterClick && control && !isDisabled(control)) return "ready";
          }
        }
        if (Date.now() >= deadline) break;
        await delay2(Math.min(100, Math.max(1, deadline - Date.now())));
      } while (true);
      logger.warn(`Navigation wait timed out: buttonDisabled=${isDisabled(findContinue())}, path=${window.location.pathname}`);
      return "timeout";
    }
    function pauseDisabledButton() {
      status("paused", `The page's Continue button stayed disabled after waiting ${navigationTimeoutMs / 1e3}s. Auto Continue is still on; inspect the page before resuming.`);
    }
    async function applyAnswers(fields, answers, token, signature) {
      const byId = new Map(answers.map((a) => [a.fieldId, a]));
      for (const original of fields) {
        if (!guard(token) || pageSignature(scanFormFields2()) !== signature) return false;
        const field = scanFormFields2().find((f) => f.id === original.id && f.label === original.label && f.type === original.type);
        const entry = byId.get(original.id);
        if (!field || !entry || entry.value === "" || entry.value == null) continue;
        field.options = original.options;
        field.element.scrollIntoView?.({ block: "center", behavior: "instant" });
        const filled = await fillField(field, entry.value);
        await delay2(settleMs);
        if (!guard(token)) return false;
        if (pageSignature(scanFormFields2()) !== signature) {
          logger.warn(`Page changed during field action: id=${field.id}, path=${window.location.pathname}`);
          status("paused", "Page changed while filling a field. Inspect the current step before resuming.");
          return false;
        }
        const live = scanFormFields2().find((f) => f.id === field.id && f.label === field.label);
        const verified = filled && live ? await verifyField(live, entry.value) : { verified: false };
        let exact = !["text", "textarea", "email", "tel", "url", "number", "contenteditable"].includes(field.type) || String(verified.actualValue ?? "").trim() === String(entry.value).trim();
        if (["select", "radio"].includes(field.type)) exact = field.options.some((o) => (String(o.value) === String(entry.value) || o.label === String(entry.value)) && String(o.value) === String(verified.actualValue));
        const valid = verified.verified && exact && !inspectValidation([live]).some((error) => error.fieldId === live.id);
        results.set(field.id, { status: valid ? entry.inferred ? "inferred" : "verified" : "failed", value: verified.actualValue ?? "", inferred: Boolean(entry.inferred), error: valid ? "" : "Value rejected or failed verification." });
        if (valid) rememberAnswer(session, field, entry);
        saveSession(session);
        emit();
      }
      return true;
    }
    async function request(fields, context, token, signature) {
      if (!guard(token)) return [];
      await harvestComboboxOptions(fields);
      if (!guard(token) || pageSignature(scanFormFields2()) !== signature) return [];
      let response = await answer(normalizeFieldsForAI(fields), { jobContext: session.job, ...context });
      if (!guard(token) || pageSignature(scanFormFields2()) !== signature) return [];
      if (response.answers.some((a) => a.searchQuery)) response = await resolveComboboxSearchAnswers(fields, response);
      return response.answers;
    }
    async function repair(errors, step, token, signature) {
      if (step.repairs >= 2) {
        status("paused", "Repair limit reached (2/2). Review errors and resume manually.");
        return false;
      }
      step.repairs++;
      session.errors.push(...errors.map((error) => ({ ...error, attempt: step.repairs, url: window.location.href, at: (/* @__PURE__ */ new Date()).toISOString() })));
      session.errors = session.errors.slice(-100);
      status("running", `Repair ${step.repairs}/2: ${errors.map((e) => e.message).join(" ").slice(0, 250)}`);
      const targets = scanFormFields2().filter((f) => errors.some((e) => e.fieldId === f.id));
      if (!targets.length) {
        status("paused", "Validation needs manual input: " + errors.map((e) => e.message).join(" ").slice(0, 250));
        return false;
      }
      const previous = targets.map((f) => ({ fieldId: f.id, ...step.answers[f.id] || recallAnswer(session, f) || {} })).filter((a) => a.value != null);
      if (!await applyAnswers(targets, previous, token, signature)) return false;
      let remaining = validation();
      if (remaining.some((e) => e.fieldId)) {
        const rejected = scanFormFields2().filter((f) => remaining.some((e) => e.fieldId === f.id));
        const repaired = await request(rejected, { repairErrors: remaining, allowSearch: false }, token, signature);
        for (const entry of repaired) step.answers[entry.fieldId] = entry;
        if (!await applyAnswers(rejected, repaired, token, signature)) return false;
        remaining = validation();
      } else if (errors.some((e) => e.kind === "semantic")) {
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
          if (!getSettings().autofillEnabled) {
            status("paused", "AI Autofill is disabled in Settings.");
            return;
          }
          const page = classifyPage();
          if (page.type !== "application") {
            status("paused", page.reason);
            return;
          }
          const fields = scanFormFields2();
          const signature = pageSignature(fields);
          if (new Set(fields.map((f) => f.id)).size !== fields.length) {
            status("paused", "Ambiguous duplicate field IDs. Fill this page manually.");
            return;
          }
          session.currentUrl = window.location.href;
          session.pendingUrl = "";
          let step = session.steps[signature];
          if (!step) {
            results.clear();
            step = session.steps[signature] = { primary: false, answers: {}, repairs: 0, clicks: 0 };
            session.history.push({ url: window.location.href, signature, at: (/* @__PURE__ */ new Date()).toISOString() });
          }
          status("running", `Application step ${session.history.length}. Repair attempts ${step.repairs}/2.`);
          if (!step.primary) {
            const targets = fields.filter((f) => getSettings().overwriteExisting || empty(f));
            const missing = [];
            for (const field of targets) {
              const cached = recallAnswer(session, field);
              if (cached) step.answers[field.id] = { fieldId: field.id, ...cached };
              else missing.push(field);
            }
            if (missing.length) {
              if ((step.requests || 0) >= 2) {
                status("paused", "Primary request limit reached (2/2). Fill this page manually.");
                return;
              }
              step.requests = (step.requests || 0) + 1;
              saveSession(session);
              status("running", `Generating answers for ${missing.length} fields.`);
              const answers = await request(missing, {}, token, signature);
              if (!guard(token) || pageSignature(scanFormFields2()) !== signature) return;
              if (!answers.length) throw new Error("AI returned no usable answers. Resume to retry.");
              for (const entry of answers) step.answers[entry.fieldId] = entry;
            }
            step.primary = true;
            saveSession(session);
            if (!await applyAnswers(targets, Object.values(step.answers), token, signature)) return;
          } else {
            const missing = fields.filter(empty);
            if (missing.length && !await applyAnswers(missing, Object.values(step.answers), token, signature)) return;
          }
          if (!guard(token) || pageSignature(scanFormFields2()) !== signature) continue;
          let control = findContinue();
          const errors = validation(scanFormFields2());
          if (errors.length) {
            if (await repair(errors, step, token, signature)) continue;
            return;
          }
          if (!getSettings().autoContinue) {
            status("paused", "Page filled. Auto Continue is off.");
            return;
          }
          control = findContinue();
          if (control && isDisabled(control)) {
            const readiness = await waitForNavigation(signature, token, false);
            if (readiness === "stopped") return;
            if (readiness === "changed" || readiness === "validation") continue;
            if (readiness === "timeout") {
              pauseDisabledButton();
              return;
            }
            control = findContinue();
          }
          if (!control || isDisabled(control)) {
            status("paused", "No unambiguous enabled Continue control. Continue manually.");
            return;
          }
          if (step.clicks >= 3 || session.transitions >= 30) {
            status("paused", "Navigation limit reached. Continue manually.");
            return;
          }
          if (!guard(token)) return;
          step.clicks++;
          session.transitions++;
          session.pendingUrl = control.tagName === "A" ? safeUrl(control.getAttribute("href")) : safeUrl(control.getAttribute("formaction") || control.form?.getAttribute("action") || window.location.href);
          session.pendingAt = Date.now();
          status("running", "Continuing; waiting for the next step.");
          bindTab(session);
          logger.info(`Navigation action: ${control.textContent?.trim() || control.value || "Continue"}, path=${window.location.pathname}`);
          control.click();
          const transition = await waitForNavigation(signature, token, true);
          if (transition === "stopped") return;
          if (transition === "changed") continue;
          const rejected = inspectValidation(scanFormFields2());
          if (rejected.length && await repair(rejected, step, token, signature)) continue;
          if (!session.active) return;
          if (isDisabled(findContinue())) {
            pauseDisabledButton();
            return;
          }
          if (session.active) status("paused", "Continue did not change the step. Check the page, then resume.");
          return;
        }
        status("paused", "Workflow limit reached. Continue manually.");
      } catch (error) {
        if (token === generation && session) status("paused", `Workflow stopped: ${error.message}`);
      } finally {
        busy = false;
        emit();
      }
    }
    return {
      get session() {
        return session;
      },
      get busy() {
        return busy;
      },
      async initialize() {
        session = await restoreSession();
        if (session) bindTab(session);
        emit();
        const schedule = () => {
          clearTimeout(timer);
          timer = setTimeout(() => void tick(), 300);
        };
        observer = new MutationObserver((mutations) => {
          if (mutations.some((m) => !m.target.closest?.("#job-copilot-root,#job-copilot-inline-rewrite"))) schedule();
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
        status("running", "Starting application workflow.");
        await tick();
      },
      pause() {
        generation++;
        clearTimeout(timer);
        cancelDelay?.();
        busy = false;
        if (session) status("paused", "Paused by user.");
      },
      tick,
      destroy() {
        generation++;
        clearTimeout(timer);
        cancelDelay?.();
        clearInterval(interval);
        observer?.disconnect();
      }
    };
  }

  // src/ui.js
  var applicationEngine = null;
  var applicationState = null;
  function resolveLiveElement(field) {
    if (!field) return null;
    try {
      if (field.element && field.element.isConnected) {
        return field.element;
      }
    } catch {
    }
    if (field.id) {
      try {
        const byId = document.getElementById(field.id);
        if (byId && byId.isConnected) {
          field.element = byId;
          return byId;
        }
      } catch {
      }
    }
    if (field.selector) {
      try {
        const bySelector = document.querySelector(field.selector);
        if (bySelector && bySelector.isConnected) {
          field.element = bySelector;
          return bySelector;
        }
      } catch {
      }
    }
    if (field.name) {
      try {
        const byName = document.querySelector(`[name="${CSS.escape(field.name)}"]`);
        if (byName && byName.isConnected) {
          field.element = byName;
          return byName;
        }
      } catch {
      }
    }
    return field.element;
  }
  var shadowRootRef = null;
  var currentTab = "home";
  var panelVisible = false;
  var lastAiTestResult = null;
  var isAiTesting = false;
  var isAutofilling = false;
  var autofillProgress = { current: 0, total: 0, statusText: "" };
  var detectedFieldsCache = [];
  var fieldResultsCache = /* @__PURE__ */ new Map();
  var activeRewriteField = null;
  var isRewriting = false;
  var rewriteFeedbackInput = "";
  var STYLES = `
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
  width: 450px;
  max-width: calc(100vw - 40px);
  height: 600px;
  max-height: calc(100vh - 80px);
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

.jc-btn-large {
  padding: 12px 18px;
  font-size: 13px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
}

.jc-btn-large:hover {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.5);
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

.jc-btn-small {
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 6px;
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

.jc-badge-blue {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
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

.jc-progress-bar-container {
  width: 100%;
  height: 6px;
  background: #1e293b;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.jc-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #2563eb);
  transition: width 0.2s ease;
}

.jc-field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
}

.jc-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.jc-field-name {
  font-weight: 600;
  font-size: 12px;
  color: #f1f5f9;
}

.jc-field-val-preview {
  font-size: 11px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jc-modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.jc-modal {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.jc-workflow-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-left: 3px solid #475569;
  transition: border-color 0.3s ease;
}

.jc-workflow-card.wf-running {
  border-left-color: #38bdf8;
}

.jc-workflow-card.wf-paused {
  border-left-color: #f59e0b;
}

.jc-workflow-card.wf-done {
  border-left-color: #10b981;
}

.jc-wf-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.jc-wf-badge-running {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  animation: jc-pulse-badge 1.8s ease-in-out infinite;
}

.jc-wf-badge-paused {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.jc-wf-badge-done {
  background: rgba(16, 185, 129, 0.18);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
  font-size: 12px;
  padding: 4px 12px;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
}

.jc-wf-badge-idle {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

@keyframes jc-pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.jc-wf-job-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.3;
}

.jc-wf-job-company {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.jc-wf-reason {
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.4;
  padding: 6px 8px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 6px;
  border-left: 2px solid #475569;
}

.jc-wf-reason.wf-error {
  border-left-color: #f59e0b;
  color: #fde68a;
}

.jc-wf-metrics {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.jc-wf-metric {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #94a3b8;
}

.jc-wf-metric strong {
  color: #e2e8f0;
  font-weight: 700;
}

.jc-wf-step-bar-container {
  width: 100%;
  height: 4px;
  background: #1e293b;
  border-radius: 2px;
  overflow: hidden;
}

.jc-wf-step-bar {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #2563eb);
  border-radius: 2px;
  transition: width 0.4s ease;
  min-width: 0;
}

.jc-wf-step-bar.wf-pulse {
  animation: jc-bar-pulse 1.5s ease-in-out infinite;
}

.jc-wf-step-bar.wf-done {
  background: linear-gradient(90deg, #34d399, #10b981);
}

@keyframes jc-bar-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.jc-wf-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.jc-wf-actions .jc-btn {
  flex: 1;
  padding: 10px 14px;
  font-size: 12px;
}

.jc-wf-actions .jc-btn:first-child {
  flex: 0 0 auto;
}

.jc-btn-pause-active {
  background: rgba(245, 158, 11, 0.18) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
  animation: jc-pulse-badge 1.8s ease-in-out infinite;
}

.jc-btn-pause-active:hover {
  background: rgba(245, 158, 11, 0.3) !important;
  color: #fef3c7 !important;
  border-color: rgba(245, 158, 11, 0.6) !important;
}
`;
  function escapeHtml(str) {
    if (str === null || str === void 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  var ttPolicy = null;
  function getTrustedHTML(htmlString) {
    if (typeof window !== "undefined" && window.trustedTypes && typeof window.trustedTypes.createPolicy === "function") {
      if (!ttPolicy) {
        try {
          ttPolicy = window.trustedTypes.createPolicy("job-copilot-ui", {
            createHTML: (s) => s
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
        const doc = parser.parseFromString(htmlString, "text/html");
        element.replaceChildren(...doc.body.childNodes);
      } catch (parseErr) {
        console.warn("[JobCopilot:UI] Fallback HTML assignment failed:", parseErr);
      }
    }
  }
  function getStatusInfo() {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        label: "No API Key",
        dotClass: "no-key",
        badgeClass: "jc-badge-amber",
        text: "Configure your OpenRouter API key in Settings."
      };
    }
    if (lastAiTestResult && !lastAiTestResult.ok) {
      return {
        label: "API Error",
        dotClass: "error",
        badgeClass: "jc-badge-red",
        text: lastAiTestResult.error || "OpenRouter connection failed"
      };
    }
    return {
      label: "Ready",
      dotClass: "",
      badgeClass: "jc-badge-green",
      text: "Connected and ready for action."
    };
  }
  function refreshDetectedFields() {
    try {
      detectedFieldsCache = scanFormFields(document);
    } catch (err) {
      logger.error("Error scanning fields:", err);
    }
  }
  var autofillGeneration = 0;
  var cancelAutofillDelay = null;
  function autofillSleep(ms) {
    return new Promise((resolve) => {
      let timer = null;
      cancelAutofillDelay = () => {
        clearTimeout(timer);
        cancelAutofillDelay = null;
        resolve();
      };
      timer = setTimeout(() => {
        cancelAutofillDelay = null;
        resolve();
      }, ms);
    });
  }
  function stopAutofillFlow(reason = "Autofill paused by user. Progress and filled fields preserved.") {
    if (!isAutofilling) return;
    autofillGeneration++;
    cancelAutofillDelay?.();
    isAutofilling = false;
    autofillProgress.statusText = reason;
    logger.info(`Single-page autofill stopped: ${reason}`);
    resumeFormObserver();
    refreshDetectedFields();
    updatePanelDOM();
  }
  async function executeAutofillFlow() {
    if (isAutofilling || applicationEngine?.busy) return;
    applicationEngine?.pause();
    const token = ++autofillGeneration;
    const runUrl = window.location.href;
    const page = classifyPage();
    if (["captcha", "boundary", "confirmation"].includes(page.type)) {
      autofillProgress.statusText = page.reason;
      updatePanelDOM();
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("Please configure your OpenRouter API Key in Settings first.");
      currentTab = "settings";
      updatePanelDOM();
      return;
    }
    isAutofilling = true;
    autofillProgress = { current: 0, total: 0, statusText: "Scanning page fields..." };
    updatePanelDOM();
    pauseFormObserver();
    try {
      refreshDetectedFields();
      const settings = getSettings();
      const overwrite = Boolean(settings.overwriteExisting);
      const targetFields = detectedFieldsCache.filter((f) => {
        if (overwrite) return true;
        const val = f.currentValue;
        return !val || val === "false" || val === "0" || String(val).trim().length === 0;
      });
      if (targetFields.length === 0) {
        autofillProgress.statusText = detectedFieldsCache.length === 0 ? "No form fields detected on this page." : 'All fields are already filled. Enable "Overwrite Existing Values" in Settings to overwrite.';
        logger.info(autofillProgress.statusText);
        isAutofilling = false;
        updatePanelDOM();
        return;
      }
      if (token !== autofillGeneration) return;
      autofillProgress.total = targetFields.length;
      autofillProgress.statusText = "Harvesting combobox options...";
      updatePanelDOM();
      await harvestComboboxOptions(targetFields);
      if (token !== autofillGeneration) return;
      autofillProgress.statusText = `Generating answers with AI (${settings.model})...`;
      updatePanelDOM();
      const normalized = normalizeFieldsForAI(targetFields, { overwriteExisting: overwrite });
      let aiResponse = await generateAutofillAnswers(normalized);
      if (token !== autofillGeneration) return;
      if (window.location.href !== runUrl) throw new Error("Page changed during autofill. Inspect the current step before retrying.");
      if (["captcha", "boundary", "confirmation"].includes(classifyPage().type)) throw new Error(classifyPage().reason);
      if (aiResponse.answers.some((answer) => answer.searchQuery)) {
        autofillProgress.statusText = "Searching for missing combobox options...";
        updatePanelDOM();
        aiResponse = await resolveComboboxSearchAnswers(targetFields, aiResponse);
        if (token !== autofillGeneration) return;
      }
      const answersMap = new Map(aiResponse.answers.map((a) => [a.fieldId, a]));
      logger.info(`Starting progressive fill of ${targetFields.length} fields...`);
      let filledCount = 0;
      let failedCount = 0;
      for (let i = 0; i < targetFields.length; i++) {
        if (token !== autofillGeneration) break;
        if (window.location.href !== runUrl) throw new Error("Page changed during autofill. Inspect the current step before retrying.");
        if (["captcha", "boundary", "confirmation"].includes(classifyPage().type)) throw new Error(classifyPage().reason);
        const field = targetFields[i];
        autofillProgress.current = i + 1;
        autofillProgress.statusText = `Filling ${i + 1} of ${targetFields.length}: "${field.label}"`;
        updatePanelDOM();
        try {
          if (token !== autofillGeneration) break;
          field.element = resolveLiveElement(field);
          const answer = answersMap.get(field.id);
          if (!answer || answer.value === "" || answer.value === null || answer.value === void 0) {
            if (field.required || field.element?.getAttribute("data-reject-fill") === "true") {
              failedCount++;
              fieldResultsCache.set(field.id, {
                status: FILL_STATUS.FAILED,
                value: field.currentValue || "",
                error: "Required field left empty by AI"
              });
              highlightFailedField(field.element);
            } else {
              fieldResultsCache.set(field.id, {
                status: FILL_STATUS.SKIPPED,
                value: field.currentValue
              });
            }
            continue;
          }
          scrollToField(field.element);
          highlightActiveField(field.element);
          await autofillSleep(100);
          if (token !== autofillGeneration) break;
          const didFill = await fillField(field, answer.value);
          if (token !== autofillGeneration) break;
          const settleDelay = field.type === "combobox" ? 250 : 80;
          await autofillSleep(settleDelay);
          if (token !== autofillGeneration) break;
          field.element = resolveLiveElement(field);
          const verification = didFill ? await verifyField(field, answer.value) : { verified: false, actualValue: "", error: "No exact option was selected or the field rejected the value" };
          if (token !== autofillGeneration) break;
          if (verification.verified) {
            highlightVerifiedField(field.element);
            filledCount++;
            fieldResultsCache.set(field.id, {
              status: answer.inferred ? FILL_STATUS.INFERRED : FILL_STATUS.VERIFIED,
              value: verification.actualValue || answer.value,
              inferred: answer.inferred
            });
            if (applicationEngine?.session) {
              rememberAnswer(applicationEngine.session, field, answer);
              saveSession(applicationEngine.session);
            } else {
              rememberAnswer(null, field, answer);
            }
          } else {
            highlightFailedField(field.element);
            failedCount++;
            fieldResultsCache.set(field.id, {
              status: FILL_STATUS.FAILED,
              value: verification.actualValue || "",
              error: verification.error || "Value did not stick in DOM"
            });
            logger.warn(`Verification failed for "${field.label}": ${verification.error}`);
          }
        } catch (fieldErr) {
          if (token !== autofillGeneration) break;
          logger.error(`Error filling field "${field.label}":`, fieldErr);
          failedCount++;
          fieldResultsCache.set(field.id, {
            status: FILL_STATUS.FAILED,
            value: "",
            error: fieldErr?.message || "Field execution failed"
          });
          try {
            highlightFailedField(field.element);
          } catch {
          }
        }
      }
      if (token !== autofillGeneration) return;
      autofillProgress.statusText = `Autofill completed! (${filledCount} filled, ${failedCount} failed)`;
      logger.info(`Autofill finished: ${filledCount} verified, ${failedCount} failed out of ${targetFields.length} fields.`);
    } catch (err) {
      if (token !== autofillGeneration) return;
      logger.error("Autofill execution failed:", err);
      autofillProgress.statusText = `Error: ${err.message}`;
    } finally {
      if (token === autofillGeneration) {
        isAutofilling = false;
        resumeFormObserver();
        refreshDetectedFields();
        updatePanelDOM();
      }
    }
  }
  function openRewriteModal(field) {
    activeRewriteField = field;
    rewriteFeedbackInput = "";
    panelVisible = true;
    updatePanelDOM();
  }
  async function executeFieldRewrite(feedback) {
    if (!activeRewriteField) return;
    isRewriting = true;
    updatePanelDOM();
    try {
      const field = activeRewriteField;
      field.element = resolveLiveElement(field);
      const currentVal = field.element?.value || field.currentValue || "";
      const rewritten = await rewriteNarrativeField({
        fieldLabel: field.label,
        currentValue: currentVal,
        feedback,
        constraints: field.constraints
      });
      if (rewritten) {
        scrollToField(field.element);
        await fillField(field, rewritten);
        highlightVerifiedField(field.element);
        fieldResultsCache.set(field.id, {
          status: FILL_STATUS.VERIFIED,
          value: rewritten
        });
        logger.info(`Rewrote and updated field "${field.label}"`);
      }
      activeRewriteField = null;
    } catch (err) {
      logger.error("Rewrite failed:", err);
      alert(`Rewrite Error: ${err.message}`);
    } finally {
      isRewriting = false;
      refreshDetectedFields();
      updatePanelDOM();
    }
  }
  function renderPill() {
    const status = getStatusInfo();
    const fieldCount = detectedFieldsCache.length;
    const countBadge = fieldCount > 0 ? `<span class="jc-badge jc-badge-blue" style="padding: 1px 5px; font-size: 10px;">${fieldCount}</span>` : "";
    return `
    <div class="jc-pill-btn" id="jc-toggle-btn" title="Toggle Job Copilot Panel">
      <div class="jc-status-dot ${status.dotClass}"></div>
      <span>Job Copilot</span>
      ${countBadge}
    </div>
  `;
  }
  function renderHomeTab() {
    const status = getStatusInfo();
    const settings = getSettings();
    const currentHost = window.location.hostname;
    const fieldCount = detectedFieldsCache.length;
    const session = applicationState?.session;
    const job = session?.job;
    const wfStatus = session?.status || "";
    const wfIsRunning = wfStatus === "running";
    const wfIsDone = ["review", "confirmation"].includes(wfStatus);
    const wfIsPaused = wfStatus === "paused";
    const wfIsWaiting = ["captcha", "boundary"].includes(wfStatus);
    const wfCardClass = wfIsRunning ? "wf-running" : wfIsDone ? "wf-done" : wfIsPaused || wfIsWaiting ? "wf-paused" : "";
    let wfBadgeHtml;
    if (wfIsDone) {
      const doneLabel = wfStatus === "confirmation" ? "\u2713 Submitted" : "\u2713 Done \u2014 Ready for Review";
      wfBadgeHtml = `<span class="jc-wf-badge jc-wf-badge-done">${doneLabel}</span>`;
    } else if (wfIsRunning) {
      wfBadgeHtml = `<span class="jc-wf-badge jc-wf-badge-running">\u25CF Running</span>`;
    } else if (wfIsWaiting) {
      const waitLabel = wfStatus === "captcha" ? "\u23F8 CAPTCHA" : "\u23F8 Manual Step Required";
      wfBadgeHtml = `<span class="jc-wf-badge jc-wf-badge-paused">${waitLabel}</span>`;
    } else if (wfIsPaused) {
      wfBadgeHtml = `<span class="jc-wf-badge jc-wf-badge-paused">\u23F8 Paused</span>`;
    } else {
      wfBadgeHtml = `<span class="jc-wf-badge jc-wf-badge-idle">Not Started</span>`;
    }
    const stepsCompleted = session ? session.history.length : 0;
    const fieldsAnswered = session ? Object.keys(session.answers).length : 0;
    const stepBarPercent = stepsCompleted > 0 ? Math.min(stepsCompleted * 25, 100) : 0;
    const stepBarClass = wfIsDone ? "wf-done" : wfIsRunning ? "wf-pulse" : "";
    let wfReasonHtml = "";
    if (session && session.reason) {
      const isErr = wfIsPaused || wfIsWaiting;
      wfReasonHtml = `<div class="jc-wf-reason ${isErr ? "wf-error" : ""}">${escapeHtml(session.reason)}</div>`;
    } else if (!session) {
      wfReasonHtml = `<div style="font-size:12px;color:#94a3b8">Capture a job listing, then start on its application page.</div>`;
    }
    let wfJobHtml = "";
    if (job) {
      const companyText = (job.company || "Company unknown") + (job.companyUncertain ? " (uncertain)" : "");
      wfJobHtml = `<div>
      <div class="jc-wf-job-title">${escapeHtml(job.title)}</div>
      <div class="jc-wf-job-company">${escapeHtml(companyText)}${job.location ? ` \xB7 ${escapeHtml(job.location)}` : ""}</div>
    </div>`;
    }
    const lastError = session?.errors?.length ? session.errors.at(-1).message : "";
    const wfErrorHtml = lastError && !session.reason?.includes(lastError) ? `<div style="font-size:11px;color:#fbbf24;padding:4px 8px;background:rgba(245,158,11,0.08);border-radius:6px">\u26A0 ${escapeHtml(lastError)}</div>` : "";
    const workflowHtml = `<div class="jc-workflow-card ${wfCardClass}">
    <div class="jc-row">
      <span class="jc-card-title">Multi-Step Application</span>
      ${wfBadgeHtml}
    </div>
    ${wfJobHtml}
    ${session ? `<div class="jc-wf-step-bar-container"><div class="jc-wf-step-bar ${stepBarClass}" style="width:${stepBarPercent}%"></div></div>` : ""}
    ${session ? `<div class="jc-wf-metrics">
      <div class="jc-wf-metric">\u{1F4CB} <strong>${stepsCompleted}</strong> step${stepsCompleted !== 1 ? "s" : ""} completed</div>
      <div class="jc-wf-metric">\u270F\uFE0F <strong>${fieldsAnswered}</strong> field${fieldsAnswered !== 1 ? "s" : ""} answered</div>
    </div>` : ""}
    ${wfReasonHtml}
    ${wfErrorHtml}
    <div class="jc-wf-actions">
      <button class="jc-btn jc-btn-secondary" id="jc-capture-job" ${isAutofilling || applicationEngine?.busy ? "disabled" : ""}>Capture Job</button>
      <button class="jc-btn" id="jc-start-application" ${isAutofilling || applicationEngine?.busy ? "disabled" : ""}>${session ? "Start / Resume" : "Start Application"}</button>
      <button class="jc-btn jc-btn-secondary ${wfIsRunning ? "jc-btn-pause-active" : ""}" id="jc-pause-application">Pause</button>
    </div>
  </div>`;
    let progressHtml = "";
    if (isAutofilling || autofillProgress.statusText) {
      const percent = autofillProgress.total > 0 ? Math.round(autofillProgress.current / autofillProgress.total * 100) : 0;
      progressHtml = `
      <div class="jc-card" style="border-color: #2563eb;">
        <div class="jc-row">
          <span class="jc-card-title">Autofill Progress</span>
          <span style="font-size: 11px; font-weight: 600; color: #38bdf8;">${autofillProgress.current} / ${autofillProgress.total}</span>
        </div>
        <div style="font-size: 12px; color: #f8fafc;">${escapeHtml(autofillProgress.statusText)}</div>
        <div class="jc-progress-bar-container">
          <div class="jc-progress-bar" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
    }
    let testResultHtml = "";
    if (lastAiTestResult) {
      if (lastAiTestResult.ok) {
        testResultHtml = `
        <div class="jc-alert jc-alert-success">
          <strong>\u2713 AI Connected</strong> (${lastAiTestResult.latencyMs}ms)<br/>
          <span style="font-size: 11px; color: #cbd5e1;">Model: ${lastAiTestResult.model}</span>
        </div>
      `;
      } else {
        testResultHtml = `
        <div class="jc-alert jc-alert-error">
          <strong>\u2717 Connection Failed</strong> (${lastAiTestResult.latencyMs}ms)<br/>
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
      <div class="jc-row">
        <span class="jc-card-title">Page Form Fields</span>
        <span class="jc-badge jc-badge-blue">${fieldCount} detected</span>
      </div>
      <div class="jc-row" style="margin-top: 4px; gap: 8px;">
        <button class="jc-btn jc-btn-large" id="jc-autofill-btn" style="flex: 1;" ${isAutofilling ? "disabled" : ""}>
          ${isAutofilling ? "\u26A1 Filling Fields..." : "\u26A1 Autofill This Page"}
        </button>
        <button class="jc-btn jc-btn-secondary ${isAutofilling ? "jc-btn-pause-active" : ""}" id="jc-pause-autofill-btn" style="padding: 10px 14px; font-size: 12px;" ${!isAutofilling ? "disabled" : ""} title="Pause / Stop autofill">
          ${isAutofilling ? "\u23F8 Pause" : "Pause"}
        </button>
        <button class="jc-btn jc-btn-secondary" id="jc-rescan-btn" title="Rescan page fields" style="padding: 10px 12px;">\u{1F504}</button>
      </div>
    </div>

    ${workflowHtml}
    ${progressHtml}

    <div class="jc-card">
      <span class="jc-card-title">Context & Connectivity</span>
      <div class="jc-row">
        <span class="jc-label">Host</span>
        <span class="jc-val">${currentHost}</span>
      </div>
      <div class="jc-row">
        <span class="jc-label">Model</span>
        <span class="jc-val" style="font-family: monospace; font-size: 11px;">${settings.model}</span>
      </div>
      <div class="jc-row" style="margin-top: 4px;">
        <button class="jc-btn jc-btn-secondary" id="jc-test-ai-btn" style="flex: 1;" ${isAiTesting ? "disabled" : ""}>
          ${isAiTesting ? "Testing..." : "Test AI Connection"}
        </button>
      </div>
      ${testResultHtml}
    </div>
  `;
  }
  function renderReviewTab() {
    if (detectedFieldsCache.length === 0) {
      return `
      <div class="jc-card">
        <div style="text-align: center; color: #94a3b8; padding: 20px 0;">
          No form fields detected on this page.<br/>
          <button class="jc-btn jc-btn-secondary" id="jc-rescan-review-btn" style="margin: 12px auto 0;">\u{1F504} Rescan Form</button>
        </div>
      </div>
    `;
    }
    const fieldRows = detectedFieldsCache.map((field) => {
      const result = fieldResultsCache.get(field.id);
      let statusBadge = '<span class="jc-badge" style="background: #1e293b; color: #94a3b8;">Pending</span>';
      if (result) {
        if (result.status === FILL_STATUS.VERIFIED) {
          statusBadge = '<span class="jc-badge jc-badge-green">Verified \u2713</span>';
        } else if (result.status === FILL_STATUS.INFERRED) {
          statusBadge = '<span class="jc-badge jc-badge-amber">Review \u26A0\uFE0F</span>';
        } else if (result.status === FILL_STATUS.FAILED) {
          statusBadge = '<span class="jc-badge jc-badge-red">Failed \u2717</span>';
        } else if (result.status === FILL_STATUS.SKIPPED) {
          statusBadge = '<span class="jc-badge" style="background: #334155; color: #94a3b8;">Skipped</span>';
        }
      }
      let currentVal = "";
      if (field.type === FIELD_TYPES.RADIO) {
        const radios = field.elements || [field.element];
        const checkedRadio = radios.find((r) => r.checked);
        currentVal = checkedRadio ? extractOptionLabel(checkedRadio) || checkedRadio.value : "";
      } else if (field.type === FIELD_TYPES.CHECKBOX) {
        currentVal = field.element?.checked ? "Checked \u2713" : "Unchecked";
      } else if (field.type === FIELD_TYPES.SELECT) {
        const sel = field.element;
        const opt = sel?.options?.[sel?.selectedIndex];
        currentVal = opt && opt.value !== "" ? opt.text.trim() || opt.value : "";
      } else {
        currentVal = field.element?.value || field.element?.textContent || field.currentValue || "";
      }
      const rewriteBtn = field.isNarrative ? `<button class="jc-btn jc-btn-secondary jc-btn-small jc-field-rewrite-btn" data-field-id="${field.id}">\u2728 Rewrite</button>` : "";
      return `
      <div class="jc-field-row">
        <div class="jc-field-header">
          <span class="jc-field-name">${escapeHtml(field.label || field.id)}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${statusBadge}
            ${rewriteBtn}
          </div>
        </div>
        <div class="jc-field-val-preview">${escapeHtml(currentVal || "(empty)")}</div>
      </div>
    `;
    }).join("");
    return `
    <div class="jc-row" style="margin-bottom: 4px;">
      <span class="jc-card-title">Form Fields (${detectedFieldsCache.length})</span>
      <button class="jc-btn jc-btn-secondary jc-btn-small" id="jc-rescan-review-btn">\u{1F504} Rescan</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${fieldRows}
    </div>
  `;
  }
  function renderProfileTab() {
    const profile = getProfile();
    const sections = PROFILE_SECTIONS.map((section, index) => `
    <details class="jc-profile-section" ${index === 0 ? "open" : ""} style="border: 1px solid #334155; border-radius: 10px; padding: 12px;">
      <summary style="cursor: pointer; font-weight: 600;">${escapeHtml(section.title)}</summary>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 12px;">${escapeHtml(section.description)}</p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${section.fields.map((field) => {
      const value = String(profile[field.name] || "");
      const id = `jc-profile-${field.name}`;
      const control = field.options ? `<select id="${id}" class="jc-input" name="${field.name}">
                <option value="">Not set</option>
                ${field.options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
              </select>` : `<input id="${id}" class="jc-input" type="${field.type || "text"}" name="${field.name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || "")}" ${field.min !== void 0 ? `min="${field.min}" step="${field.step}"` : ""} />`;
      return `<div class="jc-form-group"><label for="${id}">${escapeHtml(field.label)}</label>${control}</div>`;
    }).join("")}
      </div>
    </details>
  `).join("");
    return `
    <form id="jc-profile-form" style="display: flex; flex-direction: column; gap: 12px;">
      <div style="font-size: 12px; color: #94a3b8;">Save common answers once. Explicit answers take priority over background notes.</div>
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

      ${sections}

      <div style="padding: 10px 12px; border-radius: 8px; background: rgba(59,130,246,0.1); font-size: 12px;">
        <strong>Application source: LinkedIn</strong><br />Used for \u201CHow did you hear about us?\u201D If LinkedIn is unavailable, the field is left for review.
      </div>

      <div class="jc-form-group">
        <label for="jc-profile-resumeContext">Resume / Background Summary</label>
        <textarea id="jc-profile-resumeContext" class="jc-textarea" name="resumeContext" rows="4" placeholder="Paste your core resume highlights, skills, and background summary...">${escapeHtml(profile.resumeContext)}</textarea>
      </div>

      <div class="jc-form-group">
        <label for="jc-profile-applicantNotes">Applicant Notes / Custom Rules</label>
        <textarea id="jc-profile-applicantNotes" class="jc-textarea" name="applicantNotes" rows="2" placeholder="Additional preferences, exceptions, and guidance for written answers...">${escapeHtml(profile.applicantNotes)}</textarea>
      </div>

      <div class="jc-row" style="margin-top: 4px;">
        <button class="jc-btn" type="submit" style="flex: 1;">Save Profile</button>
        <span class="jc-save-feedback" id="jc-profile-feedback">Saved \u2713</span>
      </div>
    </form>
  `;
  }
  function renderSettingsTab() {
    const settings = getSettings();
    const hasApiKey = Boolean(getApiKey());
    const modelOptions = POPULAR_MODELS.map((m) => {
      const selected = settings.model === m ? "selected" : "";
      return `<option value="${m}" ${selected}>${m}</option>`;
    }).join("");
    return `
    <form id="jc-settings-form" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="jc-form-group">
        <label>OpenRouter API Key</label>
        <div class="jc-row">
          <input class="jc-input" id="jc-api-key-input" type="password" autocomplete="off" placeholder="${hasApiKey ? "Key saved \u2014 enter replacement" : "sk-or-v1-..."}" />
          <button type="button" class="jc-btn jc-btn-secondary" id="jc-toggle-key-btn" style="padding: 8px 10px;">\u{1F441}</button>
        </div>
        <span style="font-size: 11px; color: #64748b;">
          Saved key stays in userscript storage. Leave blank to keep it.
        </span>
      </div>

      <div class="jc-form-group">
        <label>AI Model</label>
        <select class="jc-select" name="model" id="jc-model-select">
          ${modelOptions}
          <option value="custom" ${!POPULAR_MODELS.includes(settings.model) ? "selected" : ""}>Custom Model...</option>
        </select>
        <input class="jc-input" id="jc-custom-model-input" type="text" placeholder="Enter custom model ID" value="${escapeHtml(settings.model)}" style="margin-top: 6px; display: ${!POPULAR_MODELS.includes(settings.model) ? "block" : "none"};" />
      </div>

      <div class="jc-card">
        <span class="jc-card-title">Behavior Controls</span>
        
        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">AI Autofill</div>
            <div style="font-size: 11px; color: #64748b;">Enable AI form filling capabilities</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autofillEnabled" ${settings.autofillEnabled ? "checked" : ""} />
            <span class="jc-slider"></span>
          </label>
        </div>

        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">Overwrite Existing Values</div>
            <div style="font-size: 11px; color: #64748b;">Overwrite non-empty fields on autofill</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="overwriteExisting" ${settings.overwriteExisting ? "checked" : ""} />
            <span class="jc-slider"></span>
          </label>
        </div>

        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">Auto Continue</div>
            <div style="font-size: 11px; color: #64748b;">Advance to next step on valid page (Phase 3)</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autoContinue" ${settings.autoContinue ? "checked" : ""} />
            <span class="jc-slider"></span>
          </label>
        </div>

        <div class="jc-toggle-row">
          <div>
            <div class="jc-label">Auto Submit</div>
            <div style="font-size: 11px; color: #64748b;">Final submission stays manual in Phase 3</div>
          </div>
          <label class="jc-switch">
            <input type="checkbox" name="autoSubmit" disabled />
            <span class="jc-slider"></span>
          </label>
        </div>
      </div>

      <div class="jc-row">
        <button class="jc-btn" type="submit" style="flex: 1;">Save Settings</button>
        <span class="jc-save-feedback" id="jc-settings-feedback">Saved \u2713</span>
      </div>
    </form>
  `;
  }
  function renderDebugTab() {
    const state = getSanitizedState();
    const logs = logger.getLogs();
    const logsHtml = logs.length === 0 ? '<span style="color: #64748b;">No debug logs recorded yet.</span>' : logs.slice().reverse().map((l) => {
      const time = l.timestamp.split("T")[1]?.slice(0, 8) || "";
      return `
          <div class="jc-log-item">
            <span class="jc-log-time">[${time}]</span>
            <span class="jc-log-level-${l.level}">[${l.level}]</span>
            <span>${escapeHtml(l.message)}</span>
          </div>
        `;
    }).join("");
    return `
    <div class="jc-card">
      <div class="jc-row">
        <span class="jc-card-title">System Information</span>
        <span class="jc-val" style="font-size: 11px;">v${state.version}</span>
      </div>
      <div class="jc-row">
        <span class="jc-label">API Key Stored</span>
        <span class="jc-badge ${state.hasApiKey ? "jc-badge-green" : "jc-badge-amber"}">
          ${state.hasApiKey ? "Present (Isolated in Secrets)" : "Not Configured"}
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
  function renderRewriteModal() {
    if (!activeRewriteField) return "";
    const currentVal = activeRewriteField.element?.value || activeRewriteField.currentValue || "";
    return `
    <div class="jc-modal-overlay" id="jc-rewrite-modal-overlay">
      <div class="jc-modal">
        <div class="jc-row">
          <strong style="font-size: 13px; color: #f8fafc;">\u2728 Rewrite Response</strong>
          <button class="jc-close-btn" id="jc-cancel-rewrite-btn">\u2715</button>
        </div>
        <div style="font-size: 11px; color: #94a3b8;">
          <strong>Field:</strong> ${escapeHtml(activeRewriteField.label)}
        </div>
        <div class="jc-form-group">
          <label>Current Text</label>
          <div style="max-height: 80px; overflow-y: auto; background: #090d16; padding: 6px 8px; border-radius: 6px; font-size: 11px; color: #cbd5e1;">
            ${escapeHtml(currentVal || "(empty)")}
          </div>
        </div>
        <div class="jc-form-group">
          <label>Revision Feedback / Custom Instructions</label>
          <input class="jc-input" id="jc-rewrite-feedback-input" type="text" placeholder="e.g. Make it more concise, emphasize cloud leadership" />
        </div>
        <div class="jc-row" style="margin-top: 6px;">
          <button class="jc-btn jc-btn-secondary" id="jc-cancel-rewrite-btn-2" style="flex: 1;">Cancel</button>
          <button class="jc-btn" id="jc-submit-rewrite-btn" style="flex: 1;" ${isRewriting ? "disabled" : ""}>
            ${isRewriting ? "Generating..." : "\u2728 Rewrite & Replace"}
          </button>
        </div>
      </div>
    </div>
  `;
  }
  function updatePanelDOM() {
    if (!shadowRootRef) return;
    const container = shadowRootRef.querySelector(".jc-widget-container");
    if (!container) return;
    let panelHtml = "";
    if (panelVisible) {
      let tabContent = "";
      if (currentTab === "home") tabContent = renderHomeTab();
      else if (currentTab === "review") tabContent = renderReviewTab();
      else if (currentTab === "profile") tabContent = renderProfileTab();
      else if (currentTab === "settings") tabContent = renderSettingsTab();
      else if (currentTab === "debug") tabContent = renderDebugTab();
      panelHtml = `
      <div class="jc-panel" id="jc-main-panel">
        <div class="jc-header">
          <div class="jc-header-title">
            <span>\u2728</span>
            <span>${APP_NAME}</span>
            <span class="jc-version-tag">v${APP_VERSION}</span>
          </div>
          <button class="jc-close-btn" id="jc-close-panel-btn" title="Minimize panel">\u2715</button>
        </div>

        <div class="jc-nav-tabs">
          <button class="jc-tab-btn ${currentTab === "home" ? "active" : ""}" data-tab="home">Home</button>
          <button class="jc-tab-btn ${currentTab === "review" ? "active" : ""}" data-tab="review">Review</button>
          <button class="jc-tab-btn ${currentTab === "profile" ? "active" : ""}" data-tab="profile">Profile</button>
          <button class="jc-tab-btn ${currentTab === "settings" ? "active" : ""}" data-tab="settings">Settings</button>
          <button class="jc-tab-btn ${currentTab === "debug" ? "active" : ""}" data-tab="debug">Debug</button>
        </div>

        <div class="jc-content">
          ${tabContent}
        </div>

        ${renderRewriteModal()}
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
    const capture = shadowRootRef.querySelector("#jc-capture-job");
    if (capture) capture.onclick = () => applicationEngine?.capture();
    const start = shadowRootRef.querySelector("#jc-start-application");
    if (start) start.onclick = () => void applicationEngine?.start();
    const pause = shadowRootRef.querySelector("#jc-pause-application");
    if (pause) {
      pause.onclick = () => {
        applicationEngine?.pause();
        if (isAutofilling) {
          stopAutofillFlow("Autofill paused by user. Progress and filled fields preserved.");
        }
      };
    }
    const toggleBtn = shadowRootRef.querySelector("#jc-toggle-btn");
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        panelVisible = !panelVisible;
        if (panelVisible) refreshDetectedFields();
        updatePanelDOM();
      };
    }
    const closeBtn = shadowRootRef.querySelector("#jc-close-panel-btn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        panelVisible = false;
        updatePanelDOM();
      };
    }
    const tabBtns = shadowRootRef.querySelectorAll(".jc-tab-btn");
    tabBtns.forEach((btn) => {
      btn.onclick = () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab) {
          currentTab = targetTab;
          if (targetTab === "review") refreshDetectedFields();
          updatePanelDOM();
        }
      };
    });
    const autofillBtn = shadowRootRef.querySelector("#jc-autofill-btn");
    if (autofillBtn) {
      autofillBtn.onclick = () => {
        executeAutofillFlow();
      };
    }
    const pauseAutofillBtn = shadowRootRef.querySelector("#jc-pause-autofill-btn");
    if (pauseAutofillBtn) {
      pauseAutofillBtn.onclick = () => {
        stopAutofillFlow("Autofill paused by user. Progress and filled fields preserved.");
        applicationEngine?.pause();
      };
    }
    const rescanBtn = shadowRootRef.querySelector("#jc-rescan-btn");
    if (rescanBtn) {
      rescanBtn.onclick = () => {
        refreshDetectedFields();
        logger.info(`Rescanned form: ${detectedFieldsCache.length} fields detected.`);
        updatePanelDOM();
      };
    }
    const rescanReviewBtn = shadowRootRef.querySelector("#jc-rescan-review-btn");
    if (rescanReviewBtn) {
      rescanReviewBtn.onclick = () => {
        refreshDetectedFields();
        logger.info(`Rescanned form: ${detectedFieldsCache.length} fields detected.`);
        updatePanelDOM();
      };
    }
    const testAiBtn = shadowRootRef.querySelector("#jc-test-ai-btn");
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
    const rewriteBtns = shadowRootRef.querySelectorAll(".jc-field-rewrite-btn");
    rewriteBtns.forEach((btn) => {
      btn.onclick = () => {
        const fieldId = btn.getAttribute("data-field-id");
        const target = detectedFieldsCache.find((f) => f.id === fieldId);
        if (target) {
          openRewriteModal(target);
        }
      };
    });
    const cancelRewriteBtn = shadowRootRef.querySelector("#jc-cancel-rewrite-btn");
    const cancelRewriteBtn2 = shadowRootRef.querySelector("#jc-cancel-rewrite-btn-2");
    if (cancelRewriteBtn) cancelRewriteBtn.onclick = () => {
      activeRewriteField = null;
      updatePanelDOM();
    };
    if (cancelRewriteBtn2) cancelRewriteBtn2.onclick = () => {
      activeRewriteField = null;
      updatePanelDOM();
    };
    const submitRewriteBtn = shadowRootRef.querySelector("#jc-submit-rewrite-btn");
    if (submitRewriteBtn) {
      submitRewriteBtn.onclick = () => {
        const feedbackInput = shadowRootRef.querySelector("#jc-rewrite-feedback-input");
        const feedback = feedbackInput ? feedbackInput.value.trim() : "";
        executeFieldRewrite(feedback);
      };
    }
    const profileForm = shadowRootRef.querySelector("#jc-profile-form");
    if (profileForm) {
      profileForm.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(profileForm);
        const newProfile = {
          ...getProfile(),
          ...Object.fromEntries(PROFILE_FIELDS.map((field) => [field.name, String(formData.get(field.name) || "").trim()])),
          fullName: formData.get("fullName") || "",
          email: formData.get("email") || "",
          phone: formData.get("phone") || "",
          location: formData.get("location") || "",
          linkedin: formData.get("linkedin") || "",
          github: formData.get("github") || "",
          portfolio: formData.get("portfolio") || "",
          resumeContext: formData.get("resumeContext") || "",
          applicantNotes: formData.get("applicantNotes") || ""
        };
        saveProfile(newProfile);
        logger.info("Profile saved successfully.");
        const feedback = shadowRootRef.querySelector("#jc-profile-feedback");
        if (feedback) {
          feedback.style.display = "inline";
          setTimeout(() => {
            feedback.style.display = "none";
          }, 2e3);
        }
      };
    }
    const settingsForm = shadowRootRef.querySelector("#jc-settings-form");
    if (settingsForm) {
      const modelSelect = shadowRootRef.querySelector("#jc-model-select");
      const customInput = shadowRootRef.querySelector("#jc-custom-model-input");
      if (modelSelect && customInput) {
        modelSelect.onchange = () => {
          if (modelSelect.value === "custom") {
            customInput.style.display = "block";
          } else {
            customInput.style.display = "none";
            customInput.value = modelSelect.value;
          }
        };
      }
      const toggleKeyBtn = shadowRootRef.querySelector("#jc-toggle-key-btn");
      const apiKeyInput = shadowRootRef.querySelector("#jc-api-key-input");
      if (toggleKeyBtn && apiKeyInput) {
        toggleKeyBtn.onclick = () => {
          apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
          toggleKeyBtn.textContent = apiKeyInput.type === "password" ? "\u{1F441}" : "\u{1F512}";
        };
      }
      settingsForm.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        let selectedModel = modelSelect?.value || "google/gemini-2.0-flash";
        if (selectedModel === "custom" && customInput) {
          selectedModel = customInput.value.trim() || "google/gemini-2.0-flash";
        }
        const newSettings = {
          model: selectedModel,
          autofillEnabled: formData.get("autofillEnabled") === "on",
          overwriteExisting: formData.get("overwriteExisting") === "on",
          autoContinue: formData.get("autoContinue") === "on",
          autoSubmit: formData.get("autoSubmit") === "on"
        };
        saveSettings(newSettings);
        if (apiKeyInput?.value.trim()) {
          saveApiKey(apiKeyInput.value);
          apiKeyInput.value = "";
        }
        logger.info("Settings saved.");
        const feedback = shadowRootRef.querySelector("#jc-settings-feedback");
        if (feedback) {
          feedback.style.display = "inline";
          setTimeout(() => {
            feedback.style.display = "none";
          }, 2e3);
        }
      };
    }
    const clearLogsBtn = shadowRootRef.querySelector("#jc-clear-logs-btn");
    if (clearLogsBtn) {
      clearLogsBtn.onclick = () => {
        logger.clear();
        updatePanelDOM();
      };
    }
  }
  function mountUI() {
    if (document.getElementById(UI_IDS.CONTAINER)) {
      return;
    }
    const rootElement = document.createElement("div");
    rootElement.id = UI_IDS.CONTAINER;
    rootElement.style.position = "absolute";
    rootElement.style.top = "0";
    rootElement.style.left = "0";
    rootElement.style.zIndex = "2147483647";
    const shadow = rootElement.attachShadow({ mode: "open" });
    shadowRootRef = shadow;
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    shadow.appendChild(styleEl);
    const container = document.createElement("div");
    container.className = "jc-widget-container";
    shadow.appendChild(container);
    const target = document.body || document.documentElement;
    if (target) {
      target.appendChild(rootElement);
      refreshDetectedFields();
      updatePanelDOM();
      initInlineRewriteBadge((targetInput) => {
        const field = detectedFieldsCache.find((f) => f.element === targetInput);
        if (field) {
          openRewriteModal(field);
        } else {
          openRewriteModal({
            id: targetInput.id || "narrative_field",
            label: targetInput.getAttribute("aria-label") || targetInput.placeholder || "Narrative Response",
            element: targetInput,
            currentValue: targetInput.value || "",
            isNarrative: true,
            constraints: {}
          });
        }
      });
      startFormObserver(() => {
        refreshDetectedFields();
        updatePanelDOM();
      });
      applicationEngine = createApplicationEngine({ onChange: (state) => {
        applicationState = state;
        for (const [id, result] of state.results) fieldResultsCache.set(id, result);
        refreshDetectedFields();
        updatePanelDOM();
      } });
      void applicationEngine.initialize();
      logger.info("Job Copilot Shadow DOM UI mounted successfully.");
    }
  }
  function toggleUIVisibility() {
    panelVisible = !panelVisible;
    if (panelVisible) refreshDetectedFields();
    updatePanelDOM();
  }

  // src/main.js
  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand === "function") {
      try {
        GM_registerMenuCommand(`Toggle ${APP_NAME} Panel`, () => {
          toggleUIVisibility();
        });
        GM_registerMenuCommand(`Reset ${APP_NAME} Storage`, () => {
          if (confirm(`Reset all ${APP_NAME} profile data, settings, and secrets?`)) {
            resetAll();
            logger.warn("All storage reset to defaults via menu command.");
            window.location.reload();
          }
        });
      } catch (err) {
        console.warn(`[${APP_NAME}] Could not register GM menu commands:`, err);
      }
    }
  }
  function bootstrap() {
    if (window.self !== window.top) {
      return;
    }
    try {
      initializeStorage();
      registerMenuCommands();
      mountUI();
      logger.info(`${APP_NAME} v${APP_VERSION} initialized on ${window.location.hostname}`);
    } catch (err) {
      console.error(`[${APP_NAME}] Initialization error:`, err);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
