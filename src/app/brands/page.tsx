import type { Metadata } from "next";
import { PageHeader } from "@/components/app/PageHeader";
import { DbNotice } from "@/components/app/DbNotice";
import { BrandManager } from "@/components/app/BrandManager";
import { listBrandProfiles } from "@/lib/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand profiles" };

export default async function BrandsPage() {
  const brands = await listBrandProfiles();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand profiles"
        description="Save each brand’s name, signature, logo, WhatsApp number and store feedback link. Pick one when creating a card to fill those in."
      />
      {brands.ok ? (
        <BrandManager brands={brands.data.map(({ _count, ...b }) => ({ ...b, cardCount: _count.cards }))} />
      ) : (
        <DbNotice />
      )}
    </div>
  );
}
