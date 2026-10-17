/**
 * Stable callbacks per key (e.g. per exercise) that always call the latest implementation. The logger rebuilds its handlers every
 * render; passing these wrappers instead lets memoised set rows skip re-rendering when only another row changed.
 */
export function createHandlerMap<H extends Record<string, (...args: never[]) => unknown>>() {
  const latest: Record<string, H> = {};
  const stable: Record<string, H> = {};
  return (key: string, handlers: H): H => {
    latest[key] = handlers;
    if (!stable[key]) {
      const wrappers = {} as Record<string, unknown>;
      for (const name of Object.keys(handlers)) wrappers[name] = (...args: never[]) => latest[key]![name]!(...args);
      stable[key] = wrappers as H;
    }
    return stable[key]!;
  };
}
