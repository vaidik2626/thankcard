import "server-only";
import { prisma, tryDb } from "./db";
import { normalizeDesign } from "@/lib/card/types";
import type { BrandProfileOption, TemplateOption } from "@/components/editor/CardEditor";

const brandSelect = {
  id: true,
  name: true,
  businessName: true,
  logoDataUrl: true,
  whatsappNumber: true,
  feedbackUrl: true,
} as const;

export async function getEditorOptions(): Promise<{
  dbAvailable: boolean;
  brandProfiles: BrandProfileOption[];
  templates: TemplateOption[];
}> {
  const res = await tryDb(() =>
    Promise.all([
      prisma.brandProfile.findMany({ select: brandSelect, orderBy: { name: "asc" } }),
      prisma.template.findMany({ select: { id: true, name: true, design: true }, orderBy: { name: "asc" } }),
    ]),
  );
  if (!res.ok) return { dbAvailable: false, brandProfiles: [], templates: [] };
  const [brandProfiles, templates] = res.data;
  return {
    dbAvailable: true,
    brandProfiles,
    templates: templates.map((t) => ({ id: t.id, name: t.name, design: normalizeDesign(t.design) })),
  };
}

export async function getCard(id: string) {
  return tryDb(() => prisma.card.findUnique({ where: { id } }));
}

export async function listCards(query?: string) {
  const q = query?.trim();
  return tryDb(() =>
    prisma.card.findMany({
      where: q
        ? {
            OR: [
              { brandName: { contains: q, mode: "insensitive" } },
              { productName: { contains: q, mode: "insensitive" } },
              { businessName: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { brandProfile: { select: { name: true } } },
    }),
  );
}

export async function getDashboardStats() {
  return tryDb(async () => {
    const [cards, brands, templates, exports] = await Promise.all([
      prisma.card.count(),
      prisma.brandProfile.count(),
      prisma.template.count(),
      prisma.card.aggregate({ _sum: { exportCount: true } }),
    ]);
    return { cards, brands, templates, exports: exports._sum.exportCount ?? 0 };
  });
}

export async function listBrandProfiles() {
  return tryDb(() =>
    prisma.brandProfile.findMany({
      select: { ...brandSelect, _count: { select: { cards: true } } },
      orderBy: { name: "asc" },
    }),
  );
}

export async function listTemplates() {
  return tryDb(() =>
    prisma.template.findMany({
      select: { id: true, name: true, description: true, design: true, updatedAt: true, _count: { select: { cards: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  );
}

export async function listBulkJobs() {
  return tryDb(() => prisma.bulkJob.findMany({ orderBy: { createdAt: "desc" }, take: 10 }));
}
