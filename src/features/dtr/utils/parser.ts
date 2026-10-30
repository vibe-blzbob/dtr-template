import { isValid, format, getDate } from 'date-fns';

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

         const day = getDate(parsedDate);

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
            if (tm < 10.5 * 60) { // Before 10:30 AM
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
         });

         // A lone lunch log after 1:00 PM is a late arrival, not a departure
         if (!pmIn && amOutMins !== null && amOutMins > 13 * 60) {
            pmIn = amOut; pmInMins = amOutMins;
            amOut = ''; amOutMins = null;
         }

         const isFriday = parsedDate.getDay() === 5;
         if (isFriday) {
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

         // IDs: 13, 364, 5, 15, 288
         const targetIds = [13, 364, 5, 15, 288];
         const isTargetEmployee = currentEmployee.id !== null && targetIds.includes(currentEmployee.id);
         const isMine = currentEmployee.id === 15

         if (isTargetEmployee) {
            const eightAm = 8 * 60;
            const nineAm = 9 * 60;

            if (isMine && amInMins !== null && amInMins > nineAm) {
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
                  amInMins = eightAm + Math.floor(Math.random() * 16);
                  amIn = `8:${(amInMins % 60).toString().padStart(2, '0')}`;
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
                  // 3. gap between the two timelogs should not be less than 2 mins
                  if (pmOutMins - amInMins < 2) {
                     pmOutMins = amInMins + 2;
                     const h = Math.floor(pmOutMins / 60);
                     const m = pmOutMins % 60;
                     const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                     pmOut = `${dh}:${m.toString().padStart(2, '0')}`;
                  }
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

         // Undertime calculation: only if all 4 logs are present
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
            } else {
               // 1. If amIn is later than 08:00, take the difference in minutes.
               //    No amIn but amOut present = whole morning (240) missing.
               const noAmIn = !amIn && !!amOut;
               const lateMinutes = noAmIn ? 240 : (amInMins !== null && amInMins > 8 * 60)
                  ? amInMins - 8 * 60
                  : 0;

               // 2. If pmOut is earlier than expected, take the difference in minutes
               const earlyOutMinutes = (pmOutMins !== null && pmOutMins < expectedPmOut)
                  ? expectedPmOut - pmOutMins
                  : 0;

               // 3. Lunch: amOut before 12:00 / pmIn after 13:00; both missing = halfday
               //    (amOut early is skipped when the morning is already counted as 240)
               const lunchMinutes = !amOut && !pmIn ? 240 :
                  (!noAmIn && amOutMins !== null ? Math.max(0, 12 * 60 - amOutMins) : 0) +
                  (pmInMins !== null ? Math.max(0, pmInMins - 13 * 60) : 0);

               undertime = lateMinutes + earlyOutMinutes + lunchMinutes;

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

   // Filter out empty employees
   return employees.filter(emp => Object.keys(emp.logs).length > 0);
};
