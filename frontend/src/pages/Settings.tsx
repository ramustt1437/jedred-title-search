import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, X } from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";
import type { AppSettings } from "@/lib/types";

export default function Settings() {
  const qc = useQueryClient();
  const { data: me } = useSession();
  const isAdmin = me?.role === "ADMIN";
  const [form, setForm] = useState<AppSettings>({
    company_name: "", company_address: "", company_contact: "", report_footer: "", document_types: [],
  });
  const [newType, setNewType] = useState("");
  const [msg, setMsg] = useState("");

  const { data } = useQuery<AppSettings>({ queryKey: ["settings"], queryFn: () => apiGet<AppSettings>("/settings") });
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: () => apiPut<AppSettings>("/settings", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setMsg("Settings saved."); },
    onError: () => setMsg("Only administrators can change settings."),
  });

  return (
    <div className="space-y-6 max-w-[900px]">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Company details appear on every exported report. Document types appear in the upload form.
        </p>
      </div>

      {msg && <div className="rounded-md border border-border bg-accent px-4 py-2 text-sm text-accent-foreground" data-testid="settings-message">{msg}</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {([["company_name", "Company Name"], ["company_contact", "Contact (email / phone)"], ["company_address", "Address"]] as const).map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input value={form[k]} disabled={!isAdmin} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`settings-${k}`} />
            </div>
          ))}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Report footer / disclaimer</Label>
            <Textarea rows={3} value={form.report_footer} disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, report_footer: e.target.value })} data-testid="settings-report_footer" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Document Types</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" data-testid="document-types-list">
            {form.document_types.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1.5">
                {t}
                {isAdmin && (
                  <button type="button" data-testid={`remove-doc-type-${t}`} aria-label={`Remove ${t}`}
                          onClick={() => setForm({ ...form, document_types: form.document_types.filter((x) => x !== t) })}>
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {isAdmin && (
            <div className="flex gap-2 max-w-md">
              <Input value={newType} placeholder="Add a document type…" onChange={(e) => setNewType(e.target.value)} data-testid="new-doc-type-input" />
              <Button variant="outline" data-testid="add-doc-type-button"
                      onClick={() => { if (newType.trim()) { setForm({ ...form, document_types: [...form.document_types, newType.trim()] }); setNewType(""); } }}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="save-settings-button">
          <Save className="size-4" /> Save Settings
        </Button>
      )}
    </div>
  );
}
