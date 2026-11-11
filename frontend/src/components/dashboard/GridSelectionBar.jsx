import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { draftReminder, getToneDays } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { csvFileName, EXPORT_COLUMNS } from "@/lib/invoiceCsv";
import { daysOverdue } from "@/lib/invoiceStatus";
import { pickTone } from "@/lib/toneDays";

// Same limit as the agent (MAX_PER_RUN): each draft is one AI call on the free Groq quota.
const MAX_DRAFTS = 10;

// Shown above the grid while rows are ticked: export them, or ask the AI to draft reminders
// for the overdue ones. Drafts wait in the Agent queue; nothing is sent to anyone from here.
export default function GridSelectionBar({ selected, api, onDone }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null); // { done, total } while drafting

  const overdue = selected.filter((invoice) => invoice.display_status === "OVERDUE");
  const waiting = overdue.filter((invoice) => invoice.reminder_status === "DRAFTED");
  const toDraft = overdue.filter((invoice) => invoice.reminder_status !== "DRAFTED");
  const busy = progress !== null;
  const s = (n) => (n === 1 ? "" : "s");

  function exportSelected() {
    api.exportDataAsCsv({
      fileName: csvFileName(),
      columnKeys: EXPORT_COLUMNS.map((c) => c.id),
      onlySelected: true,
      onlySelectedAllPages: true, // also the ticked rows on other pages
      skipPinnedBottom: true, // not the totals rows
    });
    toast.success(`Exported ${selected.length} selected invoice${s(selected.length)}`);
  }

  async function draftReminders() {
    const batch = toDraft.slice(0, MAX_DRAFTS);
    setProgress({ done: 0, total: batch.length });
    let rules;
    try {
      rules = await queryClient.fetchQuery({ queryKey: ["tone-days"], queryFn: getToneDays, staleTime: 30_000 });
    } catch (error) {
      toast.error(getErrorMessage(error));
      setProgress(null);
      return;
    }

    let drafted = 0;
    const failures = [];
    // One at a time, so the AI is not hit with many requests at once
    for (const invoice of batch) {
      try {
        await draftReminder(invoice.id, pickTone(daysOverdue(invoice), rules));
        drafted++;
      } catch (error) {
        failures.push(`${invoice.client_name}: ${getErrorMessage(error)}`);
      }
      setProgress({ done: drafted + failures.length, total: batch.length });
    }
    setProgress(null);
    queryClient.invalidateQueries({ queryKey: ["agent-queue"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });

    const extra = toDraft.length - batch.length;
    if (drafted) {
      toast.success(`Drafted ${drafted} reminder${s(drafted)}`, {
        description:
          "They wait in the Agent queue for your approval. Nothing was sent." +
          (extra > 0 ? ` ${extra} more selected: run it again for the next ${Math.min(extra, MAX_DRAFTS)}.` : ""),
        action: { label: "Open queue", onClick: () => navigate("/agent") },
      });
      onDone(); // clear the ticks
    }
    if (failures.length) {
      toast.error(`${failures.length} reminder${s(failures.length)} could not be drafted`, { description: failures[0] });
    }
  }

  let draftHint = "Tone follows your tone rules. Drafts wait in the Agent queue; nothing is sent.";
  if (overdue.length === 0) draftHint = "Reminders are only for overdue invoices. None of the selected ones are overdue.";
  else if (toDraft.length === 0) draftHint = "Every selected overdue invoice already has a draft waiting in the Agent queue.";
  else if (waiting.length) draftHint = `${waiting.length} already ${waiting.length === 1 ? "has a draft" : "have drafts"} waiting, so ${waiting.length === 1 ? "it is" : "they are"} skipped.`;

  return (
    <div
      role="region"
      aria-label="Selected invoices"
      className="flex flex-col gap-2 border-b bg-accent/35 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">
          {selected.length} selected
          {overdue.length > 0 && <span className="text-destructive"> · {overdue.length} overdue</span>}
        </span>
        <span className="text-xs text-muted-foreground">{draftHint}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportSelected} disabled={busy}>
          <Download /> Export selected
        </Button>
        <Button size="sm" onClick={draftReminders} disabled={busy || toDraft.length === 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {busy
            ? `Drafting ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} of ${progress.total}…`
            : `Draft reminder${s(Math.min(toDraft.length, MAX_DRAFTS))}${toDraft.length ? ` (${Math.min(toDraft.length, MAX_DRAFTS)})` : ""}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={busy} title="Clear selection">
          <X /> Clear
        </Button>
      </div>
    </div>
  );
}
