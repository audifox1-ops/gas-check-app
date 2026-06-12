/**
 * Vercel Serverless Function 진입점
 * Express 앱을 serverless-http로 래핑합니다.
 */
import serverless from "serverless-http";
import { createApp } from "../apps/api/src/app";

let handler: ReturnType<typeof serverless> | null = null;

export default async function (req: any, res: any) {
  if (!handler) {
    const app = await createApp();
    handler = serverless(app);
  }
  return handler(req, res);
}
