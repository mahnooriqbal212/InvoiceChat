import { useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { dueHint, itemsSummary } from "@/lib/invoiceStatus";

const PAGE = 10;

// The phone version of the table: one tappable card per invoice.
export default function InvoiceCardList({ rows, emptyMessage, onOpen }) {
  const [shown, setShown] = useState(PAGE);

  if (rows.length === 0) {
    return (
      <div data-slot="card" className="grid justify-items-center gap-2 rounded-xl bg-card p-8 text-center text-muted-foreground ring-1 ring-foreground/10">
        <Inbox className="size-6" />
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {rows.slice(0, shown).map((invoice) => {
          const hint = dueHint(invoice);
          return (
            <li key={invoice.id}>
              <button
                type="button"
                onClick={() => onOpen(invoice)}
                data-slot="card"
                className="flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{invoice.client_name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMoney(invoice.total, invoice.currency)}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{itemsSummary(invoice.items)}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs">
                    <StatusBadge status={invoice.display_status} />
                    <span className="text-muted-foreground">Due {formatDate(invoice.due_date)}</span>
                    {hint && <span className={hint.tone}>· {hint.text}</span>}
                    {invoice.is_demo && <span className="text-muted-foreground">· Sample</span>}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > shown && (
        <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({rows.length - shown} left)
        </Button>
      )}
    </div>
  );
}
