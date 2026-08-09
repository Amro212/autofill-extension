# Technical Notes

## WXT and execution worlds

During final planning, official WXT documentation was checked.

Key implementation point:
- WXT supports browser-targeted builds.
- Isolated content scripts should remain the default browser runtime.
- WXT recommends manually injecting a script into the main world when cross-browser page-world access is required instead of relying on a Chromium-only `world: "MAIN"` content-script declaration.

The coding agent must re-check current WXT/Firefox/Chrome documentation when implementing this layer.

Primary references:
- https://wxt.dev/guide/essentials/content-scripts.html
- https://wxt.dev/guide/essentials/target-different-browsers.html
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld
- https://developer.chrome.com/docs/extensions/reference/api/scripting
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

## OpenRouter

Provider configuration must remain dynamic.

The coding agent must query/verify current OpenRouter model IDs rather than baking an old model slug permanently into architecture.

Primary reference:
- https://openrouter.ai/google/
