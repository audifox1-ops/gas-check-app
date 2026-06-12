import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../http";
import { publicUser, requireAuth, signToken, verifyPassword, AuthRequest } from "../auth";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: body.username } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    const authUser = { id: user.id, username: user.username, role: user.role };
    res.json({ token: signToken(authUser), user: publicUser(authUser) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
  })
);

export default router;
