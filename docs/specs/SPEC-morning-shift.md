# SPEC-morning-shift: Morning Shift Schedule (7:00 AM - 3:00 PM)

## 1. Objective
Support a dedicated `morning` shift schedule for specific personnel (IDs: 307, 308, 309, 310) in the DTR template converter. Official work hours are 7:00 AM to 12:00 PM (morning session, 5 hours) and 1:00 PM to 3:00 PM (afternoon session, 2 hours), totaling 7 hours of daily work time (420 minutes) across an 8-hour span.

## 2. Schedule Specification
- **Shift Type**: `'morning'`
- **Target Employee IDs**: `[307, 308, 309, 310]`
- **Official Hours**:
  - `amIn`: 7:00 AM (420 mins)
  - `amOut`: 12:00 PM (720 mins)
  - `pmIn`: 1:00 PM (780 mins)
  - `pmOut`: 3:00 PM (900 mins)
- **Friday Dismissal**: Remains 3:00 PM (no early 4:30 PM snapping).

## 3. Log Allocation & Parsing Rules
- **amIn**: First log before 11:50 AM. If logged after 7:00 AM, apply 30-minute consideration adjustment (`amInMins - 30`, floored at 7:00 AM).
- **Lunch Break**:
  - `amOut`: 11:30 AM to 2:00 PM departure before lunch.
  - `pmIn`: 12:00 PM to 2:00 PM arrival after lunch.
- **pmOut**: Afternoon departure after 1:00 PM, targeted around 3:00 PM.
- **Lone lunch logs**: A lone log after 1:00 PM is treated as a late afternoon arrival (`pmIn`), not morning departure (`amOut`).

## 4. Undertime Calculation
- **Late Morning Arrival**:
  - If `amIn` is missing but `amOut` is present: 300 minutes (5 hours).
  - If `amIn` > 7:00 AM: `amInMins - 7:00 AM`.
- **Lunch Deficit**:
  - If both `amOut` and `pmIn` missing: 240 minutes.
  - Otherwise: `max(0, 12:00 PM - amOutMins) + max(0, pmInMins - 1:00 PM)`.
- **Early Afternoon Departure**:
  - If `pmOut` is missing: 120 minutes (2 hours).
  - If `pmOut` < 3:00 PM: `3:00 PM - pmOutMins`.
- **Total Day Max**: Capped at 420 minutes (or 420 minutes for full absence).
- **Halfday Undertime**: Evaluated against 7:00 AM arrival and 12:00 PM departure (capped at 300 minutes).

## 5. Verification Commands
- `npm run build`: Type-checks and builds frontend bundle with Vite.
- `npm run electron:patch`: Compiles changes into the compact update installer and records session updates.

