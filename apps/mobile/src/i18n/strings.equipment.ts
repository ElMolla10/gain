export const enEquipment = { "today.equipment.each": "{load} each", "today.equipment.single": "One dumbbell: {load}" } as const;
export const arEquipment: Record<keyof typeof enEquipment, string> = { "today.equipment.each": "{load} \u0644\u0643\u0644 \u062f\u0645\u0628\u0644", "today.equipment.single": "\u062f\u0645\u0628\u0644 \u0648\u0627\u062d\u062f: {load}" };
