# Intent: Morning Shift Schedule (7 AM - 3 PM)

- **Outcome**: Add a dedicated `morning` shift schedule for employee IDs 307, 308, 309, and 310 with official hours 7:00 AM–12:00 PM and 1:00 PM–3:00 PM.
- **User**: HR and the 4 morning shift employees (307, 308, 309, 310) generating monthly DTRs.
- **Why now**: These employees work a 7:00 AM to 3:00 PM schedule with standard 12:00 PM–1:00 PM lunch, requiring arrival and departure parsing to align with 7:00 AM and 3:00 PM rather than 8:00 AM and 5:00 PM.
- **Success**: Arrival parses and applies 30-min consideration against 7:00 AM, lunch uses standard 12:00 PM–1:00 PM, departure evaluates against 3:00 PM every weekday (including Fridays), and undertime is based on 300 minutes morning and 120 minutes afternoon (capped at 420 minutes for a full day absence).
- **Constraint**: Minimal diff adhering to `/ponytail`, extending `shifts.ts` and `parser.ts` cleanly without side effects on other shifts.
- **Out of scope**: Any alterations to Normal (8–5), Afternoon (3–11), or Night (11–7) shifts, or modifying target consideration employee IDs.

