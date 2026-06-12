import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ChargeScan, Furnace } from "../types";
import PdfViewer from "../components/PdfViewer";
import { Button, Field, Input, Panel, Select, StatusPill } from "../components/ui";

export default function ScansPage() {
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [form, setForm] = useState({
    pageIndex: 0,
    chargeNo: "",
    furnaceNo: 6,
    workDate: "",
    shift: "day",
    workEnd: "",
    material: "",
    weightKg: "",
    note: ""
  });
  const queryClient = useQueryClient();
  const furnaces = useQuery({ queryKey: ["furnaces"], queryFn: () => api<{ data: Furnace[] }>("/api/furnaces") });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => api<{ data: ChargeScan[] }>("/api/scans?pageSize=100") });
  const selected = scans.data?.data.find((scan) => scan.id === selectedScanId) ?? scans.data?.data[0] ?? null;

  useEffect(() => {
    if (!selectedScanId && scans.data?.data[0]) setSelectedScanId(scans.data.data[0].id);
  }, [scans.data, selectedScanId]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!files?.length) throw new Error("PDF 파일이 필요합니다.");
      const data = new FormData();
      Array.from(files).forEach((file) => data.append("files", file));
      return api("/api/scans/upload", { method: "POST", body: data });
    },
    onSuccess: () => {
      setFiles(null);
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    }
  });

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("PDF 선택이 필요합니다.");
      return api(`/api/scans/${selected.id}/records`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          weightKg: form.weightKg ? Number(form.weightKg) : null
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      queryClient.invalidateQueries({ queryKey: ["charge-entries"] });
      queryClient.invalidateQueries({ queryKey: ["analysis"] });
    }
  });

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">장입도 PDF</h2>
        <p className="text-sm text-muted">PDF 업로드 후 페이지별 작업 정보를 검토 입력합니다.</p>
      </div>

      <Panel>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="PDF">
            <Input type="file" accept=".pdf" multiple onChange={(event) => setFiles(event.target.files)} />
          </Field>
          <Button disabled={!files?.length || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
            <FileUp size={16} />
            업로드
          </Button>
        </div>
        {uploadMutation.error ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{uploadMutation.error.message}</div> : null}
      </Panel>

      <div className="grid grid-cols-[360px_1fr] gap-4">
        <Panel className="grid content-start gap-3">
          <div className="font-semibold">PDF 목록</div>
          <div className="max-h-[720px] overflow-auto rounded-md border border-border">
            {scans.data?.data.map((scan) => (
              <button
                key={scan.id}
                className={`block w-full border-b border-border p-3 text-left text-sm hover:bg-panel ${
                  selected?.id === scan.id ? "bg-teal-50" : "bg-white"
                }`}
                onClick={() => setSelectedScanId(scan.id)}
              >
                <div className="font-semibold">{scan.originalFileName}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span>{scan.pageCount}p · {scan.records?.length ?? 0}건</span>
                  <StatusPill value={scan.status} />
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-[minmax(360px,520px)_1fr] gap-4">
          <Panel>
            <div className="mb-3 font-semibold">페이지 기록</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="페이지">
                <Input
                  type="number"
                  min={0}
                  max={(selected?.pageCount ?? 1) - 1}
                  value={form.pageIndex}
                  onChange={(event) => setForm((current) => ({ ...current, pageIndex: Number(event.target.value) }))}
                />
              </Field>
              <Field label="차지번호">
                <Input value={form.chargeNo} onChange={(event) => setForm((current) => ({ ...current, chargeNo: event.target.value }))} />
              </Field>
              <Field label="작업일자">
                <Input type="date" value={form.workDate} onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} />
              </Field>
              <Field label="교대">
                <Select value={form.shift} onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))}>
                  <option value="day">주간</option>
                  <option value="night">야간</option>
                </Select>
              </Field>
              <Field label="가열로">
                <Select value={form.furnaceNo} onChange={(event) => setForm((current) => ({ ...current, furnaceNo: Number(event.target.value) }))}>
                  {furnaces.data?.data.map((furnace) => (
                    <option key={furnace.id} value={furnace.no}>{furnace.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="종료시각">
                <Input value={form.workEnd} placeholder="08:20" onChange={(event) => setForm((current) => ({ ...current, workEnd: event.target.value }))} />
              </Field>
              <Field label="재질">
                <Input value={form.material} onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))} />
              </Field>
              <Field label="중량 kg">
                <Input value={form.weightKg} onChange={(event) => setForm((current) => ({ ...current, weightKg: event.target.value }))} />
              </Field>
              <Field label="비고" className="col-span-2">
                <Input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
              </Field>
            </div>
            {recordMutation.error ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{recordMutation.error.message}</div> : null}
            <Button className="mt-4 w-full" disabled={!selected || recordMutation.isPending} onClick={() => recordMutation.mutate()}>
              <Save size={16} />
              저장
            </Button>
          </Panel>

          <Panel className="min-w-0">
            {selected ? <PdfViewer url={selected.fileUrl} pageCount={selected.pageCount} initialPage={form.pageIndex} /> : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
