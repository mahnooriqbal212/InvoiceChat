import { ReceiptText, Sparkles } from "lucide-react";

// The InvoiceChat logo and name. The app header and the client pay page both use it.
export default function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <ReceiptText className="size-4.5" />
        <Sparkles className="absolute -top-1 -right-1 size-3.5 fill-current text-highlight" />
      </span>
      <span className="text-base font-semibold tracking-tight">InvoiceChat</span>
    </span>
  );
}
