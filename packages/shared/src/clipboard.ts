export interface ParsedTsv {
  headers: string[];
  rows: string[][];
}

export function parseTsv(input: string): ParsedTsv {
  const lines = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, index, all) => line.length > 0 || index < all.length - 1);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const cells = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  const first = cells[0] ?? [];
  const hasHeader = first.some((cell) =>
    ["차지", "차지번호", "사용전", "사용후", "가열로", "호기", "작업일자", "주간", "야간"].includes(cell)
  );

  return {
    headers: hasHeader ? first : [],
    rows: hasHeader ? cells.slice(1) : cells
  };
}

export function serializeTsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const body = rows.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))).join("\t")
  );
  return [headers.join("\t"), ...body].join("\n");
}

export function parseNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "" || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
