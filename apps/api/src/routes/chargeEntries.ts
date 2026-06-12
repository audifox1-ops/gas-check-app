import { Router } from "express";
import { EntrySource, Prisma } from "@prisma/client";
import { z } from "zod";
import { validateChargeNoFormat } from "@taewoong/shared";
import { requireAuth } from "../auth";
import { prisma } from "../db";
import { asyncHandler, dateOnly, HttpError, parsePagination, toNumber } from "../http";
import { resolveFurnace } from "../services/furnaces";
import { calculateManualUsage, recalculateUsageForRecord, toDbShift } from "../services/usageService";

const router = Router();

const rowSchema = z.object({
  id: z.string().optional(),
  chargeNo: z.string().min(1),
  furnaceId: z.string().optional().nullable(),
  furnaceNo: z.number().optional().nullable(),
  gasBefore: z.number().nullable().optional(),
  gasAfter: z.number().nullable().optional(),
  workDate: z.string(),
  shift: z.enum(["day", "night"]),
  source: z.enum(["auto", "manual", "paste"]).default("manual"),
  chargeRecordId: z.string().nullable().optional(),
  note: z.string().nullable().optional()
});

function publicEntry(entry: any) {
  return {
    ...entry,
    gasBefore: toNumber(entry.gasBefore),
    gasAfter: toNumber(entry.gasAfter),
    usage: toNumber(entry.usage),
    source: entry.source.toLowerCase(),
    shift: entry.shift.toLowerCase()
  };
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
    const where: Prisma.ChargeEntryWhereInput = {};
    if (req.query.furnaceId || req.query.furnaceNo) {
      const furnace = await resolveFurnace({
        furnaceId: req.query.furnaceId?.toString(),
        furnaceNo: req.query.furnaceNo ? Number(req.query.furnaceNo) : undefined
      });
      where.furnaceId = furnace.id;
    }
    if (req.query.from || req.query.to) {
      where.workDate = {
        gte: req.query.from ? dateOnly(req.query.from.toString()) : undefined,
        lte: req.query.to ? dateOnly(req.query.to.toString()) : undefined
      };
    }
    if (req.query.shift) where.shift = req.query.shift.toString().toLowerCase() === "day" ? "DAY" : "NIGHT";
    const [rows, total] = await Promise.all([
      prisma.chargeEntry.findMany({
        where,
        skip,
        take,
        orderBy: [{ workDate: "desc" }, { chargeNo: "desc" }],
        include: { furnace: true, chargeRecord: { include: { chargeScan: true } }, gasUsage: true }
      }),
      prisma.chargeEntry.count({ where })
    ]);
    res.json({ data: rows.map(publicEntry), page, pageSize, total });
  })
);

router.post(
  "/bulk",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ rows: z.array(rowSchema).min(1) }).parse(req.body);
    const seen = new Set<string>();
    for (const row of body.rows) {
      if (!validateChargeNoFormat(row.chargeNo)) throw new HttpError(400, `차지번호 형식 오류: ${row.chargeNo}`);
      if (seen.has(row.chargeNo)) throw new HttpError(400, `중복 차지번호: ${row.chargeNo}`);
      seen.add(row.chargeNo);
    }

    const touchedRecordIds = new Set<string>();
    const saved = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const row of body.rows) {
        const furnace = await resolveFurnace({ furnaceId: row.furnaceId, furnaceNo: row.furnaceNo });
        const source = row.source.toUpperCase() as EntrySource;
        const usage = calculateManualUsage(row.gasBefore, row.gasAfter);
        if (row.chargeRecordId) touchedRecordIds.add(row.chargeRecordId);
        const entry = await tx.chargeEntry.upsert({
          where: { chargeNo: row.chargeNo },
          create: {
            chargeNo: row.chargeNo,
            furnaceId: furnace.id,
            gasBefore: row.gasBefore,
            gasAfter: row.gasAfter,
            usage,
            workDate: dateOnly(row.workDate),
            shift: toDbShift(row.shift),
            source,
            chargeRecordId: row.chargeRecordId ?? undefined,
            note: row.note ?? undefined
          },
          update: {
            furnaceId: furnace.id,
            gasBefore: row.gasBefore,
            gasAfter: row.gasAfter,
            usage,
            workDate: dateOnly(row.workDate),
            shift: toDbShift(row.shift),
            source,
            chargeRecordId: row.chargeRecordId ?? undefined,
            note: row.note ?? undefined
          },
          include: { furnace: true, chargeRecord: { include: { chargeScan: true } }, gasUsage: true }
        });
        results.push(entry);
      }
      return results;
    });

    for (const recordId of touchedRecordIds) {
      await recalculateUsageForRecord(recordId);
    }

    res.json({ data: saved.map(publicEntry) });
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.chargeEntry.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;
