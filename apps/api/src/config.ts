import path from "node:path";
import dotenv from "dotenv";
import { DEFAULT_SHIFT_CONFIG, ShiftConfig } from "@taewoong/shared";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173",
  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  uploadDriver: process.env.UPLOAD_DRIVER ?? "local",
  localUploadDir: path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? "./uploads"),
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
    region: process.env.S3_REGION ?? "ap-northeast-2",
    bucket: process.env.S3_BUCKET ?? "taewoong-files",
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin"
  },
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME ?? "admin",
    password: process.env.DEFAULT_ADMIN_PASSWORD ?? "admin1234!"
  },
  shiftConfig: {
    dayStart: process.env.SHIFT_DAY_START ?? DEFAULT_SHIFT_CONFIG.dayStart,
    dayEnd: process.env.SHIFT_DAY_END ?? DEFAULT_SHIFT_CONFIG.dayEnd,
    nightStart: process.env.SHIFT_NIGHT_START ?? DEFAULT_SHIFT_CONFIG.nightStart,
    nightEnd: process.env.SHIFT_NIGHT_END ?? DEFAULT_SHIFT_CONFIG.nightEnd
  } satisfies ShiftConfig
};
