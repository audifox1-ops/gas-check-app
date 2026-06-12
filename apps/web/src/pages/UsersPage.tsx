import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { Button, Field, Input, Panel, Select } from "../components/ui";

export default function UsersPage() {
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<any>("/api/users") });
  const createMutation = useMutation({
    mutationFn: () => api("/api/users", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ username: "", password: "", role: "user" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">사용자 관리</h2>
        <p className="text-sm text-muted">admin은 업로드·삭제·사용자 관리 권한을 가집니다.</p>
      </div>
      <Panel>
        <div className="grid grid-cols-[1fr_1fr_160px_auto] items-end gap-3">
          <Field label="아이디"><Input value={form.username} onChange={(event) => setForm((f) => ({ ...f, username: event.target.value }))} /></Field>
          <Field label="비밀번호"><Input type="password" value={form.password} onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))} /></Field>
          <Field label="권한">
            <Select value={form.role} onChange={(event) => setForm((f) => ({ ...f, role: event.target.value }))}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </Select>
          </Field>
          <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            <UserPlus size={16} />
            추가
          </Button>
        </div>
        {createMutation.error ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{createMutation.error.message}</div> : null}
      </Panel>
      <Panel className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-panel">
            <tr>
              <th className="p-3 text-left">아이디</th>
              <th className="p-3 text-left">권한</th>
              <th className="p-3 text-left">생성일</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.data.map((user: any) => (
              <tr key={user.id} className="border-t border-border">
                <td className="p-3 font-semibold">{user.username}</td>
                <td className="p-3">{user.role}</td>
                <td className="p-3">{String(user.createdAt).slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
