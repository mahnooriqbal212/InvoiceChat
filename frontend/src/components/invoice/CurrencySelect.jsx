import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, currencyName } from "@/lib/money";

// Dropdown with the 21 PayPal currencies. `value` is a code like "USD", or "" for none.
export default function CurrencySelect({ id, value, onChange, invalid }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className="h-9 w-full">
        <SelectValue placeholder="Choose currency" />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {CURRENCIES.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="w-10 font-medium tabular-nums">{code}</span>
            <span className="text-muted-foreground">{currencyName(code)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
