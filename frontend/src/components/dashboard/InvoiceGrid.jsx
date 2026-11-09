import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Copy, ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { gridTheme } from "@/components/dashboard/gridTheme";
import { copyPaymentLink } from "@/components/dashboard/copyLink";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { EXPORT_COLUMNS } from "@/lib/invoiceCsv";
import { STATUS_ORDER, dueHint, formatTimestamp, itemsSummary } from "@/lib/invoiceStatus";

// Registered here (not in main.jsx), so AG Grid only downloads when the dashboard opens
ModuleRegistry.registerModules([AllCommunityModule]);

// ---------- Cell renderers (small React components AG Grid draws inside cells) ----------

function ClientCell({ data }) {
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <span className="truncate">{data.client_name}</span>
        {data.is_demo && (
          <span className="shrink-0 rounded-sm bg-secondary px-1 py-px text-[10px] font-medium tracking-wide text-secondary-foreground uppercase">
            Sample
          </span>
        )}
      </span>
      <span className="truncate text-xs text-muted-foreground">{data.client_email || "No email"}</span>
    </div>
  );
}

function ItemsCell({ data }) {
  return <span className="block truncate text-muted-foreground">{itemsSummary(data.items)}</span>;
}

function AmountCell({ data }) {
  return (
    <div className="flex h-full flex-col items-end justify-center leading-tight">
      <span className="font-semibold tabular-nums">{formatMoney(data.total, data.currency)}</span>
      <span className="text-[11px] text-muted-foreground">{data.currency}</span>
    </div>
  );
}

function StatusCell({ data }) {
  return (
    <div className="flex h-full items-center">
      <StatusBadge status={data.display_status} />
    </div>
  );
}

function DueCell({ data }) {
  const hint = dueHint(data);
  const paid = data.display_status === "PAID" && data.paid_at;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="tabular-nums">{formatDate(data.due_date)}</span>
      {hint && <span className={`text-xs ${hint.tone}`}>{hint.text}</span>}
      {paid && <span className="text-xs text-success">Paid {formatTimestamp(data.paid_at)}</span>}
    </div>
  );
}

function ActionsCell({ data }) {
  if (!data.payment_url) return null;
  return (
    <div className="flex h-full items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" title="Copy payment link" onClick={() => copyPaymentLink(data.payment_url)}>
        <Copy />
        <span className="sr-only">Copy payment link</span>
      </Button>
      <Button variant="ghost" size="icon-sm" title="Open payment page" asChild>
        <a href={data.payment_url} target="_blank" rel="noreferrer">
          <ExternalLink />
          <span className="sr-only">Open payment page</span>
        </a>
      </Button>
    </div>
  );
}

function NoRows({ message }) {
  return (
    <div className="grid justify-items-center gap-2 p-6 text-center text-muted-foreground">
      <Inbox className="size-6" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ---------- The grid ----------

export default function InvoiceGrid({ rows, emptyMessage, onOpen, onGridReady }) {
  const columnDefs = useMemo(
    () => [
      { headerName: "Client", field: "client_name", cellRenderer: ClientCell, flex: 1.6, minWidth: 200 },
      { headerName: "Items", colId: "items", valueGetter: (p) => itemsSummary(p.data.items), cellRenderer: ItemsCell, flex: 1.6, minWidth: 160 },
      {
        headerName: "Amount",
        field: "total",
        cellRenderer: AmountCell,
        type: "rightAligned",
        width: 140,
        enableCellChangeFlash: true,
      },
      {
        headerName: "Status",
        field: "display_status",
        cellRenderer: StatusCell,
        width: 130,
        enableCellChangeFlash: true,
        comparator: (a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b),
      },
      { headerName: "Due", field: "due_date", cellRenderer: DueCell, width: 150 },
      { headerName: "Created", field: "created_at", valueFormatter: (p) => formatTimestamp(p.value), width: 130, sort: "desc", cellClass: "text-muted-foreground tabular-nums" },
      { headerName: "", colId: "actions", cellRenderer: ActionsCell, width: 96, sortable: false, resizable: false },
      // Hidden columns, only used by "Export CSV"
      ...EXPORT_COLUMNS.map((c) => ({ colId: c.id, headerName: c.header, valueGetter: (p) => c.value(p.data), hide: true })),
    ],
    [],
  );

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" data-slot="card">
      <AgGridReact
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
        getRowId={(p) => p.data.id}
        domLayout="autoHeight"
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 25, 50]}
        animateRows
        suppressCellFocus
        rowClass="cursor-pointer"
        onRowClicked={(e) => {
          // Clicks on the copy / open buttons should not open the details
          if (e.event?.target?.closest?.("button, a")) return;
          onOpen(e.data);
        }}
        noRowsOverlayComponent={NoRows}
        noRowsOverlayComponentParams={{ message: emptyMessage }}
        onGridReady={(e) => onGridReady?.(e.api)}
      />
    </div>
  );
}
