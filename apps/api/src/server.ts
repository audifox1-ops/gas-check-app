import express from "express";
import cors from "cors";
import path from "node:path";
import { config } from "./config";
import { prisma } from "./db";
import { errorHandler } from "./http";
import { ensureUploadDirs } from "./storage";
import authRoutes from "./routes/auth";
import furnaceRoutes from "./routes/furnaces";
import importRoutes from "./routes/imports";
import readingRoutes from "./routes/readings";
import chargeEntryRoutes from "./routes/chargeEntries";
import scanRoutes from "./routes/scans";
import analysisRoutes from "./routes/analysis";
import exportRoutes from "./routes/exports";
import userRoutes from "./routes/users";

async function main() {
  await ensureUploadDirs();
  const app = express();

  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: "20mb" }));
  app.use("/uploads", express.static(path.join(config.localUploadDir)));

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "taewoong-gas-api" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/furnaces", furnaceRoutes);
  app.use("/api/imports", importRoutes);
  app.use("/api/gas-readings", readingRoutes);
  app.use("/api/charge-entries", chargeEntryRoutes);
  app.use("/api/scans", scanRoutes);
  app.use("/api/analysis", analysisRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/users", userRoutes);
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`API listening on http://127.0.0.1:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
