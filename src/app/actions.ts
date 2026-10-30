"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, tryDb } from "@/lib/server/db";
import { cardContentSchema, csvRowSchema, fieldErrors, whatsappSchema } from "@/lib/validation";
import { cardTitle, sanitizeDesign } from "@/lib/card/mappers";
import type { CardContent } from "@/lib/card/types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const idSchema = z.string().min(1).max(40);

function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ cards */

export async function saveCard(input: {
  id?: string;
  content: CardContent;
  design: unknown;
  brandProfileId?: string | null;
  templateId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = cardContentSchema.safeParse(input.content);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  }
  const c = parsed.data;
  const data = {
    title: cardTitle(c),
    brandName: c.brandName,
    businessName: c.businessName || null,
    logoDataUrl: c.logoDataUrl,
    productName: c.productName,
    reviewUrl: c.reviewUrl,
    feedbackUrl: c.feedbackUrl,
    whatsappNumber: c.whatsappNumber || null,
    customMessage: c.customMessage.trim() || null,
    design: sanitizeDesign(input.design) as object,
    brandProfileId: input.brandProfileId || null,
    templateId: input.templateId || null,
  };
  const res = await tryDb(() =>
    input.id
      ? prisma.card.update({ where: { id: idSchema.parse(input.id) }, data, select: { id: true } })
      : prisma.card.create({ data, select: { id: true } }),
  );
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true, data: { id: res.data.id } };
}

export async function duplicateCard(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await tryDb(async () => {
    const src = await prisma.card.findUniqueOrThrow({ where: { id: idSchema.parse(id) } });
    const { id: _id, createdAt: _c, updatedAt: _u, exportCount: _e, lastExportedAt: _l, design, ...rest } = src;
    return prisma.card.create({
      data: { ...rest, design: design as object, title: `${src.title} (copy)`.slice(0, 200) },
      select: { id: true },
    });
  });
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true, data: { id: res.data.id } };
}

export async function deleteCard(id: string): Promise<ActionResult> {
  const res = await tryDb(() => prisma.card.delete({ where: { id: idSchema.parse(id) } }));
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true };
}

export async function recordExport(id: string): Promise<ActionResult> {
  const res = await tryDb(() =>
    prisma.card.update({
      where: { id: idSchema.parse(id) },
      data: { exportCount: { increment: 1 }, lastExportedAt: new Date() },
    }),
  );
  return res.ok ? { ok: true } : res;
}

/* ------------------------------------------------------------------ brand profiles */

const brandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(60),
  businessName: z.string().trim().max(80).default(""),
  logoDataUrl: cardContentSchema.shape.logoDataUrl.default(null),
  whatsappNumber: whatsappSchema.default(""),
  feedbackUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Must be a valid https:// link")
    .default(""),
});

export type BrandProfileInput = z.input<typeof brandSchema>;

export async function saveBrandProfile(
  input: BrandProfileInput & { id?: string },
): Promise<ActionResult<{ id: string }>> {
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  }
  const b = parsed.data;
  const data = {
    name: b.name,
    businessName: b.businessName || null,
    logoDataUrl: b.logoDataUrl,
    whatsappNumber: b.whatsappNumber || null,
    feedbackUrl: b.feedbackUrl || null,
  };
  const res = await tryDb(() =>
    input.id
      ? prisma.brandProfile.update({ where: { id: idSchema.parse(input.id) }, data, select: { id: true } })
      : prisma.brandProfile.create({ data, select: { id: true } }),
  );
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true, data: { id: res.data.id } };
}

export async function deleteBrandProfile(id: string): Promise<ActionResult> {
  const res = await tryDb(() => prisma.brandProfile.delete({ where: { id: idSchema.parse(id) } }));
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ templates */

const templateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(80),
  description: z.string().trim().max(300).default(""),
});

export async function saveTemplate(input: {
  id?: string;
  name: string;
  description?: string;
  design: unknown;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    design: sanitizeDesign(input.design) as object,
  };
  const res = await tryDb(() =>
    input.id
      ? prisma.template.update({ where: { id: idSchema.parse(input.id) }, data, select: { id: true } })
      : prisma.template.create({ data, select: { id: true } }),
  );
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true, data: { id: res.data.id } };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const res = await tryDb(() => prisma.template.delete({ where: { id: idSchema.parse(id) } }));
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ bulk */

const MAX_BULK_ROWS = 500;

export async function createBulkCards(input: {
  fileName: string;
  rows: unknown[];
  /** Rows in the uploaded file, including ones the client already rejected. */
  totalRows?: number;
  design: unknown;
  templateId?: string | null;
  brandProfileId?: string | null;
}): Promise<ActionResult<{ jobId: string; created: number; failed: number }>> {
  if (!Array.isArray(input.rows) || input.rows.length === 0) return { ok: false, error: "The CSV has no rows" };
  if (input.rows.length > MAX_BULK_ROWS) return { ok: false, error: `Up to ${MAX_BULK_ROWS} rows per upload` };

  const design = sanitizeDesign(input.design) as object;
  const errors: { row: number; message: string }[] = [];
  const valid = input.rows.flatMap((row, i) => {
    const r = csvRowSchema.safeParse(row);
    if (!r.success) {
      errors.push({ row: i + 2, message: r.error.issues[0]?.message ?? "Invalid row" });
      return [];
    }
    return [r.data];
  });

  const res = await tryDb(() =>
    prisma.$transaction(async (tx) => {
      const job = await tx.bulkJob.create({
        data: {
          fileName: input.fileName.slice(0, 200),
          totalRows: Math.max(input.rows.length, Math.floor(input.totalRows ?? 0)),
          status: "PROCESSING",
          templateId: input.templateId || null,
        },
      });
      await tx.card.createMany({
        data: valid.map((r) => ({
          title: cardTitle({ brandName: r.brand_name, productName: r.product_name }),
          brandName: r.brand_name,
          businessName: r.business_name || null,
          productName: r.product_name,
          reviewUrl: r.review_url,
          feedbackUrl: r.feedback_url,
          whatsappNumber: r.whatsapp_number || null,
          customMessage: r.custom_message.trim() || null,
          design,
          templateId: input.templateId || null,
          brandProfileId: input.brandProfileId || null,
          bulkJobId: job.id,
        })),
      });
      await tx.bulkJob.update({
        where: { id: job.id },
        data: {
          status: valid.length ? "COMPLETED" : "FAILED",
          createdRows: valid.length,
          errors: errors.length ? errors : undefined,
        },
      });
      return job.id;
    }),
  );
  if (!res.ok) return res;
  revalidateAll();
  return { ok: true, data: { jobId: res.data, created: valid.length, failed: errors.length } };
}
