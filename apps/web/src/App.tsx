import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Database,
  FileDown,
  FileText,
  Flame,
  LogOut,
  Sheet,
  Upload,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, getToken, login as loginApi, setToken } from "./lib/api";
import type { User } from "./types";
import { Button, Input, Panel } from "./components/ui";
import GasImportPage from "./pages/GasImportPage";
import ChargeGridPage from "./pages/ChargeGridPage";
import ScansPage from "./pages/ScansPage";
import ReadingsPage from "./pages/ReadingsPage";
import AnalysisPage from "./pages/AnalysisPage";
import ExportsPage from "./pages/ExportsPage";
import UsersPage from "./pages/UsersPage";

type Tab = "charges" | "gas" | "scans" | "readings" | "analysis" | "exports" | "users";
type NavTab = { id: Tab; label: string; icon: LucideIcon; admin?: boolean };

function LoginPage({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin1234!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await loginApi(username, password);
      onLogin(result.user, result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-panel p-6">
      <Panel className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-accent text-white">
            <Flame size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">TAEWOONG</h1>
            <p className="text-sm text-muted">가스 검침 & 장입도 관리</p>
          </div>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="아이디" />
          <Input
            value={password}
            type="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
          />
          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div> : null}
          <Button disabled={loading}>{loading ? "로그인 중" : "로그인"}</Button>
        </form>
      </Panel>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("charges");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!getToken()) return;
    api<{ user: User }>("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setToken(null));
  }, []);

  const tabs = useMemo(
    () =>
      [
        { id: "charges", label: "차지 그리드", icon: Sheet },
        { id: "gas", label: "가스 업로드", icon: Upload, admin: true },
        { id: "scans", label: "장입도 PDF", icon: FileText },
        { id: "readings", label: "조회", icon: Database },
        { id: "analysis", label: "연결 분석", icon: BarChart3 },
        { id: "exports", label: "내보내기", icon: FileDown },
        { id: "users", label: "사용자", icon: Users, admin: true }
      ] satisfies NavTab[],
    []
  );

  if (!user) {
    return (
      <LoginPage
        onLogin={(nextUser, token) => {
          setToken(token);
          setUser(nextUser);
        }}
      />
    );
  }

  const visibleTabs = tabs.filter((item) => !item.admin || user.role === "admin");

  return (
    <div className="min-h-screen bg-panel">
      <header className="flex h-16 items-center justify-between border-b border-border bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-white">
            <Flame size={22} />
          </div>
          <div>
            <div className="text-lg font-bold">TAEWOONG Gas & Charge</div>
            <div className="text-xs text-muted">{user.username} · {user.role}</div>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setToken(null);
            setUser(null);
            queryClient.clear();
          }}
        >
          <LogOut size={16} />
          로그아웃
        </Button>
      </header>

      <div className="grid grid-cols-[220px_1fr]">
        <nav className="min-h-[calc(100vh-4rem)] border-r border-border bg-white p-3">
          <div className="grid gap-1">
            {visibleTabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold ${
                    active ? "bg-teal-50 text-accent" : "text-ink hover:bg-panel"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
        <main className="min-w-0 p-5">
          {tab === "charges" ? <ChargeGridPage /> : null}
          {tab === "gas" ? <GasImportPage /> : null}
          {tab === "scans" ? <ScansPage /> : null}
          {tab === "readings" ? <ReadingsPage /> : null}
          {tab === "analysis" ? <AnalysisPage /> : null}
          {tab === "exports" ? <ExportsPage /> : null}
          {tab === "users" ? <UsersPage /> : null}
        </main>
      </div>
    </div>
  );
}
