# SPEC-fix-print-overlapping: Fix Print Page Overlapping & Page Breaks

## 1. Problem Analysis
When the per-page print header was introduced, each employee's DTR preview was wrapped in an outer container `div.mb-10`.
This caused a critical layout failure during print and PDF generation:
1. The CSS rule `.page-break-after-always:last-child { page-break-after: auto !important; break-after: auto !important; }` previously matched only the final employee in the list. With each employee wrapped in its own container, the inner `.page-break-after-always` div became the `:last-child` inside every single card wrapper, stripping page breaks from all employees.
2. Without page breaks, all employees flowed consecutively on the same canvas. Once an employee's 31-day table reached the bottom margin, the signature block spilled onto the top of the next page and collided directly with the next employee's header.

## 2. Technical Solution
- **Card-Level Page Scoping**:
  - Assign `.dtr-page-card` to the outer wrapper of each employee record.
  - Apply `break-inside: avoid; page-break-inside: avoid;` to `.dtr-page-card` so an employee's sheet never splits across pages.
  - Apply `break-after: page; page-break-after: always;` to `.dtr-page-card` when it is not the last page of the print job.
- **Remove Faulty Selector**:
  - Remove `.page-break-after-always:last-child { ... }` from `@media print`.
  - Handle the terminal page break cleanly:
    - In batch print (`printingPageIndex === null`): break after every employee except `index === printPages.length - 1`.
    - In single-page print (`printingPageIndex === index`): break after the employee sheet, and do not break after the duplex blank page.
- **Geometry & Margin Clearance**:
  - Use `@page { size: letter portrait; margin: 8mm; }` to give comfortable vertical clearance.
  - Constrain `.dtr-page-card` print height to fit cleanly on Letter paper without triggering trailing line overflows.

## 3. Verification
- `npm run build`: Verify compilation.
- Browser Print Preview: Check both multi-employee batch print and single-page print:
  - Batch print: Each employee starts at the top of a new page; zero overlapping of signatures or headers.
  - Single-page print: Page 1 contains employee DTR; Page 2 is a clean blank duplex page.

