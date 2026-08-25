import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useSession } from "@/lib/session";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import OrdersList from "@/pages/OrdersList";
import CreateOrder from "@/pages/CreateOrder";
import OrderWorkspace from "@/pages/OrderWorkspace";
import DocumentsAll from "@/pages/DocumentsAll";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";

function Protected({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground" data-testid="session-loading">
        Loading Jed Red Solutions Pvt Ltd…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/orders" element={<Protected><OrdersList /></Protected>} />
      <Route path="/orders/new" element={<Protected><CreateOrder /></Protected>} />
      <Route path="/orders/:id" element={<Protected><OrderWorkspace /></Protected>} />
      <Route path="/documents" element={<Protected><DocumentsAll /></Protected>} />
      <Route path="/users" element={<Protected><Users /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
