export function createLatestWinsAsyncSetter<T>(
  apply: (value: T) => Promise<void>,
): (value: T) => Promise<void> {
  const noPendingValue = Symbol("no-pending-value");
  let running = false;
  let pendingValue: T | typeof noPendingValue = noPendingValue;
  let queue: Promise<void> = Promise.resolve();

  return async (value: T) => {
    pendingValue = value;

    if (running) {
      await queue;
      return;
    }

    running = true;

    queue = (async () => {
      try {
        while (pendingValue !== noPendingValue) {
          const nextValue = pendingValue as T;
          pendingValue = noPendingValue;
          await apply(nextValue);
        }
      } finally {
        running = false;
      }
    })();

    await queue;
  };
}
