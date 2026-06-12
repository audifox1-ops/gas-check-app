import { describe, expect, it } from "vitest";
import { parseNullableNumber, parseTsv, serializeTsv } from "./clipboard";

describe("TSV clipboard parsing", () => {
  it("parses Korean headers and data rows", () => {
    const parsed = parseTsv("차지번호\t사용전\t사용후\t가열로\n260610-006\t1,000\t1,120\t가열6호");
    expect(parsed.headers).toEqual(["차지번호", "사용전", "사용후", "가열로"]);
    expect(parsed.rows).toEqual([["260610-006", "1,000", "1,120", "가열6호"]]);
    expect(parseNullableNumber(parsed.rows[0]![1])).toBe(1000);
  });

  it("round-trips export layout", () => {
    const tsv = serializeTsv(["차지번호", "사용전", "사용후"], [["260610-006", 10, 15]]);
    expect(tsv).toBe("차지번호\t사용전\t사용후\n260610-006\t10\t15");
  });
});
