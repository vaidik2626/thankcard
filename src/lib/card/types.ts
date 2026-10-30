import type { BodyFontId, ScriptFontId } from "./fonts";

/** Seller-provided content: changes per card. */
export interface CardContent {
  brandName: string;
  businessName: string;
  logoDataUrl: string | null;
  productName: string;
  reviewUrl: string;
  feedbackUrl: string;
  whatsappNumber: string;
  customMessage: string;
}

/**
 * Editable copy. `**double asterisks**` mark bold phrases in the rich fields
 * (message, whatsappText).
 */
export interface CardTexts {
  heading: string;
  intro: string;
  productSuffix: string;
  message: string;
  reviewLabel: string;
  feedbackLabel: string;
  whatsappText: string;
  contactLabel: string;
  signoff: string;
}

/** Font sizes in pt for a 4in wide card; scaled proportionally for other widths. */
export interface CardSizes {
  logo: number;
  heading: number;
  brand: number;
  intro: number;
  product: number;
  message: number;
  qr: number;
  qrLabel: number;
  whatsapp: number;
  contact: number;
  signature: number;
}

/** Vertical gaps between sections, in pt for a 4in wide card. */
export interface CardSpacing {
  afterLogo: number;
  afterHeading: number;
  afterBrand: number;
  afterIntro: number;
  afterProduct: number;
  afterMessage: number;
  afterQr: number;
  afterWhatsapp: number;
  afterContact: number;
  qrGap: number;
  lineHeight: number;
}

export type FitMode = "distribute" | "center" | "top";
export type QrErrorLevel = "L" | "M" | "Q" | "H";

export interface CardDesign {
  widthIn: number;
  heightIn: number;
  marginIn: number;
  fonts: { heading: BodyFontId; body: BodyFontId; brand: ScriptFontId };
  texts: CardTexts;
  sizes: CardSizes;
  spacing: CardSpacing;
  borderWidth: number;
  borderRadius: number;
  qrErrorLevel: QrErrorLevel;
  qrQuietZone: number;
  fitMode: FitMode;
}

export interface CardDocument {
  content: CardContent;
  design: CardDesign;
}

export const DEFAULT_TEXTS: CardTexts = {
  heading: "Thank you so much for choosing",
  intro: "I’m checking in to see how you’re enjoying your new",
  productSuffix: ".",
  message:
    "**As a small business**, we rely on your **honest review & feedback** to help us improve and help other shoppers make the right choice.\nWould you mind taking 60 seconds to share your experience?",
  reviewLabel: "Scan for Review",
  feedbackLabel: "Scan for Feedback",
  whatsappText:
    "If you have any issues or questions at all, **please reach out to us on WhatsApp**—we’re here to help!",
  contactLabel: "Call / WhatsApp No:",
  signoff: "Best,",
};

/** Proportions measured from the reference card (A4), scaled to a 4in width. */
export const DEFAULT_DESIGN: CardDesign = {
  widthIn: 4,
  heightIn: 6,
  marginIn: 0.16,
  fonts: { heading: "Carlito", body: "FiraSans", brand: "Yesteryear" },
  texts: DEFAULT_TEXTS,
  sizes: {
    logo: 26,
    heading: 19.5,
    brand: 30,
    intro: 10.8,
    product: 10.4,
    message: 10.8,
    qr: 92,
    qrLabel: 7,
    whatsapp: 10.8,
    contact: 9.8,
    signature: 11.5,
  },
  spacing: {
    afterLogo: 4,
    afterHeading: 2,
    afterBrand: 1,
    afterIntro: 1.5,
    afterProduct: 5,
    afterMessage: 3,
    afterQr: 6,
    afterWhatsapp: 4,
    afterContact: 5,
    qrGap: 26,
    lineHeight: 1.18,
  },
  borderWidth: 0.9,
  borderRadius: 4.5,
  qrErrorLevel: "H",
  qrQuietZone: 4,
  fitMode: "distribute",
};

export const EMPTY_CONTENT: CardContent = {
  brandName: "",
  businessName: "",
  logoDataUrl: null,
  productName: "",
  reviewUrl: "",
  feedbackUrl: "",
  whatsappNumber: "",
  customMessage: "",
};

export const SAMPLE_CONTENT: CardContent = {
  brandName: "Hogitomist",
  businessName: "Sarvopari Enterprise",
  logoDataUrl: null,
  productName: "Car Armrest Cushion Pad With Side Pockets",
  reviewUrl: "https://www.amazon.in/review/create-review?asin=B0EXAMPLE1",
  feedbackUrl: "https://www.amazon.in/hz/feedback",
  whatsappNumber: "+91 92271 51536",
  customMessage: "",
};

export const SIZE_PRESETS: { id: string; label: string; widthIn: number; heightIn: number }[] = [
  { id: "4x6", label: "4 × 6 in (default)", widthIn: 4, heightIn: 6 },
  { id: "5x7", label: "5 × 7 in", widthIn: 5, heightIn: 7 },
  { id: "a6", label: "A6 (4.13 × 5.83 in)", widthIn: 4.13, heightIn: 5.83 },
  { id: "a5", label: "A5 (5.83 × 8.27 in)", widthIn: 5.83, heightIn: 8.27 },
  { id: "a4", label: "A4 (8.27 × 11.69 in)", widthIn: 8.27, heightIn: 11.69 },
  { id: "3.5x5", label: "3.5 × 5 in", widthIn: 3.5, heightIn: 5 },
];

/** Deep-merge a stored (possibly partial / older) design onto the defaults. */
export function normalizeDesign(input: unknown): CardDesign {
  const d = (input && typeof input === "object" ? input : {}) as Partial<CardDesign>;
  return {
    ...DEFAULT_DESIGN,
    ...d,
    fonts: { ...DEFAULT_DESIGN.fonts, ...(d.fonts ?? {}) },
    texts: { ...DEFAULT_DESIGN.texts, ...(d.texts ?? {}) },
    sizes: { ...DEFAULT_DESIGN.sizes, ...(d.sizes ?? {}) },
    spacing: { ...DEFAULT_DESIGN.spacing, ...(d.spacing ?? {}) },
  };
}
