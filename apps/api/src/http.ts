import { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function parsePagination(req: Request) {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 100), 1), 1000);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function dateOnly(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new HttpError(400, `Invalid date: ${value}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
    res.status(400).json({ error: "Validation failed", details: error });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
