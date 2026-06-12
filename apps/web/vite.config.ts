import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@taewoong/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4000",
      "/uploads": "http://127.0.0.1:4000"
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어
          "react-vendor": ["react", "react-dom"],
          // 상태 관리
          "query": ["@tanstack/react-query"],
          // AG Grid (가장 큰 라이브러리)
          "ag-grid": ["ag-grid-community", "ag-grid-react"],
          // 차트
          "recharts": ["recharts"],
          // PDF 뷰어
          "pdf": ["pdfjs-dist"],
          // 엑셀
          "xlsx": ["xlsx"],
          // 가상화
          "react-window": ["react-window"]
        }
      }
    }
  }
});
