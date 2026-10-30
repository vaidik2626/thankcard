import type { Metadata } from "next";
import { PageHeader } from "@/components/app/PageHeader";
import { DbNotice } from "@/components/app/DbNotice";
import { BulkImporter } from "@/components/app/BulkImporter";
import { getEditorOptions, listBulkJobs } from "@/lib/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk CSV" };

export default async function BulkPage() {
  const [options, jobs] = await Promise.all([getEditorOptions(), listBulkJobs()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk generation"
        description="Upload a CSV with one product per row. Download every card in one multi-page PDF, or save them all to your history."
      />
      {!options.dbAvailable && <DbNotice />}
      <BulkImporter
        templates={options.templates}
        brandProfiles={options.brandProfiles}
        dbAvailable={options.dbAvailable}
        recentJobs={
          jobs.ok
            ? jobs.data.map((j) => ({
                id: j.id,
                fileName: j.fileName,
                status: j.status,
                totalRows: j.totalRows,
                createdRows: j.createdRows,
                createdAt: j.createdAt.toISOString(),
              }))
            : []
        }
      />
    </div>
  );
}
