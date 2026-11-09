// The three reminder tones. The keys match the backend's ai.REMINDER_TONES.
// The agent picks one by how late the invoice is (up to 3 days friendly, up to 14 firm, then final).
export const TONES = [
  {
    key: "friendly",
    label: "Friendly",
    hint: "A warm, gentle nudge",
    badge: "bg-highlight/15 text-success ring-highlight/30",
  },
  {
    key: "firm",
    label: "Firm",
    hint: "Polite but direct",
    badge: "bg-warning/12 text-warning ring-warning/25",
  },
  {
    key: "final",
    label: "Final",
    hint: "A formal final notice",
    badge: "bg-destructive/10 text-destructive ring-destructive/25",
  },
];

export function toneMeta(key) {
  return TONES.find((tone) => tone.key === key) ?? TONES[0];
}
