import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Sparkles, TriangleAlert, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import Steps from "@/components/invoice/Steps";
import ReviewForm from "@/components/invoice/ReviewForm";
import SavedInvoice from "@/components/invoice/SavedInvoice";
import SentSuccess from "@/components/invoice/SentSuccess";
import { createInvoice, deleteInvoice, extractInvoice, sendInvoice } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { toForm, toPayload, validate } from "@/lib/invoiceForm";

const MIN_CHARS = 10; // same limits as the backend's ExtractRequest
const MAX_CHARS = 8000;
const LANGUAGE_KEY = "invoicechat-invoice-language";

// The browser remembers the last choice. Storage can be blocked, so fall back to the default.
function loadLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "english" ? "english" : "original";
  } catch {
    return "original";
  }
}

function saveLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // The choice still works for this visit; it just won't be remembered.
  }
}

// The new-invoice flow. One page, four stages:
// "paste" -> (AI extracts) -> "review" -> (save draft) -> "saved" -> (send) -> "sent"
export default function PasteChat() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState("paste");
  const [chat, setChat] = useState("");
  const [language, setLanguage] = useState(loadLanguage);
  const [form, setForm] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [autofilled, setAutofilled] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [invoice, setInvoice] = useState(null); // what the server returned

  const errors = showErrors && form ? validate(form) : {};

  const extract = useMutation({
    mutationFn: ({ chatText, language }) => extractInvoice(chatText, language),
    onSuccess: (data) => {
      setForm(toForm(data.invoice));
      setWarnings(data.warnings);
      setAutofilled(data.autofilled);
      setShowErrors(false);
      setStage("review");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const save = useMutation({
    mutationFn: createInvoice,
    onSuccess: (saved) => {
      setInvoice(saved);
      setStage("saved");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // "Edit details" after saving: the backend has no update endpoint,
  // so we delete the draft and go back to the form (the form still has all values).
  const unsave = useMutation({
    mutationFn: () => deleteInvoice(invoice.id),
    onSuccess: () => {
      setInvoice(null);
      setStage("review");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const send = useMutation({
    mutationFn: () => sendInvoice(invoice.id),
    onSuccess: (sent) => {
      setInvoice(sent);
      setStage("sent");
      toast.success(sent.payment_provider === "paypal" ? "Invoice sent" : "Payment link ready");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const chatLength = chat.trim().length;
  const canExtract = chatLength >= MIN_CHARS && chat.length <= MAX_CHARS && !extract.isPending;

  function onExtract() {
    if (canExtract) extract.mutate({ chatText: chat.trim(), language });
  }

  function onLanguageChange(value) {
    setLanguage(value);
    saveLanguage(value);
  }

  function onSave() {
    setShowErrors(true);
    if (Object.keys(validate(form)).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    save.mutate(toPayload(form, chat.trim()));
  }

  function startOver() {
    setStage("paste");
    setChat("");
    setForm(null);
    setWarnings([]);
    setAutofilled([]);
    setInvoice(null);
    setShowErrors(false);
  }

  const stepIndex = { paste: 0, review: 1, saved: 2, sent: 3 }[stage];

  return (
    <div className="grid gap-8">
      <div className="flex justify-center">
        <Steps current={stepIndex} />
      </div>

      {stage === "paste" && !extract.isPending && (
        <section className="mx-auto grid w-full max-w-2xl gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="grid justify-items-center gap-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-highlight" /> AI invoicing assistant for freelancers
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Turn a client chat into an invoice
            </h1>
            <p className="max-w-lg text-pretty text-muted-foreground">
              Paste your conversation from WhatsApp, email or Slack. The AI finds the client, the work, the
              prices and the due date. You check it, then send your client a secure payment link.
            </p>
          </div>

          <Card className="[--card-spacing:--spacing(5)]">
            <CardContent>
              <label htmlFor="chat" className="sr-only">
                Client chat
              </label>
              <Textarea
                id="chat"
                autoFocus
                value={chat}
                maxLength={MAX_CHARS}
                onChange={(event) => setChat(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) onExtract();
                }}
                placeholder={
                  "Example:\n" +
                  "Sara: Hi! Can you design a logo for my bakery? Budget is $150.\n" +
                  "You: Sure! I can also do 2 banners at $40 each.\n" +
                  "Sara: Perfect, please send the invoice. I'll pay by next Friday."
                }
                className="max-h-[min(28rem,60dvh)] min-h-56 scrollbar-themed resize-y overflow-y-auto border-0 bg-transparent p-0 text-base leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent md:text-base"
              />
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 border-t py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">
                {chatLength > 0 && chatLength < MIN_CHARS
                  ? `At least ${MIN_CHARS} characters`
                  : `${chat.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`}
                <span className="hidden md:inline"> · Ctrl + Enter to extract</span>
              </span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="invoice-language" className="text-xs whitespace-nowrap text-muted-foreground">
                    Invoice language
                  </Label>
                  <Select value={language} onValueChange={onLanguageChange}>
                    <SelectTrigger id="invoice-language" className="h-9 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="original">Same as chat</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="lg" className="px-4" disabled={!canExtract} onClick={onExtract}>
                  <WandSparkles /> Extract invoice
                </Button>
              </div>
            </CardFooter>
          </Card>
        </section>
      )}

      {extract.isPending && <ExtractingSkeleton />}

      {stage === "review" && form && (
        <section className="grid items-start gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 lg:grid-cols-[1fr_20rem]">
          <ReviewForm form={form} setForm={setForm} errors={errors} autofilled={autofilled} />

          <aside className="grid gap-4 lg:sticky lg:top-20">
            {warnings.length > 0 && (
              <Card size="sm" className="bg-warning/10 ring-warning/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-warning">
                    <TriangleAlert className="size-4" /> Please double-check
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid list-disc gap-1 pl-4 text-sm">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Original chat</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="max-h-40 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {chat}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-2">
              <Button size="lg" className="h-10 w-full" onClick={onSave} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {save.isPending ? "Saving…" : "Save and review total"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                The total is calculated by the server when you save.
              </p>
              <Button variant="ghost" onClick={startOver} disabled={save.isPending}>
                <ArrowLeft /> Start over
              </Button>
            </div>
          </aside>
        </section>
      )}

      {stage === "saved" && invoice && (
        <SavedInvoice
          invoice={invoice}
          onSend={() => send.mutate()}
          sending={send.isPending}
          onEdit={() => unsave.mutate()}
          editing={unsave.isPending}
        />
      )}

      {stage === "sent" && invoice && <SentSuccess invoice={invoice} onNew={startOver} />}
    </div>
  );
}

// Placeholder shapes while the AI reads the chat
function ExtractingSkeleton() {
  return (
    <section className="grid gap-6 animate-in fade-in-0 duration-300">
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse text-highlight" /> Reading the chat and finding the invoice details…
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="[--card-spacing:--spacing(6)]">
          <CardContent className="grid gap-6">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid gap-2">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </section>
  );
}
