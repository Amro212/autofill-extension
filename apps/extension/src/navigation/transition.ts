export function pageTransitionSignature(document: Document, window: Window): string {
  const headings = [...document.querySelectorAll("h1, h2")]
    .slice(0, 3)
    .map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim())
    .join("|");
  const controls = [...document.querySelectorAll<HTMLElement>("input, select, textarea, button")]
    .slice(0, 40)
    .map((element) => element.id || element.getAttribute("name") || element.tagName)
    .join("|");
  const step = document.querySelector<HTMLElement>("[data-step]")?.dataset.step ??
    document.body?.dataset.step ??
    "";
  return `${window.location.href}\u0000${document.title}\u0000${step}\u0000${headings}\u0000${controls}`;
}

export function waitForPageTransition(
  document: Document,
  window: Window,
  before: string,
  options: { timeoutMs?: number } = {},
): Promise<boolean> {
  if (pageTransitionSignature(document, window) !== before) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => pageTransitionSignature(document, window) !== before;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.removeEventListener("hashchange", onRoute);
      window.removeEventListener("popstate", onRoute);
      clearTimeout(timer);
      resolve(result);
    };
    const onRoute = () => {
      if (changed()) finish(true);
    };
    const observer = new MutationObserver(() => {
      if (changed()) finish(true);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-step"],
    });
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    timer = setTimeout(() => finish(false), options.timeoutMs ?? 5_000);
  });
}
