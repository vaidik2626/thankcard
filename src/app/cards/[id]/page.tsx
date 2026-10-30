import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardEditor } from "@/components/editor/CardEditor";
import { PageHeader } from "@/components/app/PageHeader";
import { DbNotice } from "@/components/app/DbNotice";
import { getCard, getEditorOptions } from "@/lib/server/queries";
import { recordToContent, recordToDesign } from "@/lib/card/mappers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit card" };

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, options] = await Promise.all([getCard(id), getEditorOptions()]);
  if (!card.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit card" />
        <DbNotice />
      </div>
    );
  }
  if (!card.data) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={card.data.title}
        description={`Last saved ${card.data.updatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
      />
      <CardEditor
        key={card.data.updatedAt.toISOString()}
        cardId={card.data.id}
        initialContent={recordToContent(card.data)}
        initialDesign={recordToDesign(card.data)}
        initialBrandProfileId={card.data.brandProfileId}
        initialTemplateId={card.data.templateId}
        brandProfiles={options.brandProfiles}
        templates={options.templates}
        dbAvailable={options.dbAvailable}
      />
    </div>
  );
}
