import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Copy, ExternalLink, FilterX, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import GridSelectionBar from "@/components/dashboard/GridSelectionBar";
import { gridTheme } from "@/components/dashboard/gridTheme";
import { copyPaymentLink } from "@/components/dashboard/copyLink";
import { formatDate } from "@/lib/dates";
import { formatMoney, isZeroDecimal } from "@/lib/money";
import { EXPORT_COLUMNS } from "@/lib/invoiceCsv";
import { STATUS_ORDER, dueHint, formatTimestamp, itemsSummary } from "@/lib/invoiceStatus";

// Registered here (not in main.jsx), so AG Grid only downloads when the dashboard opens
ModuleRegistry.registerModules([AllCommunityModule]);

const SELECTION_COLUMN = "ag-Grid-SelectionColumn"; // AG Grid's id for the checkbox column

// ---------- Cell renderers (small React components AG Grid draws inside cells) ----------
// The totals rows at the bottom (node.rowPinned) reuse the same columns, so renderers check for them.

function ClientCell({ data, node }) {
  if (node.rowPinned) {
    return (
      <div className="flex h-full min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-semibold">Total {data.currency}</span>
        <span className="truncate text-xs text-muted-foreground">
          · {data.count} invoice{data.count === 1 ? "" : "s"}
        </span>
      </div>
    );
  }
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

function ItemsCell({ data, node }) {
  if (node.rowPinned) return null;
  return <span className="block truncate text-muted-foreground">{itemsSummary(data.items)}</span>;
}

// Hover over the Items cell: every item with quantity, price and line total
function ItemsTooltip({ data }) {
  if (!data?.items?.length) return null;
  return (
    <div className="max-w-xs rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {data.items.length} item{data.items.length === 1 ? "" : "s"}
      </p>
      <ul className="grid gap-1">
        {data.items.map((item, index) => (
          <li key={index} className="flex items-baseline justify-between gap-4">
            <span className="min-w-0 wrap-break-word">
              {item.description}
              <span className="text-muted-foreground">
                {" "}
                × {item.quantity} @ {formatMoney(item.unit_price, data.currency)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatMoney(item.quantity * item.unit_price, data.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AmountCell({ data, node }) {
  if (node.rowPinned) {
    return (
      <div className="flex h-full items-center justify-end">
        <span className="font-semibold tabular-nums">{formatMoney(data.total, data.currency)}</span>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-end justify-center leading-tight">
      <span className="font-semibold tabular-nums">{formatMoney(data.total, data.currency)}</span>
      <span className="text-[11px] text-muted-foreground">{data.currency}</span>
    </div>
  );
}

function StatusCell({ data, node }) {
  if (node.rowPinned) return null;
  return (
    <div className="flex h-full items-center">
      <StatusBadge status={data.display_status} />
    </div>
  );
}

function DueCell({ data, node }) {
  if (node.rowPinned) return null;
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

function NoRows({ getMessage }) {
  return (
    <div className="grid justify-items-center gap-2 p-6 text-center text-muted-foreground">
      <Inbox className="size-6" />
      <span className="text-sm">{getMessage()}</span>
    </div>
  );
}

// ---------- Totals rows (one per currency; never added across currencies) ----------

// Adds up the rows that pass every filter (tabs, search, column filters). Cancelled invoices are left out.
function totalsFor(api) {
  const byCurrency = new Map();
  api.forEachNodeAfterFilter((node) => {
    const invoice = node.data;
    if (!invoice || invoice.display_status === "CANCELLED") return;
    const entry = byCurrency.get(invoice.currency) ?? { total: 0, count: 0 };
    entry.total += Number(invoice.total) || 0;
    entry.count += 1;
    byCurrency.set(invoice.currency, entry);
  });
  return [...byCurrency.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([currency, { total, count }]) => {
      const places = isZeroDecimal(currency) ? 0 : 2; // avoid 0.1 + 0.2 = 0.30000000000000004
      // client_name changes with the count, so AG Grid redraws the "N invoices shown" text
      return { id: `total-${currency}`, client_name: `Total ${currency} (${count})`, currency, count, total: Number(total.toFixed(places)) };
    });
}

// ---------- Row colours ----------

function rowStyle({ node, data }) {
  if (node.rowPinned) return { fontWeight: 500 };
  if (data?.display_status === "OVERDUE") {
    return {
      backgroundColor: "color-mix(in srgb, var(--destructive) 6%, var(--card))",
      boxShadow: "inset 3px 0 0 var(--destructive)",
    };
  }
  if (data?.display_status === "PAID") {
    return {
      backgroundColor: "color-mix(in srgb, var(--success) 5%, var(--card))",
      boxShadow: "inset 3px 0 0 color-mix(in srgb, var(--success) 70%, transparent)",
    };
  }
  return undefined;
}

// What the search box looks through: client, email, currency and every item
const searchText = {
  client: (p) => `${p.data.client_name ?? ""} ${p.data.client_email ?? ""}`,
  items: (p) => (p.data.items ?? []).map((i) => i.description).join(" "),
  amount: (p) => p.data.currency ?? "",
  none: () => "",
};

// ---------- The grid ----------

export default function InvoiceGrid({ rows, statusFilter, search, emptyMessage, onOpen, onGridReady }) {
  const [api, setApi] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [columnFilters, setColumnFilters] = useState(false); // any filter typed under a column header?
  const [shown, setShown] = useState(rows.length);

  // AG Grid calls these callbacks later, so they read the newest values through refs
  const statusRef = useRef(statusFilter);
  const messageRef = useRef(emptyMessage);
  useLayoutEffect(() => {
    messageRef.current = columnFilters ? "No invoices match your column filters." : emptyMessage;
  }, [columnFilters, emptyMessage]);

  const columnDefs = useMemo(
    () => [
      {
        headerName: "Client",
        field: "client_name",
        cellRenderer: ClientCell,
        flex: 1.6,
        minWidth: 200,
        filter: "agTextColumnFilter",
        filterValueGetter: searchText.client, // filter on name and email
        getQuickFilterText: searchText.client,
      },
      {
        headerName: "Items",
        colId: "items",
        valueGetter: (p) => itemsSummary(p.data.items),
        cellRenderer: ItemsCell,
        flex: 1.6,
        minWidth: 160,
        filter: "agTextColumnFilter",
        filterValueGetter: searchText.items, // every item, not only the first
        getQuickFilterText: searchText.items,
        tooltipValueGetter: (p) => (p.node.rowPinned || !p.data.items?.length ? null : itemsSummary(p.data.items)),
        tooltipComponent: ItemsTooltip,
      },
      {
        headerName: "Amount",
        field: "total",
        cellRenderer: AmountCell,
        type: "rightAligned",
        width: 150,
        enableCellChangeFlash: true,
        filter: "agNumberColumnFilter",
        // Typing 500 in the box under the header means "500 or more" (the filter button offers other choices)
        filterParams: { defaultOption: "greaterThanOrEqual" },
        getQuickFilterText: searchText.amount,
      },
      {
        headerName: "Status",
        field: "display_status",
        cellRenderer: StatusCell,
        width: 130,
        enableCellChangeFlash: true,
        comparator: (a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b),
        getQuickFilterText: searchText.none, // the tabs filter by status
      },
      {
        headerName: "Due",
        field: "due_date",
        cellDataType: "dateString", // "YYYY-MM-DD" text, so the date filter understands it
        cellRenderer: DueCell,
        width: 170,
        filter: "agDateColumnFilter",
        getQuickFilterText: searchText.none,
      },
      {
        headerName: "Created",
        field: "created_at",
        valueFormatter: (p) => formatTimestamp(p.value),
        width: 130,
        sort: "desc",
        cellClass: "text-muted-foreground tabular-nums",
        getQuickFilterText: searchText.none,
      },
      { headerName: "", colId: "actions", cellRenderer: ActionsCell, width: 96, sortable: false, resizable: false, getQuickFilterText: searchText.none },
      // Hidden columns, only used by "Export CSV"
      ...EXPORT_COLUMNS.map((c) => ({ colId: c.id, headerName: c.header, valueGetter: (p) => c.value(p.data), hide: true })),
    ],
    [],
  );

  const defaultColDef = useMemo(
    () => ({ sortable: true, resizable: true, suppressMovable: true, floatingFilter: true, suppressHeaderMenuButton: true }),
    [],
  );

  const rowSelection = useMemo(
    () => ({
      mode: "multiRow",
      selectAll: "filtered", // the header checkbox ticks only the rows you can see after filtering
      enableClickSelection: false, // clicking a row opens the details; the checkbox selects
      isRowSelectable: (node) => !node.rowPinned,
      hideDisabledCheckboxes: true,
    }),
    [],
  );
  const selectionColumnDef = useMemo(() => ({ width: 52, resizable: false, suppressHeaderMenuButton: true }), []);

  // A new status tab: tell AG Grid to run its filters again
  useLayoutEffect(() => {
    statusRef.current = statusFilter;
    api?.onFilterChanged();
  }, [api, statusFilter]);

  // After every filter, sort or data change: refresh the totals rows and the "x of y" count.
  // The totals go straight to this grid (not through React state), so they always land on the
  // grid that is on screen, and only when they really changed.
  const onModelUpdated = useCallback((e) => {
    const next = totalsFor(e.api);
    if (JSON.stringify(e.api.getGridOption("pinnedBottomRowData") ?? []) !== JSON.stringify(next)) {
      e.api.setGridOption("pinnedBottomRowData", next);
    }
    let count = 0;
    e.api.forEachNodeAfterFilter(() => count++);
    setShown(count);
  }, []);

  // A row that gets filtered out is un-ticked, so "selected" always means rows you can see
  const onFilterChanged = useCallback((e) => {
    setColumnFilters(e.api.isColumnFilterPresent());
    const visible = new Set();
    e.api.forEachNodeAfterFilter((node) => visible.add(node.id));
    const hidden = e.api.getSelectedNodes().filter((node) => !visible.has(node.id));
    if (hidden.length) e.api.setNodesSelected({ nodes: hidden, newValue: false });
  }, []);

  // The selection bar uses the newest polled copy of each ticked invoice
  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return rows.filter((invoice) => ids.has(invoice.id));
  }, [rows, selectedIds]);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" data-slot="card">
      {selected.length > 0 && api ? (
        <GridSelectionBar selected={selected} api={api} onDone={() => api.deselectAll()} />
      ) : (
        columnFilters && (
          <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm animate-in fade-in-0 duration-200">
            <span className="text-muted-foreground">
              Column filters on · showing <span className="font-medium text-foreground tabular-nums">{shown}</span> of{" "}
              <span className="tabular-nums">{rows.length}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => api?.setFilterModel(null)}>
              <FilterX /> Clear column filters
            </Button>
          </div>
        )
      )}
      <AgGridReact
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={(p) => p.data.id}
        domLayout="autoHeight"
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 25, 50]}
        animateRows
        // Filtering: search box (quick filter), status tabs (external filter), column filters
        quickFilterText={search}
        isExternalFilterPresent={() => statusRef.current !== "ALL"}
        doesExternalFilterPass={(node) => node.data.display_status === statusRef.current}
        floatingFiltersHeight={40}
        onFilterChanged={onFilterChanged}
        onModelUpdated={onModelUpdated}
        // Row selection with checkboxes
        rowSelection={rowSelection}
        selectionColumnDef={selectionColumnDef}
        onSelectionChanged={(e) => setSelectedIds(e.api.getSelectedRows().map((r) => r.id))}
        // Colours, tooltips, popups
        getRowStyle={rowStyle}
        getRowHeight={(p) => (p.node.rowPinned ? 44 : undefined)} // totals rows are one line
        rowClass="cursor-pointer"
        tooltipShowDelay={250}
        tooltipHideDelay={8000}
        popupParent={document.body} // filter menus and tooltips are not cut off by the rounded card
        // Mouse and keyboard: click a row or press Enter on it to open the details
        onRowClicked={(e) => {
          if (e.node.rowPinned) return;
          // Clicks on the checkbox, copy or open buttons should not open the details
          if (e.event?.target?.closest?.(`button, a, input, [col-id="${SELECTION_COLUMN}"]`)) return;
          onOpen(e.data);
        }}
        onCellKeyDown={(e) => {
          if (e.event?.key === "Enter" && !e.node.rowPinned && e.data && e.column.getColId() !== SELECTION_COLUMN) onOpen(e.data);
        }}
        // Our own message both when there are no invoices and when the filters hide them all
        overlayComponentSelector={(p) =>
          p.overlayType === "noRows" || p.overlayType === "noMatchingRows"
            ? { component: NoRows, params: { getMessage: () => messageRef.current } }
            : undefined
        }
        onGridReady={(e) => {
          setApi(e.api);
          onGridReady?.(e.api);
        }}
      />
    </div>
  );
}
