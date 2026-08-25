import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, Eye } from "lucide-react";
import { apiGet } from "@/lib/api";
import { downloadBlob } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentRecord, Order } from "@/lib/types";

export default function DocumentsAll() {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const docsQ = useQuery<DocumentRecord[]>({
    queryKey: ["all-docs", search],
    queryFn: () => apiGet<DocumentRecord[]>(`/documents?search=${encodeURIComponent(search)}`),
  });
  const ordersQ = useQuery<Order[]>({ queryKey: ["orders", ""], queryFn: () => apiGet<Order[]>("/orders") });
  const orderOf = (id: string) => ordersQ.data?.find((o) => o.id === id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every raw document across the orders you are permitted to see. Originals are never altered.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="relative max-w-lg" onSubmit={(e) => { e.preventDefault(); setSearch(term); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9"
                   placeholder="Document number, registration number, type, file name" data-testid="documents-search-input" />
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive" data-testid="documents-error">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table data-testid="all-documents-table">
            <TableHeader><TableRow>
              <TableHead>Order</TableHead><TableHead>Type</TableHead><TableHead>Doc No.</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Uploaded by</TableHead>
              <TableHead>File</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docsQ.isLoading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {docsQ.data?.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No documents found.</TableCell></TableRow>}
              {(docsQ.data ?? []).map((d) => {
                const order = orderOf(d.order_id);
                return (
                  <TableRow key={d.id} className="ts-row" data-testid={`all-doc-row-${d.id}`}>
                    <TableCell className="font-mono text-xs">
                      <Link to={`/orders/${d.order_id}`} className="hover:underline">{order?.order_number ?? "—"}</Link>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{d.doc_type}</TableCell>
                    <TableCell className="font-mono text-xs">{d.doc_number || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{d.doc_date || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{d.uploaded_by_name}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{d.file_name}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-xs" data-testid={`all-doc-preview-${d.id}`}
                              onClick={() => window.open(`/api/documents/${d.id}/file?inline=true`, "_blank")}><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon-xs" data-testid={`all-doc-download-${d.id}`}
                              onClick={() => downloadBlob(`/documents/${d.id}/file`, d.file_name).catch((e) => setError((e as Error).message))}>
                        <Download className="size-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
