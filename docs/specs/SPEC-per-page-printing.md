# SPEC-per-page-printing: Per-Page DTR Printing

## 1. Objective
Allow users on both the web application and Electron desktop app to print a single employee's DTR sheet directly from the preview card, eliminating the need to print the entire batch when only one employee's record is required.

## 2. UI Design
- Above each employee page in the preview list:
  - Add a compact, non-printing (`print:hidden`) toolbar header.
  - Display page index and employee name: `Page X of Y • {employee.name}`.
  - Display an individual `Print` button with a print icon (`Printer`).
  - No per-page `Save PDF` button (per-page actions strictly offer `Print`).
  - Existing global batch print actions in the top control panel remain unchanged.

## 3. Print Isolation Logic
- **State**: `printingPageIndex: number | null` (default: `null`, meaning print all).
- **Execution Flow**:
  1. User clicks the per-page `Print` button for index `i`.
  2. Component sets `printingPageIndex` to `i`.
  3. Uses `flushSync` or microtask/state flush so the DOM reflects the single-page print restriction before initiating the print dialog.
  4. Under `@media print`:
     - If `printingPageIndex !== null`, all pages where `index !== printingPageIndex` are hidden (`display: none !important`).
     - The selected page prints cleanly with standard 10mm margins and exact styling.
  5. Platform execution:
     - **Electron**: Invokes `await window.electronAPI.print()`, then resets `printingPageIndex` to `null`.
     - **Web**: Invokes `window.print()`. Listens to `onafterprint` (or `setTimeout` fallback) to reset `printingPageIndex` to `null`.

## 4. Verification
- `npm run build`: Verify TypeScript compilation and asset bundling.
- Test single-page printing in web preview: verify only the target page appears in the print preview dialog.
- Test batch printing from the top panel: verify all pages remain printable.

