import React from 'react';
import { getDaysInMonth, isSaturday, isSunday, format } from 'date-fns';
import type { Employee } from '../utils/parser';

interface DtrTemplateProps {
  employee: Employee;
  year: number;
  month: number; // 0-indexed month (0 = January)
  signatoryName: string;
  signatoryPosition: string;
  holidays?: Set<number>;
  halfdays?: Set<number>;
}

export const DtrTemplate: React.FC<DtrTemplateProps> = ({ employee, year, month, signatoryName, signatoryPosition, holidays = new Set(), halfdays = new Set() }) => {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const monthName = format(new Date(year, month), 'MMMM');

  // Generate rows for 1-31
  const rows = [];
  for (let i = 1; i <= 31; i++) {
    const date = new Date(year, month, i);
    const isWeekendDay = i <= daysInMonth && (isSaturday(date) || isSunday(date));
    const dayName = isSaturday(date) ? 'SATURDAY' : isSunday(date) ? 'SUNDAY' : '';
    const log = employee.logs[i];

    const isHoliday = holidays.has(i) && i <= daysInMonth;
    const isHalfday = halfdays.has(i) && i <= daysInMonth;

    rows.push({
      day: i,
      isWeekend: isWeekendDay,
      isHoliday,
      isHalfday,
      dayName: i <= daysInMonth ? dayName : '',
      amIn: log?.amIn || '',
      amOut: (isHalfday ? log?.halfdayAmOut : log?.amOut) || '',
      pmIn: log?.pmIn || '',
      pmOut: log?.pmOut || '',
      undertime: (isHalfday ? log?.halfdayUndertime : log?.undertime) || '',
      isValidDate: i <= daysInMonth
    });
  }

  // Common dynamic classes for borders and text
  const borderColor = "border-gray-900 dark:border-gray-300 print:border-black";
  const textColor = "text-gray-900 dark:text-gray-100 print:text-black";

  return (
    <div className={`w-[50%] h-full flex flex-col justify-between px-4 py-1 text-[11px] font-sans ${textColor} transition-colors`}>
      {/* Header */}
      <div className="text-center font-bold leading-tight mb-1">
        <h3 className="text-[12px]">CIVIL SERVICE FORM NO.48</h3>
        <p className="font-normal text-[11px]">Daily Time Record</p>
      </div>

      {/* Name */}
      <div className="mb-1">
        <div className={`text-center border-b-[1.5px] ${borderColor} uppercase font-bold text-[12px] pb-0.5`}>
          {employee.name}
        </div>
        <div className="text-center text-[9px]">
          Name
        </div>
      </div>

      {/* Month */}
      <div className="flex flex-col text-[11px] mb-1 mt-0.5">
        <div className="flex items-end">
          <span className="mr-1">For the month of</span>
          <span className={`font-bold border-b-[1.5px] ${borderColor} flex-1 text-center`}>
            {monthName} 1-{daysInMonth}, {year}
          </span>
        </div>
        <div className="text-left mt-0.5">
          official hours for Arrival & Departure.
        </div>
      </div>

      {/* Reg Days / Saturday */}
      <div className="flex items-end text-[11px] mb-0.5 mt-0.5">
        <span className="mr-4">Reg. Days:</span>
        <span className={`flex-1 border-b-[1.5px] ${borderColor} text-center font-normal`}>
          22
        </span>
      </div>
      <div className="flex items-end text-[11px] mb-1">
        <span className="mr-4">Saturday :</span>
        <span className={`flex-1 border-b-[1.5px] ${borderColor} text-center font-normal`}></span>
      </div>

      {/* Table — this is the main content that should stretch */}
      <table className={`w-full border-collapse border-[1.5px] ${borderColor} text-center text-[10px] flex-1`}>
        <thead>
          <tr>
            <th className={`border-[1.5px] ${borderColor} font-bold px-1`} rowSpan={2}>Day</th>
            <th className={`border-[1.5px] ${borderColor} font-bold`} colSpan={2}>Morning</th>
            <th className={`border-[1.5px] ${borderColor} font-bold`} colSpan={2}>Afternoon</th>
            <th className={`border-[1.5px] ${borderColor} font-bold px-1`} rowSpan={2}>Undertime (minutes)</th>
          </tr>
          <tr>
            <th className={`border-[1.5px] ${borderColor} font-bold w-[20%]`}>Arrival</th>
            <th className={`border-[1.5px] ${borderColor} font-bold w-[20%]`}>Departure</th>
            <th className={`border-[1.5px] ${borderColor} font-bold w-[20%]`}>Arrival</th>
            <th className={`border-[1.5px] ${borderColor} font-bold w-[20%]`}>Departure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day} className="h-[14px]">
              <td className={`border-[1.5px] ${borderColor} font-normal`}>{row.day}</td>
              {row.isHoliday ? (
                <td colSpan={5} className={`border-[1.5px] ${borderColor} text-left pl-2 font-bold text-red-600 dark:text-red-400 print:text-red-700`}>
                  HOLIDAY
                </td>
              ) : row.isWeekend ? (
                <td colSpan={5} className={`border-[1.5px] ${borderColor} text-left pl-2 font-bold ${row.dayName === 'SUNDAY' ? 'text-red-600 dark:text-red-400 print:text-red-600' : textColor}`}>
                  {row.dayName}
                </td>
              ) : (
                <>
                  <td className={`border-[1.5px] ${borderColor} font-normal`}>{row.isValidDate ? row.amIn : ''}</td>
                  <td className={`border-[1.5px] ${borderColor} font-normal`}>{row.isValidDate ? row.amOut : ''}</td>
                  {row.isHalfday ? (
                    <td colSpan={2} className={`border-[1.5px] ${borderColor} font-bold`}>HALFDAY</td>
                  ) : (
                    <>
                      <td className={`border-[1.5px] ${borderColor} font-normal`}>{row.isValidDate ? row.pmIn : ''}</td>
                      <td className={`border-[1.5px] ${borderColor} font-normal`}>{row.isValidDate ? row.pmOut : ''}</td>
                    </>
                  )}
                  <td className={`border-[1.5px] ${borderColor} font-normal font-bold text-red-600 dark:text-red-400 print:text-black`}>{row.isValidDate ? row.undertime : ''}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Certification */}
      <div className="mt-1 text-justify text-[10px] leading-tight px-1">
        I CERTIFY on my honor that the above is a true and correct
        report of the hours of work performed, record of which was made
        daily at the arrival and departure from office.
      </div>

      {/* Signature lines */}
      <div className={`mt-4 border-b-[1.5px] ${borderColor}`}></div>
      <div className="text-center text-[9px] mt-0.5">
        (Verified as to the prescribe Office Hours)
      </div>

      <div className="mt-4 text-center font-bold text-[11px]">
        {signatoryName}
      </div>
      <div className={`text-center text-[10px] border-t-[1.5px] ${borderColor} pt-0.5 mx-0`}>
        {signatoryPosition}
      </div>
    </div>
  );
};
