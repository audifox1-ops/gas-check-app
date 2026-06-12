import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { hashPassword, requireAuth, requireRole } from "../auth";
import { prisma } from "../db";
import { asyncHandler } from "../http";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ data: users.map(({ passwordHash: _passwordHash, ...user }) => ({ ...user, role: user.role.toLowerCase() })) });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        username: z.string().min(2),
        password: z.string().min(8),
        role: z.enum(["admin", "user"]).default("user")
      })
      .parse(req.body);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await hashPassword(body.password),
        role: body.role === "admin" ? "ADMIN" : "USER"
      }
    });
    const { passwordHash: _passwordHash, ...publicData } = user;
    res.status(201).json({ data: { ...publicData, role: user.role.toLowerCase() } });
  })
);

export default router;
