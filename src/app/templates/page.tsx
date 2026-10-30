import type { Metadata } from "next";
import { PageHeader } from "@/components/app/PageHeader";
import { DbNotice } from "@/components/app/DbNotice";
import { TemplateList } from "@/components/app/TemplateList";
import { listTemplates } from "@/lib/server/queries";
import { normalizeDesign } from "@/lib/card/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const templates = await listTemplates();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Saved designs: copy, fonts, sizes, spacing and card dimensions. Save one from the card editor with “Save as template”."
      />
      {templates.ok ? (
        <TemplateList
          templates={templates.data.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            design: normalizeDesign(t.design),
            cardCount: t._count.cards,
          }))}
        />
      ) : (
        <DbNotice />
      )}
    </div>
  );
}
