import { EntrySource, Shift } from "@prisma/client";
import {
  calculateChargeUsages,
  formatLocalDate,
  GasPoint,
  getShiftWindow,
  Shift as SharedShift
} from "@taewoong/shared";
import { config } from "../config";
import { prisma } from "../db";
import { toNumber } from "../http";

export function toSharedShift(shift: Shift): SharedShift {
  return shift === "DAY" ? "day" : "night";
}

export function toDbShift(shift: SharedShift): Shift {
  return shift === "day" ? "DAY" : "NIGHT";
}

export function calculateManualUsage(gasBefore?: number | null, gasAfter?: number | null): number | null {
  if (gasBefore === null || gasBefore === undefined || gasAfter === null || gasAfter === undefined) return null;
  return gasAfter - gasBefore;
}

export async function recalculateUsageForRecordGroup(furnaceId: string, workDate: Date, shift: Shift) {
  const workDateString = formatLocalDate(workDate);
  const sharedShift = toSharedShift(shift);
  const window = getShiftWindow(workDateString, sharedShift, config.shiftConfig);
  const [records, readings] = await Promise.all([
    prisma.chargeRecord.findMany({
      where: { furnaceId, workDate, shift },
      orderBy: { workEnd: "asc" },
      include: { entries: true }
    }),
    prisma.gasReading.findMany({
      where: { furnaceId, ts: { gte: window.start, lte: window.end } },
      orderBy: { ts: "asc" },
      select: { furnaceId: true, ts: true, gasCumulative: true }
    })
  ]);

  if (records.length === 0) return [];
  const gasPoints: GasPoint[] = readings.map((reading) => ({
    furnaceId: reading.furnaceId,
    ts: reading.ts,
    gasCumulative: toNumber(reading.gasCumulative)
  }));

  const results = calculateChargeUsages(
    records.map((record) => ({
      id: record.id,
      chargeNo: record.entries[0]?.chargeNo,
      furnaceId: record.furnaceId,
      workDate: workDateString,
      shift: sharedShift,
      workEnd: record.workEnd
    })),
    new Map([[furnaceId, gasPoints]]),
    { shiftConfig: config.shiftConfig }
  );

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      const record = records.find((candidate) => candidate.id === result.id)!;
      const entry = record.entries[0];
      const weightKg = toNumber(record.weightKg);
      const unitRate = result.usage !== null && weightKg && weightKg > 0 ? result.usage / weightKg : null;
      const updateEntry =
        entry && (entry.source === EntrySource.AUTO || entry.gasBefore === null || entry.gasAfter === null);

      await tx.gasUsage.upsert({
        where: { chargeRecordId: record.id },
        create: {
          furnaceId,
          workDate,
          shift,
          cumStart: result.gasBefore,
          cumEnd: result.gasAfter,
          usage: result.usage,
          weightKg,
          unitRate,
          chargeRecordId: record.id,
          chargeEntryId: entry?.id,
          warnings: result.warnings
        },
        update: {
          cumStart: result.gasBefore,
          cumEnd: result.gasAfter,
          usage: result.usage,
          weightKg,
          unitRate,
          chargeEntryId: entry?.id,
          warnings: result.warnings
        }
      });
      if (updateEntry && entry) {
        await tx.chargeEntry.update({
          where: { id: entry.id },
          data: {
            gasBefore: result.gasBefore,
            gasAfter: result.gasAfter,
            usage: result.usage,
            source: EntrySource.AUTO
          }
        });
      }
    }
  });

  return results;
}

export async function recalculateUsageForRecord(recordId: string) {
  const record = await prisma.chargeRecord.findUnique({ where: { id: recordId } });
  if (!record) return [];
  return recalculateUsageForRecordGroup(record.furnaceId, record.workDate, record.shift);
}
