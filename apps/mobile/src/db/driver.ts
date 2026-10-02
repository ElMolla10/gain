/**
 * Minimal async SQL interface. The app uses expo-sqlite behind it (expoDriver.ts); unit tests use node:sqlite
 * (test/nodeDriver.ts). Everything above this line is plain SQL, so the DB layer is testable on Linux without a device.
 */
export type Param = string | number | null;
export type Row = Record<string, string | number | null>;

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: Param[]): Promise<T | null>;
  /** All-or-nothing. The callback should await its statements one after another. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Clock {
  now(): number;
}
export type IdGen = () => string;
export interface Deps {
  newId: IdGen;
  now: () => number;
}

/**
 * Runs async jobs one at a time, in order. Drivers use it so two transactions never interleave
 * (e.g. a double tap on "Start workout"). Transactions must therefore not be nested.
 */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(job: () => Promise<T>): Promise<T> {
    const result = tail.then(job, job);
    tail = result.catch(() => undefined);
    return result;
  };
}
