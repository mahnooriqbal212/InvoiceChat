import { cn } from "@/lib/utils";
import { STATUS } from "@/lib/invoiceStatus";

// A coloured pill: Paid (green), Pending (amber), Overdue (red), Draft / Cancelled (grey)
export default function StatusBadge({ status, className }) {
  const meta = STATUS[status] ?? STATUS.DRAFT;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        meta.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}
