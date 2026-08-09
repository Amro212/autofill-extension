export interface MutationBatch {
  records: MutationRecord[];
  addedRoots: Element[];
  changedRoots: Element[];
}

export function observeMutations(
  root: Node,
  onBatch: (batch: MutationBatch) => void,
  delayMs = 100,
): () => void {
  const document = root.ownerDocument ?? (root as Document);
  const view = document.defaultView;
  if (view === null) throw new Error("Mutation observation requires a window");
  let records: MutationRecord[] = [];
  let timer: number | undefined;
  const flush = () => {
    timer = undefined;
    const batchRecords = records;
    records = [];
    const addedRoots = new Set<Element>();
    const changedRoots = new Set<Element>();
    for (const record of batchRecords) {
      if (record.target instanceof Element) changedRoots.add(record.target);
      for (const node of record.addedNodes) {
        if (node instanceof Element) addedRoots.add(node);
      }
    }
    if (batchRecords.length > 0) {
      onBatch({
        records: batchRecords,
        addedRoots: [...addedRoots],
        changedRoots: [...changedRoots],
      });
    }
  };
  const observer = new view.MutationObserver((nextRecords) => {
    records.push(...nextRecords);
    if (timer !== undefined) view.clearTimeout(timer);
    timer = view.setTimeout(flush, delayMs);
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-hidden", "class", "disabled", "hidden", "style"],
  });
  return () => {
    observer.disconnect();
    if (timer !== undefined) view.clearTimeout(timer);
    records = [];
  };
}

