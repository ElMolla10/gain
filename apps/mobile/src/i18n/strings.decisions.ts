/**
 * Strings for the decision log. English is the source.
 * ARABIC IS A DRAFT TRANSLATION (Egyptian-leaning): needs review by Egyptian lifters.
 */
export const enDecisions = {
  "dec.entry": "Decision log",
  "dec.title": "Decision log",
  "dec.intro": "Every weight I suggested, with what you did about it. Tap one to see the numbers it came from.",
  "dec.all": "All lifts",
  "dec.empty": "No decisions yet. They are written when you finish a workout.",
  "dec.more": "Show older decisions",
  "dec.target": "Suggested: {load} × {reps}",
  "dec.noTarget": "Suggested: no number (not enough history)",
  "dec.rule": "Rule {version}, {path}",
  "dec.path.rule": "fixed rule",
  "dec.path.model": "model",
  "dec.confidence": "Confidence: {c}",
  "dec.action.proposed": "Not answered yet",
  "dec.action.proposedDone": "You did not answer; you trained anyway",
  "dec.action.accepted": "You accepted it",
  "dec.action.edited": "You changed it to {load}",
  "dec.action.rejected": "You declined it",
  "dec.for": "For {day}",
  "dec.why": "Why this weight?",
} as const;

export const arDecisions: Record<keyof typeof enDecisions, string> = {
  "dec.entry": "سجل القرارات",
  "dec.title": "سجل القرارات",
  "dec.intro": "كل وزن اقترحته، مع اللي عملته فيه. اضغط على واحد تشوف الأرقام اللي طلع منها.",
  "dec.all": "كل الحركات",
  "dec.empty": "لسه مفيش قرارات. بتتسجل لما تخلّص تمرينة.",
  "dec.more": "اعرض قرارات أقدم",
  "dec.target": "المقترح: {load} × {reps}",
  "dec.noTarget": "المقترح: مفيش رقم (التاريخ مش كفاية)",
  "dec.rule": "القاعدة {version}، {path}",
  "dec.path.rule": "قاعدة ثابتة",
  "dec.path.model": "نموذج",
  "dec.confidence": "الثقة: {c}",
  "dec.action.proposed": "لسه مردّتش",
  "dec.action.proposedDone": "مردّتش، وتمرنت برضه",
  "dec.action.accepted": "قبلته",
  "dec.action.edited": "غيّرته لـ {load}",
  "dec.action.rejected": "رفضته",
  "dec.for": "لـ {day}",
  "dec.why": "ليه الوزن ده؟",
};
