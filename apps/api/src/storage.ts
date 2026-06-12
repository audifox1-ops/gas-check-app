import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { config } from "./config";

export interface StoredFile {
  key: string;
  url: string;
}

let s3Client: S3Client | null = null;

function s3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey
      }
    });
  }
  return s3Client;
}

export async function ensureUploadDirs() {
  await fs.mkdir(config.localUploadDir, { recursive: true });
  await fs.mkdir(path.join(config.localUploadDir, "tmp"), { recursive: true });
}

export async function persistUploadedFile(file: Express.Multer.File, category: string): Promise<StoredFile> {
  const safeName = file.originalname.replace(/[^\p{L}\p{N}._ -]/gu, "_");
  const key = `${category}/${randomUUID()}-${safeName}`;

  if (config.uploadDriver === "s3") {
    await s3().send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: await fs.readFile(file.path),
        ContentType: file.mimetype || mime.lookup(file.originalname) || "application/octet-stream"
      })
    );
    await fs.unlink(file.path).catch(() => undefined);
    return { key, url: `${config.s3.endpoint}/${config.s3.bucket}/${key}` };
  }

  const target = path.join(config.localUploadDir, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(file.path, target);
  return { key, url: `/uploads/${key.replace(/\\/g, "/")}` };
}
