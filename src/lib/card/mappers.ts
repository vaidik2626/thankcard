import { normalizeDesign, type CardContent, type CardDesign } from "./types";

/** Shape of a Card row as selected from the database (kept Prisma-free for client use). */
export interface CardRecord {
  id: string;
  title: string;
  brandName: string;
  businessName: string | null;
  logoDataUrl: string | null;
  productName: string;
  reviewUrl: string;
  feedbackUrl: string;
  whatsappNumber: string | null;
  customMessage: string | null;
  design: unknown;
  brandProfileId: string | null;
  templateId: string | null;
}

export function recordToContent(r: CardRecord): CardContent {
  return {
    brandName: r.brandName,
    businessName: r.businessName ?? "",
    logoDataUrl: r.logoDataUrl,
    productName: r.productName,
    reviewUrl: r.reviewUrl,
    feedbackUrl: r.feedbackUrl,
    whatsappNumber: r.whatsappNumber ?? "",
    customMessage: r.customMessage ?? "",
  };
}

export function recordToDesign(r: { design: unknown }): CardDesign {
  return normalizeDesign(r.design);
}

export function cardTitle(content: Pick<CardContent, "brandName" | "productName">) {
  return `${content.brandName.trim()} – ${content.productName.trim()}`.slice(0, 200);
}

/** Clamp numeric design values to printable ranges before persisting. */
export function sanitizeDesign(input: unknown): CardDesign {
  const d = normalizeDesign(input);
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    ...d,
    widthIn: clamp(d.widthIn, 2, 12, 4),
    heightIn: clamp(d.heightIn, 2, 17, 6),
    marginIn: clamp(d.marginIn, 0, 1, 0.16),
    borderWidth: clamp(d.borderWidth, 0, 4, 0.9),
    borderRadius: clamp(d.borderRadius, 0, 30, 4.5),
    qrQuietZone: clamp(d.qrQuietZone, 2, 8, 4),
    qrErrorLevel: ["L", "M", "Q", "H"].includes(d.qrErrorLevel) ? d.qrErrorLevel : "H",
    fitMode: ["distribute", "center", "top"].includes(d.fitMode) ? d.fitMode : "distribute",
  };
}
