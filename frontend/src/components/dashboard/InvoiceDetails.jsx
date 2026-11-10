import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { copyPaymentLink } from "@/components/dashboard/copyLink";
import { deleteInvoice, sendInvoice } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { dueHint, formatTimestamp } from "@/lib/invoiceStatus";

// Popup with everything about one invoice. Drafts can be sent or deleted from here.
export default function InvoiceDetails({ invoice, onClose }) {
  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      {invoice && <DetailsBody invoice={invoice} onClose={onClose} />}
    </Dialog>
  );
}

function DetailsBody({ invoice, onClose }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hint = dueHint(invoice);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["invoices"] });

  const send = useMutation({
    mutationFn: () => sendInvoice(invoice.id),
    onSuccess: () => {
      toast.success("Invoice sent. The payment link is ready.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteInvoice(invoice.id),
    onSuccess: () => {
      toast.success("Draft deleted");
      refresh();
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const busy = send.isPending || remove.isPending;

  return (
    // grid-cols-[minmax(0,1fr)]: the popup's single column may shrink to the popup's width.
    // Without it, a long unbreakable text (like a PayPal payment link) stretches the column
    // wider than the popup and a sideways scrollbar appears.
    <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-lg">
      <DialogHeader className="min-w-0 gap-1 pr-8">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DialogTitle className="min-w-0 text-lg wrap-break-word">{invoice.client_name}</DialogTitle>
          <StatusBadge status={invoice.display_status} />
          {invoice.is_demo && <span className="text-xs text-muted-foreground">Sample data</span>}
        </div>
        <DialogDescription className="break-all">{invoice.client_email || "No email saved for this client"}</DialogDescription>
      </DialogHeader>

      <div className="grid min-w-0 gap-4">
        <ul className="grid gap-2">
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
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(invoice.total, invoice.currency)}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/60 p-3 text-sm">
          <Fact label="Due date">
            {formatDate(invoice.due_date)}
            {hint && <span className={`block text-xs ${hint.tone}`}>{hint.text}</span>}
          </Fact>
          <Fact label="Created">{formatTimestamp(invoice.created_at)}</Fact>
          {invoice.sent_at && <Fact label="Sent">{formatTimestamp(invoice.sent_at)}</Fact>}
          {invoice.paid_at && <Fact label="Paid">{formatTimestamp(invoice.paid_at)}</Fact>}
          {invoice.payment_method && <Fact label="Paid by">{invoice.payment_method}</Fact>}
          {invoice.braintree_transaction_id && <Fact label="Transaction">{invoice.braintree_transaction_id}</Fact>}
          {invoice.reminders?.length > 0 && <Fact label="Reminders sent">{invoice.reminders.length}</Fact>}
        </dl>

        {invoice.notes && <p className="text-sm whitespace-pre-wrap wrap-break-word text-muted-foreground">{invoice.notes}</p>}

        {invoice.payment_url && (
          <div className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Payment link</span>
            <div className="flex min-w-0 items-center gap-1 rounded-lg border bg-background/60 p-1 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={invoice.payment_url}>
                {invoice.payment_url}
              </span>
              <Button variant="ghost" size="icon" title="Copy payment link" onClick={() => copyPaymentLink(invoice.payment_url)}>
                <Copy />
                <span className="sr-only">Copy payment link</span>
              </Button>
              <Button variant="ghost" size="icon" title="Open payment page" asChild>
                <a href={invoice.payment_url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  <span className="sr-only">Open payment page</span>
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>

      {invoice.status === "DRAFT" && (
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => (confirmDelete ? remove.mutate() : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {confirmDelete ? "Click again to delete" : "Delete draft"}
          </Button>
          <Button disabled={busy} onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />} Send invoice
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{children}</dd>
    </div>
  );
}
