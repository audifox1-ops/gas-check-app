import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { api } from "../lib/api";
import type { Furnace } from "../types";
import PdfViewer from "../components/PdfViewer";
import { Button, Field, Input, Panel, Select } from "../components/ui";

export default function AnalysisPage() {
  const [filters, setFilters] = useState({ from: "", to: "", furnaceNo: "", shift: "" });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const furnaces = useQuery({ queryKey: ["furnaces"], queryFn: () => api<{ data: Furnace[] }>("/api/furnaces") });
  const overview = useQuery({
    queryKey: ["analysis", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.furnaceNo) params.set("furnaceNo", filters.furnaceNo);
      if (filters.shift) params.set("shift", filters.shift);
      return api<any>(`/api/analysis/overview?${params.toString()}`);
    }
  });
  const detail = useQuery({
    queryKey: ["analysis-detail", selectedEntryId],
    enabled: Boolean(selectedEntryId),
    queryFn: () => api<any>(`/api/analysis/charge/${selectedEntryId}`)
  });

  const rows = overview.data?.rows ?? [];
  const chartRows = rows.map((row: any) => ({
    label: `${String(row.workDate).slice(5, 10)} ${row.furnaceName}`,
    usage: row.usage ?? 0,
    unitRate: row.unitRate ?? 0
  }));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">연결 분석</h2>
        <p className="text-sm text-muted">차지별 사용량, 중량, 원단위와 장입도 PDF를 함께 봅니다.</p>
      </div>

      <Panel>
        <div className="grid grid-cols-5 gap-3">
          <Field label="시작일"><Input type="date" value={filters.from} onChange={(event) => setFilters((f) => ({ ...f, from: event.target.value }))} /></Field>
          <Field label="종료일"><Input type="date" value={filters.to} onChange={(event) => setFilters((f) => ({ ...f, to: event.target.value }))} /></Field>
          <Field label="가열로">
            <Select value={filters.furnaceNo} onChange={(event) => setFilters((f) => ({ ...f, furnaceNo: event.target.value }))}>
              <option value="">전체</option>
              {furnaces.data?.data.map((furnace) => <option key={furnace.id} value={furnace.no}>{furnace.name}</option>)}
            </Select>
          </Field>
          <Field label="교대">
            <Select value={filters.shift} onChange={(event) => setFilters((f) => ({ ...f, shift: event.target.value }))}>
              <option value="">전체</option>
              <option value="day">주간</option>
              <option value="night">야간</option>
            </Select>
          </Field>
          <div className="flex items-end"><Button variant="secondary" onClick={() => overview.refetch()}>조회</Button></div>
        </div>
      </Panel>

      <div className="grid grid-cols-4 gap-4">
        <Panel><div className="text-sm text-muted">건수</div><div className="mt-2 text-2xl font-bold">{overview.data?.summary.count ?? 0}</div></Panel>
        <Panel><div className="text-sm text-muted">총 사용량</div><div className="mt-2 text-2xl font-bold">{overview.data?.summary.totalUsage?.toLocaleString() ?? 0}</div></Panel>
        <Panel><div className="text-sm text-muted">총 중량 kg</div><div className="mt-2 text-2xl font-bold">{overview.data?.summary.totalWeight?.toLocaleString() ?? 0}</div></Panel>
        <Panel><div className="text-sm text-muted">원단위</div><div className="mt-2 text-2xl font-bold">{overview.data?.summary.unitRate?.toFixed(4) ?? "-"}</div></Panel>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-4">
        <Panel>
          <div className="mb-3 font-semibold">사용량 추이</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" hide={chartRows.length > 18} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usage" fill="#0f766e" name="사용량" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 font-semibold">원단위</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="unitRate" stroke="#b45309" dot={false} name="원단위" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(520px,1fr)_minmax(520px,1fr)] gap-4">
        <Panel className="p-0">
          <div className="border-b border-border p-3 font-semibold">차지 목록</div>
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr>
                  <th className="p-2 text-left">차지</th>
                  <th className="p-2 text-left">가열로</th>
                  <th className="p-2 text-left">일자</th>
                  <th className="p-2 text-right">사용량</th>
                  <th className="p-2 text-right">중량</th>
                  <th className="p-2 text-right">원단위</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-t border-border hover:bg-panel ${selectedEntryId === row.chargeEntryId ? "bg-teal-50" : ""}`}
                    onClick={() => row.chargeEntryId && setSelectedEntryId(row.chargeEntryId)}
                  >
                    <td className="p-2 font-semibold">{row.chargeNo ?? "-"}</td>
                    <td className="p-2">{row.furnaceName}</td>
                    <td className="p-2">{String(row.workDate).slice(0, 10)} · {row.shift}</td>
                    <td className="p-2 text-right">{row.usage ?? ""}</td>
                    <td className="p-2 text-right">{row.weightKg ?? ""}</td>
                    <td className="p-2 text-right">{row.unitRate?.toFixed?.(4) ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="min-w-0">
          <div className="mb-3 font-semibold">차트 · PDF</div>
          {detail.data?.data ? (
            <div className="grid gap-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detail.data.data.chart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ts" hide />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="gasCumulative" stroke="#0f766e" dot={false} name="가스누적지침" />
                    <Line type="monotone" dataKey="temp" stroke="#b45309" dot={false} name="온도" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {detail.data.data.scan ? (
                <PdfViewer url={detail.data.data.scan.fileUrl} pageCount={detail.data.data.scan.pageCount} />
              ) : (
                <div className="rounded-md bg-panel p-4 text-sm text-muted">연결된 PDF 없음</div>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-panel p-4 text-sm text-muted">차지 선택</div>
          )}
        </Panel>
      </div>
    </div>
  );
}
