import { themeQuartz } from "ag-grid-community";

// AG Grid has its own theme system. We point every colour at the app's CSS variables
// (from src/index.css), so the grid switches between light and dark together with the app.
export const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 14,
  headerFontSize: 12,
  headerFontWeight: 500,
  backgroundColor: "var(--card)",
  foregroundColor: "var(--foreground)",
  cellTextColor: "var(--foreground)",
  accentColor: "var(--primary)",
  borderColor: "var(--border)",
  chromeBackgroundColor: "var(--card)",
  headerBackgroundColor: "color-mix(in srgb, var(--muted) 55%, var(--card))",
  headerTextColor: "var(--muted-foreground)",
  rowHoverColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
  selectedRowBackgroundColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
  oddRowBackgroundColor: "var(--card)",
  inputBackgroundColor: "var(--background)",
  inputBorder: { color: "var(--input)" },
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowBorder: { color: "var(--border)" },
  headerRowBorder: { color: "var(--border)" },
  columnBorder: false,
  headerColumnResizeHandleColor: "var(--border)",
  spacing: 7,
  cellHorizontalPadding: 16,
  rowHeight: 60,
  headerHeight: 42,
  iconSize: 14,
  focusShadow: { radius: 3, spread: 0, color: "color-mix(in srgb, var(--ring) 50%, transparent)" },
  // Keyboard focus on a cell (arrow keys)
  rangeSelectionBorderColor: "color-mix(in srgb, var(--ring) 55%, transparent)",
  // Row checkboxes: same colour as the buttons, with a readable tick
  checkboxCheckedBackgroundColor: "var(--primary)",
  checkboxCheckedBorderColor: "var(--primary)",
  checkboxCheckedShapeColor: "var(--primary-foreground)",
  checkboxIndeterminateBackgroundColor: "var(--primary)",
  checkboxIndeterminateBorderColor: "var(--primary)",
  checkboxIndeterminateShapeColor: "var(--primary-foreground)",
  checkboxUncheckedBackgroundColor: "var(--background)",
  checkboxUncheckedBorderColor: "var(--input)",
  // Totals rows at the bottom
  pinnedRowBackgroundColor: "color-mix(in srgb, var(--muted) 55%, var(--card))",
  pinnedRowBorder: { color: "var(--border)", width: 2 },
  // Filter menus (they open over the page, see popupParent in InvoiceGrid)
  menuBackgroundColor: "var(--popover)",
  menuBorder: { color: "var(--border)" },
});
