import { isValid, format, getDate } from 'date-fns';
import { getShiftByEmployeeId, SHIFT_SCHEDULES } from './shifts';

export interface EmployeeLog {
   day: number;
   amIn: string;
   amOut: string;
   pmIn: string;
   pmOut: string;
   undertime?: number;
   halfdayUndertime?: number; // used instead of undertime when the day is declared a halfday
   halfdayAmOut?: string; // last log of the day, shown as amOut on halfdays
}

export interface Employee {
   name: string;
   id: number | null;
   office: string;
   logs: Record<number, EmployeeLog>;
}

// Helper to determine if a time is AM or PM and format it
const parseTime = (timeStr: string) => {
   if (!timeStr) return null;
   // Basic parsing
   const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
   if (!match) return null;
   let hours = parseInt(match[1]);
   const minutes = parseInt(match[2]);
   const period = match[3] ? match[3].toUpperCase() : null;

   const formatted = `${hours}:${minutes.toString().padStart(2, '0')}`;

   if (period === 'PM' && hours !== 12) hours += 12;
   if (period === 'AM' && hours === 12) hours = 0;

   const totalMinutes = hours * 60 + minutes;

   return { time: formatted, period, totalMinutes, raw: timeStr };
};

export const parseExcelData = (data: any[][]): Employee[] => {
   const employees: Employee[] = [];
   let currentEmployee: Employee | null = null;

   for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0]).trim();

      // Check if this row indicates a new employee
      // It usually looks like "PBO/Agar, Benzar (191)"
      if (/^[A-Z]+\//.test(firstCell) || firstCell.includes(',')) {
         // Possible employee name row
         // Sometimes date is in the same cell, but usually it's just the name
         if (!firstCell.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
            let name = firstCell;
            const officeMatch = firstCell.match(/^([A-Z]+)\//);
            const office = officeMatch ? officeMatch[1] : '';
            name = name.replace(/^[A-Z]+\//, '').trim(); // remove office prefix like "PBO/", "ADMIN/", etc.
            name = name.replace(/\(\d+\)/, '').trim(); // remove ID like (191)
            const idMatch = firstCell.match(/\((\d+)\)/);
            const empId = idMatch ? parseInt(idMatch[1]) : null;

            currentEmployee = { name, id: empId, office, logs: {} };
            employees.push(currentEmployee);
            continue;
         }
      }

      // Check if it's a date row
      const dateMatch = firstCell.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      let dateStr = dateMatch ? dateMatch[1] : null;

      // Sometimes the first cell is a date object from Excel
      if (row[0] instanceof Date) {
         dateStr = format(row[0], 'MM/dd/yyyy');
      } else if (typeof row[0] === 'number') {
         // Excel serial date
         const excelDate = new Date(Math.round((row[0] - 25569) * 86400 * 1000));
         if (isValid(excelDate)) {
            dateStr = format(excelDate, 'MM/dd/yyyy');
         }
      }

      if (dateStr && currentEmployee) {
         const parsedDate = new Date(dateStr);
         if (!isValid(parsedDate)) continue;

         let day = getDate(parsedDate);
         const shift = getShiftByEmployeeId(currentEmployee.id);
         const isAfternoonShift = shift.type === 'afternoon';
         const isNightShift = shift.type === 'night';

         // For night shift: handle cutoff rows at month boundaries
         if (isNightShift) {
            if (day >= 28) {
               for (let k = i + 1; k < Math.min(i + 5, data.length); k++) {
                  const cell = data[k]?.[0];
                  let nd: Date | null = null;
                  if (cell instanceof Date) nd = cell;
                  else if (typeof cell === 'number') nd = new Date(Math.round((cell - 25569) * 86400 * 1000));
                  else if (typeof cell === 'string') {
                     const m = cell.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
                     if (m) nd = new Date(m[1]);
                  }
                  if (nd && isValid(nd)) {
                     if (getDate(nd) === 1) day = 0;
                     break;
                  }
               }
            } else if (day <= 5 && currentEmployee.logs[1]) {
               // Next month cutoff row (e.g. Nov 1 following the end of current month)
               const maxDay = Math.max(0, ...Object.keys(currentEmployee.logs).map(Number));
               day = Math.max(32, maxDay + 1);
            }
         }

         // Collect all time logs in this row
         const times: string[] = [];
         for (let j = 1; j < row.length; j++) {
            const cell = row[j];
            if (typeof cell === 'string' && cell.match(/\d+:\d+/)) {
               times.push(cell);
            } else if (typeof cell === 'number') {
               // Excel time fraction
               const totalSeconds = Math.round(cell * 86400);
               let h = Math.floor(totalSeconds / 3600);
               const m = Math.floor((totalSeconds % 3600) / 60);
               const period = h >= 12 ? 'PM' : 'AM';
               if (h > 12) h -= 12;
               if (h === 0) h = 12;
               times.push(`${h}:${m.toString().padStart(2, '0')} ${period}`);
            } else if (cell instanceof Date) {
               times.push(format(cell, 'h:mm a'));
            } else if (typeof cell === 'string') {
               // Sometimes multiple times are in one cell, e.g. "7:14 AM 2:03 PM 2:05 PM"
               const matches = cell.match(/(\d{1,2}:\d{2}\s*(AM|PM))/gi);
               if (matches) {
                  times.push(...matches);
               }
            }
         }

         // If row[0] string had times in it (like "9/21/2026 Mo 7:14 AM 2:03 PM...")
         if (typeof row[0] === 'string') {
            const matches = row[0].match(/(\d{1,2}:\d{2}\s*(AM|PM))/gi);
            if (matches) {
               times.push(...matches);
            }
         }

         // Distribute times to AM In, AM Out, PM In, PM Out
         let amIn = '', amOut = '', pmIn = '', pmOut = '';
         let amInMins: number | null = null;
         let amOutMins: number | null = null;
         let pmInMins: number | null = null;
         let pmOutMins: number | null = null;
         const parsedTimes = times.map(parseTime).filter(Boolean) as ReturnType<typeof parseTime>[];

         parsedTimes.sort((a, b) => (a?.totalMinutes || 0) - (b?.totalMinutes || 0));

         parsedTimes.forEach(pt => {
            if (!pt) return;
            const tm = pt.totalMinutes;
            // Disregard succeeding time logs on amIn that have less than 30 mins interval from the first one
            const isNightLunch = isNightShift && tm >= 2.5 * 60 && tm <= 4.5 * 60;
            if (!isNightLunch && amInMins !== null && tm >= amInMins && tm - amInMins < 30) {
               return;
            }

            if (isAfternoonShift) {
               // Afternoon Shift: amIn 3:00 PM (15:00), amOut 7:00 PM (19:00), pmIn 8:00 PM (20:00), pmOut 11:00 PM (23:00)
               if (tm < 17.5 * 60) { // Before 5:30 PM (around 3:00 PM)
                  if (!amIn) { amIn = pt.time; amInMins = tm; }
                  else if (!amOut) { amOut = pt.time; amOutMins = tm; }
               } else if (tm >= 17.5 * 60 && tm <= 19.5 * 60) { // 5:30 PM to 7:30 PM (around 7:00 PM)
                  if (!amOut) { amOut = pt.time; amOutMins = tm; }
                  else if (!pmIn) { pmIn = pt.time; pmInMins = tm; }
               } else if (tm > 19.5 * 60 && tm <= 21.5 * 60) { // 7:30 PM to 9:30 PM (around 8:00 PM)
                  if (!pmIn) { pmIn = pt.time; pmInMins = tm; }
                  else if (!pmOut) { pmOut = pt.time; pmOutMins = tm; }
               } else { // After 9:30 PM (around 11:00 PM)
                  if (!pmOut) { pmOut = pt.time; pmOutMins = tm; }
                  else if (!pmIn) { pmIn = pmOut; pmInMins = pmOutMins; pmOut = pt.time; pmOutMins = tm; }
               }
            } else if (isNightShift) {
               // Night Shift: amIn 11:00 PM (23:00), amOut 3:00 AM (03:00), pmIn 4:00 AM (04:00), pmOut 7:00 AM/PM
               if (tm >= 21 * 60) { // 9:00 PM to midnight (around 11:00 PM) -> amIn
                  if (!amIn) { amIn = pt.time; amInMins = tm; }
               } else if (tm < 5.5 * 60) { // Lunch break window (3:00 AM - 4:00 AM)
                  if (!amOut) { amOut = pt.time; amOutMins = tm; }
                  else if (!pmIn) { pmIn = pt.time; pmInMins = tm; }
               } else { // 5:30 AM onwards (around 7:00 AM or 7:00 PM) -> pmOut
                  if (!pmOut) { pmOut = pt.time; pmOutMins = tm; }
               }
            } else {
               // Normal Shift: amIn 8:00 AM, amOut 12:00 PM, pmIn 1:00 PM, pmOut 5:00 PM
               if (tm < 11.75 * 60) { // Before 11:50 AM
                  if (!amIn) { amIn = pt.time; amInMins = tm; }
                  else if (!amOut) { amOut = pt.time; amOutMins = tm; }
               } else if (tm >= 11.5 * 60 && tm <= 14 * 60) { // 11:30 PM to 2:00 PM
                  if (!amOut) { amOut = pt.time; amOutMins = tm; }
                  else if (!pmIn) { pmIn = pt.time; pmInMins = tm; }
               } else if (tm > 12 * 60 && tm <= 14 * 60) { // 12:00 PM to 2:00 PM
                  if (!pmIn) { pmIn = pt.time; pmInMins = tm; }
                  else if (!pmOut) { pmOut = pt.time; pmOutMins = tm; }
               } else { // After 1:00 PM
                  if (!pmOut) { pmOut = pt.time; pmOutMins = tm; }
                  else if (!pmIn) { pmIn = pmOut; pmInMins = pmOutMins; pmOut = pt.time; pmOutMins = tm; }
               }
            }
         });

         if (!isAfternoonShift && !isNightShift) {
            // A lone lunch log after 1:00 PM is a late arrival, not a departure
            if (!pmIn && amOutMins !== null && amOutMins > 13 * 60) {
               pmIn = amOut; pmInMins = amOutMins;
               amOut = ''; amOutMins = null;
            }
         } else if (isAfternoonShift) {
            // A lone dinner log after 8:00 PM is a late arrival, not a departure
            if (!pmIn && amOutMins !== null && amOutMins > 20 * 60) {
               pmIn = amOut; pmInMins = amOutMins;
               amOut = ''; amOutMins = null;
            }
         } else if (isNightShift) {
            // A lone lunch log after 3:30 AM is a late arrival / return, not a departure
            if (!pmIn && amOutMins !== null && amOutMins > 3.5 * 60) {
               pmIn = amOut; pmInMins = amOutMins;
               amOut = ''; amOutMins = null;
            }
         }

         // If the gap between two logs in amIn and pmOut is under 30 mins, disregard the later log (mistake log)
         if (amInMins !== null && pmOutMins !== null && Math.abs(pmOutMins - amInMins) < 30) {
            if (pmOutMins >= amInMins) {
               pmOut = '';
               pmOutMins = null;
            } else {
               amIn = '';
               amInMins = null;
            }
         }

         const isFriday = parsedDate.getDay() === 5;

         const targetIds = [13, 364, 5, 15, 288, 12];
         const isTargetEmployee = currentEmployee.id !== null && targetIds.includes(currentEmployee.id);
         const isMine = currentEmployee.id === 15

         if (isTargetEmployee) {
            const eightAm = 8 * 60;
            const eightThirty = 8.5 * 60;
            const nineAm = 9 * 60;

            if (isMine && amInMins !== null && amInMins <= eightThirty) {
               amInMins = eightAm;
               amIn = '8:00';
            } else if (isMine && amInMins !== null && amInMins > nineAm) {
               const adjusted = amInMins - 60; // consideration adjustment
               if (adjusted < eightAm) {
                  amInMins = eightAm;
                  amIn = '8:00';
               } else {
                  amInMins = adjusted;
                  const h = Math.floor(adjusted / 60);
                  const m = adjusted % 60;
                  amIn = `${h}:${m.toString().padStart(2, '0')}`;
               }
            } else if (amInMins !== null && amInMins > eightAm) {
               const adjusted = amInMins - 30; // consideration adjustment
               if (adjusted < eightAm) {
                  amInMins = eightAm;
                  amIn = '8:00';
               } else {
                  amInMins = adjusted;
                  const h = Math.floor(adjusted / 60);
                  const m = adjusted % 60;
                  amIn = `${h}:${m.toString().padStart(2, '0')}`;
               }
            }

            // Fill log for target employees if at least one time log is present
            if (parsedTimes.length > 0) {
               if (!amIn) {
                  amInMins = eightAm;
                  amIn = '8:00';
               }
               if (!pmOut) {
                  pmOutMins = 17 * 60 + Math.floor(Math.random() * 16);
                  pmOut = `5:${(pmOutMins % 60).toString().padStart(2, '0')}`;
               }

               // 2. pmOut shall not be earlier than amIn
               if (amInMins !== null && pmOutMins !== null) {
                  if (pmOutMins < amInMins) {
                     const tempTime = pmOut; pmOut = amIn; amIn = tempTime;
                     const tempMins = pmOutMins; pmOutMins = amInMins; amInMins = tempMins;
                  }
                  // 3. gap between amIn and pmOut under 30 mins: disregard later log as mistake
                  if (pmOutMins - amInMins < 30) {
                     pmOutMins = 17 * 60 + Math.floor(Math.random() * 16);
                     pmOut = `5:${(pmOutMins % 60).toString().padStart(2, '0')}`;
                  }
               }

               const fourFiftyPm = 16 * 60 + 50;
               const fivePm = 17 * 60;
               if (pmOut && pmOutMins !== null && pmOutMins >= fourFiftyPm && pmOutMins <= fivePm) {
                  pmOut = '5:00';
                  pmOutMins = fivePm;
               }

               // 1. If amOut or pmIn is empty, randomly populate
               if (!amOut) {
                  const amOutMin = Math.floor(Math.random() * 50); // 0 to 50
                  amOut = `12:${amOutMin.toString().padStart(2, '0')}`;
                  amOutMins = 12 * 60 + amOutMin;
               }

               if (!pmIn) {
                  const parsedAmOut = parseTime(amOut);
                  const amTotal = parsedAmOut ? parsedAmOut.totalMinutes : 12 * 60;
                  const gap = 2 + Math.floor(Math.random() * 4); // 2 to 5 minutes gap
                  const pmTotal = amTotal + gap;

                  const h = Math.floor(pmTotal / 60);
                  const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                  pmIn = `${dh}:${(pmTotal % 60).toString().padStart(2, '0')}`;
                  pmInMins = pmTotal;
               }
            }
         } else if (isAfternoonShift) {
            const threePm = 15 * 60;
            if (amInMins !== null && amInMins > threePm) {
               const adjusted = amInMins - 30; // consideration adjustment
               if (adjusted < threePm) {
                  amInMins = threePm;
                  amIn = '3:00';
               } else {
                  amInMins = adjusted;
                  const h = Math.floor(adjusted / 60);
                  const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                  const m = adjusted % 60;
                  amIn = `${dh}:${m.toString().padStart(2, '0')}`;
               }
            }
         } else if (isNightShift) {
            const elevenPm = 23 * 60;
            if (amInMins !== null && amInMins > elevenPm) {
               const adjusted = amInMins - 30; // consideration adjustment
               if (adjusted < elevenPm) {
                  amInMins = elevenPm;
                  amIn = '11:00';
               } else {
                  amInMins = adjusted;
                  const h = Math.floor(adjusted / 60);
                  const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                  const m = adjusted % 60;
                  amIn = `${dh}:${m.toString().padStart(2, '0')}`;
               }
            }
         } else {
            const eightAm = 8 * 60;
            if (amInMins !== null && amInMins > eightAm) {
               const adjusted = amInMins - 30; // consideration adjustment
               if (adjusted < eightAm) {
                  amInMins = eightAm;
                  amIn = '8:00';
               } else {
                  amInMins = adjusted;
                  const h = Math.floor(adjusted / 60);
                  const m = adjusted % 60;
                  amIn = `${h}:${m.toString().padStart(2, '0')}`;
               }
            }
         }

         if (isFriday && !isAfternoonShift && !isNightShift) {
            if (amOut && amOutMins !== null && amOutMins < 12 * 60) {
               amOut = '12:00';
               amOutMins = 12 * 60;
            }
            if (pmIn && pmInMins !== null && pmInMins > 13 * 60 && pmInMins < 14 * 60) {
               pmIn = '1:00';
               pmInMins = 13 * 60;
            }
            if (pmOut && pmOutMins !== null && pmOutMins >= 16.5 * 60 && pmOutMins < 17 * 60) {
               pmOut = '5:00';
               pmOutMins = 17 * 60;
            }
         }

         // Undertime calculation
         let undertime = 0;
         let halfdayUndertime = 0;
         const hasEmptyLogs = amIn == '' && amOut == '' && pmIn == '' && pmOut == '';
         const expectedPmOut = isFriday ? 16.5 * 60 : 17 * 60; // 16:30 on Fridays, 17:00 otherwise

         const dayOfWeek = parsedDate.getDay();
         const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

         // Halfday departure = last log after amIn (-1 = none; falls back to amOut text, e.g. random fill)
         const hdOutMins = Math.max(amOutMins ?? -1, pmInMins ?? -1, pmOutMins ?? -1);
         const hdOut = hdOutMins === pmOutMins ? pmOut : hdOutMins === pmInMins ? pmIn : amOut;

         if (isWeekday) {
            if (hasEmptyLogs) {
               undertime = 480;
               halfdayUndertime = 240;
            } else if (isAfternoonShift) {
               // Afternoon Shift: amIn 3:00 PM (15:00), amOut 7:00 PM (19:00), pmIn 8:00 PM (20:00), pmOut 11:00 PM (23:00)
               const noAmIn = !amIn && !!amOut;
               const lateMinutes = noAmIn ? 240 : (amInMins !== null && amInMins > 15 * 60)
                  ? amInMins - 15 * 60
                  : 0;

               const noPmOut = !pmOut;
               const earlyOutMinutes = noPmOut ? 180 : (pmOutMins !== null && pmOutMins < 23 * 60)
                  ? 23 * 60 - pmOutMins
                  : 0;

               const dinnerMinutes = !amOut && !pmIn ? 240 :
                  (!noAmIn && amOutMins !== null ? Math.max(0, 19 * 60 - amOutMins) : 0) +
                  (!noPmOut && pmInMins !== null ? Math.max(0, pmInMins - 20 * 60) : 0);

               undertime = Math.min(480, lateMinutes + earlyOutMinutes + dinnerMinutes);
               halfdayUndertime = !amIn ? 240 : lateMinutes + (hdOutMins >= 0 ? Math.max(0, 19 * 60 - hdOutMins) : 0);
            } else if (isNightShift) {
               // Night Shift: amIn 11:00 PM (23:00), amOut 3:00 AM (03:00), pmIn 4:00 AM (04:00), pmOut 7:00 AM/PM
               const noAmIn = !amIn && !!amOut;
               const lateMinutes = noAmIn ? 240 : (amInMins !== null && amInMins > 23 * 60)
                  ? amInMins - 23 * 60
                  : 0;

               const noPmOut = !pmOut;
               const earlyOutMinutes = noPmOut ? 180 : (pmOutMins !== null && pmOutMins < 7 * 60)
                  ? 7 * 60 - pmOutMins
                  : 0;

               const breakMinutes = !amOut && !pmIn ? 240 :
                  (!noAmIn && amOutMins !== null && amOutMins < 3 * 60 ? 3 * 60 - amOutMins : 0) +
                  (!noPmOut && pmInMins !== null && pmInMins > 4 * 60 && pmInMins < 21 * 60 ? pmInMins - 4 * 60 : 0);

               undertime = Math.min(480, lateMinutes + earlyOutMinutes + breakMinutes);
               halfdayUndertime = !amIn ? 240 : lateMinutes + (hdOutMins >= 0 && hdOutMins < 3 * 60 ? 3 * 60 - hdOutMins : 0);
            } else {
               // 1. If amIn is later than 08:00, take the difference in minutes.
               //    No amIn but amOut present = whole morning (240) missing.
               const noAmIn = !amIn && !!amOut;
               const lateMinutes = noAmIn ? 240 : (amInMins !== null && amInMins > 8 * 60)
                  ? amInMins - 8 * 60
                  : 0;

               // 2. If pmOut is earlier than expected, take the difference in minutes.
               //    No pmOut for non-target employees = afternoon (240) missing.
               const noPmOut = !isTargetEmployee && !pmOut;
               const earlyOutMinutes = noPmOut ? 240 : (pmOutMins !== null && pmOutMins < expectedPmOut)
                  ? expectedPmOut - pmOutMins
                  : 0;

               // 3. Lunch: amOut before 12:00 / pmIn after 13:00; both missing = halfday
               //    (amOut early is skipped when the morning is already counted as 240)
               const lunchMinutes = !amOut && !pmIn ? 240 :
                  (!noAmIn && amOutMins !== null ? Math.max(0, 12 * 60 - amOutMins) : 0) +
                  (!noPmOut && pmInMins !== null ? Math.max(0, pmInMins - 13 * 60) : 0);

               undertime = Math.min(480, lateMinutes + earlyOutMinutes + lunchMinutes);

               // Halfday: late amIn + departure before 12:00, afternoon ignored; no amIn = whole halfday
               halfdayUndertime = !amIn ? 240 : lateMinutes + (hdOutMins >= 0 ? Math.max(0, 12 * 60 - hdOutMins) : 0);
            }
         }

         currentEmployee.logs[day] = {
            day,
            amIn,
            amOut,
            pmIn,
            pmOut,
            undertime: undertime > 0 ? undertime : undefined,
            halfdayUndertime: halfdayUndertime > 0 ? halfdayUndertime : undefined,
            halfdayAmOut: hdOut
         };
      }
   }

   // Post-processing: For night shift employees, each Day D (1..31) starts at evening (amIn) on Day D and adopts morning departures (amOut/pmIn/pmOut) from Day D+1
   employees.forEach(emp => {
      if (emp.id !== null && SHIFT_SCHEDULES.night.employeeIds.includes(emp.id)) {
         // Snapshot original morning departures before bridging
         const morningLogs: Record<number, { amOut: string; pmIn: string; pmOut: string }> = {};
         for (const d of Object.keys(emp.logs).map(Number)) {
            morningLogs[d] = {
               amOut: emp.logs[d]?.amOut || '',
               pmIn: emp.logs[d]?.pmIn || '',
               pmOut: emp.logs[d]?.pmOut || '',
            };
         }

         for (let d = 1; d <= 31; d++) {
            const curLog = emp.logs[d];
            const nextMorning = morningLogs[d + 1];

            if (curLog && (curLog.amIn || nextMorning?.amOut || nextMorning?.pmOut)) {
               curLog.amOut = nextMorning?.amOut || '';
               curLog.pmIn = nextMorning?.pmIn || '';
               curLog.pmOut = nextMorning?.pmOut || '';
            } else if (curLog && !curLog.amIn) {
               curLog.amOut = '';
               curLog.pmIn = '';
               curLog.pmOut = '';
            }
         }

         // Clean up cutoff rows outside the current month (Day 0 and Day > 31)
         delete emp.logs[0];
         Object.keys(emp.logs).map(Number).filter(d => d > 31).forEach(d => delete emp.logs[d]);

         // Recalculate undertime for night shift days with the newly aligned logs
         for (let d = 1; d <= 31; d++) {
            const curLog = emp.logs[d];
            if (!curLog) continue;

            if (!curLog.amIn && !curLog.amOut && !curLog.pmIn && !curLog.pmOut) {
               delete emp.logs[d];
               continue;
            }

            const curAmInM = parseTime(curLog.amIn)?.totalMinutes ?? null;
            const curPmOutM = parseTime(curLog.pmOut)?.totalMinutes ?? null;
            const curAmOutM = parseTime(curLog.amOut)?.totalMinutes ?? null;
            const curPmInM = parseTime(curLog.pmIn)?.totalMinutes ?? null;

            const noAmIn = !curLog.amIn && !!curLog.amOut;
            const lateM = noAmIn ? 240 : (curAmInM !== null && curAmInM > 23 * 60 ? curAmInM - 23 * 60 : 0);
            const noPmOut = !curLog.pmOut;
            const earlyOutM = noPmOut ? 180 : (curPmOutM !== null && curPmOutM < 7 * 60 ? 7 * 60 - curPmOutM : 0);
            const brkM = (!curLog.amOut && !curLog.pmIn) ? 240 :
               (!noAmIn && curAmOutM !== null && curAmOutM < 3 * 60 ? 3 * 60 - curAmOutM : 0) +
               (!noPmOut && curPmInM !== null && curPmInM > 4 * 60 && curPmInM < 21 * 60 ? curPmInM - 4 * 60 : 0);

            const tot = Math.min(480, lateM + earlyOutM + brkM);
            curLog.undertime = tot > 0 ? tot : undefined;
            curLog.halfdayUndertime = !curLog.amIn ? 240 : lateM + (curAmOutM !== null && curAmOutM >= 0 && curAmOutM < 3 * 60 ? 3 * 60 - curAmOutM : 0);
         }
      }
   });

   // Filter out empty employees
   return employees.filter(emp => Object.keys(emp.logs).length > 0);
};
