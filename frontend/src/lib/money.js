// The 21 currencies the backend accepts (PayPal's list, see backend/app/models.py)
export const CURRENCIES = [
  "AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "ILS", "JPY",
  "MXN", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD", "THB", "TWD", "USD",
];

// PayPal rejects decimals for these
export const ZERO_DECIMAL_CURRENCIES = ["HUF", "JPY", "TWD"];

export function isZeroDecimal(currency) {
  return ZERO_DECIMAL_CURRENCIES.includes(currency);
}

const names = new Intl.DisplayNames(["en"], { type: "currency" });

// "EUR" -> "Euro"
export function currencyName(code) {
  try {
    return names.of(code);
  } catch {
    return code;
  }
}

// formatMoney(1200, "USD") -> "$1,200.00", formatMoney(45000, "JPY") -> "¥45,000"
export function formatMoney(amount, currency) {
  const digits = isZeroDecimal(currency) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}
