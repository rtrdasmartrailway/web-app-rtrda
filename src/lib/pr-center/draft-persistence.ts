// Serialize draft writes and deletion so a slow PUT cannot resurrect a cleared draft.
export function createDraftPersistence() {
  let tail: Promise<unknown> = Promise.resolve();
  let generation = 0;
  return {
    save(write: () => Promise<void>): Promise<void> {
      const queuedGeneration = generation;
      const result = tail
        .catch(() => undefined)
        .then(async () => {
          if (queuedGeneration === generation) await write();
        });
      tail = result;
      return result;
    },
    clear(remove: () => Promise<void>): Promise<void> {
      generation += 1;
      const result = tail.catch(() => undefined).then(remove);
      tail = result;
      return result;
    },
  };
}

// Cache successful uploads by the actual File object, not a collision-prone name.
export function createUploadCache<T extends object>() {
  const uploaded = new WeakMap<T, string>();
  return async (file: T, upload: () => Promise<string>): Promise<string> => {
    const existing = uploaded.get(file);
    if (existing) return existing;
    const id = await upload();
    uploaded.set(file, id);
    return id;
  };
}
