export type ShiftType = 'normal' | 'afternoon' | 'night';

export interface ShiftOfficialHours {
  amIn: string;
  amInMins: number;
  amOut: string;
  amOutMins: number;
  pmIn: string;
  pmInMins: number;
  pmOut: string;
  pmOutMins: number;
}

export interface ShiftSchedule {
  name: string;
  type: ShiftType;
  employeeIds: number[];
  officialHours: ShiftOfficialHours;
}

export const SHIFT_SCHEDULES: Record<ShiftType, ShiftSchedule> = {
  normal: {
    name: 'Normal Day Shift',
    type: 'normal',
    employeeIds: [], // default for all other IDs
    officialHours: {
      amIn: '8:00 AM',
      amInMins: 8 * 60,
      amOut: '12:00 PM',
      amOutMins: 12 * 60,
      pmIn: '1:00 PM',
      pmInMins: 13 * 60,
      pmOut: '5:00 PM',
      pmOutMins: 17 * 60,
    },
  },
  afternoon: {
    name: 'Afternoon Shift',
    type: 'afternoon',
    employeeIds: [315, 312, 313],
    officialHours: {
      amIn: '3:00 PM',
      amInMins: 15 * 60,
      amOut: '7:00 PM',
      amOutMins: 19 * 60,
      pmIn: '8:00 PM',
      pmInMins: 20 * 60,
      pmOut: '11:00 PM',
      pmOutMins: 23 * 60,
    },
  },
  night: {
    name: 'Night Shift',
    type: 'night',
    employeeIds: [316, 317, 318],
    officialHours: {
      amIn: '11:00 PM',
      amInMins: 23 * 60,
      amOut: '3:00 AM',
      amOutMins: 3 * 60,
      pmIn: '4:00 AM',
      pmInMins: 4 * 60,
      pmOut: '7:00 AM',
      pmOutMins: 7 * 60,
    },
  },
};

export function getShiftByEmployeeId(employeeId: number | null): ShiftSchedule {
  if (employeeId !== null) {
    if (SHIFT_SCHEDULES.afternoon.employeeIds.includes(employeeId)) {
      return SHIFT_SCHEDULES.afternoon;
    }
    if (SHIFT_SCHEDULES.night.employeeIds.includes(employeeId)) {
      return SHIFT_SCHEDULES.night;
    }
  }
  return SHIFT_SCHEDULES.normal;
}

