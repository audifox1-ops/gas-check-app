import { useQuery } from "@tanstack/react-query";
import { FixedSizeList as List } from "react-window";
import { useState } from "react";
import { api } from "../lib/api";
import type { Furnace } from "../types";
import { Button, Field, Input, Panel, Select } from "../components/ui";

export default function ReadingsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", furnaceNo: "", shift: "", page: 1, pageSize: 300 });
  const furnaces = useQuery({ queryKey: ["furnaces"], queryFn: () => api<{ data: Furnace[] }>("/api/furnaces") });
  const readings = useQuery({
    queryKey: ["gas-readings", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
      if (filters.from) params.set("from", `${filters.from}T00:00:00`);
      if (filters.to) params.set("to", `${filters.to}T23:59:59`);
      if (filters.furnaceNo) params.set("furnaceNo", filters.furnaceNo);
      return api<any>(`/api/gas-readings?${params.toString()}`);
    }
  });

  const totalPages = Math.max(Math.ceil((readings.data?.total ?? 0) / filters.pageSize), 1);
  const rows = readings.data?.data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">조회 그리드</h2>
        <p className="text-sm text-muted">가스 시계열은 서버 페이지네이션으로 조회합니다.</p>
      </div>
      <Panel>
        <div className="grid grid-cols-6 gap-3">
          <Field label="시작일"><Input type="date" value={filters.from} onChange={(event) => setFilters((f) => ({ ...f, from: event.target.value, page: 1 }))} /></Field>
          <Field label="종료일"><Input type="date" value={filters.to} onChange={(event) => setFilters((f) => ({ ...f, to: event.target.value, page: 1 }))} /></Field>
          <Field label="가열로">
            <Select value={filters.furnaceNo} onChange={(event) => setFilters((f) => ({ ...f, furnaceNo: event.target.value, page: 1 }))}>
              <option value="">전체</option>
              {furnaces.data?.data.map((furnace) => <option key={furnace.id} value={furnace.no}>{furnace.name}</option>)}
            </Select>
          </Field>
          <Field label="페이지 크기">
            <Select value={filters.pageSize} onChange={(event) => setFilters((f) => ({ ...f, pageSize: Number(event.target.value), page: 1 }))}>
              <option value={100}>100</option>
              <option value={300}>300</option>
              <option value={1000}>1000</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>이전</Button>
            <Button variant="secondary" disabled={filters.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>다음</Button>
          </div>
          <div className="flex items-end text-sm text-muted">
            {filters.page} / {totalPages}
          </div>
        </div>
      </Panel>

      <Panel className="p-0">
        <div className="grid grid-cols-[130px_180px_120px_120px_140px_120px_140px_120px_120px] border-b border-border bg-panel px-3 py-2 text-sm font-semibold">
          <div>가열로</div>
          <div>시간</div>
          <div className="text-right">온도</div>
          <div className="text-right">가스</div>
          <div className="text-right">가스누적지침</div>
          <div className="text-right">전력</div>
          <div className="text-right">전력누적지침</div>
          <div className="text-right">온도2</div>
          <div className="text-right">온도3</div>
        </div>
        <List height={620} itemCount={rows.length} itemSize={38} width="100%">
          {({ index, style }) => {
            const row = rows[index];
            return (
              <div
                style={style}
                className="grid grid-cols-[130px_180px_120px_120px_140px_120px_140px_120px_120px] items-center border-b border-border px-3 text-sm"
              >
                <div>{row.furnace?.name}</div>
                <div>{String(row.ts).replace("T", " ").slice(0, 19)}</div>
                <div className="text-right">{row.temp ?? ""}</div>
                <div className="text-right">{row.gas ?? ""}</div>
                <div className="text-right font-semibold">{row.gasCumulative}</div>
                <div className="text-right">{row.power ?? ""}</div>
                <div className="text-right">{row.powerCumulative ?? ""}</div>
                <div className="text-right">{row.temp2 ?? ""}</div>
                <div className="text-right">{row.temp3 ?? ""}</div>
              </div>
            );
          }}
        </List>
      </Panel>
    </div>
  );
}
