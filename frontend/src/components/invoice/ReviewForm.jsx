import { Plus, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ClientAutocomplete from "@/components/invoice/ClientAutocomplete";
import CurrencySelect from "@/components/invoice/CurrencySelect";
import { isZeroDecimal } from "@/lib/money";
import { newItem } from "@/lib/invoiceForm";

function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-xs text-destructive animate-in fade-in-0">{children}</p>;
}

function Field({ label, htmlFor, hint, error, className, children }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint}
      </div>
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}

// The editable invoice: client, currency, due date, line items and notes.
// `errors` comes from validate() in lib/invoiceForm.js.
export default function ReviewForm({ form, setForm, errors, autofilled }) {
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateItem = (index, field, value) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));

  const removeItem = (index) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, newItem()] }));

  const priceStep = isZeroDecimal(form.currency) ? "1" : "0.01";

  return (
    <Card className="[--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-lg">Invoice details</CardTitle>
        <CardDescription>The AI filled these in from the chat. Check them and fix anything that is off.</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6">
        {/* Client */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" htmlFor="client_name" error={errors.client_name}>
            <ClientAutocomplete
              id="client_name"
              value={form.client_name}
              invalid={!!errors.client_name}
              onChange={(value) => update("client_name", value)}
              onPick={({ name, email }) => setForm((f) => ({ ...f, client_name: name, client_email: email || f.client_email }))}
            />
          </Field>
          <Field
            label="Client email"
            htmlFor="client_email"
            error={errors.client_email}
            hint={
              autofilled.includes("client_email") && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <Wand2 className="size-3" /> From saved client
                </span>
              )
            }
          >
            <Input
              id="client_email"
              type="email"
              className="h-9"
              placeholder="client@example.com"
              value={form.client_email}
              aria-invalid={!!errors.client_email || undefined}
              onChange={(event) => update("client_email", event.target.value)}
            />
          </Field>
          <Field label="Currency" htmlFor="currency" error={errors.currency}>
            <CurrencySelect
              id="currency"
              value={form.currency}
              invalid={!!errors.currency}
              onChange={(value) => update("currency", value)}
            />
          </Field>
          <Field label="Due date" htmlFor="due_date" error={errors.due_date}>
            <Input
              id="due_date"
              type="date"
              className="h-9"
              value={form.due_date}
              aria-invalid={!!errors.due_date || undefined}
              onChange={(event) => update("due_date", event.target.value)}
            />
          </Field>
        </section>

        {/* Line items */}
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Work items</h3>
            {isZeroDecimal(form.currency) && (
              <span className="text-xs text-muted-foreground">{form.currency} uses whole numbers only</span>
            )}
          </div>

          {/* Column labels (desktop only; on phones each field has its own label) */}
          <div className="hidden grid-cols-[1fr_5rem_8rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
          </div>

          <ul className="grid gap-3 sm:gap-2">
            {form.items.map((item, index) => {
              const e = errors.items?.[index] || {};
              return (
                <li
                  key={item.key}
                  // Phones: description + delete on row 1, qty + price on row 2. Desktop: one row.
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border bg-background/50 p-3 animate-in fade-in-0 slide-in-from-top-1 sm:grid-cols-[1fr_5rem_8rem_2rem] sm:border-0 sm:bg-transparent sm:p-0"
                >
                  <div className="col-span-2 grid content-start gap-1 sm:col-span-1">
                    <Label htmlFor={`desc-${item.key}`} className="text-xs text-muted-foreground sm:sr-only">
                      Description
                    </Label>
                    <Input
                      id={`desc-${item.key}`}
                      className="h-9"
                      placeholder="e.g. Logo design"
                      value={item.description}
                      aria-invalid={!!e.description || undefined}
                      onChange={(event) => updateItem(index, "description", event.target.value)}
                    />
                    <FieldError>{e.description}</FieldError>
                  </div>
                  <div className="row-start-2 grid content-start gap-1 sm:row-start-auto">
                    <Label htmlFor={`qty-${item.key}`} className="text-xs text-muted-foreground sm:sr-only">
                      Qty
                    </Label>
                    <Input
                      id={`qty-${item.key}`}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      className="h-9 tabular-nums"
                      value={item.quantity}
                      aria-invalid={!!e.quantity || undefined}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    />
                    <FieldError>{e.quantity}</FieldError>
                  </div>
                  <div className="col-span-2 row-start-2 grid content-start gap-1 sm:col-span-1 sm:row-start-auto">
                    <Label htmlFor={`price-${item.key}`} className="text-xs text-muted-foreground sm:sr-only">
                      Unit price
                    </Label>
                    <div className="relative">
                      <Input
                        id={`price-${item.key}`}
                        type="number"
                        min="0"
                        step={priceStep}
                        inputMode="decimal"
                        placeholder="0"
                        className="h-9 pr-12 tabular-nums"
                        value={item.unit_price}
                        aria-invalid={!!e.unit_price || undefined}
                        onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                        {form.currency}
                      </span>
                    </div>
                    <FieldError>{e.unit_price}</FieldError>
                  </div>
                  <div className="col-start-3 row-start-1 flex items-start justify-end sm:col-start-auto sm:row-start-auto sm:block">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Remove item"
                      disabled={form.items.length === 1}
                      onClick={() => removeItem(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                      <span className="sr-only">Remove item</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <FieldError>{errors.items_empty}</FieldError>

          <Button type="button" variant="outline" className="w-fit" onClick={addItem}>
            <Plus /> Add item
          </Button>
        </section>

        {/* Notes */}
        <Field label="Notes (optional)" htmlFor="notes" error={errors.notes}>
          <Textarea
            id="notes"
            rows={2}
            placeholder="Payment terms, project name…"
            value={form.notes}
            aria-invalid={!!errors.notes || undefined}
            onChange={(event) => update("notes", event.target.value)}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
