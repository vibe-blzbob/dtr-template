# Intent: Night Shift Month Cycle & Next-Month Bridge

- **Outcome**: For night shift employees (IDs: 316, 317, 318), each DTR row (Day *D*, 1 to the end of the month) represents the shift that **starts** on the evening of Day *D* (9:00 PM–11:00 PM `amIn`) and finishes the following morning (`amOut`/`pmIn` lunch 3:00 AM–4:00 AM, `pmOut` ~7:00 AM checkout).
- **User**: HR and night shift staff generating and printing monthly DTRs.
- **Why now**: Cross-midnight bridging previously only bridged within the calendar month (1 to 31), leaving the month's final day without its morning checkout from Day 1 of the next month.
- **Success Criteria**:
  1. **Row 1**: Evening arrival on Day 1 (11:00 PM) + Morning departures on Day 2 (3:00 AM, 4:00 AM, 7:00 AM).
  2. **Rows 2 to (*N*−1)**: Evening arrival on Day *D* (11:00 PM) + Morning departures on Day *D*+1.
  3. **Last Day of Month (Day *N*, e.g., Day 31)**: Evening arrival on Day *N* (11:00 PM) adopts morning departures from Day 1 of the next month (e.g., Nov 1: 3:00 AM, 4:00 AM, 7:00 AM) to complete the month cycle.
  4. **Prior Month Checkout**: Morning departures on Day 1 from the shift started on the previous month's final day are excluded from this month's DTR table.
  5. **Undertime**: Accurately calculated for each completed night shift row.
- **Constraint**: Normal and Afternoon shifts remain untouched; minimal diff adhering to `/ponytail`.
- **Out of Scope**: Non-night shift modifications, cross-file persistent storage.
