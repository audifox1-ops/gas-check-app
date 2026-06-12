import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import type { CellValueChangedEvent, ColDef } from "ag-grid-community";
import { ClientSideRowModelModule, ModuleRegistry } from "ag-grid-community";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatLocalDate,
  parseFurnaceNo,
  parseNullableNumber,
  parseTsv,
  serializeTsv,
  validateChargeGridRow
} from "@taewoong/shared";
import { api } from "../lib/api";
import type { ChargeEntry, Furnace, Shift } from "../types";
import { Button, Field, Input, Panel, Select } from "../components/ui";

ModuleRegistry.registerModules([ClientSideRowModelModule]);

function emptyRow(furnaceNo = 6): ChargeEntry {
  return {
    chargeNo: "",
    furnaceNo,
    gasBefore: null,
    gasAfter: null,
    usage: null,
    workDate: formatLocalDate(new Date()),
    shift: "day",
    source: "manual",
    note: ""
  };
}

function normalizeEntry(entry: any): ChargeEntry {
  return {
    ...entry,
    furnaceNo: entry.furnace?.no ?? entry.furnaceNo,
    workDate: String(entry.workDate).slice(0, 10),
    shift: entry.shift?.toLowerCase() as Shift,
    source: entry.source?.toLowerCase() ?? "manual"
  };
}

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ChargeGridPage() {
  const [rows, setRows] = useState<ChargeEntry[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", furnaceNo: "", shift: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const furnaces = useQuery({ queryKey: ["furnaces"], queryFn: () => api<{ data: Furnace[] }>("/api/furnaces") });
  const entries = useQuery({
    queryKey: ["charge-entries", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.furnaceNo) params.set("furnaceNo", filters.furnaceNo);
      if (filters.shift) params.set("shift", filters.shift);
      const result = await api<{ data: any[] }>(`/api/charge-entries?${params.toString()}`);
      const normalized = result.data.map(normalizeEntry);
      setRows(normalized);
      return normalized;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = rows
        .filter((row) => row.chargeNo.trim())
        .map((row) => ({
          id: row.id,
          chargeNo: row.chargeNo.trim(),
          furnaceNo: row.furnaceNo,
          gasBefore: row.gasBefore,
          gasAfter: row.gasAfter,
          workDate: row.workDate,
          shift: row.shift,
          source: row.source,
          chargeRecordId: row.chargeRecordId,
          note: row.note
        }));
      return api<{ data: ChargeEntry[] }>("/api/charge-entries/bulk", {
        method: "POST",
        body: JSON.stringify({ rows: payload })
      });
    },
    onSuccess: (result) => {
      setRows(result.data.map(normalizeEntry));
      setNotice(`${result.data.length}행 저장`);
      queryClient.invalidateQueries({ queryKey: ["analysis"] });
      queryClient.invalidateQueries({ queryKey: ["charge-entries"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      for (const id of selectedIds) await api(`/api/charge-entries/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      setRows((current) => current.filter((row) => !row.id || !selectedIds.includes(row.id)));
      setSelectedIds([]);
    }
  });

  const duplicateNos = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.chargeNo) counts.set(row.chargeNo, (counts.get(row.chargeNo) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([chargeNo]) => chargeNo));
  }, [rows]);

  function updateRow(index: number, patch: Partial<ChargeEntry>) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...patch };
        next.usage =
          next.gasBefore !== null && next.gasAfter !== null && next.gasBefore !== undefined && next.gasAfter !== undefined
            ? next.gasAfter - next.gasBefore
            : null;
        return next;
      })
    );
  }

  function pasteRows(text: string) {
    const parsed = parseTsv(text);
    const headers = parsed.headers.length
      ? parsed.headers
      : ["차지번호", "사용전", "사용후", "가열로", "작업일자", "교대", "비고"];
    const mapped = parsed.rows.map((row) => {
      const obj = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      const furnaceNo = parseFurnaceNo(String(obj["가열로"] ?? obj["호기"] ?? "")) ?? Number(obj["가열로"] || obj["호기"] || 6);
      const gasBefore = parseNullableNumber(String(obj["사용전"] ?? ""));
      const gasAfter = parseNullableNumber(String(obj["사용후"] ?? ""));
      return {
        chargeNo: String(obj["차지번호"] ?? obj["차지"] ?? ""),
        gasBefore,
        gasAfter,
        usage: gasBefore !== null && gasAfter !== null ? gasAfter - gasBefore : null,
        furnaceNo,
        workDate: String(obj["작업일자"] ?? formatLocalDate(new Date())).slice(0, 10),
        shift: String(obj["교대"] ?? "day").includes("야") || String(obj["교대"] ?? "day").toLowerCase() === "night" ? "night" : "day",
        source: "paste",
        note: String(obj["비고"] ?? "")
      } satisfies ChargeEntry;
    });
    setRows((current) => [...current, ...mapped]);
    setNotice(`${mapped.length}행 붙여넣기`);
  }

  const columns = useMemo<ColDef<ChargeEntry>[]>(
    () => [
      { checkboxSelection: true, headerCheckboxSelection: true, width: 48, pinned: "left" },
      { field: "chargeNo", headerName: "차지번호", editable: true, minWidth: 140, pinned: "left" },
      {
        field: "gasBefore",
        headerName: "사용전",
        editable: true,
        type: "numericColumn",
        valueParser: (params) => parseNullableNumber(params.newValue)
      },
      {
        field: "gasAfter",
        headerName: "사용후",
        editable: true,
        type: "numericColumn",
        valueParser: (params) => parseNullableNumber(params.newValue)
      },
      {
        field: "usage",
        headerName: "사용량",
        editable: false,
        type: "numericColumn",
        cellClassRules: { "text-danger font-semibold": (params) => Number(params.value) < 0 }
      },
      {
        field: "furnaceNo",
        headerName: "가열로",
        editable: true,
        width: 110,
        valueFormatter: (params) => (params.value ? `가열${params.value}호` : "")
      },
      { field: "workDate", headerName: "작업일자", editable: true, width: 130 },
      {
        field: "shift",
        headerName: "교대",
        editable: true,
        width: 100,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["day", "night"] },
        valueFormatter: (params) => (params.value === "night" ? "야간" : "주간")
      },
      { field: "source", headerName: "출처", width: 100 },
      { field: "note", headerName: "비고", editable: true, flex: 1, minWidth: 180 }
    ],
    []
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">차지 사용량 그리드</h2>
          <p className="text-sm text-muted">사용량은 사용후에서 사용전을 뺀 값으로 계산됩니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setRows((current) => [emptyRow(Number(filters.furnaceNo) || 6), ...current])}>
            <Plus size={16} />
            행 추가
          </Button>
          <Button variant="secondary" disabled={!selectedIds.length || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            <Trash2 size={16} />
            삭제
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadText(
                "charge-entries.tsv",
                serializeTsv(
                  ["차지번호", "사용전", "사용후", "사용량", "가열로", "작업일자", "교대", "비고"],
                  rows.map((row) => [
                    row.chargeNo,
                    row.gasBefore,
                    row.gasAfter,
                    row.usage,
                    row.furnaceNo ? `가열${row.furnaceNo}호` : "",
                    row.workDate,
                    row.shift,
                    row.note
                  ])
                )
              )
            }
          >
            <Download size={16} />
            TSV
          </Button>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save size={16} />
            저장
          </Button>
        </div>
      </div>

      <Panel>
        <div className="grid grid-cols-5 gap-3">
          <Field label="시작일">
            <Input type="date" value={filters.from} onChange={(event) => setFilters((f) => ({ ...f, from: event.target.value }))} />
          </Field>
          <Field label="종료일">
            <Input type="date" value={filters.to} onChange={(event) => setFilters((f) => ({ ...f, to: event.target.value }))} />
          </Field>
          <Field label="가열로">
            <Select value={filters.furnaceNo} onChange={(event) => setFilters((f) => ({ ...f, furnaceNo: event.target.value }))}>
              <option value="">전체</option>
              {furnaces.data?.data.map((furnace) => (
                <option key={furnace.id} value={furnace.no}>{furnace.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="교대">
            <Select value={filters.shift} onChange={(event) => setFilters((f) => ({ ...f, shift: event.target.value }))}>
              <option value="">전체</option>
              <option value="day">주간</option>
              <option value="night">야간</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => entries.refetch()}>조회</Button>
          </div>
        </div>
      </Panel>

      {notice ? <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}
      {saveMutation.error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{saveMutation.error.message}</div> : null}

      <div
        className="ag-theme-quartz h-[620px] rounded-lg border border-border bg-white"
        onPaste={(event) => {
          if (!event.clipboardData.getData("text/plain")) return;
          event.preventDefault();
          pasteRows(event.clipboardData.getData("text/plain"));
        }}
      >
        <AgGridReact
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          rowSelection="multiple"
          suppressRowClickSelection
          onSelectionChanged={(event) =>
            setSelectedIds(event.api.getSelectedRows().map((row) => row.id).filter(Boolean) as string[])
          }
          onCellValueChanged={(event: CellValueChangedEvent<ChargeEntry>) => {
            const index = rows.findIndex((row) => row === event.data);
            if (index >= 0) updateRow(index, { ...event.data, source: event.colDef.field === "source" ? event.data.source : "manual" });
          }}
          getRowClass={(params) => {
            const duplicateContext = new Set(duplicateNos);
            if (params.data?.chargeNo) duplicateContext.delete(params.data.chargeNo);
            const validation = validateChargeGridRow(params.data ?? {}, duplicateNos.has(params.data?.chargeNo ?? "") ? new Set([params.data!.chargeNo]) : new Set());
            return validation.errors.length ? "bg-red-50" : validation.warnings.length ? "bg-amber-50" : "";
          }}
        />
      </div>
    </div>
  );
}
