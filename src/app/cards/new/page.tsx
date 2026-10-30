import type { Metadata } from "next";
import { CardEditor } from "@/components/editor/CardEditor";
import { PageHeader } from "@/components/app/PageHeader";
import { DbNotice } from "@/components/app/DbNotice";
import { getEditorOptions } from "@/lib/server/queries";
import { DEFAULT_DESIGN, EMPTY_CONTENT, SAMPLE_CONTENT, type CardContent } from "@/lib/card/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create card" };

export default async function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ example?: string; brand?: string; template?: string }>;
}) {
  const params = await searchParams;
  const options = await getEditorOptions();

  let content: CardContent = params.example ? SAMPLE_CONTENT : EMPTY_CONTENT;
  const brand = options.brandProfiles.find((b) => b.id === params.brand);
  if (brand) {
    content = {
      ...content,
      brandName: brand.name,
      businessName: brand.businessName ?? "",
      logoDataUrl: brand.logoDataUrl,
      whatsappNumber: brand.whatsappNumber ?? "",
      feedbackUrl: brand.feedbackUrl ?? "",
    };
  }
  const template = options.templates.find((t) => t.id === params.template);

  return (
    <div className="space-y-6">
      <PageHeader title="Create a thank-you card" description="Fill in your details. The preview updates as you type." />
      {!options.dbAvailable && <DbNotice />}
      <CardEditor
        initialContent={content}
        initialDesign={template?.design ?? DEFAULT_DESIGN}
        initialBrandProfileId={brand?.id}
        initialTemplateId={template?.id}
        brandProfiles={options.brandProfiles}
        templates={options.templates}
        dbAvailable={options.dbAvailable}
      />
    </div>
  );
}
