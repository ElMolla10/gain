/**
 * Free vs paid scaffold (Step 24). **There is NO billing in this app**: no purchase library, no store call, no network call, no server entitlement.
 * Everything is OFF by default and nothing in the app asks `isUnlocked`: every feature works for everyone, as before.
 * This file only holds the split from docs/PRODUCT.md (Price) so that, when a decision to charge is made (after the pilot, Step 20 / D9),
 * the gate points and the "limit shown before purchase" text already exist and are tested. Prices are NOT set here.
 */
export const PLAN_FLAGS = {
  /** When true, `isUnlocked` starts locking the paid features for people without an entitlement. Off. */
  paywallEnabled: false,
  /** When true, Settings shows a "Plans (preview)" row that opens the page describing the split. Off. */
  planPreviewVisible: false,
} as const;

export type PlanFlags = { readonly paywallEnabled: boolean; readonly planPreviewVisible: boolean };

/**
 * Free: logging, history, one template, basic charts, own-data export, and the next-weight recommendation with its reason (P31: the core
 * promise of the app is never behind a paywall). Records stay after cancel (PRODUCT.md, Price).
 */
export const FREE_FEATURES = ["logging", "history", "one_template", "basic_charts", "export_own_data", "next_session_targets", "gym_aware_increments"] as const;
/** Paid (only if a decision to charge is made after the pilot): goal pace, short-week rebuild, weekly decision. */
export const PAID_FEATURES = ["goal_pace", "short_week_rebuild", "weekly_decision"] as const;

export type FreeFeature = (typeof FREE_FEATURES)[number];
export type PaidFeature = (typeof PAID_FEATURES)[number];
export type Feature = FreeFeature | PaidFeature;

export const isPaidFeature = (f: Feature): f is PaidFeature => (PAID_FEATURES as readonly string[]).includes(f);

/**
 * Is the feature available? With the paywall flag off (the default) everything is. Free features are always available, flag or not.
 * `entitled` would come from a server-checked entitlement; no such thing exists yet, so callers pass false.
 */
export function isUnlocked(feature: Feature, entitled = false, flags: PlanFlags = PLAN_FLAGS): boolean {
  if (!flags.paywallEnabled) return true;
  if (!isPaidFeature(feature)) return true;
  return entitled;
}

/** The records a lifter logged never go behind the paywall, whatever happens to the subscription. */
export const RECORDS_STAY_AFTER_CANCEL = true;
