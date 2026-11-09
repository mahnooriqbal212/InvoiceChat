import { useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, CircleMinus, History } from "lucide-react";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";

// What the agent did on its last run: how many overdue invoices it checked, drafted and skipped (and why).
export default function AgentRunSummary({ result, ranAt, fresh }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  const { checked, drafted = [], skipped = [], errors = [] } = result;
  const details = [
    ...drafted.map((d) => ({ icon: CircleCheck, tone: "text-success", client: d.client, text: d.reason })),
    ...skipped.map((s) => ({ icon: CircleMinus, tone: "text-muted-foreground", client: s.client, text: `Skipped: ${s.reason}.` })),
    ...errors.map((e) => ({ icon: CircleAlert, tone: "text-destructive", client: e.client, text: e.error })),
  ];

  let headline;
  if (checked === 0) headline = "No overdue invoices. Nothing to do.";
  else if (drafted.length === 0) headline = `Checked ${checked} overdue invoice${checked === 1 ? "" : "s"}. No new drafts needed.`;
  else headline = `Drafted ${drafted.length} reminder${drafted.length === 1 ? "" : "s"} from ${checked} overdue invoice${checked === 1 ? "" : "s"}.`;

  return (
    <section
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        fresh && "animate-in fade-in-0 slide-in-from-top-2 duration-500",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={details.length === 0}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <History className="size-4" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">{headline}</span>
          <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {ranAt && <span>Last run {timeAgo(ranAt)}</span>}
            <span className="text-success">{drafted.length} drafted</span>
            <span>{skipped.length} skipped</span>
            {errors.length > 0 && <span className="text-destructive">{errors.length} failed</span>}
          </span>
        </span>
        {details.length > 0 && (
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        )}
      </button>
      {open && (
        <ul className="grid gap-2 border-t px-4 py-3 text-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {details.map((d, i) => (
            <li key={i} className="flex items-start gap-2">
              <d.icon className={cn("mt-0.5 size-4 shrink-0", d.tone)} />
              <span>
                <span className="font-medium">{d.client}</span> <span className="text-muted-foreground">{d.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
