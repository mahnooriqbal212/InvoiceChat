// From which day overdue the collections agent uses each tone.
// Keep these rules and messages the same as ToneDays in backend/app/models.py,
// so the browser and the server never disagree.
export const TONE_DAYS_MAX = 365;
export const TONE_DAY_FIELDS = ["friendly", "firm", "final"];

// Form values are text (from number inputs). Returns {} when everything is fine.
export function validateToneDays(form) {
  const errors = {};
  const values = {};
  for (const key of TONE_DAY_FIELDS) {
    const text = String(form[key] ?? "").trim();
    const number = Number(text);
    if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(number)) errors[key] = "Enter a whole number of days.";
    else if (number > TONE_DAYS_MAX) errors[key] = `Use ${TONE_DAYS_MAX} days or fewer.`;
    else values[key] = number;
  }
  if (Object.keys(errors).length) return errors;
  if (values.friendly < 1) errors.friendly = "Friendly must start at day 1 or later.";
  else if (values.firm <= values.friendly) errors.firm = "Firm must start after the friendly day.";
  else if (values.final <= values.firm) errors.final = "Final must start after the firm day.";
  return errors;
}

export function toToneDays(form) {
  return Object.fromEntries(TONE_DAY_FIELDS.map((key) => [key, Number(String(form[key]).trim())]));
}

// "days 1–3" / "day 3" / "day 15 onwards": the range each tone covers
export function toneRanges(rules) {
  const span = (from, to) => (from === to ? `day ${from}` : `days ${from}–${to}`);
  return {
    friendly: span(rules.friendly, rules.firm - 1),
    firm: span(rules.firm, rules.final - 1),
    final: `day ${rules.final} onwards`,
  };
}
