import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./db";
import { HttpError } from "./http";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function signToken(user: AuthUser): string {
  const options: jwt.SignOptions = {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  };
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, config.jwtSecret, options);
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) throw new HttpError(401, "Missing bearer token");
    const payload = jwt.verify(token, config.jwtSecret) as { sub?: string };
    if (!payload.sub) throw new HttpError(401, "Invalid token");
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, "User not found");
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid token"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Insufficient permissions"));
    return next();
  };
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role.toLowerCase()
  };
}
