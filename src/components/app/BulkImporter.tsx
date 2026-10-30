"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { CheckCircle2Icon, CircleAlertIcon, DownloadIcon, FileDownIcon, Loader2Icon, SaveIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createBulkCards } from "@/app/actions";
import { Field, NativeSelect } from "@/components/editor/fields";
import type { BrandProfileOption, TemplateOption } from "@/components/editor/CardEditor";
import { useCardFonts } from "@/components/editor/useCardLayout";
import { layoutCard } from "@/lib/card/layout";
import { downloadBlob, exportPdf, QrVerificationError } from "@/lib/card/export";
import { DEFAULT_DESIGN, type CardContent as CardContentData } from "@/lib/card/types";
import { csvRowSchema, type CsvRow } from "@/lib/validation";

const SAMPLE_CSV = `brand_name,product_name,review_url,feedback_url,whatsapp_number,business_name,custom_message
Hogitomist,Car Armrest Cushion Pad With Side Pockets,https://www.amazon.in/review/create-review?asin=B0EXAMPLE1,https://www.amazon.in/hz/feedback,+91 92271 51536,Sarvopari Enterprise,
Hogitomist,Car Seat Gap Filler Organizer,https://www.amazon.in/review/create-review?asin=B0EXAMPLE2,https://www.amazon.in/hz/feedback,+91 92271 51536,Sarvopari Enterprise,
`;

interface ParsedRow {
  line: number;
  raw: Record<string, string>;
  data?: CsvRow;
  error?: string;
}

interface Job {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  createdRows: number;
  createdAt: string;
}

export function BulkImporter({
  templates,
  brandProfiles,
  dbAvailable,
  recentJobs,
}: {
  templates: TemplateOption[];
  brandProfiles: BrandProfileOption[];
  dbAvailable: boolean;
  recentJobs: Job[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [brandProfileId, setBrandProfileId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [saving, startSaving] = useTransition();
  const { measurer } = useCardFonts();

  const valid = useMemo(() => rows.filter((r) => r.data), [rows]);
  const design = templates.find((t) => t.id === templateId)?.design ?? DEFAULT_DESIGN;

  function parse(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const parsed = result.data.slice(0, 500).map((raw, i) => {
          const r = csvRowSchema.safeParse(raw);
          return r.success
            ? { line: i + 2, raw, data: r.data }
            : { line: i + 2, raw, error: r.error.issues.map((x) => x.message).join("; ") };
        });
        setRows(parsed);
        if (result.data.length > 500) toast.warning("Only the first 500 rows were loaded");
        if (!parsed.length) toast.error("No rows found. Check the header row matches the sample.");
      },
      error: (err) => toast.error(`Could not read CSV: ${err.message}`),
    });
  }

  function toContent(r: CsvRow): CardContentData {
    const brand = brandProfiles.find((b) => b.id === brandProfileId);
    return {
      brandName: r.brand_name,
      businessName: r.business_name || brand?.businessName || "",
      logoDataUrl: brand?.logoDataUrl ?? null,
      productName: r.product_name,
      reviewUrl: r.review_url,
      feedbackUrl: r.feedback_url,
      whatsappNumber: r.whatsapp_number || brand?.whatsappNumber || "",
      customMessage: r.custom_message,
    };
  }

  async function downloadAll() {
    if (!measurer || !valid.length) return;
    setExporting(true);
    try {
      const layouts = valid.map((r) => layoutCard(measurer, toContent(r.data!), design, { placeholders: false }));
      const blob = await exportPdf(layouts, `Thank you cards (${layouts.length})`);
      downloadBlob(blob, `thank-you-cards-${layouts.length}.pdf`);
      toast.success(`PDF with ${layouts.length} cards downloaded`, { description: "Every QR code was scan-tested." });
    } catch (err) {
      toast.error("Bulk export failed", {
        description: err instanceof QrVerificationError ? err.problems.join(". ") : String(err),
      });
    } finally {
      setExporting(false);
    }
  }

  function saveAll() {
    startSaving(async () => {
      const res = await createBulkCards({
        fileName: fileName || "upload.csv",
        totalRows: rows.length,
        rows: valid.map((r) => ({
          ...r.data!,
          business_name: toContent(r.data!).businessName,
          whatsapp_number: toContent(r.data!).whatsappNumber,
        })),
        design,
        templateId: templateId || null,
        brandProfileId: brandProfileId || null,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data.created} cards saved to your history`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>1. Upload CSV</CardTitle>
            <CardDescription>
              Required columns: <code>brand_name</code>, <code>product_name</code>, <code>review_url</code>,{" "}
              <code>feedback_url</code>. Optional: <code>whatsapp_number</code>, <code>business_name</code>,{" "}
              <code>custom_message</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => inputRef.current?.click()}>
              <UploadIcon /> Choose CSV file
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadBlob(new Blob([SAMPLE_CSV], { type: "text/csv" }), "thank-you-cards-sample.csv")}
            >
              <DownloadIcon /> Sample CSV
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parse(f);
                e.target.value = "";
              }}
            />
            {fileName && <span className="self-center text-sm text-muted-foreground">{fileName}</span>}
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>2. Check rows</CardTitle>
              <CardDescription>
                {valid.length} of {rows.length} rows are ready. Rows with errors are skipped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="text-muted-foreground tabular-nums">{r.line}</TableCell>
                      <TableCell className="max-w-32 truncate">{r.raw.brand_name}</TableCell>
                      <TableCell className="max-w-64 truncate">{r.raw.product_name}</TableCell>
                      <TableCell className="whitespace-normal">
                        {r.data ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2Icon className="size-3.5" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-start gap-1 text-destructive">
                            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" /> {r.error}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>3. Generate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Template" htmlFor="bulk-template" required>
              <NativeSelect
                id="bulk-template"
                value={templateId}
                onChange={setTemplateId}
                options={[
                  { value: "", label: "Reference design (default)" },
                  ...templates.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </Field>
            <Field label="Brand profile" htmlFor="bulk-brand" hint="Supplies logo, signature and WhatsApp when a row leaves them empty.">
              <NativeSelect
                id="bulk-brand"
                value={brandProfileId}
                onChange={setBrandProfileId}
                options={[{ value: "", label: "None" }, ...brandProfiles.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </Field>
            <Button className="w-full" disabled={!valid.length || exporting || !measurer} onClick={downloadAll}>
              {exporting ? <Loader2Icon className="animate-spin" /> : <FileDownIcon />}
              Download {valid.length || ""} cards as PDF
            </Button>
            <Button variant="secondary" className="w-full" disabled={!valid.length || saving || !dbAvailable} onClick={saveAll}>
              {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Save {valid.length || ""} cards to history
            </Button>
          </CardContent>
        </Card>

        {recentJobs.length > 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Recent imports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{j.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {j.createdRows}/{j.totalRows} rows · {new Date(j.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <Badge variant={j.status === "COMPLETED" ? "secondary" : "outline"}>{j.status.toLowerCase()}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
