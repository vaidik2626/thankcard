"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDownIcon, ImageDownIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardLayout } from "@/lib/card/layout";
import {
  downloadBlob,
  exportFilename,
  exportPdf,
  exportRaster,
  QrVerificationError,
  type ExportFormat,
} from "@/lib/card/export";
import { recordExport } from "@/app/actions";
import { NativeSelect } from "./fields";

interface ExportManagerProps {
  /** Builds the final (placeholder-free) layout; null while fonts load. */
  getLayout: () => CardLayout | null;
  /** Validates the form and surfaces errors; returns false to block export. */
  validate: () => boolean;
  brandName: string;
  productName: string;
  cardId?: string;
}

export function ExportManager({ getLayout, validate, brandName, productName, cardId }: ExportManagerProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [dpi, setDpi] = useState("300");

  async function run(format: ExportFormat) {
    if (!validate()) {
      toast.error("Fill in the required fields before downloading");
      return;
    }
    const layout = getLayout();
    if (!layout) return;
    setBusy(format);
    try {
      const blob =
        format === "pdf"
          ? await exportPdf([layout], `${brandName} – ${productName}`)
          : await exportRaster(layout, format, Number(dpi));
      downloadBlob(blob, exportFilename(brandName, productName, format));
      toast.success(`${format.toUpperCase()} downloaded`, {
        description:
          format === "pdf" ? "Vector PDF with embedded fonts. Both QR codes scanned OK." : `${dpi} DPI. Both QR codes scanned OK.`,
      });
      if (cardId) void recordExport(cardId);
    } catch (err) {
      if (err instanceof QrVerificationError) {
        toast.error("QR check failed, nothing was exported", { description: err.problems.join(". ") });
      } else {
        console.error(err);
        toast.error("Export failed", { description: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      setBusy(null);
    }
  }

  const icon = (f: ExportFormat) =>
    busy === f ? <Loader2Icon className="animate-spin" /> : f === "pdf" ? <FileDownIcon /> : <ImageDownIcon />;

  return (
    <div className="space-y-2">
      <Button className="h-10 w-full text-sm" onClick={() => run("pdf")} disabled={busy !== null}>
        {icon("pdf")} Download PDF
      </Button>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Button variant="outline" className="h-9" onClick={() => run("png")} disabled={busy !== null}>
          {icon("png")} PNG
        </Button>
        <Button variant="outline" className="h-9" onClick={() => run("jpg")} disabled={busy !== null}>
          {icon("jpg")} JPG
        </Button>
        <NativeSelect
          value={dpi}
          onChange={setDpi}
          className="w-[5.5rem]"
          options={[
            { value: "300", label: "300 dpi" },
            { value: "600", label: "600 dpi" },
          ]}
        />
      </div>
    </div>
  );
}
