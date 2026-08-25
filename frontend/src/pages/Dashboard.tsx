import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, AlertTriangle, Clock, CheckCircle2, Inbox, Loader2, ListChecks } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/AppShell";
import { useSession } from "@/lib/session";
import type { Dashboard as DashboardData, Order } from "@/lib/types";

const CARDS = [
  { key: "total", label: "Total Orders", icon: ListChecks, tone: "text-slate-700" },
  { key: "new", label: "New Orders", icon: Inbox, tone: "text-blue-700" },
  { key: "in_progress", label: "In Progress", icon: Loader2, tone: "text-amber-700" },
  { key: "pending_review", label: "Pending Review", icon: Clock, tone: "text-purple-700" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "text-green-700" },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, tone: "text-red-700" },
] as const;

function OrderList({ orders, testid, empty }: { orders: Order[]; testid: string; empty: string }) {
  if (!orders.length) return <p className="text-sm text-muted-foreground py-2">{empty}</p>;
  return (
    <ul className="divide-y divide-border" data-testid={testid}>
      {orders.map((o) => (
        <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 ts-row hover:bg-secondary/60 -mx-2 px-2 rounded">
          <div className="min-w-0">
            <Link to={`/orders/${o.id}`} className="text-sm font-medium hover:underline font-mono" data-testid={`order-link-${o.order_number}`}>
              {o.order_number}
            </Link>
            <p className="text-xs text-muted-foreground truncate">{o.client_name} · {o.property_owner || "Owner not provided"}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:block">Due {o.due_date || "—"}</span>
            <StatusBadge status={o.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { data: user } = useSession();
  const { data, isError } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/dashboard"),
  });
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back{user ? `, ${user.name}` : ""}. Here is the current state of your title search work.
          </p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "RESEARCHER") && (
          <Link to="/orders/new">
            <Button data-testid="dashboard-create-order-button"><FilePlus2 className="size-4" /> New Title Search Order</Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {CARDS.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key} className="ts-card-hover" data-testid={`stat-card-${key}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <Icon className={`size-4 ${tone}`} />
              </div>
              <p className="mt-2 font-heading text-3xl font-semibold" data-testid={`stat-value-${key}`}>
                {stats ? stats[key] : isError ? "—" : "…"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="recent-orders-card">
          <CardHeader><CardTitle className="text-base">Recent Orders</CardTitle></CardHeader>
          <CardContent><OrderList orders={data?.recent ?? []} testid="recent-orders-list" empty="No orders yet." /></CardContent>
        </Card>
        <Card data-testid="due-soon-card">
          <CardHeader><CardTitle className="text-base">Orders Due Soon</CardTitle></CardHeader>
          <CardContent><OrderList orders={data?.due_soon ?? []} testid="due-soon-list" empty="Nothing due." /></CardContent>
        </Card>
        <Card data-testid="assigned-to-me-card">
          <CardHeader><CardTitle className="text-base">Orders Assigned to Me</CardTitle></CardHeader>
          <CardContent><OrderList orders={data?.assigned_to_me ?? []} testid="assigned-list" empty="No orders assigned to you." /></CardContent>
        </Card>
        <Card data-testid="recently-completed-card">
          <CardHeader><CardTitle className="text-base">Recently Completed</CardTitle></CardHeader>
          <CardContent><OrderList orders={data?.recently_completed ?? []} testid="completed-list" empty="No completed orders yet." /></CardContent>
        </Card>
      </div>
    </div>
  );
}
