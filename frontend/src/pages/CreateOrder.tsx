import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, FilePlus2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emptyOrder, ORDER_STATUSES, PRIORITIES, type Order, type OrderPayload, type User } from "@/lib/types";

function Field({ label, value, onChange, type = "text", testid }:
  { label: string; value: string; onChange: (v: string) => void; type?: string; testid: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
    </div>
  );
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<OrderPayload>(emptyOrder());
  const [error, setError] = useState("");
  const set = (k: keyof OrderPayload) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: users } = useQuery<User[]>({ queryKey: ["users"], queryFn: () => apiGet<User[]>("/users") });

  const create = useMutation({
    mutationFn: (draft: boolean) => apiPost<Order>("/orders", { ...form, is_draft: draft }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/orders/${order.id}`);
    },
    onError: () => setError("Could not save the order. Client name is required."),
  });

  const submit = (draft: boolean) => {
    setError("");
    if (!form.client_name.trim()) { setError("Client Name is required."); return; }
    create.mutate(draft);
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="font-heading text-2xl font-semibold">New Title Search Order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the order as received from the client. Leave anything you do not have blank —
          the report will mark it as “Information not provided”.
        </p>
      </div>

      <Card data-testid="order-info-section">
        <CardHeader><CardTitle className="text-base">Order Information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Order ID (leave blank to auto-generate)" value={form.order_number ?? ""} onChange={set("order_number")} testid="field-order-number" />
          <Field label="Client Name *" value={form.client_name} onChange={set("client_name")} testid="field-client-name" />
          <Field label="Client Reference Number" value={form.client_reference} onChange={set("client_reference")} testid="field-client-reference" />
          <Field label="Order Date" value={form.order_date} onChange={set("order_date")} type="date" testid="field-order-date" />
          <Field label="Due Date" value={form.due_date} onChange={set("due_date")} type="date" testid="field-due-date" />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
            <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.priority}
                    onChange={(e) => set("priority")(e.target.value)} data-testid="field-priority">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Assigned Researcher</Label>
            <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.assigned_to ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value || null }))} data-testid="field-assigned-to">
              <option value="">Unassigned</option>
              {(users ?? []).filter((u) => u.role === "RESEARCHER" || u.role === "ADMIN")
                .map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Order Status</Label>
            <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.status}
                    onChange={(e) => set("status")(e.target.value)} data-testid="field-status">
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="property-info-section">
        <CardHeader><CardTitle className="text-base">Property / Search Information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Property Owner Name" value={form.property_owner} onChange={set("property_owner")} testid="field-property-owner" />
          <Field label="Applicant / Party Name" value={form.applicant_name} onChange={set("applicant_name")} testid="field-applicant" />
          <Field label="Property Address" value={form.property_address} onChange={set("property_address")} testid="field-property-address" />
          <Field label="Village / Town" value={form.village} onChange={set("village")} testid="field-village" />
          <Field label="Taluk / Tehsil" value={form.taluk} onChange={set("taluk")} testid="field-taluk" />
          <Field label="District" value={form.district} onChange={set("district")} testid="field-district" />
          <Field label="State" value={form.state} onChange={set("state")} testid="field-state" />
          <Field label="Survey Number" value={form.survey_number} onChange={set("survey_number")} testid="field-survey-number" />
          <Field label="Sub-Division Number" value={form.sub_division_number} onChange={set("sub_division_number")} testid="field-subdivision" />
          <Field label="Plot Number" value={form.plot_number} onChange={set("plot_number")} testid="field-plot-number" />
          <Field label="Property ID / Khata Number" value={form.khata_number} onChange={set("khata_number")} testid="field-khata" />
          <Field label="Registration District" value={form.registration_district} onChange={set("registration_district")} testid="field-reg-district" />
          <Field label="Registration Office" value={form.registration_office} onChange={set("registration_office")} testid="field-reg-office" />
          <Field label="Search Period" value={form.search_period} onChange={set("search_period")} testid="field-search-period" />
          <Field label="Other Identifying Information" value={form.other_identifying_info} onChange={set("other_identifying_info")} testid="field-other-info" />
        </CardContent>
      </Card>

      <Card data-testid="instructions-section">
        <CardHeader><CardTitle className="text-base">Client Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Client Order Instructions / Clues</Label>
            <Textarea rows={8} value={form.client_instructions} placeholder="Paste the important information from the client's email here…"
                      onChange={(e) => set("client_instructions")(e.target.value)} data-testid="field-client-instructions" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Internal Notes</Label>
              <Textarea rows={4} value={form.internal_notes} onChange={(e) => set("internal_notes")(e.target.value)} data-testid="field-internal-notes" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Additional Search Information</Label>
              <Textarea rows={4} value={form.additional_search_info} onChange={(e) => set("additional_search_info")(e.target.value)} data-testid="field-additional-info" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" data-testid="create-order-error">{error}</p>}

      <div className="flex flex-wrap gap-3 pb-6">
        <Button variant="outline" onClick={() => submit(true)} disabled={create.isPending} data-testid="save-draft-button">
          <Save className="size-4" /> Save Draft
        </Button>
        <Button onClick={() => submit(false)} disabled={create.isPending} data-testid="create-order-button">
          <FilePlus2 className="size-4" /> {create.isPending ? "Saving…" : "Create Order"}
        </Button>
      </div>
    </div>
  );
}
