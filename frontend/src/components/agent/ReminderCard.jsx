import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Loader2, Mail, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dismissReminder, draftReminder, sendReminder } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { dueHint } from "@/lib/invoiceStatus";
import { TONES, toneMeta } from "@/lib/reminderTones";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 4000; // same limit as the backend's ReminderSend model

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// One reminder draft waiting for approval. The freelancer can change the tone (the AI rewrites it),
// edit the text, copy it or open it in their email app, then approve it or dismiss it.
// Nothing is sent to the client by InvoiceChat.
export default function ReminderCard({ invoice, index }) {
  const queryClient = useQueryClient();
  const serverDraft = invoice.reminder_draft ?? "";
  const [text, setText] = useState(serverDraft);
  const [base, setBase] = useState(serverDraft); // the server's text that the box was filled from
  const [newVersion, setNewVersion] = useState(null); // a newer server text, waiting because you edited the box
  const [leaving, setLeaving] = useState(null); // "approved" | "dismissed" while the card animates out

  // The agent can rewrite this draft (for example after the tone rules changed). If you have not
  // edited the box, show the new text. If you have, keep your text and offer the new version.
  if (serverDraft !== base) {
    setBase(serverDraft);
    if (text === base || text === serverDraft) {
      setText(serverDraft);
      setNewVersion(null);
    } else {
      setNewVersion(serverDraft);
    }
  }
  const tone = toneMeta(invoice.reminder_tone);
  const hint = dueHint(invoice);
  const isPayPal = invoice.payment_provider === "paypal";

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["agent-queue"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  // Let the card fade out before it leaves the list
  function leave(kind) {
    setLeaving(kind);
    setTimeout(refresh, 320);
  }

  const rewrite = useMutation({
    mutationFn: (newTone) => draftReminder(invoice.id, newTone),
    onSuccess: (data) => {
      setText(data.reminder_draft);
      queryClient.invalidateQueries({ queryKey: ["agent-queue"] });
      toast.success(`Rewritten in a ${data.tone} tone`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const approve = useMutation({
    mutationFn: () => sendReminder(invoice.id, text.trim()),
    onSuccess: async () => {
      const copied = await copyText(text.trim());
      toast.success("Reminder approved", {
        description: isPayPal
          ? "PayPal is emailing its reminder to the client." + (copied ? " Your message is copied too." : "")
          : copied
            ? "Your message is copied. Paste it into your email or chat with the client."
            : "Remember to send your message to the client.",
      });
      leave("approved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const dismiss = useMutation({
    mutationFn: () => dismissReminder(invoice.id),
    onSuccess: () => {
      toast("Draft dismissed", { description: "The agent will not draft another one for 3 days." });
      leave("dismissed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const busy = rewrite.isPending || approve.isPending || dismiss.isPending || !!leaving;
  const tooLong = text.length > MAX_LENGTH;
  const empty = !text.trim();
  const subject = `Payment reminder: ${formatMoney(invoice.total, invoice.currency)} due ${formatDate(invoice.due_date)}`;
  const mailto = invoice.client_email
    ? `mailto:${encodeURIComponent(invoice.client_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    : null;

  async function onCopy() {
    if (await copyText(text)) toast.success("Message copied");
    else toast.error("Could not copy. Select the text and copy it by hand.");
  }

  return (
    <article
      data-slot="card"
      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
      className={cn(
        "relative grid gap-4 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500",
        leaving && "animate-out fade-out-0 zoom-out-95 fill-mode-forwards duration-300",
        leaving === "approved" && "ring-success/40",
      )}
    >
      {/* Client and invoice */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {invoice.client_name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="truncate">{invoice.client_name}</span>
              {invoice.is_demo && (
                <span className="shrink-0 rounded-sm bg-secondary px-1 py-px text-[10px] font-medium tracking-wide text-secondary-foreground uppercase">
                  Sample
                </span>
              )}
            </h3>
            <p className="truncate text-sm text-muted-foreground">{invoice.client_email || "No email saved"}</p>
          </div>
        </div>
        {/* Phones: amount and due date on one row under the name. Wider screens: top right. */}
        <div className="flex w-full items-baseline justify-between gap-2 sm:block sm:w-auto sm:text-right">
          <p className="text-lg font-semibold tracking-tight tabular-nums">{formatMoney(invoice.total, invoice.currency)}</p>
          <p className="text-xs text-muted-foreground">
            Due {formatDate(invoice.due_date)}
            {hint && <span className={cn("font-medium", hint.tone)}> · {hint.text}</span>}
          </p>
        </div>
      </header>

      {/* Why the agent wrote this */}
      {invoice.agent_note && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary/70 px-3 py-2 text-sm text-secondary-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-highlight" />
          <span>{invoice.agent_note}</span>
        </p>
      )}

      {/* Tone picker */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Tone</span>
        <div role="radiogroup" aria-label="Reminder tone" className="inline-flex rounded-lg bg-muted p-0.75">
          {TONES.map((option) => {
            const active = option.key === tone.key;
            const loading = rewrite.isPending && rewrite.variables === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={active}
                title={option.hint}
                disabled={busy}
                onClick={() => !active && rewrite.mutate(option.key)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
                  active ? cn("ring-1 ring-inset", option.badge) : "text-muted-foreground hover:text-foreground",
                  !active && busy && "opacity-60",
                )}
              >
                {loading && <Loader2 className="size-3 animate-spin" />}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The message */}
      <div className="relative">
        <label htmlFor={`reminder-${invoice.id}`} className="sr-only">
          Reminder message for {invoice.client_name}
        </label>
        <Textarea
          id={`reminder-${invoice.id}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
          aria-invalid={tooLong || undefined}
          className="min-h-40 resize-y bg-background/60 text-sm leading-relaxed"
        />
        {rewrite.isPending && (
          <div className="absolute inset-0 grid place-items-center rounded-lg bg-card/80 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="size-4 animate-pulse text-highlight" />
              Rewriting in a {toneMeta(rewrite.variables).label.toLowerCase()} tone…
            </span>
          </div>
        )}
        {newVersion && (
          <div
            role="status"
            className="mt-2 flex flex-col gap-2 rounded-lg bg-accent/50 px-3 py-2 text-sm text-accent-foreground sm:flex-row sm:items-center sm:justify-between animate-in fade-in-0 slide-in-from-top-1 duration-300"
          >
            <span className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-highlight" />
              The agent wrote a new {tone.label.toLowerCase()} version. Your edits are kept until you choose.
            </span>
            <span className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => setNewVersion(null)}>
                Keep mine
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setText(newVersion);
                  setNewVersion(null);
                }}
              >
                Use new version
              </Button>
            </span>
          </div>
        )}
        <span className={cn("mt-1 block text-right text-[11px] tabular-nums text-muted-foreground", tooLong && "text-destructive")}>
          {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </span>
      </div>

      {/* Actions */}
      <footer className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          className="justify-center text-muted-foreground hover:text-destructive sm:justify-start"
          disabled={busy}
          onClick={() => dismiss.mutate()}
        >
          {dismiss.isPending ? <Loader2 className="animate-spin" /> : <X />} Dismiss
        </Button>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" disabled={busy || empty} onClick={onCopy}>
            <Copy /> Copy
          </Button>
          {mailto ? (
            <Button variant="outline" disabled={busy || empty} asChild={!(busy || empty)}>
              {busy || empty ? (
                <>
                  <Mail /> Email
                </>
              ) : (
                <a href={mailto}>
                  <Mail /> Email
                </a>
              )}
            </Button>
          ) : (
            <Button variant="outline" disabled title="No email saved for this client">
              <Mail /> Email
            </Button>
          )}
          <Button className="col-span-2" disabled={busy || empty || tooLong} onClick={() => approve.mutate()}>
            {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />} Approve &amp; mark sent
          </Button>
        </div>
      </footer>
      <p className="-mt-2 text-xs text-muted-foreground">
        {isPayPal
          ? "Approving also asks PayPal to email its standard reminder to the client."
          : "InvoiceChat never emails your client by itself. Copy the message or open your email app, then approve to record it."}
      </p>
    </article>
  );
}
