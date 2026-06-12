export type Role = "admin" | "user";
export type Shift = "day" | "night";
export type EntrySource = "auto" | "manual" | "paste";

export interface User {
  id: string;
  username: string;
  role: Role;
}

export interface Furnace {
  id: string;
  no: number;
  name: string;
}

export interface ChargeEntry {
  id?: string;
  chargeNo: string;
  furnaceId?: string;
  furnaceNo?: number;
  furnace?: Furnace;
  gasBefore: number | null;
  gasAfter: number | null;
  usage: number | null;
  workDate: string;
  shift: Shift;
  source: EntrySource;
  chargeRecordId?: string | null;
  note?: string | null;
}

export interface ChargeScan {
  id: string;
  fileUrl: string;
  originalFileName: string;
  pageCount: number;
  status: string;
  records: ChargeRecord[];
}

export interface ChargeRecord {
  id: string;
  pageIndex: number;
  furnace?: Furnace;
  workDate: string;
  shift: Shift;
  workEnd: string;
  material?: string | null;
  weightKg?: number | null;
  note?: string | null;
}
