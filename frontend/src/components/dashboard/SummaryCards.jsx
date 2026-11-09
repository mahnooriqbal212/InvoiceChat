import { CircleCheck, Clock, FilePen, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

const CARDS = [
  { key: "PAID", label: "Paid", icon: CircleCheck, tone: "text-success", glow: "bg-success" },
  { key: "PENDING", label: "Pending", icon: Clock, tone: "text-warning", glow: "bg-warning" },
  { key: "OVERDUE", label: "Overdue", icon: TriangleAlert, tone: "text-destructive", glow: "bg-destructive" },
  { key: "DRAFT", label: "Drafts", icon: FilePen, tone: "text-muted-foreground", glow: "bg-muted-foreground" },
];

// Adds up invoices per status AND per currency. Different currencies are never added together.
function summarize(invoices) {
  const out = {};
  for (const card of CARDS) out[card.key] = { count: 0, byCurrency: {} };
  for (const invoice of invoices) {
    const bucket = out[invoice.display_status];
    if (!bucket) continue; // cancelled invoices are not counted
    bucket.count += 1;
    bucket.byCurrency[invoice.currency] = (bucket.byCurrency[invoice.currency] ?? 0) + invoice.total;
  }
  return out;
}

// Four cards at the top. Clicking a card filters the table to that status.
export default function SummaryCards({ invoices, active, onSelect }) {
  const summary = summarize(invoices);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, tone, glow }) => {
        const { count, byCurrency } = summary[key];
        // Biggest amount first
        const amounts = Object.entries(byCurrency).sort((a, b) => b[1] - a[1]);
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(selected ? "ALL" : key)}
            aria-pressed={selected}
            data-slot="card"
            className={cn(
              "group relative grid min-w-0 content-start gap-3 overflow-hidden rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-all outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5",
              selected && "ring-2 ring-primary",
            )}
          >
            <span aria-hidden className={cn("pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20", glow)} />
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <span className={cn("grid size-8 place-items-center rounded-lg bg-current/10", tone)}>
                <Icon className="size-4" />
              </span>
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                {amounts.length > 0 ? formatMoney(amounts[0][1], amounts[0][0]) : "—"}
              </span>
              {amounts.length > 1 && (
                <span className="truncate text-xs text-muted-foreground tabular-nums" title={amounts.slice(1).map(([c, v]) => formatMoney(v, c)).join(" · ")}>
                  + {amounts.slice(1).map(([c, v]) => formatMoney(v, c)).join(" · ")}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {count} invoice{count === 1 ? "" : "s"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
