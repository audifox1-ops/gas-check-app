import {
  DEFAULT_SHIFT_CONFIG,
  Shift,
  ShiftConfig,
  formatLocalDateTime,
  getShiftWindow,
  isInsideShift,
  parseLocalDateTime
} from "./domain";

export interface GasPoint {
  furnaceId: string;
  ts: Date | string;
  gasCumulative: number | null;
}

export interface ChargeUsageInput {
  id?: string;
  chargeNo?: string | null;
  furnaceId: string;
  workDate: string;
  shift: Shift;
  workEnd: Date | string;
  manualGasBefore?: number | null;
  manualGasAfter?: number | null;
}

export interface ResolvedGasPoint {
  requestedAt: Date;
  matchedAt: Date | null;
  cumulative: number | null;
  distanceMinutes: number | null;
}

export interface ChargeUsageResult {
  id?: string;
  chargeNo?: string | null;
  furnaceId: string;
  workDate: string;
  shift: Shift;
  beforeAt: Date;
  afterAt: Date;
  gasBefore: number | null;
  gasAfter: number | null;
  usage: number | null;
  beforeReading: ResolvedGasPoint;
  afterReading: ResolvedGasPoint;
  warnings: string[];
}

export interface UsageOptions {
  shiftConfig?: ShiftConfig;
  nearestToleranceMinutes?: number;
  rolloverMaxValue?: number;
}

function byTime(point: GasPoint): number {
  return parseLocalDateTime(point.ts).getTime();
}

export function sortGasPoints(points: GasPoint[]): GasPoint[] {
  return [...points].sort((a, b) => byTime(a) - byTime(b));
}

export function findNearestGasPoint(
  points: GasPoint[],
  target: Date | string,
  nearestToleranceMinutes = 3
): ResolvedGasPoint {
  const requestedAt = parseLocalDateTime(target);
  if (points.length === 0) {
    return { requestedAt, matchedAt: null, cumulative: null, distanceMinutes: null };
  }

  let low = 0;
  let high = points.length - 1;
  const targetMs = requestedAt.getTime();
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midMs = byTime(points[mid]!);
    if (midMs < targetMs) low = mid + 1;
    else high = mid - 1;
  }

  const candidates = [points[low], points[low - 1]].filter(Boolean) as GasPoint[];
  let best = candidates[0]!;
  for (const candidate of candidates) {
    if (Math.abs(byTime(candidate) - targetMs) < Math.abs(byTime(best) - targetMs)) {
      best = candidate;
    }
  }

  const matchedAt = parseLocalDateTime(best.ts);
  const distanceMinutes = Math.abs(matchedAt.getTime() - targetMs) / 60_000;
  return {
    requestedAt,
    matchedAt,
    cumulative: distanceMinutes <= nearestToleranceMinutes ? best.gasCumulative : null,
    distanceMinutes
  };
}

export function calculateChargeUsages(
  charges: ChargeUsageInput[],
  readingsByFurnace: Map<string, GasPoint[]> | Record<string, GasPoint[]>,
  options: UsageOptions = {}
): ChargeUsageResult[] {
  const shiftConfig = options.shiftConfig ?? DEFAULT_SHIFT_CONFIG;
  const tolerance = options.nearestToleranceMinutes ?? 3;
  const rolloverMaxValue = options.rolloverMaxValue;
  const sortedReadings = new Map<string, GasPoint[]>();

  const getReadings = (furnaceId: string) => {
    if (!sortedReadings.has(furnaceId)) {
      const raw = readingsByFurnace instanceof Map ? readingsByFurnace.get(furnaceId) : readingsByFurnace[furnaceId];
      sortedReadings.set(furnaceId, sortGasPoints(raw ?? []));
    }
    return sortedReadings.get(furnaceId)!;
  };

  const ordered = [...charges].sort((a, b) => {
    const groupA = `${a.furnaceId}|${a.workDate}|${a.shift}`;
    const groupB = `${b.furnaceId}|${b.workDate}|${b.shift}`;
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    return parseLocalDateTime(a.workEnd).getTime() - parseLocalDateTime(b.workEnd).getTime();
  });

  const previousEndByGroup = new Map<string, Date>();
  return ordered.map((charge) => {
    const warnings: string[] = [];
    const window = getShiftWindow(charge.workDate, charge.shift, shiftConfig);
    const groupKey = `${charge.furnaceId}|${charge.workDate}|${charge.shift}`;
    const afterAt = parseLocalDateTime(charge.workEnd);
    const beforeAt = previousEndByGroup.get(groupKey) ?? window.start;
    previousEndByGroup.set(groupKey, afterAt);

    if (!isInsideShift(afterAt, window)) {
      warnings.push(`작업 종료시각 ${formatLocalDateTime(afterAt)}이(가) ${charge.shift} 근무 범위를 벗어났습니다.`);
    }
    if (beforeAt < window.start || beforeAt > window.end) {
      warnings.push("사용전 시각이 근무 경계를 벗어나 근무 시작 경계로 보정되었습니다.");
    }

    const readings = getReadings(charge.furnaceId);
    const beforeReading = findNearestGasPoint(readings, beforeAt, tolerance);
    const afterReading = findNearestGasPoint(readings, afterAt, tolerance);
    if (beforeReading.cumulative === null) {
      warnings.push("사용전 시각과 가까운 가스누적지침을 찾지 못했습니다.");
    }
    if (afterReading.cumulative === null) {
      warnings.push("사용후 시각과 가까운 가스누적지침을 찾지 못했습니다.");
    }
    if (beforeReading.distanceMinutes !== null && beforeReading.distanceMinutes > tolerance) {
      warnings.push(`사용전 가장 가까운 지침이 ${beforeReading.distanceMinutes.toFixed(1)}분 차이입니다.`);
    }
    if (afterReading.distanceMinutes !== null && afterReading.distanceMinutes > tolerance) {
      warnings.push(`사용후 가장 가까운 지침이 ${afterReading.distanceMinutes.toFixed(1)}분 차이입니다.`);
    }

    const gasBefore = charge.manualGasBefore ?? beforeReading.cumulative;
    const gasAfter = charge.manualGasAfter ?? afterReading.cumulative;
    let usage: number | null = null;
    if (gasBefore !== null && gasAfter !== null) {
      usage = gasAfter - gasBefore;
      if (usage < 0) {
        if (rolloverMaxValue && gasAfter >= 0 && gasBefore >= 0) {
          usage = rolloverMaxValue - gasBefore + gasAfter;
          warnings.push("누적지침 감소가 감지되어 롤오버 기준으로 사용량을 보정했습니다.");
        } else {
          warnings.push("누적지침 감소가 감지되었습니다. 수동 확인이 필요합니다.");
        }
      }
    }

    return {
      id: charge.id,
      chargeNo: charge.chargeNo,
      furnaceId: charge.furnaceId,
      workDate: charge.workDate,
      shift: charge.shift,
      beforeAt,
      afterAt,
      gasBefore,
      gasAfter,
      usage,
      beforeReading,
      afterReading,
      warnings
    };
  });
}
