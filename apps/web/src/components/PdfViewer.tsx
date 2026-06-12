import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { Button } from "./ui";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

export default function PdfViewer({
  url,
  pageCount,
  initialPage = 0
}: {
  url: string;
  pageCount: number;
  initialPage?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [page, setPage] = useState(initialPage);
  const [scale, setScale] = useState(1.15);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument(url);
    task.promise
      .then((pdf) => pdf.getPage(page + 1))
      .then(async (pdfPage) => {
        if (cancelled || !canvasRef.current) return;
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: context, viewport }).promise;
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "PDF 렌더링 실패");
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url, page, scale]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {page + 1} / {pageCount}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((current) => Math.max(current - 1, 0))}>
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="secondary"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((current) => Math.min(current + 1, pageCount - 1))}
          >
            <ChevronRight size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setScale((current) => Math.max(current - 0.15, 0.6))}>
            <ZoomOut size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setScale((current) => Math.min(current + 0.15, 2.4))}>
            <ZoomIn size={16} />
          </Button>
        </div>
      </div>
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div> : null}
      <div className="max-h-[680px] overflow-auto rounded-md border border-border bg-zinc-200 p-3">
        <canvas ref={canvasRef} className="mx-auto bg-white shadow" />
      </div>
    </div>
  );
}
