export const FURNACE_NOS = [
  1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
] as const;

export type FurnaceNo = (typeof FURNACE_NOS)[number];
export type Shift = "day" | "night";
export type UserRole = "admin" | "user";
export type EntrySource = "auto" | "manual" | "paste";

export interface ShiftConfig {
  dayStart: string;
  dayEnd: string;
  nightStart: string;
  nightEnd: string;
}

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  dayStart: "08:00",
  dayEnd: "19:30",
  nightStart: "20:00",
  nightEnd: "07:00"
};

export interface ShiftWindow {
  shift: Shift;
  workDate: string;
  start: Date;
  end: Date;
}

export function furnaceName(no: number): string {
  return `가열${no}호`;
}

export function isValidFurnaceNo(no: number): no is FurnaceNo {
  return FURNACE_NOS.includes(no as FurnaceNo);
}

export function parseFurnaceNo(value: string): number | null {
  const match = value.match(/(?:가열로?|furnace)?\s*(\d{1,2})\s*호(?:기)?/i);
  if (!match) return null;
  const no = Number(match[1]);
  return isValidFurnaceNo(no) ? no : null;
}

export function inferFurnaceAndPeriodFromFileName(fileName: string): {
  furnaceNo: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
} {
  const furnaceNo = parseFurnaceNo(fileName);
  const datePattern = /(\d{4}-\d{2}-\d{2})\s+(\d{2})_(\d{2})/g;
  const dates = [...fileName.matchAll(datePattern)].map((match) =>
    parseLocalDateTime(`${match[1]} ${match[2]}:${match[3]}:00`)
  );
  return {
    furnaceNo,
    periodStart: dates[0] ?? null,
    periodEnd: dates[1] ?? null
  };
}

export function parseChargeNo(chargeNo: string): Date | null {
  const match = chargeNo.match(/^(\d{2})(\d{2})(\d{2})-\d{3}$/);
  if (!match) return null;
  const year = Number(match[1]) + 2000;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateChargeNoFormat(chargeNo: string): boolean {
  return parseChargeNo(chargeNo) !== null;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLocalDateTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${formatLocalDate(date)} ${h}:${m}:${s}`;
}

export function parseLocalDateTime(value: string | Date): Date {
  if (value instanceof Date) return value;
  const normalized = value.trim().replace("T", " ");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    throw new Error(`Invalid local datetime: ${value}`);
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
}

export function combineDateAndClock(date: string | Date, clock: string): Date {
  const workDate = typeof date === "string" ? parseLocalDateTime(`${date} 00:00:00`) : date;
  const [hour, minute] = clock.split(":").map(Number);
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid clock value: ${clock}`);
  }
  return new Date(workDate.getFullYear(), workDate.getMonth(), workDate.getDate(), hour, minute, 0);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function clockToMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid clock value: ${clock}`);
  }
  return hour * 60 + minute;
}

export function getShiftWindow(
  workDate: string | Date,
  shift: Shift,
  config: ShiftConfig = DEFAULT_SHIFT_CONFIG
): ShiftWindow {
  const workDateString = typeof workDate === "string" ? workDate : formatLocalDate(workDate);
  const start = combineDateAndClock(workDateString, shift === "day" ? config.dayStart : config.nightStart);
  let end = combineDateAndClock(workDateString, shift === "day" ? config.dayEnd : config.nightEnd);
  if (shift === "night" && end <= start) {
    end = addDays(end, 1);
  }
  return { shift, workDate: workDateString, start, end };
}

export function inferShiftWindowFromEnd(
  workEnd: Date,
  config: ShiftConfig = DEFAULT_SHIFT_CONFIG
): ShiftWindow | null {
  const minute = minutesOfDay(workEnd);
  const dayStart = clockToMinutes(config.dayStart);
  const dayEnd = clockToMinutes(config.dayEnd);
  const nightStart = clockToMinutes(config.nightStart);
  const nightEnd = clockToMinutes(config.nightEnd);

  if (minute >= dayStart && minute <= dayEnd) {
    return getShiftWindow(formatLocalDate(workEnd), "day", config);
  }
  if (minute >= nightStart) {
    return getShiftWindow(formatLocalDate(workEnd), "night", config);
  }
  if (minute <= nightEnd) {
    return getShiftWindow(formatLocalDate(addDays(workEnd, -1)), "night", config);
  }
  return null;
}

export function isInsideShift(date: Date, window: ShiftWindow): boolean {
  return date >= window.start && date <= window.end;
}
