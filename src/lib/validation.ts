import { z } from "zod";

const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(2000, `${label} is too long for a scannable QR code`)
    .refine((v) => {
      try {
        const u = new URL(v);
        return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
      } catch {
        return false;
      }
    }, `${label} must be a valid link starting with https://`);

export const whatsappSchema = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^\+?[\d\s\-()]{7,20}$/.test(v), "Enter a phone number, e.g. +91 92271 51536")
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return v === "" || (digits >= 7 && digits <= 15);
  }, "Phone number must have 7–15 digits");

export const cardContentSchema = z.object({
  brandName: z.string().trim().min(1, "Brand name is required").max(60),
  businessName: z.string().trim().max(80),
  logoDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/, "Logo must be a PNG, JPG, WEBP or SVG image")
    .max(1_500_000, "Logo must be under 1 MB")
    .nullable(),
  productName: z.string().trim().min(1, "Product name is required").max(200),
  reviewUrl: httpUrl("Product review URL"),
  feedbackUrl: httpUrl("Seller feedback URL"),
  whatsappNumber: whatsappSchema,
  customMessage: z.string().max(1000),
});

export type CardContentInput = z.infer<typeof cardContentSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function isValidHttpUrl(v: string) {
  return httpUrl("URL").safeParse(v).success;
}

/** Columns accepted by the CSV bulk importer. */
export const csvRowSchema = z.object({
  brand_name: z.string().trim().min(1, "brand_name is required"),
  product_name: z.string().trim().min(1, "product_name is required"),
  review_url: httpUrl("review_url"),
  feedback_url: httpUrl("feedback_url"),
  whatsapp_number: whatsappSchema.optional().default(""),
  business_name: z.string().trim().optional().default(""),
  custom_message: z.string().optional().default(""),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
