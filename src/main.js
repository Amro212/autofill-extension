import { APP_NAME, APP_VERSION } from './constants.js';
import { initializeStorage, resetAll } from './storage.js';
import { logger } from './debug.js';
import { mountUI, toggleUIVisibility } from './ui.js';

function registerMenuCommands() {
  if (typeof GM_registerMenuCommand === 'function') {
    try {
      GM_registerMenuCommand(`Toggle ${APP_NAME} Panel`, () => {
        toggleUIVisibility();
      });

      GM_registerMenuCommand(`Reset ${APP_NAME} Storage`, () => {
        if (confirm(`Reset all ${APP_NAME} profile data, settings, and secrets?`)) {
          resetAll();
          logger.warn('All storage reset to defaults via menu command.');
          window.location.reload();
        }
      });
    } catch (err) {
      console.warn(`[${APP_NAME}] Could not register GM menu commands:`, err);
    }
  }
}

function bootstrap() {
  // Only mount the main floating UI in the top-level window (not hidden sub-iframes)
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

// Start when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
