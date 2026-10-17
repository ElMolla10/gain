/** Native-only presentation boundary. Workout timer state remains the source of truth. */
export type RestActivityState = { endsAt: number | null; durationMs: number; label: string; restLabel?: string };
export type RestActivityProps = { endsAt: number; startedAt: number; label: string; restLabel: string };
export interface RestActivityInstance {
  update(props: RestActivityProps, staleDate?: Date): Promise<void>;
  end(policy: "immediate"): Promise<void>;
}
export interface RestActivityFactory {
  getInstances(): RestActivityInstance[];
  start(props: RestActivityProps, url?: string, staleDate?: Date): RestActivityInstance;
}

export function createRestLiveActivityController(load: () => RestActivityFactory | null, now = Date.now) {
  let queue = Promise.resolve();
  let lastContent: string | null = null;
  const enqueue = (operation: () => Promise<void>) => {
    // One failed or unavailable native operation must never break logging or future updates.
    queue = queue.then(operation).catch(() => { lastContent = null; });
    return queue;
  };
  const endAll = async (factory: RestActivityFactory) => {
    lastContent = null;
    await Promise.allSettled(factory.getInstances().map((instance) => instance.end("immediate")));
  };
  return {
    sync(state: RestActivityState): Promise<void> {
      return enqueue(async () => {
        const factory = load();
        if (!factory) return;
        if (state.endsAt === null || !Number.isFinite(state.endsAt) || state.endsAt <= now() || !Number.isFinite(state.durationMs) || state.durationMs <= 0) {
          await endAll(factory);
          return;
        }
        const props: RestActivityProps = {
          endsAt: state.endsAt, startedAt: state.endsAt - state.durationMs,
          label: state.label, restLabel: state.restLabel ?? "Rest",
        };
        const instances = factory.getInstances();
        // Recover activities after relaunch and leave just one presentation of the current rest.
        await Promise.allSettled(instances.slice(1).map((instance) => instance.end("immediate")));
        const content = JSON.stringify(props);
        const staleDate = new Date(props.endsAt);
        if (!instances[0]) factory.start(props, undefined, staleDate);
        else if (lastContent !== content) await instances[0].update(props, staleDate);
        lastContent = content;
      });
    },
    stop(): Promise<void> {
      return enqueue(async () => {
        const factory = load();
        if (factory) await endAll(factory);
      });
    },
  };
}
