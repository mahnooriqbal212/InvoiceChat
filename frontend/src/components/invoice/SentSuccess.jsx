import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, LayoutDashboard, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

// Shown after POST /api/invoices/{id}/send succeeds.
export default function SentSuccess({ invoice, onNew }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(invoice.payment_url);
      toast.success("Payment link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  return (
    <Card className="mx-auto w-full max-w-xl [--card-spacing:--spacing(8)] animate-in fade-in-0 zoom-in-95 duration-300">
      <CardContent className="grid justify-items-center gap-5 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-success/15 text-success animate-in zoom-in-50 duration-500">
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <div className="grid gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">Invoice sent</h2>
          <p className="text-sm text-muted-foreground">
            {formatMoney(invoice.total, invoice.currency)} to {invoice.client_name}.{" "}
            {invoice.client_email
              ? `PayPal emailed it to ${invoice.client_email}.`
              : "There is no client email, so share the payment link yourself."}
          </p>
        </div>

        {invoice.payment_url && (
          <div className="flex w-full items-center gap-2 rounded-lg border bg-background/60 p-1.5 pl-3 text-left">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={invoice.payment_url}>
              {invoice.payment_url}
            </span>
            <Button variant="ghost" size="icon" title="Copy payment link" onClick={copyLink}>
              <Copy />
              <span className="sr-only">Copy payment link</span>
            </Button>
            <Button variant="ghost" size="icon" title="Open payment link" asChild>
              <a href={invoice.payment_url} target="_blank" rel="noreferrer">
                <ExternalLink />
                <span className="sr-only">Open payment link</span>
              </a>
            </Button>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" size="lg" asChild>
            <Link to="/dashboard">
              <LayoutDashboard /> Go to dashboard
            </Link>
          </Button>
          <Button size="lg" className="px-4" onClick={onNew}>
            <MessageSquarePlus /> New invoice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
