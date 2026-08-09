type HistoryMethod = "pushState" | "replaceState";

export function observeRoutes(
  window: Window,
  onChange: (url: URL) => void,
): () => void {
  let current = window.location.href;
  const notify = () => {
    if (window.location.href === current) return;
    current = window.location.href;
    onChange(new URL(current));
  };
  const originals = new Map<HistoryMethod, History[HistoryMethod]>();
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    originals.set(method, original);
    window.history[method] = function (...args: Parameters<History[HistoryMethod]>) {
      original.apply(window.history, args);
      notify();
    };
  }
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  return () => {
    for (const [method, original] of originals) window.history[method] = original;
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
  };
}

