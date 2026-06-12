import path from "node:path";
import fs from "node:fs/promises";
import multer from "multer";
import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { combineDateAndClock, parseLocalDateTime } from "@taewoong/shared";
import { requireAuth, requireRole } from "../auth";
import { config } from "../config";
import { prisma } from "../db";
import { asyncHandler, dateOnly, HttpError, parsePagination, toNumber } from "../http";
import { resolveFurnace } from "../services/furnaces";
import { persistUploadedFile } from "../storage";
import { recalculateUsageForRecord, toDbShift } from "../services/usageService";

const router = Router();
const upload = multer({
  dest: path.join(config.localUploadDir, "tmp"),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) callback(null, true);
    else callback(new HttpError(400, "PDF 파일만 업로드할 수 있습니다."));
  }
});

const recordSchema = z.object({
  pageIndex: z.number().int().min(0),
  furnaceId: z.string().optional().nullable(),
  furnaceNo: z.number().optional().nullable(),
  workDate: z.string(),
  shift: z.enum(["day", "night"]),
  workEnd: z.string(),
  workStart: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  weightKg: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
  chargeNo: z.string().optional().nullable()
});

function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return Math.max(matches?.length ?? 1, 1);
}

function normalizeDateTime(workDate: string, value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (/^\d{1,2}:\d{2}/.test(value)) return combineDateAndClock(workDate, value.padStart(5, "0"));
  return parseLocalDateTime(value);
}

function publicRecord(record: any) {
  return {
    ...record,
    shift: record.shift?.toLowerCase?.() ?? record.shift,
    weightKg: toNumber(record.weightKg),
    gasUsages: record.gasUsages?.map((usage: any) => ({
      ...usage,
      cumStart: toNumber(usage.cumStart),
      cumEnd: toNumber(usage.cumEnd),
      usage: toNumber(usage.usage),
      weightKg: toNumber(usage.weightKg),
      unitRate: toNumber(usage.unitRate)
    }))
  };
}

router.post(
  "/upload",
  requireAuth,
  requireRole(Role.ADMIN),
  upload.array("files", 200),
  asyncHandler(async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length === 0) throw new HttpError(400, "PDF 파일이 필요합니다.");
    const results = [];
    for (const file of files) {
      try {
        const buffer = await fs.readFile(file.path);
        const stored = await persistUploadedFile(file, "scans");
        const scan = await prisma.chargeScan.create({
          data: {
            fileUrl: stored.url,
            storageKey: stored.key,
            originalFileName: file.originalname,
            pageCount: countPdfPages(buffer),
            status: "UPLOADED"
          }
        });
        results.push({ ok: true, scan });
      } catch (error) {
        await fs.unlink(file.path).catch(() => undefined);
        results.push({ ok: false, fileName: file.originalname, error: error instanceof Error ? error.message : String(error) });
      }
    }
    res.status(201).json({ data: results });
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
    const [rows, total] = await Promise.all([
      prisma.chargeScan.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { records: { include: { furnace: true, gasUsages: true } } }
      }),
      prisma.chargeScan.count()
    ]);
    res.json({ data: rows.map((scan) => ({ ...scan, records: scan.records.map(publicRecord) })), page, pageSize, total });
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const scan = await prisma.chargeScan.findUnique({
      where: { id: req.params.id },
      include: { records: { orderBy: { pageIndex: "asc" }, include: { furnace: true, entries: true, gasUsages: true } } }
    });
    if (!scan) throw new HttpError(404, "장입도 PDF를 찾을 수 없습니다.");
    res.json({ data: { ...scan, records: scan.records.map(publicRecord) } });
  })
);

router.post(
  "/:scanId/records",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = recordSchema.parse(req.body);
    const scan = await prisma.chargeScan.findUnique({ where: { id: req.params.scanId } });
    if (!scan) throw new HttpError(404, "장입도 PDF를 찾을 수 없습니다.");
    if (body.pageIndex >= scan.pageCount) throw new HttpError(400, "페이지 번호가 PDF 페이지 수를 초과합니다.");
    const furnace = await resolveFurnace({ furnaceId: body.furnaceId, furnaceNo: body.furnaceNo });
    const workDate = dateOnly(body.workDate);
    const record = await prisma.chargeRecord.upsert({
      where: { chargeScanId_pageIndex: { chargeScanId: scan.id, pageIndex: body.pageIndex } },
      create: {
        chargeScanId: scan.id,
        pageIndex: body.pageIndex,
        furnaceId: furnace.id,
        workDate,
        shift: toDbShift(body.shift),
        workEnd: normalizeDateTime(body.workDate, body.workEnd)!,
        workStart: normalizeDateTime(body.workDate, body.workStart),
        material: body.material ?? undefined,
        weightKg: body.weightKg ?? undefined,
        note: body.note ?? undefined
      },
      update: {
        furnaceId: furnace.id,
        workDate,
        shift: toDbShift(body.shift),
        workEnd: normalizeDateTime(body.workDate, body.workEnd)!,
        workStart: normalizeDateTime(body.workDate, body.workStart),
        material: body.material ?? undefined,
        weightKg: body.weightKg ?? undefined,
        note: body.note ?? undefined
      }
    });

    if (body.chargeNo) {
      await prisma.chargeEntry.upsert({
        where: { chargeNo: body.chargeNo },
        create: {
          chargeNo: body.chargeNo,
          furnaceId: furnace.id,
          workDate,
          shift: toDbShift(body.shift),
          source: "AUTO",
          chargeRecordId: record.id
        },
        update: {
          furnaceId: furnace.id,
          workDate,
          shift: toDbShift(body.shift),
          source: "AUTO",
          chargeRecordId: record.id
        }
      });
    }

    await recalculateUsageForRecord(record.id);
    const saved = await prisma.chargeRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: { furnace: true, entries: true, gasUsages: true }
    });
    res.status(201).json({ data: publicRecord(saved) });
  })
);

export default router;
