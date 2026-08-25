import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderOpen, FilePlus2, Files, Users as UsersIcon,
  Settings as SettingsIcon, LogOut, Menu, Search, Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEndSession, useSession } from "@/lib/session";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/orders", label: "Orders", icon: FolderOpen, testid: "nav-orders" },
  { to: "/orders/new", label: "Create New Order", icon: FilePlus2, testid: "nav-create-order", roles: ["ADMIN", "RESEARCHER"] },
  { to: "/documents", label: "Documents", icon: Files, testid: "nav-documents" },
  { to: "/users", label: "Users / Access", icon: UsersIcon, testid: "nav-users", roles: ["ADMIN"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "NEW": "bg-[#EFF6FF] text-[#1D4ED8]",
    "IN PROGRESS": "bg-[#FEF3C7] text-[#92400E]",
    "DOCUMENTS COLLECTED": "bg-[#E0F2FE] text-[#075985]",
    "REPORT PREPARATION": "bg-[#EDE9FE] text-[#5B21B6]",
    "PENDING REVIEW": "bg-[#F3E8FF] text-[#6B21A8]",
    "APPROVED": "bg-[#DCFCE7] text-[#15803D]",
    "COMPLETED": "bg-[#DCFCE7] text-[#166534]",
    "ON HOLD": "bg-[#F1F5F9] text-[#475569]",
    "CANCELLED": "bg-[#FEE2E2] text-[#B91C1C]",
  };
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: user } = useSession();
  const endSession = useEndSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/orders?search=${encodeURIComponent(term)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        data-testid="app-sidebar"
      >
        <Link to="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border" data-testid="sidebar-logo">
          <span className="grid place-items-center size-8 rounded-md bg-sidebar-primary/15 text-sidebar-primary">
            <Scale className="size-4" />
          </span>
          <span className="font-heading text-[15px] font-semibold leading-tight">
            Title Search<br /><span className="text-sidebar-primary text-xs font-medium">Services</span>
          </span>
        </Link>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {items.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-slate-300 hover:bg-sidebar-accent/60 hover:text-white"
                }`
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 pb-2">
            <p className="text-sm font-medium truncate" data-testid="sidebar-user-name">{user?.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            <Badge variant="outline" className="mt-1.5 border-sidebar-border text-sidebar-primary" data-testid="sidebar-user-role">
              {user?.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-sidebar-accent"
            data-testid="logout-button"
            onClick={async () => {
              await endSession();
              navigate("/login");
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" data-testid="sidebar-toggle" onClick={() => setOpen(!open)}>
            <Menu className="size-5" />
          </Button>
          <form onSubmit={submitSearch} className="relative flex-1 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search orders, owners, survey no., document no…"
              className="pl-9"
              data-testid="global-search-input"
            />
          </form>
          <span className="ml-auto hidden md:block text-sm text-muted-foreground font-heading">Title Search Services</span>
        </header>
        <main className="p-4 md:p-6 lg:p-8 max-w-[1600px]">{children}</main>
      </div>
    </div>
  );
}
