# Paywall scaffold (Step 24, scaffold only)

Status: **built and unit-tested; OFF; no billing exists.** Not a price test, not a purchase flow.

- `apps/mobile/src/logic/plans.ts`: the split from PRODUCT.md (free: logging, history, one template, basic charts, own-data export, next-session targets, standard weight steps (P31: the next-weight recommendation stays free); paid, only if a decision to charge is made: goal pace, short-week rebuild, weekly decision), two flags (`paywallEnabled`, `planPreviewVisible`, both `false`), and `isUnlocked(feature, entitled, flags)` which returns true for everything while the paywall flag is off.
- `PlansScreen`: lists what would be free and what would be paid and says the limit before any purchase; says nothing is for sale; no price, no button, no network. Reachable from Settings only when `planPreviewVisible` is switched on in code (it is not).
- Nothing in the app calls `isUnlocked`: no feature is gated. A test fails if a screen starts using it before this is decided, and another fails if a billing library or store call appears.
- Records stay available after cancel: `RECORDS_STAY_AFTER_CANCEL`, and a future gate must never cover logging, history or export.

Not done (needs accounts, payments or Mohamed): Play Billing or RevenueCat (D9), server-checked entitlement, trial, annual-first price page, prices (fees, tax and Egyptian payment methods are unknown), licence-tester purchase/cancel/restore. PRODUCT.md says to gate only after the pilot (Step 20).
