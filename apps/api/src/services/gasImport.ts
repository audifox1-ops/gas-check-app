import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import {
  inferFurnaceAndPeriodFromFileName,
  parseLocalDateTime,
  parseNullableNumber
} from "@taewoong/shared";
import { prisma } from "../db";
import { HttpError } from "../http";

const REQUIRED_HEADERS = ["시간", "가스누적지침"];
const HEADER_ALIASES: Record<string, string[]> = {
  sequence: ["순번", "No", "NO"],
  ts: ["시간", "일시", "Time", "timestamp"],
  temp: ["온도", "Temp", "temperature"],
  gas: ["가스", "Gas"],
  gasCumulative: ["가스누적지침", "가스 누적 지침", "gasCumulative"],
  power: ["전력", "Power"],
  powerCumulative: ["전력누적지침", "전력 누적 지침", "powerCumulative"],
  temp2: ["온도2", "Temp2"],
  temp3: ["온도3", "Temp3"]
};

export interface ImportPreview {
  inferredFurnaceNo: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  missingHeaders: string[];
}

export interface ImportGasFileInput {
  filePath: string;
  fileName: string;
  furnaceId: string;
  batchId: string;
}

function normalizeKey(key: string): string {
  return key.trim().replace(/\s+/g, "");
}

function normalizeRecord(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
}

function readAliased(row: Record<string, unknown>, logicalName: keyof typeof HEADER_ALIASES): unknown {
  const normalized = normalizeRecord(row);
  for (const key of HEADER_ALIASES[logicalName] ?? []) {
    const value = normalized[normalizeKey(key)];
    if (value !== undefined) return value;
  }
  return undefined;
}

function parseExcelDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
    }
  }
  if (typeof value === "string") return parseLocalDateTime(value);
  throw new Error(`Invalid timestamp: ${String(value)}`);
}

function toDecimal(value: unknown): Prisma.Decimal | null {
  const parsed = parseNullableNumber(typeof value === "number" ? value : value === null || value === undefined ? null : String(value));
  return parsed === null ? null : new Prisma.Decimal(parsed);
}

function rowToGasReading(
  row: Record<string, unknown>,
  furnaceId: string,
  importBatchId: string
): Prisma.GasReadingCreateManyInput {
  const ts = parseExcelDate(readAliased(row, "ts"));
  const gasCumulative = toDecimal(readAliased(row, "gasCumulative"));
  if (!gasCumulative) {
    throw new Error("가스누적지침 값이 비어 있습니다.");
  }

  return {
    furnaceId,
    importBatchId,
    ts,
    temp: toDecimal(readAliased(row, "temp")),
    gas: toDecimal(readAliased(row, "gas")),
    gasCumulative,
    power: toDecimal(readAliased(row, "power")),
    powerCumulative: toDecimal(readAliased(row, "powerCumulative")),
    temp2: toDecimal(readAliased(row, "temp2")),
    temp3: toDecimal(readAliased(row, "temp3"))
  };
}

function inspectHeaders(rows: Array<Record<string, unknown>>): { headers: string[]; missingHeaders: string[] } {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const normalized = new Set(headers.map(normalizeKey));
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !normalized.has(normalizeKey(header)));
  return { headers, missingHeaders };
}

export async function previewGasFile(filePath: string, fileName: string, maxRows = 20): Promise<ImportPreview> {
  const inferred = inferFurnaceAndPeriodFromFileName(fileName);
  const extension = path.extname(fileName).toLowerCase();
  let rows: Array<Record<string, unknown>> = [];

  if (extension === ".csv") {
    const parser = fs.createReadStream(filePath).pipe(
      parse({ columns: true, bom: true, trim: true, skip_empty_lines: true })
    );
    for await (const row of parser) {
      rows.push(row);
      if (rows.length >= maxRows) break;
    }
  } else {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames.includes("이력") ? "이력" : workbook.SheetNames[0];
    if (!sheetName) throw new HttpError(400, "Excel 파일에 시트가 없습니다.");
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]!, {
      defval: null,
      raw: false
    }).slice(0, maxRows);
  }

  const { headers, missingHeaders } = inspectHeaders(rows);
  return {
    inferredFurnaceNo: inferred.furnaceNo,
    periodStart: inferred.periodStart,
    periodEnd: inferred.periodEnd,
    headers,
    rows,
    missingHeaders
  };
}

async function flushRows(rows: Prisma.GasReadingCreateManyInput[]) {
  if (rows.length === 0) return 0;
  const result = await prisma.gasReading.createMany({ data: rows, skipDuplicates: true });
  rows.length = 0;
  return result.count;
}

export async function importGasFile(input: ImportGasFileInput): Promise<void> {
  const extension = path.extname(input.fileName).toLowerCase();
  const pending: Prisma.GasReadingCreateManyInput[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let rowCount = 0;
  let successCount = 0;

  await prisma.importBatch.update({ where: { id: input.batchId }, data: { status: "running" } });

  const pushRow = async (row: Record<string, unknown>, rowNumber: number) => {
    rowCount += 1;
    try {
      pending.push(rowToGasReading(row, input.furnaceId, input.batchId));
      if (pending.length >= 5000) successCount += await flushRows(pending);
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : String(error) });
    }
  };

  if (extension === ".csv") {
    const parser = fs.createReadStream(input.filePath).pipe(
      parse({ columns: true, bom: true, trim: true, skip_empty_lines: true })
    );
    let rowNumber = 1;
    for await (const row of parser) {
      await pushRow(row, rowNumber++);
    }
  } else if ([".xlsx", ".xls"].includes(extension)) {
    const workbook = XLSX.readFile(input.filePath, { cellDates: true });
    const sheetName = workbook.SheetNames.includes("이력") ? "이력" : workbook.SheetNames[0];
    if (!sheetName) throw new HttpError(400, "Excel 파일에 시트가 없습니다.");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]!, {
      defval: null,
      raw: false
    });
    for (let index = 0; index < rows.length; index += 1) {
      await pushRow(rows[index]!, index + 2);
    }
  } else {
    throw new HttpError(400, "CSV 또는 Excel 파일만 업로드할 수 있습니다.");
  }

  successCount += await flushRows(pending);
  await prisma.importBatch.update({
    where: { id: input.batchId },
    data: {
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      rowCount,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 200)
    }
  });
}
