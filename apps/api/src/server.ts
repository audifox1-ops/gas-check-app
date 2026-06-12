import { createApp } from "./app";
import { prisma } from "./db";
import { config } from "./config";

async function main() {
  const app = await createApp();

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
