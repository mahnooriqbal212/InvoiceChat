import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveToneDays } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { TONE_DAYS_MAX, toToneDays, toneRanges, validateToneDays } from "@/lib/toneDays";
import { TONES } from "@/lib/reminderTones";
import { cn } from "@/lib/utils";

const asForm = (rules) => ({ friendly: String(rules.friendly), firm: String(rules.firm), final: String(rules.final) });

// "Tone rules": the freelancer chooses from which day overdue the agent uses each tone.
export default function ToneRulesDialog({ rules }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" disabled={!rules}>
          <SlidersHorizontal /> Tone rules
        </Button>
      </DialogTrigger>
      {/* Mounted only while open, so the form starts from the saved values every time */}
      {open && rules && <ToneRulesForm rules={rules} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function ToneRulesForm({ rules, onDone }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => asForm(rules));
  const [touched, setTouched] = useState(false);
  const errors = validateToneDays(form);
  const valid = Object.keys(errors).length === 0;
  const shown = touched ? errors : {};
  const preview = valid ? toneRanges(toToneDays(form)) : null;
  const unchanged = valid && ["friendly", "firm", "final"].every((k) => Number(form[k]) === rules[k]);
  const isDefault = ["friendly", "firm", "final"].every((k) => Number(form[k]) === rules.defaults[k]);

  const save = useMutation({
    mutationFn: () => saveToneDays(toToneDays(form)),
    onSuccess: (saved) => {
      queryClient.setQueryData(["tone-days"], saved);
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      const r = toneRanges(saved);
      toast.success("Tone rules saved", { description: `Friendly ${r.friendly}, firm ${r.firm}, final ${r.final}.` });
      onDone();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function onSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (valid && !unchanged) save.mutate();
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <DialogHeader>
          <DialogTitle>Tone rules</DialogTitle>
          <DialogDescription>
            Choose from which day overdue the agent uses each tone. Whole days only, each tone later than the one before.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {TONES.map((tone) => (
            <div key={tone.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <Label htmlFor={`tone-${tone.key}`} className="flex items-center gap-2">
                <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", tone.badge)}>
                  {tone.label}
                </span>
                <span className="text-sm text-muted-foreground">from day</span>
              </Label>
              <Input
                id={`tone-${tone.key}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={TONE_DAYS_MAX}
                step={1}
                value={form[tone.key]}
                onChange={(event) => {
                  setTouched(true);
                  setForm((f) => ({ ...f, [tone.key]: event.target.value }));
                }}
                aria-invalid={shown[tone.key] ? true : undefined}
                aria-describedby={shown[tone.key] ? `tone-${tone.key}-error` : undefined}
                className="h-9 w-24 text-right tabular-nums"
              />
              {shown[tone.key] && (
                <p id={`tone-${tone.key}-error`} role="alert" className="col-span-2 text-xs text-destructive animate-in fade-in-0 duration-200">
                  {shown[tone.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* What the rules mean, updated as you type */}
        <div className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite">
          {preview ? (
            <ul className="grid gap-1">
              {TONES.map((tone) => (
                <li key={tone.key} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{tone.label}</span>
                  <span className="font-medium tabular-nums">{preview[tone.key]} overdue</span>
                </li>
              ))}
              {Number(form.friendly) > 1 && (
                <li className="pt-1 text-xs text-muted-foreground">
                  Invoices less than {form.friendly} days overdue get no reminder yet.
                </li>
              )}
            </ul>
          ) : (
            <p className="text-muted-foreground">Fix the numbers above to see the result.</p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={isDefault || save.isPending}
            onClick={() => {
              setTouched(true);
              setForm(asForm(rules.defaults));
            }}
          >
            <RotateCcw /> Reset to defaults
          </Button>
          <Button type="submit" disabled={!valid || unchanged || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save rules
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
