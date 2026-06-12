import { Shift, isValidFurnaceNo, parseChargeNo, parseLocalDateTime } from "./domain";

export interface ChargeGridRowLike {
  chargeNo?: string | null;
  furnaceNo?: number | null;
  gasBefore?: number | null;
  gasAfter?: number | null;
  workDate?: string | null;
  shift?: Shift | null;
}

export interface RowValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateChargeGridRow(row: ChargeGridRowLike, existingChargeNos = new Set<string>()): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.chargeNo || !parseChargeNo(row.chargeNo)) {
    errors.push("차지번호는 YYMMDD-NNN 형식이어야 합니다.");
  } else if (existingChargeNos.has(row.chargeNo)) {
    errors.push("중복 차지번호입니다.");
  }

  if (row.furnaceNo === null || row.furnaceNo === undefined || !isValidFurnaceNo(row.furnaceNo)) {
    errors.push("가열로는 1~20호기 중 7호기를 제외한 값이어야 합니다.");
  }
  if (!row.workDate) {
    errors.push("작업일자가 필요합니다.");
  } else {
    try {
      parseLocalDateTime(`${row.workDate} 00:00:00`);
    } catch {
      errors.push("작업일자 형식이 올바르지 않습니다.");
    }
  }
  if (row.shift !== "day" && row.shift !== "night") {
    errors.push("교대는 day 또는 night 이어야 합니다.");
  }
  if (row.gasBefore !== null && row.gasAfter !== null && row.gasBefore !== undefined && row.gasAfter !== undefined) {
    const usage = row.gasAfter - row.gasBefore;
    if (usage < 0) warnings.push("사용량이 음수입니다. 롤오버 또는 입력 오류를 확인하세요.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
