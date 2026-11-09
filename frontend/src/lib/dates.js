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

// "just now", "5 minutes ago", "2 hours ago", "3 days ago" from a full ISO timestamp
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, size] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${name}${value === 1 ? "" : "s"} ago`;
  }
  return "1 minute ago";
}
