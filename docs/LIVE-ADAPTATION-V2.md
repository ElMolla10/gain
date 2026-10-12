# Live Adaptation v2 — integration status

This branch adds the pure TypeScript inference and recommendation-policy foundation. **It is not yet connected to the workout logger and must not be merged as a finished feature.**

The trained synthetic-data model and exact feature schema are in the GAIN Live Adaptation integration kit shared in ChatGPT. Copy `model.json`, `schema.json`, and `reference-predictions.json` from that kit into a suitable offline asset directory; do not fetch from the network.

Next:
1. Build the 20 input features from **pre-set** workout history; encode `load_convention` using the bundled schema. Never substitute 0 for missing history.
2. Load model lazily, cache it, and benchmark Android startup/inference.
3. Add 10 parity tests against the exported Python reference predictions (delta tolerance 0.0001).
4. Wire the result into the active logger after confirmed working sets, with existing rules as fallback, and allow manual overrides.
5. Snap recommended loads to actual available gym equipment. The policy's 5% decrease is only a placeholder and should not be used directly in UI.
6. Test bodyweight/assisted exercises, first sets, missing history, drop sets, rest changes, and reported pain/dizziness.
7. Evaluate real logged sessions; all current model accuracy claims are synthetic-only.

## Install exact Kaggle model

Extract the provided `gain-live-adaptation-integration-kit.zip` alongside the repository, then from the repository root run:

```bash
node scripts/install-live-adaptation-model.mjs ../gain-live-adaptation-kit/model
npm run test:engine
npm run typecheck
npm test
npm run export:android -w @gain/mobile
```

Commit the three installed files under `packages/engine/assets/live-adaptation-v2/` to this branch. The reference parity test is skipped when the model is absent; do **not** consider a green CI run proof of trained-model parity until these assets are committed and the parity test executes.

The repository currently has **no trained model asset**, so the active logger must not claim to display ML recommendations. Once bundled, add the lazy-loaded asset adapter, the logger integration, equipment-aware load snapping, and a fallback for incomplete history. The model does not infer injury risk.
