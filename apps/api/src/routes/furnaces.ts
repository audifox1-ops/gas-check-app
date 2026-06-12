import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../http";
import { requireAuth } from "../auth";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const furnaces = await prisma.furnace.findMany({ orderBy: { no: "asc" } });
    res.json({ data: furnaces });
  })
);

export default router;
