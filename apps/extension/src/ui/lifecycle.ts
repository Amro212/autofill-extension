interface MountableShadowUi {
  mount: () => void;
  shadowHost: HTMLElement;
}

export function keepUiMounted(
  ui: MountableShadowUi,
  document: Document,
): () => void {
  ui.mount();
  const MutationObserver = document.defaultView?.MutationObserver;
  if (MutationObserver === undefined) return () => undefined;

  const observer = new MutationObserver(() => {
    if (!ui.shadowHost.isConnected) {
      (document.body ?? document.documentElement).append(ui.shadowHost);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
