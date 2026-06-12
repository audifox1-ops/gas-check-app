import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import { combineDateAndClock } from "@taewoong/shared";

const root = path.resolve(process.cwd(), "../../samples");

function makePdf(): string {
  return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 102 >> stream
BT /F1 18 Tf 72 760 Td (TAEWOONG Charge Record Sample) Tj 0 -32 Td (WorkEnd 2026-06-10 08:20 Furnace 6) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000394 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
464
%%EOF`;
}

async function main() {
  await fs.mkdir(root, { recursive: true });
  const start = combineDateAndClock("2026-06-10", "08:00");
  const rows = Array.from({ length: 61 }, (_, index) => ({
    순번: index + 1,
    시간: new Date(start.getTime() + index * 60_000).toISOString().slice(0, 19).replace("T", " "),
    온도: 930 + index * 0.2,
    가스: 2.5,
    가스누적지침: 10000 + index * 3,
    전력: "-",
    전력누적지침: 50000 + index,
    온도2: 920 + index * 0.1,
    온도3: 910 + index * 0.1
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "이력");
  XLSX.writeFile(workbook, path.join(root, "가열로6호기_가스_온도(2026-06-10 08_00 - 2026-06-10 09_00).xlsx"));

  await fs.writeFile(path.join(root, "sample-charge-scan.pdf"), makePdf(), "latin1");
  await fs.writeFile(
    path.join(root, "charge-entries.tsv"),
    "차지번호\t사용전\t사용후\t가열로\t작업일자\t교대\n260610-006\t10000\t10060\t가열6호\t2026-06-10\tday\n",
    "utf8"
  );
  console.log(`Sample files written to ${root}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
