// Presentation-tree helpers for the round-2 achievement components (no renderer: function components are called with mocked hooks).
// Kept free of a `react` import so a test's vi.mock("react") factory can use `mockReactHooks` without a cycle.

type El = { $$typeof: symbol; type: unknown; props: Record<string, any>; key: unknown };
const FRAGMENT = Symbol.for("react.fragment");
const isEl = (v: unknown): v is El => !!v && typeof v === "object" && typeof (v as El).$$typeof === "symbol" && "props" in (v as object);

/** Hooks that work outside a renderer: state keeps its initial value, effects do not run, refs are fresh objects. */
export function mockReactHooks<R extends Record<string, unknown>>(real: R, extra: Record<string, unknown> = {}) {
  const hooks = {
    useState: <T,>(v: T | (() => T)) => [typeof v === "function" ? (v as () => T)() : v, () => {}] as const,
    useRef: <T,>(v: T) => ({ current: v }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: <T,>(fn: () => T) => fn(),
    useCallback: <T,>(fn: T) => fn,
    useId: () => ":r1:",
    ...extra,
  };
  const base = (real as { default?: Record<string, unknown> }).default ?? real;
  return { ...real, ...hooks, default: { ...base, ...hooks } };
}

/** Expand function components (calling them with their props) into a tree of host elements. */
export function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (!isEl(value)) return value;
  if (typeof value.type === "function") {
    const fn = value.type as (p: Record<string, any>) => unknown;
    return expand(fn(value.props));
  }
  if (value.type === FRAGMENT) return expand(value.props.children);
  return { ...value, props: { ...value.props, children: expand(value.props.children) } };
}

export type Node = El;
/** Every host element in the tree, depth first. */
export function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isEl(value)) return [];
  return [value, ...nodes(value.props.children)];
}

/** Every string rendered inside AppText (joined per element). */
export function texts(value: unknown): string[] {
  return nodes(value)
    .filter((n) => n.type === "AppText")
    .map((n) => flat(n.props.children));
}

export function flat(children: unknown): string {
  if (children === null || children === undefined || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(flat).join("");
  return "";
}

export const byType = (tree: unknown, type: string): Node[] => nodes(tree).filter((n) => n.type === type);
