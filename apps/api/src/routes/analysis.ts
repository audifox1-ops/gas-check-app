import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../auth";
import { prisma } from "../db";
import { asyncHandler, dateOnly, HttpError, toNumber } from "../http";
import { resolveFurnace } from "../services/furnaces";

const router = Router();

function usageWhere(query: any): Prisma.GasUsageWhereInput {
  const where: Prisma.GasUsageWhereInput = {};
  if (query.from || query.to) {
    where.workDate = {
      gte: query.from ? dateOnly(query.from.toString()) : undefined,
      lte: query.to ? dateOnly(query.to.toString()) : undefined
    };
  }
  if (query.shift) where.shift = query.shift.toString().toLowerCase() === "day" ? "DAY" : "NIGHT";
  return where;
}

router.get(
  "/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const where = usageWhere(req.query);
    if (req.query.furnaceId || req.query.furnaceNo) {
      const furnace = await resolveFurnace({
        furnaceId: req.query.furnaceId?.toString(),
        furnaceNo: req.query.furnaceNo ? Number(req.query.furnaceNo) : undefined
      });
      where.furnaceId = furnace.id;
    }

    const usages = await prisma.gasUsage.findMany({
      where,
      include: { furnace: true, chargeEntry: true, chargeRecord: { include: { chargeScan: true } } },
      orderBy: [{ workDate: "asc" }, { furnace: { no: "asc" } }]
    });

    const rows = usages.map((usage) => ({
      id: usage.id,
      furnaceNo: usage.furnace.no,
      furnaceName: usage.furnace.name,
      workDate: usage.workDate,
      shift: usage.shift.toLowerCase(),
      usage: toNumber(usage.usage),
      weightKg: toNumber(usage.weightKg),
      unitRate: toNumber(usage.unitRate),
      chargeNo: usage.chargeEntry?.chargeNo,
      chargeEntryId: usage.chargeEntry?.id,
      scanFile: usage.chargeRecord?.chargeScan.originalFileName,
      warnings: usage.warnings
    }));

    const totalUsage = rows.reduce((sum, row) => sum + (row.usage ?? 0), 0);
    const totalWeight = rows.reduce((sum, row) => sum + (row.weightKg ?? 0), 0);
    res.json({
      summary: {
        count: rows.length,
        totalUsage,
        totalWeight,
        unitRate: totalWeight > 0 ? totalUsage / totalWeight : null
      },
      rows
    });
  })
);

router.get(
  "/charge/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const entry = await prisma.chargeEntry.findUnique({
      where: { id: req.params.id },
      include: {
        furnace: true,
        gasUsage: true,
        chargeRecord: { include: { chargeScan: true, gasUsages: true } }
      }
    });
    if (!entry) throw new HttpError(404, "차지 사용량을 찾을 수 없습니다.");

    const record = entry.chargeRecord;
    const chart =
      record === null
        ? []
        : await prisma.gasReading.findMany({
            where: {
              furnaceId: entry.furnaceId,
              ts: {
                gte: new Date(record.workEnd.getTime() - 90 * 60_000),
                lte: new Date(record.workEnd.getTime() + 30 * 60_000)
              }
            },
            orderBy: { ts: "asc" },
            select: { ts: true, gasCumulative: true, temp: true, gas: true }
          });

    res.json({
      data: {
        ...entry,
        shift: entry.shift.toLowerCase(),
        gasBefore: toNumber(entry.gasBefore),
        gasAfter: toNumber(entry.gasAfter),
        usage: toNumber(entry.usage),
        gasUsage: entry.gasUsage
          ? {
              ...entry.gasUsage,
              cumStart: toNumber(entry.gasUsage.cumStart),
              cumEnd: toNumber(entry.gasUsage.cumEnd),
              usage: toNumber(entry.gasUsage.usage),
              weightKg: toNumber(entry.gasUsage.weightKg),
              unitRate: toNumber(entry.gasUsage.unitRate)
            }
          : null,
        chart: chart.map((point) => ({
          ts: point.ts,
          gasCumulative: toNumber(point.gasCumulative),
          temp: toNumber(point.temp),
          gas: toNumber(point.gas)
        })),
        scan: record?.chargeScan ?? null
      }
    });
  })
);

export default router;
