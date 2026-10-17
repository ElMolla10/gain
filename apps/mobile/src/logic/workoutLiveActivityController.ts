import type { WorkoutActivityProps } from "./workoutActivityModel";

/**
 * Native-only presentation boundary for the one workout Live Activity (Lock Screen + Dynamic Island). Session state stays the source
 * of truth; this serialises native calls, dedupes by content, recovers after relaunch, ends duplicates and contains every error.
 */
export interface WorkoutActivityInstance {
  update(props: WorkoutActivityProps, staleDate?: Date): Promise<void>;
  end(policy: "immediate"): Promise<void>;
}
export interface WorkoutActivityFactory {
  getInstances(): WorkoutActivityInstance[];
  start(props: WorkoutActivityProps, url?: string, staleDate?: Date): WorkoutActivityInstance;
  /** Cards of the older rest-only activity ("GainRestActivity"); only ever ended. */
  legacy?: { getInstances(): { end(policy: "immediate"): Promise<void> }[] };
}

export function createWorkoutLiveActivityController(load: () => WorkoutActivityFactory | null) {
  let queue = Promise.resolve();
  let lastContent: string | null = null;
  const enqueue = (operation: () => Promise<void>) => {
    // One failed or unavailable native operation must never break logging or future updates.
    queue = queue.then(operation).catch(() => { lastContent = null; });
    return queue;
  };
  const endLegacy = async (factory: WorkoutActivityFactory) => {
    await Promise.allSettled((factory.legacy?.getInstances() ?? []).map((instance) => instance.end("immediate")));
  };
  const endAll = async (factory: WorkoutActivityFactory) => {
    lastContent = null;
    await Promise.allSettled(factory.getInstances().map((instance) => instance.end("immediate")));
    await endLegacy(factory);
  };
  const endDuplicates = async (factory: WorkoutActivityFactory) => {
    const instances = factory.getInstances();
    await Promise.allSettled(instances.slice(1).map((instance) => instance.end("immediate")));
    return instances[0];
  };
  const stop = (): Promise<void> => enqueue(async () => {
    const factory = load();
    if (factory) await endAll(factory);
  });
  return {
    /** Show these props (start, or update when the content changed); null ends the card. */
    sync(props: WorkoutActivityProps | null): Promise<void> {
      return enqueue(async () => {
        const factory = load();
        if (!factory) return;
        if (!props) return endAll(factory);
        const first = await endDuplicates(factory);
        await endLegacy(factory);
        const content = JSON.stringify(props);
        const staleDate = props.rest ? new Date(props.rest.endsAt) : undefined;
        if (!first) factory.start(props, undefined, staleDate);
        else if (lastContent !== content) await first.update(props, staleDate);
        lastContent = content;
      });
    },
    /** End every workout card and every legacy rest card. */
    stop,
    /** At boot, on foreground and when the logger unmounts: no open workout ends the card; an open one keeps it (the logger syncs it). */
    reconcile(hasOpenSession: () => Promise<boolean>): Promise<void> {
      return enqueue(async () => {
        const factory = load();
        if (!factory) return;
        if (!(await hasOpenSession())) return endAll(factory);
        await endDuplicates(factory);
        await endLegacy(factory);
      });
    },
  };
}
