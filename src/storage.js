import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_PROFILE, APP_VERSION } from './constants.js';

// In-memory fallback if running outside Tampermonkey (e.g. fixtures or preview)
const memoryStore = new Map();

function isGMAvailable() {
  return typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
}

export function gmGet(key, defaultValue = null) {
  try {
    if (isGMAvailable()) {
      const val = GM_getValue(key, defaultValue);
      return val !== undefined ? val : defaultValue;
    }
    return memoryStore.has(key) ? memoryStore.get(key) : defaultValue;
  } catch (err) {
    console.error(`[JobCopilot:Storage] Failed to read "${key}":`, err);
    return defaultValue;
  }
}

export function gmSet(key, value) {
  try {
    if (isGMAvailable()) {
      GM_setValue(key, value);
    } else {
      memoryStore.set(key, value);
    }
  } catch (err) {
    console.error(`[JobCopilot:Storage] Failed to write "${key}":`, err);
  }
}

export function gmDelete(key) {
  try {
    if (typeof GM_deleteValue === 'function') {
      GM_deleteValue(key);
    } else {
      memoryStore.delete(key);
    }
  } catch (err) {
    console.error(`[JobCopilot:Storage] Failed to delete "${key}":`, err);
  }
}

export function getSettings() {
  const stored = gmGet(STORAGE_KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings) {
  // Ensure we do not accidentally persist secrets in general settings
  const cleanSettings = { ...settings };
  delete cleanSettings.apiKey;
  delete cleanSettings.openRouterApiKey;
  gmSet(STORAGE_KEYS.SETTINGS, cleanSettings);
  return getSettings();
}

export function getProfile() {
  const stored = gmGet(STORAGE_KEYS.PROFILE, {});
  return { ...DEFAULT_PROFILE, ...stored };
}

export function saveProfile(profile) {
  const cleanProfile = { ...DEFAULT_PROFILE, ...profile };
  gmSet(STORAGE_KEYS.PROFILE, cleanProfile);
  return getProfile();
}

export function getApiKey() {
  const secrets = gmGet(STORAGE_KEYS.SECRETS, {});
  return (secrets && secrets.apiKey) ? String(secrets.apiKey).trim() : '';
}

export function saveApiKey(apiKey) {
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  gmSet(STORAGE_KEYS.SECRETS, { apiKey: cleanKey });
}

export function clearApiKey() {
  gmDelete(STORAGE_KEYS.SECRETS);
}

export function getDebugLogs() {
  return gmGet(STORAGE_KEYS.DEBUG, []);
}

export function saveDebugLogs(logs) {
  gmSet(STORAGE_KEYS.DEBUG, logs);
}

export function clearDebugLogs() {
  gmSet(STORAGE_KEYS.DEBUG, []);
}

export function initializeStorage() {
  const currentVer = gmGet(STORAGE_KEYS.VERSION);
  if (!currentVer) {
    gmSet(STORAGE_KEYS.VERSION, APP_VERSION);
  }
}

export function getSanitizedState() {
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
      hasResumeContext: Boolean(profile.resumeContext),
    },
    url: window.location.href,
    host: window.location.hostname,
    timestamp: new Date().toISOString(),
  };
}

export function resetAll() {
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
