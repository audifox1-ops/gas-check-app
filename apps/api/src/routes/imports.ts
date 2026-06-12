import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { Role } from "@prisma/client";
import { inferFurnaceAndPeriodFromFileName } from "@taewoong/shared";
import { requireAuth, requireRole } from "../auth";
import { config } from "../config";
import { prisma } from "../db";
import { asyncHandler, HttpError, parsePagination } from "../http";
import { resolveFurnace } from "../services/furnaces";
import { importGasFile, previewGasFile } from "../services/gasImport";

const router = Router();
const upload = multer({
  dest: path.join(config.localUploadDir, "tmp"),
  limits: { fileSize: 500 * 1024 * 1024 }
});

router.post(
  "/gas/preview",
  requireAuth,
  requireRole(Role.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "파일이 필요합니다.");
    try {
      const preview = await previewGasFile(req.file.path, req.file.originalname);
      res.json(preview);
    } finally {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
  })
);

router.post(
  "/gas",
  requireAuth,
  requireRole(Role.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "파일이 필요합니다.");
    const inferred = inferFurnaceAndPeriodFromFileName(req.file.originalname);
    const furnaceNo = req.body.furnaceNo ? Number(req.body.furnaceNo) : inferred.furnaceNo;
    const furnace = await resolveFurnace({ furnaceNo });
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (![".csv", ".xlsx", ".xls"].includes(extension)) {
      throw new HttpError(400, "CSV 또는 Excel 파일만 업로드할 수 있습니다.");
    }

    const batch = await prisma.importBatch.create({
      data: {
        fileName: req.file.originalname,
        furnaceId: furnace.id,
        periodStart: inferred.periodStart,
        periodEnd: inferred.periodEnd,
        status: "pending"
      }
    });

    try {
      await importGasFile({
        filePath: req.file.path,
        fileName: req.file.originalname,
        furnaceId: furnace.id,
        batchId: batch.id
      });
      const completed = await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
      res.status(201).json({ data: completed });
    } finally {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
  })
);

router.get(
  "/batches",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.importBatch.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { furnace: true }
      }),
      prisma.importBatch.count()
    ]);
    res.json({ data, page, pageSize, total });
  })
);

export default router;
