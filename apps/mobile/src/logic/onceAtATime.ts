/**
 * A gate that runs one async job at a time. While a job is in flight, a second call is ignored and returns the SAME
 * promise, so a same-frame double tap (before a `busy` state re-renders the button disabled) can't start it twice.
 * Keep one gate per screen in a ref.
 */
export function onceAtATime(): <T>(job: () => Promise<T>) => Promise<T> {
  let current: Promise<unknown> | null = null;
  return <T,>(job: () => Promise<T>): Promise<T> => {
    if (current) return current as Promise<T>;
    const p = (async () => {
      try {
        return await job();
      } finally {
        current = null;
      }
    })();
    current = p;
    return p;
  };
}
