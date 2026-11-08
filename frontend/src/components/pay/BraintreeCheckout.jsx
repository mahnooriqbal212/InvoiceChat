import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Loader2, Lock, RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClientToken, payInvoice } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { formatMoney } from "@/lib/money";

// Shows Braintree's ready-made payment form and pays the invoice.
// The form's code is large, so it only downloads when a client opens a pay page.
async function createDropin(host, token, invoice) {
  const { default: dropin } = await import("braintree-web-drop-in");
  const options = { authorization: token, container: host };
  try {
    return await dropin.create({
      ...options,
      paypal: { flow: "checkout", amount: invoice.amount, currency: invoice.currency },
    });
  } catch {
    // PayPal may not be available on this sandbox account, but cards can still work
    host.replaceChildren();
    return dropin.create(options);
  }
}

export default function BraintreeCheckout({ invoice, onPaid }) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const [formState, setFormState] = useState("loading"); // loading, ready or error
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Each run gets its own empty box, because Drop-in only starts in an empty element
    const host = document.createElement("div");
    containerRef.current.appendChild(host);
    let cancelled = false;
    let created = null;

    createClientToken(invoice.id)
      .then((token) => createDropin(host, token, invoice))
      .then((instance) => {
        created = instance;
        if (cancelled) return;
        instanceRef.current = instance;
        setFormState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error.response
            ? getErrorMessage(error)
            : "The payment form could not load. Check your connection and try again.",
        );
        setFormState("error");
      });

    return () => {
      cancelled = true;
      instanceRef.current = null;
      Promise.resolve(created?.teardown())
        .catch(() => {})
        .finally(() => host.remove());
    };
    // Only rebuild for a new invoice or a retry, not when the page refreshes its data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, attempt]);

  const pay = useMutation({
    mutationFn: (body) => payInvoice(invoice.id, body),
    onSuccess: onPaid,
    onError: (error) => {
      toast.error(getErrorMessage(error));
      instanceRef.current?.clearSelectedPaymentMethod();
    },
  });

  async function onPay() {
    setRequesting(true);
    try {
      const { nonce } = await instanceRef.current.requestPaymentMethod();
      pay.mutate({ nonce });
    } catch {
      // Empty or wrong card details: the form already highlights the problem itself
    } finally {
      setRequesting(false);
    }
  }

  function retry() {
    setFormState("loading");
    setLoadError("");
    setAttempt((value) => value + 1);
  }

  const busy = requesting || pay.isPending;

  return (
    <div className="grid gap-4">
      {formState === "loading" && (
        <div className="grid gap-3" aria-label="Loading the payment form">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {formState === "error" && (
        <div role="alert" className="grid justify-items-start gap-3 rounded-lg bg-destructive/10 p-4 text-sm">
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            {loadError}
          </p>
          <Button variant="outline" onClick={retry}>
            <RotateCw /> Try again
          </Button>
        </div>
      )}

      {/* The form brings its own light styling, so it sits on a white panel in both themes */}
      <div
        ref={containerRef}
        className={formState === "ready" ? "rounded-lg bg-white px-3 py-1 text-neutral-900" : "hidden"}
      />

      {formState === "ready" && (
        <Button size="lg" className="h-11 w-full" onClick={onPay} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Lock />}
          {busy ? "Processing…" : `Pay ${formatMoney(invoice.total, invoice.currency)}`}
        </Button>
      )}

      {invoice.simulated_paypal && (
        <div className="grid gap-2 rounded-lg border border-dashed p-3">
          <Button variant="outline" onClick={() => pay.mutate({ simulated_paypal: true })} disabled={busy}>
            <FlaskConical /> Pay with PayPal (simulated)
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Test only. Braintree simulates this PayPal payment, with no PayPal login and no real money.
          </p>
        </div>
      )}
    </div>
  );
}
