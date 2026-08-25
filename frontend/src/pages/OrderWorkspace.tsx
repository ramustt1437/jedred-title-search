import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Download, Trash2, Sparkles, Save, CheckCircle2, FileDown, Package,
  ArrowUp, ArrowDown, RefreshCw, Eye, Plus,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { downloadBlob, useSession, can } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/AppShell";
import { ORDER_STATUSES, PERMISSIONS, PRIORITIES, type AccessGrant, type ActivityEntry, type AppSettings, type DocumentInfo, type DocumentRecord, type Finding, type Order, type ReportSection, type ReportVersion, type User } from "@/lib/types";

const ORDER_FIELDS: [keyof Order, string][] = [
  ["client_name", "Client Name"], ["client_reference", "Client Reference"],
  ["order_date", "Order Date"], ["due_date", "Due Date"],
  ["property_owner", "Property Owner"], ["applicant_name", "Applicant / Party"],
  ["property_address", "Property Address"], ["village", "Village / Town"],
  ["taluk", "Taluk / Tehsil"], ["district", "District"], ["state", "State"],
  ["survey_number", "Survey Number"], ["sub_division_number", "Sub-Division No."],
  ["plot_number", "Plot Number"], ["khata_number", "Khata / Property ID"],
  ["registration_district", "Registration District"], ["registration_office", "Registration Office"],
  ["search_period", "Search Period"], ["other_identifying_info", "Other Identifying Info"],
];

const INFO_GROUPS: [string, [keyof DocumentInfo, string][]][] = [
  ["Parties", [["seller", "Seller / Transferor"], ["buyer", "Buyer / Transferee"], ["donor", "Donor"],
    ["donee", "Donee"], ["mortgagor", "Mortgagor"], ["mortgagee", "Mortgagee"], ["other_parties", "Other Parties"]]],
  ["Property Details", [["prop_address", "Property Address"], ["survey_number", "Survey Number"],
    ["sub_division_number", "Sub-Division Number"], ["plot_number", "Plot Number"],
    ["extent_area", "Extent / Area"], ["boundaries", "Boundaries"], ["village", "Village"],
    ["taluk", "Taluk"], ["district", "District"], ["state", "State"]]],
  ["Transaction Details", [["transaction_type", "Transaction Type"], ["consideration_amount", "Consideration Amount"],
    ["execution_date", "Execution Date"], ["registration_date", "Registration Date"],
    ["nature_of_transaction", "Nature of Transaction"]]],
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-b border-border/70">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5 break-words">{value || <span className="text-muted-foreground italic">Information not provided</span>}</p>
    </div>
  );
}

