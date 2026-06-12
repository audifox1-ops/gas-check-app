import { Download } from "lucide-react";
import { useState } from "react";
import { getToken } from "../lib/api";
import { Button, Field, Input, Panel, Select } from "../components/ui";

async function download(path: string, fileName: string) {
  const response = await fetch(path, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!response.ok) throw new Error(response.statusText);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ExportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", furnaceNo: "", shift: "" });
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "charges" | "gas", format: "csv" | "xlsx") {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.furnaceNo) params.set("furnaceNo", filters.furnaceNo);
      if (filters.shift && kind === "charges") params.set("shift", filters.shift);
      await download(`/api/export/${kind}.${format}?${params.toString()}`, `${kind}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내보내기 실패");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">내보내기</h2>
        <p className="text-sm text-muted">필터 조건으로 CSV 또는 Excel 파일을 생성합니다.</p>
      </div>
      <Panel>
        <div className="grid grid-cols-5 gap-3">
          <Field label="시작일"><Input type="date" value={filters.from} onChange={(event) => setFilters((f) => ({ ...f, from: event.target.value }))} /></Field>
          <Field label="종료일"><Input type="date" value={filters.to} onChange={(event) => setFilters((f) => ({ ...f, to: event.target.value }))} /></Field>
          <Field label="가열로"><Input value={filters.furnaceNo} placeholder="6" onChange={(event) => setFilters((f) => ({ ...f, furnaceNo: event.target.value }))} /></Field>
          <Field label="교대">
            <Select value={filters.shift} onChange={(event) => setFilters((f) => ({ ...f, shift: event.target.value }))}>
              <option value="">전체</option>
              <option value="day">주간</option>
              <option value="night">야간</option>
            </Select>
          </Field>
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-4">
        <Panel>
          <div className="mb-3 font-semibold">차지 집계</div>
          <div className="flex gap-2">
            <Button onClick={() => run("charges", "csv")}><Download size={16} />CSV</Button>
            <Button variant="secondary" onClick={() => run("charges", "xlsx")}><Download size={16} />Excel</Button>
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 font-semibold">가스 시계열</div>
          <div className="flex gap-2">
            <Button onClick={() => run("gas", "csv")}><Download size={16} />CSV</Button>
            <Button variant="secondary" onClick={() => run("gas", "xlsx")}><Download size={16} />Excel</Button>
          </div>
        </Panel>
      </div>
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div> : null}
    </div>
  );
}
