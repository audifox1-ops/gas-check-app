import { PrismaClient } from "@prisma/client";
import { combineDateAndClock, FURNACE_NOS, furnaceName } from "@taewoong/shared";
import { config } from "../src/config";
import { hashPassword } from "../src/auth";
import { recalculateUsageForRecord } from "../src/services/usageService";

const prisma = new PrismaClient();

async function main() {
  for (const no of FURNACE_NOS) {
    await prisma.furnace.upsert({
      where: { no },
      create: { no, name: furnaceName(no) },
      update: { name: furnaceName(no) }
    });
  }

  await prisma.user.upsert({
    where: { username: config.defaultAdmin.username },
    create: {
      username: config.defaultAdmin.username,
      passwordHash: await hashPassword(config.defaultAdmin.password),
      role: "ADMIN"
    },
    update: {
      passwordHash: await hashPassword(config.defaultAdmin.password),
      role: "ADMIN"
    }
  });

  const furnace = await prisma.furnace.findUniqueOrThrow({ where: { no: 6 } });
  const batch = await prisma.importBatch.create({
    data: {
      fileName: "sample-gas-2026-06-10.xlsx",
      furnaceId: furnace.id,
      periodStart: combineDateAndClock("2026-06-10", "08:00"),
      periodEnd: combineDateAndClock("2026-06-10", "09:00"),
      rowCount: 61,
      successCount: 61,
      status: "completed"
    }
  });

  const start = combineDateAndClock("2026-06-10", "08:00");
  await prisma.gasReading.createMany({
    skipDuplicates: true,
    data: Array.from({ length: 61 }, (_, index) => ({
      furnaceId: furnace.id,
      ts: new Date(start.getTime() + index * 60_000),
      temp: 930 + index * 0.2,
      gas: 2.5,
      gasCumulative: 10000 + index * 3,
      power: null,
      powerCumulative: 50000 + index,
      temp2: 920 + index * 0.1,
      temp3: 910 + index * 0.1,
      importBatchId: batch.id
    }))
  });

  let scan = await prisma.chargeScan.findFirst({ where: { originalFileName: "sample-charge-scan.pdf" } });
  if (!scan) {
    scan = await prisma.chargeScan.create({
      data: {
        fileUrl: "/uploads/scans/sample-charge-scan.pdf",
        storageKey: "scans/sample-charge-scan.pdf",
        originalFileName: "sample-charge-scan.pdf",
        pageCount: 1,
        status: "REVIEWING"
      }
    });
  }

  const record = await prisma.chargeRecord.upsert({
    where: { chargeScanId_pageIndex: { chargeScanId: scan.id, pageIndex: 0 } },
    create: {
      chargeScanId: scan.id,
      pageIndex: 0,
      furnaceId: furnace.id,
      workDate: new Date(2026, 5, 10),
      shift: "DAY",
      workEnd: combineDateAndClock("2026-06-10", "08:20"),
      material: "S45C",
      weightKg: 1200,
      note: "seed sample"
    },
    update: {
      furnaceId: furnace.id,
      workDate: new Date(2026, 5, 10),
      shift: "DAY",
      workEnd: combineDateAndClock("2026-06-10", "08:20"),
      material: "S45C",
      weightKg: 1200
    }
  });

  await prisma.chargeEntry.upsert({
    where: { chargeNo: "260610-006" },
    create: {
      chargeNo: "260610-006",
      furnaceId: furnace.id,
      workDate: new Date(2026, 5, 10),
      shift: "DAY",
      source: "AUTO",
      chargeRecordId: record.id
    },
    update: {
      furnaceId: furnace.id,
      workDate: new Date(2026, 5, 10),
      shift: "DAY",
      source: "AUTO",
      chargeRecordId: record.id
    }
  });

  await recalculateUsageForRecord(record.id);
  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