export default function OrderWorkspace() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data: me } = useSession();
  const [tab, setTab] = useState("overview");
  const [msg, setMsg] = useState("");

  const orderQ = useQuery<Order>({ queryKey: ["order", id], queryFn: () => apiGet<Order>(`/orders/${id}`) });
  const docsQ = useQuery<DocumentRecord[]>({ queryKey: ["docs", id], queryFn: () => apiGet<DocumentRecord[]>(`/orders/${id}/documents`) });
  const findQ = useQuery<Finding[]>({ queryKey: ["findings", id], queryFn: () => apiGet<Finding[]>(`/orders/${id}/findings`) });
  const verQ = useQuery<ReportVersion[]>({ queryKey: ["versions", id], queryFn: () => apiGet<ReportVersion[]>(`/orders/${id}/report/versions`) });
  const actQ = useQuery<ActivityEntry[]>({ queryKey: ["activity", id], queryFn: () => apiGet<ActivityEntry[]>(`/orders/${id}/activity`) });
  const accQ = useQuery<AccessGrant[]>({ queryKey: ["access", id], queryFn: () => apiGet<AccessGrant[]>(`/orders/${id}/access`) });
  const setQ = useQuery<AppSettings>({ queryKey: ["settings"], queryFn: () => apiGet<AppSettings>("/settings") });
  const usersQ = useQuery<User[]>({ queryKey: ["users"], queryFn: () => apiGet<User[]>("/users"), enabled: me?.role !== "CLIENT" });

  const order = orderQ.data;
  const perms = order?.permissions ?? [];
  const docs = docsQ.data ?? [];
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 4000); };
  const refresh = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, id] }));

  // ---------- order edit ----------
  const [edit, setEdit] = useState<Partial<Order>>({});
  useEffect(() => { if (order) setEdit(order); }, [order]);
  const saveOrder = useMutation({
    mutationFn: () => apiPut<Order>(`/orders/${id}`, edit),
    onSuccess: () => { refresh(["order", "activity"]); flash("Order details saved."); },
    onError: () => flash("You are not permitted to edit this order."),
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => apiPatch<Order>(`/orders/${id}/status`, { status }),
    onSuccess: () => { refresh(["order", "activity"]); qc.invalidateQueries({ queryKey: ["dashboard"] }); flash("Status updated."); },
    onError: () => flash("You are not permitted to set this status."),
  });

  // ---------- documents ----------
  const [file, setFile] = useState<File | null>(null);
  const [docMeta, setDocMeta] = useState({ doc_type: "Sale Deed", doc_number: "", doc_date: "", source: "Netro Online", source_url: "", registration_number: "", registration_office: "", description: "", notes: "" });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("no file");
      const fd = new FormData();
      fd.append("file", file);
      Object.entries(docMeta).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch(`/api/orders/${id}/documents`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { detail?: string } | null)?.detail || "Upload failed");
      return res.json();
    },
    onSuccess: () => { setFile(null); refresh(["docs", "activity", "order"]); flash("Document uploaded."); },
    onError: (e: Error) => flash(e.message),
  });
  const patchDoc = useMutation({
    mutationFn: (v: { docId: string; body: Record<string, unknown> }) => apiPut<DocumentRecord>(`/documents/${v.docId}`, v.body),
    onSuccess: () => { refresh(["docs", "activity"]); flash("Document information saved."); },
    onError: () => flash("Could not save document information."),
  });
  const delDoc = useMutation({
    mutationFn: (docId: string) => apiDelete(`/documents/${docId}`),
    onSuccess: () => { refresh(["docs", "activity"]); flash("Document deleted."); },
  });

  // ---------- document information ----------
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const activeDoc = useMemo(() => docs.find((d) => d.id === selectedDoc) ?? docs[0], [docs, selectedDoc]);
  const [info, setInfo] = useState<DocumentInfo | null>(null);
  useEffect(() => { if (activeDoc) setInfo({ ...activeDoc.info }); }, [activeDoc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- findings ----------
  const [finding, setFinding] = useState({ finding_type: "", description: "", source: "", source_url: "", date_found: "", researcher_notes: "", importance: "Medium" });
  const addFinding = useMutation({
    mutationFn: () => apiPost<Finding>(`/orders/${id}/findings`, finding),
    onSuccess: () => { setFinding({ finding_type: "", description: "", source: "", source_url: "", date_found: "", researcher_notes: "", importance: "Medium" }); refresh(["findings", "activity"]); flash("Finding recorded."); },
    onError: () => flash("Could not add the finding."),
  });

  // ---------- report ----------
  const [sections, setSections] = useState<ReportSection[]>([]);
  const latest = verQ.data?.[0];
  useEffect(() => { if (latest) setSections(latest.sections.map((s) => ({ ...s }))); }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const generate = useMutation({
    mutationFn: () => apiPost<ReportVersion>(`/orders/${id}/report/generate`, { use_ai: true }),
    onSuccess: (v) => { setSections(v.sections.map((s) => ({ ...s }))); refresh(["versions", "activity", "order"]); flash(`Version ${v.version} generated${v.ai_generated ? " (AI-assisted draft)" : " from entered data"}.`); },
    onError: () => flash("Could not generate the report."),
  });
  const saveVersion = useMutation({
    mutationFn: () => apiPost<ReportVersion>(`/orders/${id}/report/versions`, { sections, change_note: "Edited by user" }),
    onSuccess: (v) => { refresh(["versions", "activity"]); flash(`Saved as version ${v.version}.`); },
    onError: () => flash("Could not save this version."),
  });
  const approve = useMutation({
    mutationFn: (versionId: string) => apiPost<ReportVersion>(`/orders/${id}/report/versions/${versionId}/approve`),
    onSuccess: (v) => { refresh(["versions", "activity", "order"]); qc.invalidateQueries({ queryKey: ["dashboard"] }); flash(`Approved as version ${v.version}.`); },
    onError: () => flash("You are not permitted to approve this report."),
  });

  const [pkgDocs, setPkgDocs] = useState<string[]>([]);
  useEffect(() => { setPkgDocs(docs.map((d) => d.id)); }, [docs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportReport = async (fmt: "pdf" | "docx") => {
    try {
      await downloadBlob(`/orders/${id}/report/export?fmt=${fmt}`, `Summary_Report_${order?.order_number}.${fmt}`);
      refresh(["activity"]);
      flash(`Report exported as ${fmt.toUpperCase()}.`);
    } catch (e) { flash((e as Error).message); }
  };
  const exportPackage = async () => {
    try {
      await downloadBlob(`/orders/${id}/package`, `${order?.order_number}_package.zip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: pkgDocs, include_index: true }),
      });
      refresh(["activity"]);
      flash("Order package downloaded.");
    } catch (e) { flash((e as Error).message); }
  };

  // ---------- access ----------
  const [grantUser, setGrantUser] = useState("");
  const [grantPerms, setGrantPerms] = useState<string[]>(["view", "download"]);
  const grant = useMutation({
    mutationFn: () => apiPost<AccessGrant>(`/orders/${id}/access`, { user_id: grantUser, permissions: grantPerms }),
    onSuccess: () => { refresh(["access", "activity"]); flash("Access updated."); },
    onError: () => flash("Only administrators can change access."),
  });
  const revoke = useMutation({
    mutationFn: (gid: string) => apiDelete(`/orders/${id}/access/${gid}`),
    onSuccess: () => { refresh(["access", "activity"]); flash("Access revoked."); },
  });

  const move = (doc: DocumentRecord, dir: -1 | 1) => {
    const target = doc.timeline_index + dir;
    patchDoc.mutate({ docId: doc.id, body: { timeline_index: Math.max(0, target) } });
  };

  const editable = can(perms, "edit");
  const docTypes = setQ.data?.document_types ?? ["Sale Deed", "Other"];

  if (orderQ.isError) {
    return (
      <Card><CardContent className="p-8 text-center">
        <h2 className="font-heading text-lg font-semibold">Order not available</h2>
        <p className="text-sm text-muted-foreground mt-2" data-testid="order-access-denied">
          This order does not exist, or it has not been shared with your account.
        </p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card data-testid="order-header">
        <CardContent className="p-5 flex flex-wrap items-start gap-6">
          <div className="min-w-[220px]">
            <p className="font-mono text-sm font-semibold" data-testid="workspace-order-number">{order?.order_number ?? "…"}</p>
            <h1 className="font-heading text-xl font-semibold mt-1">{order?.client_name}</h1>
            <p className="text-sm text-muted-foreground">{order?.property_address || "Property address not provided"}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm flex-1">
            <div><p className="text-[11px] uppercase text-muted-foreground">Researcher</p><p>{order?.assigned_to_name || "Unassigned"}</p></div>
            <div><p className="text-[11px] uppercase text-muted-foreground">Due date</p><p>{order?.due_date || "—"}</p></div>
            <div><p className="text-[11px] uppercase text-muted-foreground">Priority</p><p>{order?.priority}</p></div>
            <div><p className="text-[11px] uppercase text-muted-foreground">Status</p><p>{order && <StatusBadge status={order.status} />}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {order?.is_demo && <Badge variant="outline" data-testid="demo-badge">DEMO DATA</Badge>}
            {perms.map((p) => <Badge key={p} variant="secondary" className="capitalize">{p}</Badge>)}
          </div>
        </CardContent>
      </Card>

      {msg && <div className="rounded-md border border-border bg-accent px-4 py-2 text-sm text-accent-foreground ts-rise" data-testid="workspace-message">{msg}</div>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="flex-wrap h-auto" data-testid="workspace-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">Order Details</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="docinfo" data-testid="tab-document-information">Document Information</TabsTrigger>
          <TabsTrigger value="findings" data-testid="tab-findings">Search Findings</TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-report">Summary Report</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity / History</TabsTrigger>
          <TabsTrigger value="access" data-testid="tab-access">Access</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Progress</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" data-testid="status-stepper">
                {ORDER_STATUSES.slice(0, 7).map((s) => (
                  <span key={s} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase ${order?.status === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s}</span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[["Documents", docs.length], ["Findings", findQ.data?.length ?? 0], ["Report versions", verQ.data?.length ?? 0]].map(([l, v]) => (
                  <div key={l as string} className="rounded-md border border-border p-3">
                    <p className="font-heading text-2xl font-semibold" data-testid={`overview-count-${String(l).toLowerCase()}`}>{v as number}</p>
                    <p className="text-xs text-muted-foreground">{l as string}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Change status</Label>
                  <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={order?.status ?? "NEW"}
                          disabled={!editable} onChange={(e) => setStatus.mutate(e.target.value)} data-testid="status-select">
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {editable && <Button variant="outline" onClick={() => { setTab("report"); generate.mutate(); }} data-testid="overview-generate-report"><Sparkles className="size-4" /> Generate Report</Button>}
                {can(perms, "export") && <Button variant="outline" onClick={exportPackage} data-testid="overview-export-package"><Package className="size-4" /> Export Order Package</Button>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Client Instructions / Clues</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap" data-testid="overview-instructions">
                {order?.client_instructions || "Information not provided"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ORDER DETAILS */}
        <TabsContent value="details" className="mt-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Order &amp; Property Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ORDER_FIELDS.map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    {editable ? (
                      <Input value={String(edit[key] ?? "")} data-testid={`detail-${key}`}
                             onChange={(e) => setEdit((f) => ({ ...f, [key]: e.target.value }))} />
                    ) : <Row label="" value={String(order?.[key] ?? "")} />}
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" disabled={!editable}
                          value={edit.priority ?? "Normal"} onChange={(e) => setEdit((f) => ({ ...f, priority: e.target.value }))} data-testid="detail-priority">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assigned Researcher</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" disabled={!editable}
                          value={edit.assigned_to ?? ""} onChange={(e) => setEdit((f) => ({ ...f, assigned_to: e.target.value || null }))} data-testid="detail-assigned">
                    <option value="">Unassigned</option>
                    {(usersQ.data ?? []).filter((u) => u.role === "RESEARCHER" || u.role === "ADMIN").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {(["client_instructions", "internal_notes", "additional_search_info"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</Label>
                  <Textarea rows={4} disabled={!editable} value={String(edit[k] ?? "")}
                            onChange={(e) => setEdit((f) => ({ ...f, [k]: e.target.value }))} data-testid={`detail-${k}`} />
                </div>
              ))}
              {editable && (
                <Button onClick={() => saveOrder.mutate()} disabled={saveOrder.isPending} data-testid="save-order-details">
                  <Save className="size-4" /> Save Order Details
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-5 space-y-5">
          {can(perms, "upload") && (
            <Card data-testid="upload-card">
              <CardHeader><CardTitle className="text-base">Upload Raw Document</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">File (PDF, DOCX, JPG, PNG, TIFF — max 25 MB)</Label>
                  <Input type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.tif,.tiff"
                         onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="document-file-input" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Document Type</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={docMeta.doc_type}
                          onChange={(e) => setDocMeta({ ...docMeta, doc_type: e.target.value })} data-testid="document-type-select">
                    {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {([["doc_number", "Document Number"], ["doc_date", "Document Date"], ["source", "Source"],
                   ["source_url", "Source URL"], ["registration_number", "Registration Number"],
                   ["registration_office", "Registration Office"], ["description", "Description"], ["notes", "Notes"]] as const).map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type={k === "doc_date" ? "date" : "text"} value={docMeta[k]}
                           onChange={(e) => setDocMeta({ ...docMeta, [k]: e.target.value })} data-testid={`document-${k}-input`} />
                  </div>
                ))}
                <div className="md:col-span-3">
                  <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending} data-testid="upload-document-button">
                    <Upload className="size-4" /> {upload.isPending ? "Uploading…" : "Upload Document"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Documents ({docs.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table data-testid="documents-table">
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>Doc No.</TableHead><TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Reg. No.</TableHead><TableHead className="hidden lg:table-cell">Uploaded by</TableHead>
                  <TableHead>File</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {docs.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No documents uploaded yet.</TableCell></TableRow>}
                  {docs.map((d) => (
                    <TableRow key={d.id} className="ts-row" data-testid={`document-row-${d.id}`}>
                      <TableCell className="font-medium">{d.doc_type}</TableCell>
                      <TableCell className="font-mono text-xs">{d.doc_number || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{d.doc_date || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{d.registration_number || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{d.uploaded_by_name}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{d.file_name}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {can(perms, "download") && (
                          <>
                            <Button variant="ghost" size="icon-xs" title="Preview" data-testid={`preview-doc-${d.id}`}
                                    onClick={() => window.open(`/api/documents/${d.id}/file?inline=true`, "_blank")}><Eye className="size-4" /></Button>
                            <Button variant="ghost" size="icon-xs" title="Download" data-testid={`download-doc-${d.id}`}
                                    onClick={() => downloadBlob(`/documents/${d.id}/file`, d.file_name).catch((e) => flash(e.message))}><Download className="size-4" /></Button>
                          </>
                        )}
                        {editable && (
                          <Button variant="ghost" size="icon-xs" title="Delete" data-testid={`delete-doc-${d.id}`}
                                  onClick={() => { if (window.confirm(`Delete ${d.file_name}? The record is archived, not erased.`)) delDoc.mutate(d.id); }}>
                            <Trash2 className="size-4 text-destructive" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="timeline-card">
            <CardHeader><CardTitle className="text-base">Title Chain / Document Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {docs.length === 0 && <p className="text-sm text-muted-foreground">Upload documents to build the timeline.</p>}
              {docs.map((d, i) => (
                <div key={d.id} className="relative pl-6" data-testid={`timeline-item-${i}`}>
                  <span className="absolute left-0 top-2 size-2.5 rounded-full bg-primary" />
                  {i < docs.length - 1 && <span className="absolute left-[4px] top-5 bottom-[-14px] w-0.5 bg-border" />}
                  <div className="rounded-md border border-border p-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{d.doc_date || "Date not provided"} — {d.doc_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Doc No. {d.doc_number || "not provided"} · Reg. {d.registration_number || "not provided"} · {d.registration_office || "office not provided"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parties: {d.info.seller || d.info.donor || "not provided"} → {d.info.buyer || d.info.donee || "not provided"} · Property: {d.info.survey_number || "survey not provided"}
                      </p>
                    </div>
                    {editable && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon-xs" onClick={() => move(d, -1)} data-testid={`timeline-up-${i}`}><ArrowUp className="size-3.5" /></Button>
                        <Button variant="outline" size="icon-xs" onClick={() => move(d, 1)} data-testid={`timeline-down-${i}`}><ArrowDown className="size-3.5" /></Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENT INFORMATION */}
        <TabsContent value="docinfo" className="mt-5 space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Select a document</CardTitle></CardHeader>
            <CardContent>
              <select className="h-9 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm"
                      value={activeDoc?.id ?? ""} onChange={(e) => setSelectedDoc(e.target.value)} data-testid="docinfo-select">
                {docs.length === 0 && <option value="">No documents uploaded</option>}
                {docs.map((d) => <option key={d.id} value={d.id}>{d.doc_type} — {d.doc_number || d.file_name}</option>)}
              </select>
            </CardContent>
          </Card>

          {activeDoc && info && (
            <Card data-testid="docinfo-form">
              <CardHeader><CardTitle className="text-base">Information from {activeDoc.doc_type} {activeDoc.doc_number}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {INFO_GROUPS.map(([group, fields]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{group}</p>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {fields.map(([key, label]) => (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <Input value={info[key]} disabled={!editable} data-testid={`docinfo-${key}`}
                                 onChange={(e) => setInfo({ ...info, [key]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {(["important_info", "researcher_notes", "potential_issues", "source_reference"] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {k === "important_info" ? "Important Document Information" : k.replace(/_/g, " ")}
                    </Label>
                    <Textarea rows={k === "important_info" ? 8 : 3} value={info[k]} disabled={!editable}
                              onChange={(e) => setInfo({ ...info, [k]: e.target.value })} data-testid={`docinfo-${k}`} />
                  </div>
                ))}
                <div className="rounded-md bg-secondary p-3 text-xs text-muted-foreground" data-testid="docinfo-upload-history">
                  <p className="font-semibold mb-1">Upload history</p>
                  {activeDoc.upload_history.map((h, i) => <p key={i}>{h}</p>)}
                </div>
                {editable && (
                  <Button onClick={() => patchDoc.mutate({ docId: activeDoc.id, body: { info } })} disabled={patchDoc.isPending} data-testid="save-docinfo-button">
                    <Save className="size-4" /> Save Document Information
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* FINDINGS */}
        <TabsContent value="findings" className="mt-5 space-y-5">
          {editable && (
            <Card>
              <CardHeader><CardTitle className="text-base">Record a Search Finding</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {([["finding_type", "Finding Type"], ["source", "Source"], ["source_url", "Source URL"], ["date_found", "Date Found"]] as const).map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type={k === "date_found" ? "date" : "text"} value={finding[k]}
                           onChange={(e) => setFinding({ ...finding, [k]: e.target.value })} data-testid={`finding-${k}-input`} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Importance</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={finding.importance}
                          onChange={(e) => setFinding({ ...finding, importance: e.target.value })} data-testid="finding-importance-select">
                    {["Low", "Medium", "High", "Critical"].map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea rows={3} value={finding.description} onChange={(e) => setFinding({ ...finding, description: e.target.value })} data-testid="finding-description-input" />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Researcher Notes</Label>
                  <Textarea rows={2} value={finding.researcher_notes} onChange={(e) => setFinding({ ...finding, researcher_notes: e.target.value })} data-testid="finding-notes-input" />
                </div>
                <div>
                  <Button onClick={() => addFinding.mutate()} disabled={!finding.description.trim() || addFinding.isPending} data-testid="add-finding-button">
                    <Plus className="size-4" /> Add Finding
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Search Findings ({findQ.data?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-3" data-testid="findings-list">
              {(findQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No findings recorded yet.</p>}
              {(findQ.data ?? []).map((f) => (
                <div key={f.id} className="rounded-md border border-border p-3" data-testid={`finding-item-${f.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{f.finding_type || "Finding"} <Badge variant="secondary" className="ml-2">{f.importance}</Badge></p>
                      <p className="text-sm mt-1">{f.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Source: {f.source || "not provided"} {f.source_url && <a className="underline" href={f.source_url} target="_blank" rel="noreferrer">link</a>} · Found {f.date_found || "—"} · by {f.created_by_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">Title Search Summary Report</CardTitle>
              <div className="flex flex-wrap gap-2">
                {editable && <Button variant="outline" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="generate-report-button">
                  <Sparkles className="size-4" /> {verQ.data?.length ? "Regenerate" : "Generate Report"}</Button>}
                {editable && <Button variant="outline" size="sm" onClick={() => saveVersion.mutate()} disabled={!sections.length || saveVersion.isPending} data-testid="save-report-button">
                  <Save className="size-4" /> Save Draft as New Version</Button>}
                {can(perms, "approve") && latest && <Button size="sm" onClick={() => approve.mutate(latest.id)} data-testid="approve-report-button">
                  <CheckCircle2 className="size-4" /> Approve</Button>}
                {can(perms, "export") && <>
                  <Button variant="outline" size="sm" onClick={() => exportReport("pdf")} data-testid="export-pdf-button"><FileDown className="size-4" /> PDF</Button>
                  <Button variant="outline" size="sm" onClick={() => exportReport("docx")} data-testid="export-docx-button"><FileDown className="size-4" /> DOCX</Button>
                </>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {generate.isPending && <p className="text-sm text-muted-foreground" data-testid="report-generating">Generating draft from the information you entered…</p>}
              {!sections.length && !generate.isPending && (
                <p className="text-sm text-muted-foreground" data-testid="report-empty">
                  No report yet. Click “Generate Report” — the draft uses only what has been entered into this order.
                </p>
              )}
              {latest && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" data-testid="report-current-version">Version {latest.version} · {latest.status}</Badge>
                  {latest.ai_generated && <Badge className="bg-[#EDE9FE] text-[#5B21B6]" data-testid="report-ai-badge">AI-ASSISTED DRAFT — review before approval</Badge>}
                  <span className="text-muted-foreground">by {latest.created_by_name}</span>
                </div>
              )}
              {sections.map((s, i) => (
                <div key={i} className="space-y-1.5" data-testid={`report-section-${i}`}>
                  <Input value={s.heading} disabled={!editable} className="font-heading font-semibold"
                         onChange={(e) => setSections(sections.map((x, j) => j === i ? { ...x, heading: e.target.value } : x))}
                         data-testid={`report-heading-${i}`} />
                  <Textarea rows={Math.min(16, Math.max(4, s.body.split("\n").length + 1))} value={s.body} disabled={!editable}
                            onChange={(e) => setSections(sections.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                            data-testid={`report-body-${i}`} />
                  {editable && (
                    <Button variant="ghost" size="xs" onClick={() => setSections(sections.filter((_, j) => j !== i))} data-testid={`report-delete-section-${i}`}>
                      <Trash2 className="size-3.5" /> Remove section
                    </Button>
                  )}
                </div>
              ))}
              {editable && !!sections.length && (
                <Button variant="outline" size="sm" onClick={() => setSections([...sections, { heading: "New section", body: "" }])} data-testid="report-add-section">
                  <Plus className="size-4" /> Add Section
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Version History</CardTitle></CardHeader>
              <CardContent className="space-y-2" data-testid="version-history">
                {(verQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No versions yet.</p>}
                {(verQ.data ?? []).map((v) => (
                  <button key={v.id} type="button" onClick={() => setSections(v.sections.map((s) => ({ ...s })))}
                          className="w-full text-left rounded-md border border-border p-2.5 hover:bg-secondary transition-colors duration-150"
                          data-testid={`version-item-${v.version}`}>
                    <p className="text-sm font-medium">Version {v.version} — {v.status}</p>
                    <p className="text-xs text-muted-foreground">{v.created_at?.slice(0, 16).replace("T", " ")} · {v.created_by_name}</p>
                    <p className="text-xs text-muted-foreground">{v.change_note}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
            {can(perms, "export") && (
              <Card>
                <CardHeader><CardTitle className="text-base">Export Order Package</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">Choose which raw documents to include in the ZIP.</p>
                  {docs.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm" data-testid={`package-doc-${d.id}`}>
                      <Checkbox checked={pkgDocs.includes(d.id)}
                                onCheckedChange={(c) => setPkgDocs(c ? [...pkgDocs, d.id] : pkgDocs.filter((x) => x !== d.id))} />
                      <span className="truncate">{d.doc_type} — {d.file_name}</span>
                    </label>
                  ))}
                  <Button className="w-full" onClick={exportPackage} data-testid="export-package-button">
                    <Package className="size-4" /> Download Order Package (ZIP)
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity" className="mt-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Activity / History</CardTitle>
              <Button variant="ghost" size="xs" onClick={() => refresh(["activity"])} data-testid="refresh-activity"><RefreshCw className="size-3.5" /> Refresh</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="activity-table">
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(actQ.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No activity recorded.</TableCell></TableRow>}
                  {(actQ.data ?? []).map((a) => (
                    <TableRow key={a.id} className="ts-row">
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
        </TabsContent>

        {/* ACCESS */}
        <TabsContent value="access" className="mt-5 space-y-5">
          {me?.role === "ADMIN" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Share this order</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">User</Label>
                    <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={grantUser}
                            onChange={(e) => setGrantUser(e.target.value)} data-testid="access-user-select">
                      <option value="">Select a user…</option>
                      {(usersQ.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Permissions</Label>
                    <div className="flex flex-wrap gap-3">
                      {PERMISSIONS.map((p) => (
                        <label key={p} className="flex items-center gap-1.5 text-sm capitalize" data-testid={`access-perm-${p}`}>
                          <Checkbox checked={grantPerms.includes(p)}
                                    onCheckedChange={(c) => setGrantPerms(c ? [...grantPerms, p] : grantPerms.filter((x) => x !== p))} />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={() => grant.mutate()} disabled={!grantUser || grant.isPending} data-testid="grant-access-button">
                  <CheckCircle2 className="size-4" /> Share Order
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Users with access</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table data-testid="access-table">
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Permissions</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {(accQ.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Not shared with anyone yet.</TableCell></TableRow>}
                  {(accQ.data ?? []).map((g) => (
                    <TableRow key={g.id} data-testid={`access-row-${g.user_email}`}>
                      <TableCell className="text-sm">{g.user_name}<span className="block text-xs text-muted-foreground">{g.user_email}</span></TableCell>
                      <TableCell className="text-sm">{g.user_role}</TableCell>
                      <TableCell className="text-xs capitalize">{g.permissions.join(", ")}</TableCell>
                      <TableCell className="text-right">
                        {me?.role === "ADMIN" && <Button variant="ghost" size="xs" onClick={() => revoke.mutate(g.id)} data-testid={`revoke-access-${g.user_email}`}>Revoke</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
