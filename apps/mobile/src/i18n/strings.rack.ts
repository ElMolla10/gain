/**
 * Strings for the logger 10x, "The Rack" (design pack /workspace/plate/design-10x/02-logger). English is the source.
 * Every Arabic string here is a DRAFT for native review (marked `// DRAFT ar`).
 */
export const enRack = {
  "load.change.add": "+{plates} each side",
  "load.change.strip": "Strip the {plates}s",
  "load.change.swap": "Swap {from} for {to} each side",
  "load.change.bar": "Bar only",
  "load.change.nearest": "Nearest you can load: {load}",
  "load.change.horn": "+{plates} on each horn",
  "load.change.grab": "Grab the {load}s",
  "load.change.pin": "Pin to {load}",
  "load.change.stack": "{load} on the stack",
  "load.change.assist": "Assistance {from} {arrow} {to} (less is stronger)",
  "load.change.work": "{change}: work sets",
  "load.change.backoff": "{change}: back-off sets",
} as const;

export const arRack: Record<keyof typeof enRack, string> = {
  // DRAFT ar
  "load.change.add": "حمّل {plates} في كل ناحية",
  // DRAFT ar
  "load.change.strip": "شيل الـ{plates}",
  // DRAFT ar
  "load.change.swap": "بدّل {from} بـ{to} في كل ناحية",
  // DRAFT ar
  "load.change.bar": "البار فاضي",
  // DRAFT ar
  "load.change.nearest": "أقرب وزن تقدر تحمّله: {load}",
  // DRAFT ar
  "load.change.horn": "حمّل {plates} على كل ناحية",
  // DRAFT ar
  "load.change.grab": "هات الـ{load}",
  // DRAFT ar
  "load.change.pin": "حط البن على {load}",
  // DRAFT ar
  "load.change.stack": "{load} على الستاك",
  // DRAFT ar
  "load.change.assist": "المساعدة {from} {arrow} {to} (الأقل أقوى)",
  // DRAFT ar
  "load.change.work": "{change}: المجموعات الأساسية",
  // DRAFT ar
  "load.change.backoff": "{change}: مجموعات أخف",
};
