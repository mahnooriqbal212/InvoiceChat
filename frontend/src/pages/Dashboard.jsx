import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Database,
  Download,
  Loader2,
  MessageSquarePlus,
  ReceiptText,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SummaryCards from "@/components/dashboard/SummaryCards";
import InvoiceGrid from "@/components/dashboard/InvoiceGrid";
import InvoiceCardList from "@/components/dashboard/InvoiceCardList";
import InvoiceDetails from "@/components/dashboard/InvoiceDetails";
import { clearDemo, listInvoices, seedDemo } from "@/api/invoices";
import { getErrorMessage } from "@/api/client";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EXPORT_COLUMNS, csvFileName, downloadCsv } from "@/lib/invoiceCsv";

const POLL_MS = 4000; // live updates: ask the server for the list every 4 seconds

// Status tabs (tablets and computers)
const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "PAID", label: "Paid" },
  { key: "DRAFT", label: "Drafts" },
  { key: "CANCELLED", label: "Cancelled" },
];

// On phones the cards are the filters; these words describe the active one
const FILTER_LABELS = { PENDING: "pending", OVERDUE: "overdue", PAID: "paid", DRAFT: "drafts", CANCELLED: "cancelled" };

const EMPTY_MESSAGES = {
  ALL: "No invoices match your search.",
  PENDING: "No pending invoices.",
  OVERDUE: "Nothing overdue. Nice work!",
  PAID: "No paid invoices yet.",
  DRAFT: "No drafts.",
  CANCELLED: "No cancelled invoices.",
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const gridApi = useRef(null);

  const { data: invoices, error, isPending, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["invoices"],
    queryFn: listInvoices,
    // Pause polling if the first load failed, so the error message stays put until "Try again"
    refetchInterval: (query) => (query.state.status === "error" && !query.state.data ? false : POLL_MS),
    retry: 1, // show the "can't reach the server" message quickly instead of retrying for ~7 seconds
  });

  usePaymentToasts(invoices);

  const seed = useMutation({
    mutationFn: seedDemo,
    onSuccess: (result) => {
      toast.success(`Added ${result.created} sample invoices`);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const clear = useMutation({
    mutationFn: clearDemo,
    onSuccess: (result) => {
      toast.success(result.deleted ? `Removed ${result.deleted} sample invoices` : "There were no sample invoices");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const all = useMemo(() => invoices ?? [], [invoices]);
  const counts = useMemo(() => {
    const out = { ALL: all.length };
    for (const invoice of all) out[invoice.display_status] = (out[invoice.display_status] ?? 0) + 1;
    return out;
  }, [all]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((invoice) => {
      if (filter !== "ALL" && invoice.display_status !== filter) return false;
      if (!q) return true;
      return [invoice.client_name, invoice.client_email, invoice.currency, ...invoice.items.map((i) => i.description)]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(q));
    });
  }, [all, filter, search]);

  // The popup always shows the newest copy of the invoice, so it updates live too
  const openInvoice = openId ? all.find((invoice) => invoice.id === openId) ?? null : null;

  function exportCsv() {
    if (rows.length === 0) {
      toast.error("There are no invoices to export with the current filter.");
      return;
    }
    if (isDesktop && gridApi.current) {
      // AG Grid's built-in CSV export: rows as currently filtered and sorted
      gridApi.current.exportDataAsCsv({ fileName: csvFileName(), columnKeys: EXPORT_COLUMNS.map((c) => c.id) });
    } else {
      downloadCsv(rows);
    }
    toast.success(`Exported ${rows.length} invoice${rows.length === 1 ? "" : "s"}`);
  }

  const showFilters = FILTERS.filter((f) => f.key !== "CANCELLED" || counts.CANCELLED);
  const hasDemo = all.some((invoice) => invoice.is_demo);
  const demoBusy = seed.isPending || clear.isPending;

  return (
    // minmax(0, 1fr) lets wide children (the filter tabs) scroll instead of stretching the page on phones
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {/* Title row */}
      {/* Phones: title on the left, buttons stacked on the right. Wider screens: one row. */}
      <div className="flex items-start justify-between gap-3 sm:items-end">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <LiveStatus error={error} hasData={!!invoices} updatedAt={dataUpdatedAt} />
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={demoBusy}>
                {demoBusy ? <Loader2 className="animate-spin" /> : <Database />} Sample data <ChevronDown className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Sample invoices are marked "Sample". Your real invoices are never touched.
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => seed.mutate()}>
                <Sparkles /> {hasDemo ? "Reset sample data" : "Load sample data"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasDemo} onClick={() => clear.mutate()}>
                <Trash2 /> Remove sample data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={exportCsv} disabled={!invoices || all.length === 0}>
            <Download /> Export CSV
          </Button>
          {/* Hidden on phones: the header nav already has a "New invoice" button */}
          <Button className="hidden sm:inline-flex" asChild>
            <Link to="/">
              <MessageSquarePlus /> New invoice
            </Link>
          </Button>
        </div>
      </div>

      {isPending && <DashboardSkeleton />}

      {!invoices && error && (
        <Card className="[--card-spacing:--spacing(8)]">
          <CardContent role="alert" className="grid justify-items-center gap-3 text-center">
            <WifiOff className="size-6 text-muted-foreground" />
            <div className="grid gap-1">
              <h2 className="font-semibold">Couldn't load your invoices</h2>
              <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="animate-spin" /> : <RotateCw />} Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {invoices && all.length === 0 && <EmptyState onSeed={() => seed.mutate()} seeding={seed.isPending} />}

      {invoices && all.length > 0 && (
        <>
          <SummaryCards invoices={all} active={filter} onSelect={setFilter} />

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Tablets and computers: the five status tabs */}
              <Tabs value={filter} onValueChange={setFilter} className="hidden sm:flex">
                <TabsList className="h-9">
                  {showFilters.map((f) => (
                    <TabsTrigger key={f.key} value={f.key} className="px-2.5">
                      {f.label}
                      <span className="rounded-full bg-foreground/8 px-1.5 text-[11px] tabular-nums">{counts[f.key] ?? 0}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Phones: the tabs don't fit, so the cards are the filters and this checkbox clears the filter */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:hidden">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={filter === "ALL"}
                  onClick={() => setFilter("ALL")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2.5 rounded-lg border bg-card px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    filter === "ALL" ? "border-accent bg-accent/40" : "hover:bg-secondary",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 place-items-center rounded-[5px] border transition-colors",
                      filter === "ALL" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                    )}
                  >
                    {filter === "ALL" && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  Show all invoices
                  <span className="rounded-full bg-foreground/8 px-1.5 text-[11px] tabular-nums">{counts.ALL}</span>
                </button>
                <span className="text-xs text-muted-foreground">
                  {filter === "ALL" ? (
                    "Tip: click a card above to filter."
                  ) : (
                    <>
                      Showing <span className="font-medium text-foreground">{FILTER_LABELS[filter]}</span> only ({counts[filter] ?? 0})
                    </>
                  )}
                </span>
              </div>
              <div className="relative md:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search client, email or item"
                  aria-label="Search invoices"
                  className="h-9 bg-card pl-9"
                />
              </div>
            </div>

            {isDesktop ? (
              <InvoiceGrid
                rows={rows}
                emptyMessage={search ? EMPTY_MESSAGES.ALL : EMPTY_MESSAGES[filter]}
                onOpen={(invoice) => setOpenId(invoice.id)}
                onGridReady={(api) => (gridApi.current = api)}
              />
            ) : (
              <InvoiceCardList
                key={filter + search}
                rows={rows}
                emptyMessage={search ? EMPTY_MESSAGES.ALL : EMPTY_MESSAGES[filter]}
                onOpen={(invoice) => setOpenId(invoice.id)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Amounts in different currencies are shown separately and never added together.
            </p>
          </div>
        </>
      )}

      <InvoiceDetails invoice={openInvoice} onClose={() => setOpenId(null)} />
    </div>
  );
}

// Shows a toast when an invoice turns Paid while the dashboard is open (e.g. the client just paid).
function usePaymentToasts(invoices) {
  const previous = useRef(null);
  useEffect(() => {
    if (!invoices) return;
    const before = previous.current;
    if (before) {
      for (const invoice of invoices) {
        const old = before.get(invoice.id);
        if (old && old !== "PAID" && invoice.display_status === "PAID") {
          toast.success(`${invoice.client_name} paid ${formatMoney(invoice.total, invoice.currency)}`, {
            description: "The invoice is now marked as paid.",
          });
        }
      }
    }
    previous.current = new Map(invoices.map((invoice) => [invoice.id, invoice.display_status]));
  }, [invoices]);
}

function LiveStatus({ error, hasData, updatedAt }) {
  if (error && hasData) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-destructive">
        <WifiOff className="size-3.5" /> Can't reach the server. Showing the last saved data.
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      Live
      {updatedAt > 0 && (
        <span className="whitespace-nowrap tabular-nums">
          · <span className="hidden sm:inline">updated </span>
          {new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </p>
  );
}

function EmptyState({ onSeed, seeding }) {
  return (
    <Card className="[--card-spacing:--spacing(10)] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardContent className="grid justify-items-center gap-5 text-center">
        <span className="relative grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <ReceiptText className="size-7" />
          <Sparkles className="absolute -top-1.5 -right-1.5 size-5 fill-current text-highlight" />
        </span>
        <div className="grid max-w-md gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">No invoices yet</h2>
          <p className="text-sm text-muted-foreground">
            Paste a client chat to create your first invoice, or load sample invoices to see how the dashboard looks.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="lg" onClick={onSeed} disabled={seeding}>
            {seeding ? <Loader2 className="animate-spin" /> : <Database />} Load sample data
          </Button>
          <Button size="lg" className="px-4" asChild>
            <Link to="/">
              <MessageSquarePlus /> Create an invoice
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
