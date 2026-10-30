/**
 * Card font registry. All fonts are SIL OFL licensed and served from /public/fonts,
 * so the same files drive the browser preview, raster export (embedded as data URIs)
 * and PDF export (embedded via jsPDF).
 *
 * Reference card fonts → open substitutes:
 *   Calibri          → Carlito (metric compatible)
 *   Lucida Sans/Demi → Fira Sans Regular/SemiBold
 *   Script MT Bold   → Yesteryear (default), with other script choices
 */

export type FontStyleKey = "normal" | "bold" | "italic" | "bolditalic";

interface FontFamilyDef {
  label: string;
  files: Partial<Record<FontStyleKey, string>>;
}

export const BODY_FONTS = {
  Carlito: {
    label: "Carlito (Calibri-style)",
    files: {
      normal: "Carlito-Regular.ttf",
      bold: "Carlito-Bold.ttf",
      italic: "Carlito-Italic.ttf",
      bolditalic: "Carlito-BoldItalic.ttf",
    },
  },
  FiraSans: {
    label: "Fira Sans (Lucida-style)",
    files: {
      normal: "FiraSans-Regular.ttf",
      bold: "FiraSans-SemiBold.ttf",
      italic: "FiraSans-Italic.ttf",
      bolditalic: "FiraSans-SemiBoldItalic.ttf",
    },
  },
} satisfies Record<string, FontFamilyDef>;

export const SCRIPT_FONTS = {
  Yesteryear: { label: "Yesteryear (bold script)", files: { normal: "Yesteryear-Regular.ttf" } },
  Norican: { label: "Norican", files: { normal: "Norican-Regular.ttf" } },
  Lobster: { label: "Lobster", files: { normal: "Lobster-Regular.ttf" } },
  GreatVibes: { label: "Great Vibes (fine script)", files: { normal: "GreatVibes-Regular.ttf" } },
  Allura: { label: "Allura", files: { normal: "Allura-Regular.ttf" } },
} satisfies Record<string, FontFamilyDef>;

export type BodyFontId = keyof typeof BODY_FONTS;
export type ScriptFontId = keyof typeof SCRIPT_FONTS;
export type FontId = BodyFontId | ScriptFontId;

const ALL_FONTS: Record<FontId, FontFamilyDef> = { ...BODY_FONTS, ...SCRIPT_FONTS };

export function styleKey(bold: boolean, italic: boolean): FontStyleKey {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

/** Script fonts only ship one face; fall back to it for any requested style. */
export function fontFile(family: FontId, style: FontStyleKey): { file: string; style: FontStyleKey } {
  const files = ALL_FONTS[family].files;
  const file = files[style];
  if (file) return { file, style };
  return { file: files.normal!, style: "normal" };
}

export function fontUrl(file: string) {
  return `/fonts/${file}`;
}

let loadPromise: Promise<void> | null = null;

/** Registers every card font with the document so canvas measuring and SVG preview use them. */
export function loadCardFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (loadPromise) return loadPromise;
  const faces: FontFace[] = [];
  for (const [family, def] of Object.entries(ALL_FONTS)) {
    for (const [style, file] of Object.entries(def.files) as [FontStyleKey, string][]) {
      faces.push(
        new FontFace(family, `url(${fontUrl(file)})`, {
          weight: style === "bold" || style === "bolditalic" ? "700" : "400",
          style: style === "italic" || style === "bolditalic" ? "italic" : "normal",
        }),
      );
    }
  }
  loadPromise = Promise.all(
    faces.map(async (face) => {
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  loadPromise.catch(() => {
    loadPromise = null;
  });
  return loadPromise;
}

const base64Cache = new Map<string, Promise<string>>();

/** Base64 of a font file, for embedding into exported SVG / PDF. */
export function fontBase64(file: string): Promise<string> {
  let p = base64Cache.get(file);
  if (!p) {
    p = fetch(fontUrl(file))
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load font ${file}`);
        return r.arrayBuffer();
      })
      .then(arrayBufferToBase64);
    base64Cache.set(file, p);
    p.catch(() => base64Cache.delete(file));
  }
  return p;
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
