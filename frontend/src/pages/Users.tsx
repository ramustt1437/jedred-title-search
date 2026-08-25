import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/lib/session";
import type { ActivityEntry, User } from "@/lib/types";

const ROLE_HELP: Record<string, string> = {
  ADMIN: "Full access — orders, users, permissions, reports, exports.",
  RESEARCHER: "Works on assigned orders: uploads documents, enters information, prepares reports.",
  REVIEWER: "Reviews and edits reports on any order and can approve them.",
  CLIENT: "Read-only. Sees only orders explicitly shared with them.",
};

export default function Users() {
  const qc = useQueryClient();
  const { data: me } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CLIENT" });
  const [msg, setMsg] = useState("");

  const usersQ = useQuery<User[]>({ queryKey: ["users"], queryFn: () => apiGet<User[]>("/users") });
  const activityQ = useQuery<ActivityEntry[]>({
    queryKey: ["all-activity"],
    queryFn: () => apiGet<ActivityEntry[]>("/activity"),
    enabled: me?.role === "ADMIN",
  });

  const create = useMutation({
    mutationFn: () => apiPost<User>("/users", form),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setForm({ name: "", email: "", password: "", role: "CLIENT" });
      setMsg(`User ${u.name} created as ${u.role}.`);
    },
    onError: () => setMsg("Could not create the user — the email may already exist, or you are not an administrator."),
  });

  const toggle = useMutation({
    mutationFn: (u: User) => apiPatch<User>(`/users/${u.id}`, { active: !u.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: () => setMsg("Only administrators can change users."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Users / Access Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create accounts and set what each role can do. Order-level sharing is done inside each order’s Access tab.
        </p>
      </div>

      {msg && <div className="rounded-md border border-border bg-accent px-4 py-2 text-sm text-accent-foreground" data-testid="users-message">{msg}</div>}

      {me?.role === "ADMIN" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add a user</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Temporary password</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-role-select">
                {["ADMIN", "RESEARCHER", "REVIEWER", "CLIENT"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <p className="md:col-span-3 text-xs text-muted-foreground self-end">{ROLE_HELP[form.role]}</p>
            <div className="self-end">
              <Button onClick={() => create.mutate()} disabled={!form.name || !form.email || form.password.length < 6 || create.isPending} data-testid="create-user-button">
                <UserPlus className="size-4" /> Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Users ({usersQ.data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table data-testid="users-table">
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(usersQ.data ?? []).map((u) => (
                <TableRow key={u.id} className="ts-row" data-testid={`user-row-${u.email}`}>
                  <TableCell className="text-sm font-medium">{u.name} {u.is_demo && <Badge variant="outline" className="ml-1">DEMO</Badge>}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                  <TableCell className="text-sm">{u.active ? "Active" : "Disabled"}</TableCell>
                  <TableCell className="text-right">
                    {me?.role === "ADMIN" && me.id !== u.id && (
                      <Button variant="outline" size="xs" onClick={() => toggle.mutate(u)} data-testid={`toggle-user-${u.email}`}>
                        {u.active ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {me?.role === "ADMIN" && (
        <Card>
          <CardHeader><CardTitle className="text-base">System Activity Log</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table data-testid="system-activity-table">
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
              <TableBody>
                {(activityQ.data ?? []).slice(0, 50).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{a.created_at?.slice(0, 16).replace("T", " ")}</TableCell>
                    <TableCell className="text-sm">{a.user_name}</TableCell>
                    <TableCell className="text-sm font-medium">{a.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
