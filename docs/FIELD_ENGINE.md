# Field Engine

Discovery gathers visible native inputs, textareas, selects, contenteditable
regions, ARIA comboboxes, radio/checkbox groups, file inputs, repeated sections,
and adapter-supplied candidates. Honeypots, passwords, hidden/internal mirrors,
disabled controls, and unsafe boundaries are excluded.

Each field becomes a `NormalizedField` containing a stable ID, adapter/page key,
kind, semantic hint, label evidence, current value, required/disabled state,
constraints, options, repeat scope, and safe locator hints. Labels prefer
explicit `<label>`, ARIA, nearby group text, placeholder/name, then conservative
fallbacks. Registries replace stale page snapshots rather than accumulating DOM
nodes.

Execution is sequential. Native setters and input/change/blur events handle
standard and React-controlled inputs. Custom controls use keyboard/option
selection and, only where required, a narrow MAIN-world action. Dates and file
uploads have dedicated executors. Every action reads page state afterward;
failure records expected versus actual state and enters bounded repair. Changed
fields are highlighted and the latest page action retains undo snapshots.
