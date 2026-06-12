import { Router } from "express";
import { Prisma } from "@prisma/client";
import XLSX from "xlsx";
import { requireAuth } from "../auth";
import { prisma } from "../db";
import { asyncHandler, dateOnly, toNumber } from "../http";
import { resolveFurnace } from "../services/furnaces";

const router = Router();

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function sendXlsx(res: any, fileName: string, sheetName: string, rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  res.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.attachment(fileName).send(buffer);
}

router.get(
  "/charges.csv",
  requireAuth,
  asyncHandler(async (req, res) => {
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

    const rows = await prisma.chargeEntry.findMany({
      where,
      include: { furnace: true, chargeRecord: true },
      orderBy: [{ workDate: "asc" }, { chargeNo: "asc" }]
    });
    const content = csv([
      ["차지번호", "사용전", "사용후", "사용량", "가열로", "작업일자", "교대", "출처", "비고"],
      ...rows.map((row) => [
        row.chargeNo,
        toNumber(row.gasBefore),
        toNumber(row.gasAfter),
        toNumber(row.usage),
        row.furnace.name,
        row.workDate.toISOString().slice(0, 10),
        row.shift.toLowerCase(),
        row.source.toLowerCase(),
        row.note
      ])
    ]);
    res.header("content-type", "text/csv; charset=utf-8");
    res.attachment("charge-entries.csv").send(`\uFEFF${content}`);
  })
);

router.get(
  "/gas.csv",
  requireAuth,
  asyncHandler(async (req, res) => {
    const where: Prisma.GasReadingWhereInput = {};
    if (req.query.furnaceId || req.query.furnaceNo) {
      const furnace = await resolveFurnace({
        furnaceId: req.query.furnaceId?.toString(),
        furnaceNo: req.query.furnaceNo ? Number(req.query.furnaceNo) : undefined
      });
      where.furnaceId = furnace.id;
    }
    if (req.query.from || req.query.to) {
      where.ts = {
        gte: req.query.from ? new Date(req.query.from.toString()) : undefined,
        lte: req.query.to ? new Date(req.query.to.toString()) : undefined
      };
    }
    const rows = await prisma.gasReading.findMany({
      where,
      take: 100000,
      include: { furnace: true },
      orderBy: { ts: "asc" }
    });
    const content = csv([
      ["순번", "시간", "온도", "가스", "가스누적지침", "전력", "전력누적지침", "온도2", "온도3", "가열로"],
      ...rows.map((row, index) => [
        index + 1,
        row.ts.toISOString(),
        toNumber(row.temp),
        toNumber(row.gas),
        toNumber(row.gasCumulative),
        toNumber(row.power),
        toNumber(row.powerCumulative),
        toNumber(row.temp2),
        toNumber(row.temp3),
        row.furnace.name
      ])
    ]);
    res.header("content-type", "text/csv; charset=utf-8");
    res.attachment("gas-readings.csv").send(`\uFEFF${content}`);
  })
);

router.get(
  "/charges.xlsx",
  requireAuth,
  asyncHandler(async (req, res) => {
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

    const rows = await prisma.chargeEntry.findMany({
      where,
      include: { furnace: true, chargeRecord: true },
      orderBy: [{ workDate: "asc" }, { chargeNo: "asc" }]
    });
    sendXlsx(res, "charge-entries.xlsx", "charge-entries", [
      ["차지번호", "사용전", "사용후", "사용량", "가열로", "작업일자", "교대", "출처", "비고"],
      ...rows.map((row) => [
        row.chargeNo,
        toNumber(row.gasBefore),
        toNumber(row.gasAfter),
        toNumber(row.usage),
        row.furnace.name,
        row.workDate.toISOString().slice(0, 10),
        row.shift.toLowerCase(),
        row.source.toLowerCase(),
        row.note
      ])
    ]);
  })
);

router.get(
  "/gas.xlsx",
  requireAuth,
  asyncHandler(async (req, res) => {
    const where: Prisma.GasReadingWhereInput = {};
    if (req.query.furnaceId || req.query.furnaceNo) {
      const furnace = await resolveFurnace({
        furnaceId: req.query.furnaceId?.toString(),
        furnaceNo: req.query.furnaceNo ? Number(req.query.furnaceNo) : undefined
      });
      where.furnaceId = furnace.id;
    }
    if (req.query.from || req.query.to) {
      where.ts = {
        gte: req.query.from ? new Date(req.query.from.toString()) : undefined,
        lte: req.query.to ? new Date(req.query.to.toString()) : undefined
      };
    }
    const rows = await prisma.gasReading.findMany({
      where,
      take: 100000,
      include: { furnace: true },
      orderBy: { ts: "asc" }
    });
    sendXlsx(res, "gas-readings.xlsx", "gas-readings", [
      ["순번", "시간", "온도", "가스", "가스누적지침", "전력", "전력누적지침", "온도2", "온도3", "가열로"],
      ...rows.map((row, index) => [
        index + 1,
        row.ts.toISOString(),
        toNumber(row.temp),
        toNumber(row.gas),
        toNumber(row.gasCumulative),
        toNumber(row.power),
        toNumber(row.powerCumulative),
        toNumber(row.temp2),
        toNumber(row.temp3),
        row.furnace.name
      ])
    ]);
  })
);

export default router;
