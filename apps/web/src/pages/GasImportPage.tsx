import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import type { Furnace } from "../types";
import { Button, Field, Input, Panel, Select, StatusPill } from "../components/ui";

interface Preview {
  inferredFurnaceNo: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  headers: string[];
  rows: Record<string, unknown>[];
  missingHeaders: string[];
}

export default function GasImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [furnaceNo, setFurnaceNo] = useState<number | "">("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const furnaces = useQuery({ queryKey: ["furnaces"], queryFn: () => api<{ data: Furnace[] }>("/api/furnaces") });
  const batches = useQuery({ queryKey: ["import-batches"], queryFn: () => api<any>("/api/imports/batches?pageSize=20") });

  const previewMutation = useMutation({
    mutationFn: async (nextFile: File) => {
      const form = new FormData();
      form.append("file", nextFile);
      return api<Preview>("/api/imports/gas/preview", { method: "POST", body: form });
    },
    onSuccess: (result) => {
      setPreview(result);
      setFurnaceNo(result.inferredFurnaceNo ?? "");
    }
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("파일이 필요합니다.");
      const form = new FormData();
      form.append("file", file);
      if (furnaceNo) form.append("furnaceNo", String(furnaceNo));
      return api<any>("/api/imports/gas", { method: "POST", body: form });
    },
    onSuccess: (result) => {
      setMessage(`성공 ${result.data.successCount}행 / 오류 ${result.data.errorCount}행`);
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["gas-readings"] });
    }
  });

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setMessage(null);
    if (nextFile) previewMutation.mutate(nextFile);
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">가스 RAW 업로드</h2>
        <p className="text-sm text-muted">CSV는 스트리밍 처리, Excel은 시트 `이력`을 기준으로 배치 인서트합니다.</p>
      </div>

      <Panel>
        <div
          className="grid min-h-36 place-items-center rounded-lg border-2 border-dashed border-border bg-panel p-6 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files.item(0));
          }}
        >
          <UploadCloud className="mb-3 text-accent" size={34} />
          <div className="font-semibold">{file ? file.name : "CSV 또는 Excel 파일을 놓으세요"}</div>
          <div className="mt-3">
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[220px_1fr_auto] items-end gap-3">
          <Field label="가열로">
            <Select value={furnaceNo} onChange={(event) => setFurnaceNo(event.target.value ? Number(event.target.value) : "")}>
              <option value="">자동 추출</option>
              {furnaces.data?.data.map((furnace) => (
                <option key={furnace.id} value={furnace.no}>
                  {furnace.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="text-sm text-muted">
            {preview ? (
              <span>
                추출 호기 {preview.inferredFurnaceNo ?? "-"} · 기간 {preview.periodStart?.slice(0, 10) ?? "-"} ~{" "}
                {preview.periodEnd?.slice(0, 10) ?? "-"}
              </span>
            ) : null}
          </div>
          <Button onClick={() => importMutation.mutate()} disabled={!file || !furnaceNo || importMutation.isPending}>
            <FileSpreadsheet size={16} />
            {importMutation.isPending ? "저장 중" : "배치 저장"}
          </Button>
        </div>
        {preview?.missingHeaders.length ? (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-warn">
            <AlertTriangle size={16} />
            누락 컬럼: {preview.missingHeaders.join(", ")}
          </div>
        ) : null}
        {message ? <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        {previewMutation.error || importMutation.error ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
            {(previewMutation.error ?? importMutation.error)?.message}
          </div>
        ) : null}
      </Panel>

      {preview ? (
        <Panel>
          <div className="mb-3 font-semibold">미리보기</div>
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr>{preview.headers.map((header) => <th key={header} className="border-b border-border p-2 text-left">{header}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={index} className="odd:bg-white even:bg-panel">
                    {preview.headers.map((header) => <td key={header} className="border-b border-border p-2">{String(row[header] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="mb-3 font-semibold">최근 배치</div>
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="p-2 text-left">파일</th>
                <th className="p-2 text-left">가열로</th>
                <th className="p-2 text-right">행</th>
                <th className="p-2 text-right">성공</th>
                <th className="p-2 text-right">오류</th>
                <th className="p-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {batches.data?.data.map((batch: any) => (
                <tr key={batch.id} className="border-t border-border">
                  <td className="p-2">{batch.fileName}</td>
                  <td className="p-2">{batch.furnace?.name}</td>
                  <td className="p-2 text-right">{batch.rowCount}</td>
                  <td className="p-2 text-right">{batch.successCount}</td>
                  <td className="p-2 text-right">{batch.errorCount}</td>
                  <td className="p-2"><StatusPill value={batch.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
