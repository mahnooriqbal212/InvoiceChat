import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { searchClients } from "@/api/invoices";
import { useDebounce } from "@/hooks/useDebounce";

// Client name box that suggests saved clients (GET /api/clients?q=).
// Picking one calls onPick({ name, email }) so the email fills in too.
export default function ClientAutocomplete({ id, value, onChange, onPick, invalid }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const query = useDebounce(value.trim(), 250);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", query],
    queryFn: () => searchClients(query),
    enabled: open,
    staleTime: 30_000,
  });

  // Hide the list when the only match is exactly what is already typed
  const suggestions = clients.filter((c) => c.name.toLowerCase() !== value.trim().toLowerCase() || !value);
  const showList = open && suggestions.length > 0;

  function pick(client) {
    onPick({ name: client.name, email: client.email || "" });
    setOpen(false);
  }

  function onKeyDown(event) {
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(suggestions[Math.min(highlight, suggestions.length - 1)]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        placeholder="Client or company name"
        aria-invalid={invalid || undefined}
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        role="combobox"
        className="h-9"
        onChange={(event) => {
          onChange(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <li className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Saved clients</li>
          {suggestions.map((client, index) => (
            <li
              key={client.id}
              role="option"
              aria-selected={index === highlight}
              // onMouseDown (not onClick) so it fires before the input loses focus
              onMouseDown={(event) => {
                event.preventDefault();
                pick(client);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                index === highlight && "bg-secondary",
              )}
            >
              <UserRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{client.name}</span>
                {client.email && (
                  <span className="block truncate text-xs text-muted-foreground">{client.email}</span>
                )}
              </span>
              {client.is_demo && (
                <span className="shrink-0 rounded-sm bg-secondary px-1 py-px text-[10px] font-medium tracking-wide text-secondary-foreground uppercase">
                  Sample
                </span>
              )}
              {client.invoice_count > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {client.invoice_count} {client.invoice_count === 1 ? "invoice" : "invoices"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
