import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/AppShell";
import { useSession } from "@/lib/session";
import { ORDER_STATUSES, type ClientRecord, type Order, type User } from "@/lib/types";

export default function OrdersList() {
  const [params, setParams] = useSearchParams();
  const { data: user } = useSession();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const status = params.get("status") ?? "";
  const client = params.get("client") ?? "";
  const assignee = params.get("assignee") ?? "";
  const dueBefore = params.get("due_before") ?? "";

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (params.get("search")) q.set("search", params.get("search")!);
    if (status) q.set("status", status);
    if (client) q.set("client", client);
    if (assignee) q.set("assignee", assignee);
    if (dueBefore) q.set("due_before", dueBefore);
    return q.toString();
  }, [params, status, client, assignee, dueBefore]);

  const { data: orders, isLoading, isError } = useQuery<Order[]>({
    queryKey: ["orders", query],
    queryFn: () => apiGet<Order[]>(`/orders?${query}`),
  });
  const { data: clients } = useQuery<ClientRecord[]>({ queryKey: ["clients"], queryFn: () => apiGet<ClientRecord[]>("/clients") });
  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => apiGet<User[]>("/users"),
    enabled: user?.role !== "CLIENT",
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">All title search orders you are permitted to see.</p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "RESEARCHER") && (
          <Link to="/orders/new"><Button data-testid="orders-create-button"><FilePlus2 className="size-4" /> New Order</Button></Link>
        )}
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <form
            className="relative lg:col-span-2"
            onSubmit={(e) => { e.preventDefault(); setParam("search", search); }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"
                   placeholder="Order ID, client, owner, address, survey no., document no." data-testid="orders-search-input" />
          </form>
          <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={status}
                  onChange={(e) => setParam("status", e.target.value)} data-testid="orders-status-filter">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={client}
                  onChange={(e) => setParam("client", e.target.value)} data-testid="orders-client-filter">
            <option value="">All clients</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <select className="h-9 flex-1 rounded-md border border-input bg-card px-2 text-sm" value={assignee}
                    onChange={(e) => setParam("assignee", e.target.value)} data-testid="orders-assignee-filter">
              <option value="">All researchers</option>
              {(users ?? []).filter((u) => u.role === "RESEARCHER" || u.role === "ADMIN")
                .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Input type="date" value={dueBefore} className="w-[140px]"
                   onChange={(e) => setParam("due_before", e.target.value)} data-testid="orders-due-filter" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="orders-table">
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Property owner</TableHead>
                <TableHead className="hidden lg:table-cell">Researcher</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading orders…</TableCell></TableRow>}
              {isError && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Orders are unavailable right now.</TableCell></TableRow>}
              {orders?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No orders match your filters.</TableCell></TableRow>}
              {(orders ?? []).map((o) => (
                <TableRow key={o.id} className="ts-row" data-testid={`order-row-${o.order_number}`}>
                  <TableCell className="font-mono text-xs font-semibold">{o.order_number}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{o.client_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{o.property_owner || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{o.assigned_to_name || "Unassigned"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{o.due_date || "—"}</TableCell>
                  <TableCell className="text-sm">{o.priority}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right">
                    <Link to={`/orders/${o.id}`}>
                      <Button variant="outline" size="xs" data-testid={`open-order-${o.order_number}`}>Open</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
