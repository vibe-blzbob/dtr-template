# SPEC-single-page-blank-duplex: Blank Page for Single-Page DTR Printing

## 1. Objective
Automatically append a blank second page when printing a specific employee's DTR sheet via the per-page "Print" button, supporting duplex/double-sided printer workflows, while leaving batch printing unaltered.

## 2. Requirements & Behavior
- **Trigger**: Only active when printing an individual employee's sheet (`printingPageIndex !== null`).
- **Single-Page Print Output**:
  - Page 1: Selected employee's two-copy DTR sheet.
  - Page 2: Blank page (print-only empty block with page break).
- **Batch Print Output**:
  - Global batch print ("Print" / "Save PDF") remains single sheet per employee with no extra blank pages between records.
- **Preview UI**:
  - The blank page is completely hidden in screen view (`hidden print:block`), having zero visual footprint in the browser preview.

## 3. Implementation Details
- When `printingPageIndex !== null` and `index === printingPageIndex`:
  - The target page retains a page break after it: `pageBreakAfter: 'always'`, `breakAfter: 'page'`.
  - An empty print element is rendered immediately after:
    `<div className="hidden print:block print:h-[10in] print:w-full" style={{ pageBreakAfter: 'auto', breakAfter: 'auto' }} />`
- When `printingPageIndex === null` (batch printing):
  - Standard batch flow: each page breaks after itself except the last page. No blank pages rendered.

## 4. Verification
- `npm run build`: Verify compilation without errors.
- Verify in browser print preview:
  - Single-page print produces exactly 2 pages (Page 1: DTR, Page 2: Blank).
  - Batch print produces exactly $N$ pages (1 page per employee).

