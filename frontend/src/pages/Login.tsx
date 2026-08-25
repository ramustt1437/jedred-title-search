import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, FileStack, Lock } from "lucide-react";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/lib/types";

const DEMO = [
  { role: "Administrator", email: "admin@titlesearch.com", password: "Admin@123" },
  { role: "Researcher", email: "researcher@titlesearch.com", password: "Research@123" },
  { role: "Reviewer", email: "reviewer@titlesearch.com", password: "Review@123" },
  { role: "Client (read-only)", email: "client@titlesearch.com", password: "Client@123" },
];

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("admin@titlesearch.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: () => apiPost<User>("/auth/login", { email, password }),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(["me"], user);
      navigate("/");
    },
    onError: () => setError("Invalid email or password. Try one of the demo accounts listed."),
  });

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden lg:flex flex-col justify-between bg-[#0F172A] p-12 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,#1E3A8A,transparent_55%)]" />
        <div className="relative">
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-white px-3 py-2">
              <img src="/jedred-logo.png" alt="Jed Red Solutions Pvt Ltd" className="h-10 w-auto" />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold">Jed Red Solutions Pvt Ltd</p>
              <p className="text-xs text-slate-400">Title search order management &amp; summary reporting</p>
            </div>
          </div>
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="font-heading text-4xl font-semibold leading-tight">
            One workspace for every title search order.
          </h1>
          <p className="text-slate-300 text-[15px] leading-relaxed">
            Record the order, attach the raw documents you obtain, capture what each document
            says, and produce a reviewable Title Search Summary Report — with full audit history.
          </p>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3"><FileStack className="size-4 mt-0.5 text-sky-400" /> Raw documents stay attached, unaltered</li>
            <li className="flex gap-3"><ShieldCheck className="size-4 mt-0.5 text-sky-400" /> Role-based access enforced on the server</li>
            <li className="flex gap-3"><Lock className="size-4 mt-0.5 text-sky-400" /> Clients only see orders shared with them</li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Version 1 — manual research workspace</p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-sm ts-rise">
          <h2 className="font-heading text-2xl font-semibold">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">Use your work email and password.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => { e.preventDefault(); setError(""); login.mutate(); }}
            data-testid="login-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} required
                     onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} required
                     onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={login.isPending} data-testid="login-submit-button">
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo accounts</p>
            <div className="mt-3 space-y-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  data-testid={`demo-login-${d.email.split("@")[0]}`}
                  onClick={() => { setEmail(d.email); setPassword(d.password); }}
                  className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors duration-150"
                >
                  <span className="font-medium">{d.role}</span>
                  <span className="block text-xs text-muted-foreground font-mono">{d.email} · {d.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
