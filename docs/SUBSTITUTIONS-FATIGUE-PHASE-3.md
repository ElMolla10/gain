# Phase 3: substitutions, fatigue and prescription edge cases

## Replacement picker

- The active workout's Replace picker offers up to three similar exercises ahead of the full searchable library.
- Candidates must match movement pattern, measurement (reps/time/distance) and setup (free/assisted/bodyweight plus added), and must not already be displayed in the workout. An unknown `other` pattern yields no suggestions.
- Prefer matching equipment and catalogue muscle metadata; preserve library order for ties. Availability means a configured equipment category or an explicit per-exercise load grid, not proof that a particular machine exists or is free. The lifter confirms suitability.
- Suggestions never infer a strength ratio or copy the outgoing lift's weights. The existing target builder reads the replacement's own exercise/gym/setup history. A lift without usable history can start with an empty load.
- Opening the picker resets search/filter state. Today-only and permanent replacement choices remain explicit, and exercises with logged sets remain protected from replacement.

## Prescription corrections

Today-only replacements now use the replacement's actual movement pattern and load grid. Previously the display could inherit the outgoing exercise's custom grid. The library query now supplies each exercise's configured grid.

Set count is preserved. A change in measurement resets the quantity range: 30–60 seconds, 20–40 metres, or 6–10 reps when returning to rep work. Rep-only top/back-off and effort settings are cleared for timed/distance work. Goal and custom rep-ceiling flags do not transfer to a different lift. The same range/reset rules apply to the permanent program replacement. Same-measure replacements retain the program's range and applicable set scheme.

No database migration or inferred cross-exercise load conversion is introduced.

## Observed fatigue

For a target minimum of at least four reps, an observed collapse from at least six first-set reps to at most two reps after two or more working sets can trigger the existing stop/reassess message before model inference. Two consecutive sets of at most two reps at comparable loads can also trigger the message when the target minimum is at least four. The phone counts them from actual logged working sets. A model failure or optimistic prediction cannot override those observations.

The phone supplies the first and previous working-set weights. The collapse comparison applies at the same or a lighter load; a deliberate heavier set is not treated as comparable. Low-rep targets remain supported. Legacy callers without observed load metadata retain the earlier assumption of comparability.

An observed-only stop explicitly marks its forecast unavailable. It is not displayed or scored as a model prediction. Explicit pain/dizziness stops also run before inference. These rules are conservative prompts to reassess, not medical diagnoses or calibrated safety guarantees.

## Existing progression checks retained

The deterministic engine already reverses assistance progression, separates gym/setup histories, accounts for known bodyweight in added-load jump ratios, handles coarse equipment steps and respects real minimum bar loads in warm-ups. Those behaviors were verified through existing regression tests rather than reimplemented. Phase 1's increase-eligibility safeguards remain.

## Validation limits

Automated coverage includes candidate filtering/ranking, unknown patterns, own grids, quantity resets, permanent replacement persistence, observed fatigue before failed/optimistic inference, heavier-set and low-rep exceptions, model-output presentation, and existing progression/warm-up behavior.

Native verification on the updated iPhone remains pending: picker layout and Arabic/search behavior, today-only and permanent swap/resume flows, custom-grid logging, time/distance inputs and warning presentation. No real-user model accuracy or substitution-strength ratio is claimed.
