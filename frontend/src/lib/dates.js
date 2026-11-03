// The backend stores due dates as "YYYY-MM-DD" text.
// We add "T00:00:00" so the browser reads it as a local date (not UTC, which can shift the day).
export function formatDate(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
