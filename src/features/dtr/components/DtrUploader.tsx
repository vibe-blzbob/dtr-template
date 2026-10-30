import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getDaysInMonth, isSaturday, isSunday } from 'date-fns';
import { parseExcelData, type Employee } from '../utils/parser';
import { SIGNATORIES } from '../utils/signatories';
import { DtrTemplate } from './DtrTemplate';
import { Button } from '../../../components/Button';
import { Upload, RefreshCcw, FileDown, ClipboardList, X, CalendarDays } from 'lucide-react';

// ─── Holiday Picker Modal ────────────────────────────────────────────────────

interface HolidayPickerModalProps {
  year: number;
  month: number;
  holidays: Set<number>;
  halfdays: Set<number>;
  onToggle: (day: number) => void;
  onClose: () => void;
  onClear: () => void;
}

const HolidayPickerModal: React.FC<HolidayPickerModalProps> = ({
  year, month, holidays, halfdays, onToggle, onClose, onClear,
}) => {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun, 6=Sat
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  // Leading blanks for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing blanks to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="holiday-picker-modal fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Select Holidays &amp; Halfdays</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{monthName} {year}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-5">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayLabels.map(label => (
              <div key={label} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1">
                {label}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`blank-${idx}`} className="aspect-square" />;
              }

              const date = new Date(year, month, day);
              const isWeekend = isSaturday(date) || isSunday(date);
              const isSelected = holidays.has(day);
              const isHalfday = halfdays.has(day);

              return (
                <button
                  key={day}
                  onClick={() => !isWeekend && onToggle(day)}
                  disabled={isWeekend}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center text-sm font-medium
                    transition-all duration-150 relative
                    ${isWeekend
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-gray-900/30'
                      : isSelected
                        ? 'bg-green-500 text-white shadow-md shadow-green-500/30 hover:bg-green-600 ring-2 ring-green-300 dark:ring-green-700'
                        : isHalfday
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 ring-2 ring-amber-300 dark:ring-amber-700'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {holidays.size + halfdays.size > 0
              ? <span>{holidays.size} holiday{holidays.size !== 1 ? 's' : ''}, {halfdays.size} halfday{halfdays.size !== 1 ? 's' : ''}</span>
              : <span>Click: Holiday → Halfday → none</span>
            }
          </div>
          <div className="flex gap-2">
            {holidays.size + halfdays.size > 0 && (
              <Button onClick={onClear} variant="outline" className="text-xs px-3 py-1 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Clear All
              </Button>
            )}
            <Button onClick={onClose} className="text-xs px-4 py-1 bg-green-600 hover:bg-green-700 text-white">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DTR Uploader ────────────────────────────────────────────────────────────

export const DtrUploader = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [selectedSignatoryIndex, setSelectedSignatoryIndex] = useState(0); // HRMO default
  const [showUtSummary, setShowUtSummary] = useState(false);
  const [holidays, setHolidays] = useState<Set<number>>(new Set());
  const [halfdays, setHalfdays] = useState<Set<number>>(new Set());
  const [showHolidayPicker, setShowHolidayPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Parse as array of arrays
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      const parsedEmployees = parseExcelData(jsonData);
      setEmployees(parsedEmployees);
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePrint = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.print();
      if (!result.success) {
        console.error('Failed to print:', result.error);
        alert('Failed to print: ' + result.error);
      }
    } else {
      window.print();
    }
  };

  const handlePrintToPDF = async () => {
    const result = await window.electronAPI!.printToPDF();
    if (!result.success && !result.canceled) {
      console.error('Failed to save PDF:', result.error);
      alert('Failed to save PDF: ' + result.error);
    }
  };

  const handleReset = () => {
    setEmployees([]);
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth());
    setSelectedSignatoryIndex(0);
    setHolidays(new Set());
    setHalfdays(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const without = (set: Set<number>, day: number) => new Set([...set].filter(d => d !== day));

  // Cycles: none → holiday → halfday → none
  const toggleHoliday = (day: number) => {
    if (holidays.has(day)) {
      setHolidays(without(holidays, day));
      setHalfdays(new Set(halfdays).add(day));
    } else if (halfdays.has(day)) {
      setHalfdays(without(halfdays, day));
    } else {
      setHolidays(new Set(holidays).add(day));
    }
  };

  // Create a page for each employee, containing 2 identical copies side-by-side
  const printPages = employees.map(emp => [emp, emp]);

  // Compute UT summary data
  const utSummary = useMemo(() => {
    return employees
      .map(emp => {
        const undertimeDays: { day: number; minutes: number }[] = [];
        for (const [dayStr, log] of Object.entries(emp.logs)) {
          const dayNum = Number(dayStr);
          // Skip holidays when computing undertime summary
          if (holidays.has(dayNum)) continue;
          const minutes = halfdays.has(dayNum) ? log.halfdayUndertime : log.undertime;
          if (minutes && minutes > 0) {
            undertimeDays.push({ day: dayNum, minutes });
          }
        }
        undertimeDays.sort((a, b) => a.day - b.day);
        const totalMinutes = undertimeDays.reduce((sum, d) => sum + d.minutes, 0);
        return { name: emp.name, undertimeDays, totalMinutes };
      })
      .filter(entry => entry.totalMinutes > 0);
  }, [employees, holidays, halfdays]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 print:bg-white p-8 print:p-0 transition-colors">

      {/* Control Panel (Hidden when printing) */}
      <div className="max-w-5xl mx-auto mb-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg print:hidden transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">DTR Template Converter</h1>
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <RefreshCcw size={16} /> Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const date = new Date();
                date.setMonth(i);
                return (
                  <option key={i} value={i}>{date.toLocaleString('default', { month: 'long' })}</option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Excel Data</label>
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                <Upload size={16} /> Choose File
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Signatory</label>
            <select
              value={selectedSignatoryIndex}
              onChange={(e) => setSelectedSignatoryIndex(Number(e.target.value))}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            >
              {SIGNATORIES.map((sig, index) => (
                <option key={index} value={index}>{sig.name} — {sig.position}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Office</label>
            <select
              value={selectedSignatoryIndex}
              onChange={(e) => setSelectedSignatoryIndex(Number(e.target.value))}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            >
              {SIGNATORIES.map((sig, index) => (
                <option key={index} value={index}>{sig.office}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Holiday Picker Button */}
        <div className="mt-4">
          <Button onClick={() => setShowHolidayPicker(true)} variant="outline" className="flex items-center gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <CalendarDays size={16} /> Manage Holidays
            {holidays.size + halfdays.size > 0 && (
              <span className="ml-1 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {holidays.size + halfdays.size}
              </span>
            )}
          </Button>
        </div>

        {employees.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Loaded {employees.length} employees
            </span>
            <div className="flex gap-3">
              {window.electronAPI && (
                <Button onClick={handlePrintToPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6">
                  <FileDown size={18} /> Save PDF
                </Button>
              )}
              <Button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6">
                <FileDown size={18} /> {window.electronAPI ? 'Print' : 'Save PDF / Print'}
              </Button>
              <Button onClick={() => setShowUtSummary(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6">
                <ClipboardList size={18} /> UT Summary
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Print Preview Area */}
      {employees.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 mx-auto print:mx-0 rounded-lg shadow-sm print:shadow-none p-8 print:p-0 max-w-[8.5in] w-full overflow-hidden transition-colors">
          {printPages.map((pair, index) => (
            <div
              key={index}
              className="flex flex-row justify-center page-break-after-always print:h-[10in] pt-4 print:pt-0"
              style={{ pageBreakAfter: index < printPages.length - 1 ? 'always' : 'auto' }}
            >
              {pair.map((emp, copyIndex) => (
                <DtrTemplate
                  key={`${emp.name}-copy-${copyIndex}`}
                  employee={emp}
                  year={year}
                  month={month}
                  signatoryName={SIGNATORIES[selectedSignatoryIndex].name}
                  signatoryPosition={SIGNATORIES[selectedSignatoryIndex].position}
                  holidays={holidays}
                  halfdays={halfdays}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto text-center p-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 print:hidden transition-colors">
          <Upload className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-500 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Upload an Excel file to generate DTR templates</p>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: letter portrait ; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          .page-break-after-always { page-break-after: always; break-after: page; }
          .ut-summary-modal { display: none !important; }
          .holiday-picker-modal { display: none !important; }
        }
      `}</style>

      {/* UT Summary Modal */}
      {showUtSummary && (
        <div className="ut-summary-modal fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Undertime Summary</h2>
              <button
                onClick={() => setShowUtSummary(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 flex-1">
              {utSummary.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No employees with undertime found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">Employee</th>
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">Days with Undertime</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">Total (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utSummary.map((entry, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{entry.name}</td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                          {entry.undertimeDays.map((d, i) => (
                            <span key={d.day} className="inline-block">
                              <span className="font-medium">Day {d.day}</span>
                              <span className="text-red-500 dark:text-red-400 ml-0.5">({d.minutes}m)</span>
                              {i < entry.undertimeDays.length - 1 && <span className="mx-1 text-gray-300 dark:text-gray-600">,</span>}
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-red-600 dark:text-red-400 whitespace-nowrap">{entry.totalMinutes}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="py-3 px-3 font-bold text-gray-800 dark:text-gray-200" colSpan={2}>
                        Total Employees: {utSummary.length}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-red-700 dark:text-red-300">
                        {utSummary.reduce((sum, e) => sum + e.totalMinutes, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button onClick={() => setShowUtSummary(false)} variant="outline" className="dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Picker Modal */}
      {showHolidayPicker && (
        <HolidayPickerModal
          year={year}
          month={month}
          holidays={holidays}
          halfdays={halfdays}
          onToggle={toggleHoliday}
          onClose={() => setShowHolidayPicker(false)}
          onClear={() => { setHolidays(new Set()); setHalfdays(new Set()); }}
        />
      )}
    </div>
  );
};

