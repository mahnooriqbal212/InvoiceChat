import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot,
  CircleCheckBig,
  Clock,
  Inbox,
  LayoutDashboard,
  Loader2,
  MailCheck,
  PenLine,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ReminderCard from "@/components/agent/ReminderCard";
import AgentRunSummary from "@/components/agent/AgentRunSummary";
import ToneRulesDialog from "@/components/agent/ToneRulesDialog";
import { getAgentQueue, getAgentStatus, getToneDays, listInvoices, runAgent } from "@/api/invoices";
import { toneRanges } from "@/lib/toneDays";
import { getErrorMessage } from "@/api/client";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Search, title: "Finds overdue invoices", text: "Sent, unpaid and past the due date." },
  { key: "draft", icon: PenLine, title: "Drafts a reminder", text: "Friendly, firm or final, depending on how late it is." },
  { icon: ShieldCheck, title: "You approve", text: "Nothing reaches your client without you." },
];

// Seconds left until the agent may run again. The server tells us the number; we count down locally.
function useCountdown(seconds, fetchedAt) {
  const [now, setNow] = useState(() => Date.now());
  const elapsed = Math.max(0, now - (fetchedAt || now)) / 1000;
  const left = Math.max(0, Math.ceil((seconds ?? 0) - elapsed));
  useEffect(() => {
    if (left <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left]);
  return left;
}

export default function AgentQueue() {
  const queryClient = useQueryClient();
  const [lastRun, setLastRun] = useState(null); // the result of a run started on this visit

  const queue = useQuery({ queryKey: ["agent-queue"], queryFn: getAgentQueue, retry: 1 });
  const status = useQuery({ queryKey: ["agent-status"], queryFn: getAgentStatus, retry: 1 });
  const toneDays = useQuery({ queryKey: ["tone-days"], queryFn: getToneDays, retry: 1 });
  const ranges = toneDays.data ? toneRanges(toneDays.data) : null;
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, retry: 1, refetchInterval: 15000 });

  const cooldown = useCountdown(status.data?.cooldown_seconds, status.dataUpdatedAt);

  const run = useMutation({
    mutationFn: runAgent,
    onSuccess: (result) => {
      setLastRun(result);
      const n = result.drafted.length;
      if (n > 0) toast.success(`The agent drafted ${n} reminder${n === 1 ? "" : "s"}`, { description: "Review them below." });
      else toast(result.checked ? "No new drafts needed" : "No overdue invoices", { description: "See the run summary for details." });
      if (result.errors.length) toast.error(`${result.errors.length} draft${result.errors.length === 1 ? "" : "s"} failed. Try again later.`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-queue"] });
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const all = invoices.data ?? [];
  const overdueCount = all.filter((i) => i.display_status === "OVERDUE").length;
  const remindersSent = all.reduce((sum, i) => sum + (i.reminders?.length ?? 0), 0);
  const drafts = queue.data ?? [];
  const summary = lastRun ?? status.data?.last_result;
  const loadError = queue.error && !queue.data;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {/* Title row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-highlight" /> AI collections agent
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Agent queue</h1>
          <p className="max-w-xl text-sm text-pretty text-muted-foreground">
            The agent drafts polite payment reminders for overdue invoices. It never sends anything: every message waits here
            for your approval.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start">
          <ToneRulesDialog rules={toneDays.data} />
          <RunButton running={run.isPending} cooldown={cooldown} onRun={() => run.mutate()} />
        </div>
      </div>

      {/* How it works */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text, key }, i) => (
          // Step 2 shows the current tone rules
          <li
            key={title}
            style={{ animationDelay: `${i * 80}ms` }}
            className="flex items-start gap-3 rounded-xl border border-dashed bg-card/50 p-3 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
              <Icon className="size-4" />
            </span>
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">
                <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {title}
              </span>
              <span className="text-xs text-muted-foreground">
                {key === "draft" && ranges ? `Friendly ${ranges.friendly}, firm ${ranges.firm}, final ${ranges.final} overdue.` : text}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={TriangleAlert} label="Overdue" value={overdueCount} tone="text-destructive" loading={invoices.isPending} />
        <Stat icon={Clock} label="Waiting" value={drafts.length} tone="text-warning" loading={queue.isPending} />
        <Stat icon={MailCheck} label="Sent" value={remindersSent} tone="text-success" loading={invoices.isPending} />
      </div>

      {run.isPending && <AgentWorking />}
      {!run.isPending && summary && (
        <AgentRunSummary result={summary} ranAt={status.data?.last_run_at} fresh={!!lastRun} />
      )}

      {/* The approval queue */}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Waiting for your approval
          <span className="rounded-full bg-foreground/8 px-2 text-xs tabular-nums">{drafts.length}</span>
        </h2>

        {queue.isPending && <QueueSkeleton />}
        {loadError && <LoadError error={queue.error} onRetry={() => queue.refetch()} retrying={queue.isFetching} />}
        {queue.data && drafts.length === 0 && (
          <EmptyQueue overdue={overdueCount} cooldown={cooldown} running={run.isPending} onRun={() => run.mutate()} />
        )}
        {drafts.length > 0 && (
          <div className="grid gap-4">
            {drafts.map((invoice, index) => (
              <ReminderCard key={invoice.id} invoice={invoice} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RunButton({ running, cooldown, onRun }) {
  const waiting = cooldown > 0 && !running;
  return (
    <div className="grid gap-1 sm:justify-items-end">
      <Button size="lg" className="relative px-5" disabled={running || waiting} onClick={onRun}>
        {running ? <Loader2 className="animate-spin" /> : <Bot />}
        {running ? "Agent is working…" : waiting ? `Run again in ${cooldown}s` : "Run agent"}
      </Button>
      <span className="text-xs text-muted-foreground sm:text-right">
        {waiting ? "The agent can run once a minute." : "Checks every overdue invoice."}
      </span>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, loading }) {
  return (
    <div data-slot="card" className="grid gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
        {label}
        <Icon className={cn("size-4", tone)} />
      </span>
      {loading ? (
        <Skeleton className="h-7 w-10" />
      ) : (
        <span key={value} className="text-2xl font-semibold tracking-tight tabular-nums animate-in fade-in-0 zoom-in-95 duration-300">
          {value}
        </span>
      )}
    </div>
  );
}

// Shown while the agent runs (each draft is an AI call, so a run can take a little while)
function AgentWorking() {
  return (
    <Card className="[--card-spacing:--spacing(5)] animate-in fade-in-0 duration-300" role="status">
      <CardContent className="flex items-center gap-4">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <span className="absolute inset-0 animate-ping rounded-xl bg-highlight/25" />
          <Bot className="relative size-5" />
        </span>
        <div className="grid flex-1 gap-2">
          <p className="text-sm font-medium">Checking overdue invoices and writing reminders…</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-[agent-progress_1.4s_ease-in-out_infinite] rounded-full bg-highlight" />
          </div>
          <p className="text-xs text-muted-foreground">This can take up to a minute when there are many invoices.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyQueue({ overdue, cooldown, running, onRun }) {
  const caughtUp = overdue === 0;
  return (
    <Card className="[--card-spacing:--spacing(10)] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardContent className="grid justify-items-center gap-4 text-center">
        <span className={cn("grid size-14 place-items-center rounded-2xl", caughtUp ? "bg-success/12 text-success" : "bg-accent text-accent-foreground")}>
          {caughtUp ? <CircleCheckBig className="size-7" /> : <Inbox className="size-7" />}
        </span>
        <div className="grid max-w-md gap-1.5">
          <h3 className="text-lg font-semibold tracking-tight">{caughtUp ? "All caught up" : "No drafts waiting"}</h3>
          <p className="text-sm text-muted-foreground">
            {caughtUp
              ? "No invoice is overdue, so there is nothing to chase. New drafts appear here when an invoice passes its due date."
              : `${overdue} invoice${overdue === 1 ? " is" : "s are"} overdue. Run the agent to draft reminders, or check the run summary to see why some were skipped.`}
          </p>
        </div>
        {caughtUp ? (
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <LayoutDashboard /> Open dashboard
            </Link>
          </Button>
        ) : (
          <Button onClick={onRun} disabled={running || cooldown > 0}>
            {running ? <Loader2 className="animate-spin" /> : <Bot />}
            {cooldown > 0 ? `Run again in ${cooldown}s` : "Run agent"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function LoadError({ error, onRetry, retrying }) {
  return (
    <Card className="[--card-spacing:--spacing(8)]">
      <CardContent role="alert" className="grid justify-items-center gap-3 text-center">
        <WifiOff className="size-6 text-muted-foreground" />
        <div className="grid gap-1">
          <h3 className="font-semibold">Couldn't load the queue</h3>
          <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
        </div>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 className="animate-spin" /> : <RotateCw />} Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-4">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}
