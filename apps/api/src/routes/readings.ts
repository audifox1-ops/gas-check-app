import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../auth";
import { prisma } from "../db";
import { asyncHandler, parsePagination, toNumber } from "../http";
import { resolveFurnace } from "../services/furnaces";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = parsePagination(req);
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
    const [rows, total] = await Promise.all([
      prisma.gasReading.findMany({
        where,
        skip,
        take,
        orderBy: { ts: "desc" },
        include: { furnace: true }
      }),
      prisma.gasReading.count({ where })
    ]);
    res.json({
      data: rows.map((row) => ({
        ...row,
        id: row.id.toString(),
        temp: toNumber(row.temp),
        gas: toNumber(row.gas),
        gasCumulative: toNumber(row.gasCumulative),
        power: toNumber(row.power),
        powerCumulative: toNumber(row.powerCumulative),
        temp2: toNumber(row.temp2),
        temp3: toNumber(row.temp3)
      })),
      page,
      pageSize,
      total
    });
  })
);

export default router;
