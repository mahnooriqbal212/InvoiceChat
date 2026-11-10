import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CalendarDays, Check, ExternalLink, FileQuestion, FlaskConical, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Brand from "@/components/layout/Brand";
import { ModeToggle } from "@/components/mode-toggle";
import BraintreeCheckout from "@/components/pay/BraintreeCheckout";
import { getPayInvoice, simulatePayment } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

// The page a client opens from the pay link. It has no app navigation and needs no login.
export default function PayInvoice() {
  const { invoiceId } = useParams();
  const queryClient = useQueryClient();
  const queryKey = ["pay", invoiceId];

  const { data: invoice, error, isPending, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => getPayInvoice(invoiceId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  function onPaid(updated) {
    queryClient.setQueryData(queryKey, updated);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast.success("Payment received");
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(40%_80%_at_25%_0%,var(--highlight),transparent),radial-gradient(40%_80%_at_75%_0%,var(--highlight),transparent)] opacity-25 dark:opacity-20"
      />
      <header className="relative mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Brand />
        <ModeToggle />
      </header>

      <main className="relative mx-auto grid max-w-2xl gap-4 px-4 py-6 sm:py-10">
        {isPending && <PageSkeleton />}
        {error && <LoadError error={error} onRetry={refetch} retrying={isFetching} />}
        {invoice && <InvoiceView invoice={invoice} onPaid={onPaid} onRefresh={refetch} />}
        {invoice && (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" />
            {invoice.checkout_mode === "braintree"
              ? "Sandbox demo. Payments are processed by Braintree, a PayPal service. No real money moves."
              : "Test invoice. No real money moves."}
          </p>
        )}
      </main>
    </div>
  );
}

function InvoiceView({ invoice, onPaid, onRefresh }) {
  return (
    <>
      {invoice.status === "PAID" && <PaidNotice invoice={invoice} />}
      <InvoiceSummary invoice={invoice} />
      {invoice.status === "SENT" && (
        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.checkout_mode === "braintree" && <BraintreeCheckout invoice={invoice} onPaid={onPaid} />}
            {invoice.checkout_mode === "test" && <TestCheckout invoice={invoice} onDone={onRefresh} />}
            {invoice.checkout_mode === "paypal" && <PayPalLink url={invoice.paypal_url} />}
          </CardContent>
        </Card>
      )}
      {invoice.status === "CANCELLED" && (
        <Notice icon={Ban} title="This invoice was cancelled" text="It no longer needs payment. Please contact the sender if you have questions." />
      )}
      {invoice.status === "DRAFT" && (
        <Notice icon={FileQuestion} title="This invoice isn't ready yet" text="The sender hasn't sent it, so it can't be paid yet." />
      )}
    </>
  );
}

function InvoiceSummary({ invoice }) {
  // The server decides this (not the browser's clock), so it matches the dashboard
  const overdue = invoice.display_status === "OVERDUE";
  return (
    <Card className="[--card-spacing:--spacing(6)] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <p className="text-sm text-muted-foreground">Invoice for</p>
        <CardTitle className="text-xl">{invoice.client_name}</CardTitle>
        <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
          <CalendarDays className="size-4" /> Due {formatDate(invoice.due_date)}
          {overdue && <Badge className="bg-destructive/10 text-destructive">Overdue</Badge>}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2.5 text-sm">
          {invoice.items.map((item, index) => (
            <li key={index} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 wrap-break-word">
                {item.description}
                <span className="text-muted-foreground"> × {item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(item.quantity * item.unit_price, invoice.currency)}</span>
            </li>
          ))}
        </ul>
        {invoice.notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>}
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatMoney(invoice.total, invoice.currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PaidNotice({ invoice }) {
  return (
    <Card className="bg-success/10 ring-success/30 [--card-spacing:--spacing(6)] animate-in fade-in-0 zoom-in-95 duration-300">
      <CardContent className="grid justify-items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-6" strokeWidth={2.5} />
        </span>
        <div className="grid gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Paid. Thank you!</h1>
          <p className="text-sm text-muted-foreground">
            {formatMoney(invoice.total, invoice.currency)} received
            {invoice.paid_at && ` on ${new Date(invoice.paid_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`}
            {invoice.payment_method && ` by ${invoice.payment_method}`}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// For the fake provider and sample invoices. It is clearly labelled, so it can't pass as a real payment.
function TestCheckout({ invoice, onDone }) {
  const simulate = useMutation({
    mutationFn: () => simulatePayment(invoice.id),
    onSuccess: () => {
      toast.success("Test payment recorded");
      onDone();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        This is a test invoice, so no payment form is shown and nothing is charged.
      </p>
      <Button variant="outline" size="lg" onClick={() => simulate.mutate()} disabled={simulate.isPending}>
        {simulate.isPending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        Simulate payment (test)
      </Button>
    </div>
  );
}

function PayPalLink({ url }) {
  return (
    <Button size="lg" className="h-11 w-full" asChild>
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink /> Pay on PayPal
      </a>
    </Button>
  );
}

function Notice({ icon: Icon, title, text }) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent className="grid justify-items-center gap-2 text-center">
        <Icon className="size-6 text-muted-foreground" />
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function LoadError({ error, onRetry, retrying }) {
  if (error.response?.status === 404) {
    return (
      <Notice
        icon={FileQuestion}
        title="We couldn't find this invoice"
        text="The link may be wrong or incomplete. Please ask the sender for a new one."
      />
    );
  }
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent role="alert" className="grid justify-items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
        <Button variant="outline" onClick={() => onRetry()} disabled={retrying}>
          {retrying ? <Loader2 className="animate-spin" /> : <RotateCw />} Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent className="grid gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-40 justify-self-end" />
      </CardContent>
    </Card>
  );
}
