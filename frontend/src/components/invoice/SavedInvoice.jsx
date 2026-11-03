import { CalendarDays, Loader2, Mail, PencilLine, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

// The saved DRAFT as the server returned it. The total shown here is the server's total.
export default function SavedInvoice({ invoice, onSend, sending, onEdit, editing }) {
  const busy = sending || editing;
  return (
    <Card className="mx-auto w-full max-w-xl [--card-spacing:--spacing(6)] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Ready to send</CardTitle>
          <Badge variant="secondary">Draft</Badge>
        </div>
        <CardDescription>Saved. Check the total, then send it through PayPal.</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="grid gap-1.5 text-sm">
          <p className="text-base font-medium">{invoice.client_name}</p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" />
            {invoice.client_email || "No email: PayPal will create a payment link but not email it"}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            Due {formatDate(invoice.due_date)}
          </p>
        </div>

        <ul className="grid gap-2 text-sm">
          {invoice.items.map((item, index) => (
            <li key={index} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate">{item.description}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {item.quantity} × {formatMoney(item.unit_price, invoice.currency)}
              </span>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatMoney(invoice.total, invoice.currency)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col-reverse gap-2 border-t bg-muted/40 py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="lg" onClick={onEdit} disabled={busy} className="w-full sm:w-auto">
          {editing ? <Loader2 className="animate-spin" /> : <PencilLine />}
          Edit details
        </Button>
        <Button size="lg" onClick={onSend} disabled={busy} className="w-full px-4 sm:w-auto">
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          {sending ? "Sending…" : "Send invoice"}
        </Button>
      </CardFooter>
    </Card>
  );
}
