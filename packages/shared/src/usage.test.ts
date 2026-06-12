import { describe, expect, it } from "vitest";
import { calculateChargeUsages, GasPoint } from "./usage";

function points(furnaceId: string, start: string, values: number[]): GasPoint[] {
  const startDate = new Date(start);
  return values.map((value, index) => ({
    furnaceId,
    ts: new Date(startDate.getTime() + index * 60_000),
    gasCumulative: value
  }));
}

describe("charge gas usage calculation", () => {
  it("uses shift start for the first charge and previous end for the next charge", () => {
    const readings = new Map([
      [
        "f1",
        points("f1", "2026-06-10T08:00:00", [
          100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128, 130, 132, 134, 136,
          138, 140
        ])
      ]
    ]);
    const result = calculateChargeUsages(
      [
        { id: "a", chargeNo: "260610-001", furnaceId: "f1", workDate: "2026-06-10", shift: "day", workEnd: "2026-06-10 08:10:00" },
        { id: "b", chargeNo: "260610-002", furnaceId: "f1", workDate: "2026-06-10", shift: "day", workEnd: "2026-06-10 08:20:00" }
      ],
      readings
    );

    expect(result[0]!.gasBefore).toBe(100);
    expect(result[0]!.gasAfter).toBe(120);
    expect(result[0]!.usage).toBe(20);
    expect(result[1]!.gasBefore).toBe(120);
    expect(result[1]!.gasAfter).toBe(140);
    expect(result[1]!.usage).toBe(20);
  });

  it("warns and can correct rollover when a max value is configured", () => {
    const readings = new Map([
      ["f1", points("f1", "2026-06-10T20:00:00", [990, 995, 5])]
    ]);
    const result = calculateChargeUsages(
      [{ furnaceId: "f1", workDate: "2026-06-10", shift: "night", workEnd: "2026-06-10 20:02:00" }],
      readings,
      { rolloverMaxValue: 1000 }
    );

    expect(result[0]!.usage).toBe(15);
    expect(result[0]!.warnings.join(" ")).toContain("롤오버");
  });
});
