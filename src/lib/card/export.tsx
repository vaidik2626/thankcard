import { renderToStaticMarkup } from "react-dom/server";
import { ThankYouCard } from "@/components/card/ThankYouCard";
import { fontBase64, fontFile, styleKey, type FontId, type FontStyleKey } from "./fonts";
import type { CardLayout } from "./layout";
import { decodeQr } from "./qr";

export type ExportFormat = "pdf" | "png" | "jpg";

export function cardSvgMarkup(layout: CardLayout): string {
  return renderToStaticMarkup(<ThankYouCard layout={layout} />);
}

function usedFonts(layouts: CardLayout[]) {
  const map = new Map<string, { family: FontId; style: FontStyleKey; file: string }>();
  for (const layout of layouts) {
    for (const section of Object.values(layout.sections)) {
      for (const run of section?.runs ?? []) {
        const { file, style } = fontFile(run.family, styleKey(run.bold, run.italic));
        map.set(`${run.family}|${style}`, { family: run.family, style, file });
      }
    }
  }
  return [...map.values()];
}

/* ------------------------------------------------------------------ raster */

async function rasterize(layout: CardLayout, dpi: number, background: string) {
  const scale = dpi / 72;
  const pw = Math.round(layout.width * scale);
  const ph = Math.round(layout.height * scale);

  const fonts = await Promise.all(
    usedFonts([layout]).map(async (f) => {
      const b64 = await fontBase64(f.file);
      const weight = f.style === "bold" || f.style === "bolditalic" ? 700 : 400;
      const style = f.style === "italic" || f.style === "bolditalic" ? "italic" : "normal";
      return `@font-face{font-family:"${f.family}";font-weight:${weight};font-style:${style};src:url(data:font/ttf;base64,${b64}) format("truetype");}`;
    }),
  );
  const markup = cardSvgMarkup(layout)
    .replace(/width="[\d.]+pt"/, `width="${pw}"`)
    .replace(/height="[\d.]+pt"/, `height="${ph}"`)
    .replace(/(<svg[^>]*>)/, `$1<defs><style>${fonts.join("")}</style></defs>`);

  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    img.src = url;
    await img.decode();
    // Give the SVG image a beat to apply its embedded @font-face rules before drawing.
    await new Promise((r) => setTimeout(r, 50));
    const canvas = document.createElement("canvas");
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, pw, ph);
    ctx.drawImage(img, 0, 0, pw, ph);
    return { canvas, scale };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes each QR from the rendered card pixels and checks it matches its URL. */
function verifyRenderedQrs(canvas: HTMLCanvasElement, layout: CardLayout, scale: number) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const problems: string[] = [];
  for (const q of layout.qrs) {
    const label = q.kind === "review" ? "Product review QR" : "Seller feedback QR";
    if (!q.path) {
      problems.push(`${label} has no valid URL`);
      continue;
    }
    const pad = Math.round(4 * scale);
    const x = Math.max(0, Math.floor(q.x * scale) - pad);
    const y = Math.max(0, Math.floor(q.y * scale) - pad);
    const s = Math.ceil(q.size * scale) + pad * 2;
    const data = ctx.getImageData(x, y, Math.min(s, canvas.width - x), Math.min(s, canvas.height - y));
    const decoded = decodeQr(data.data, data.width, data.height);
    if (decoded !== q.url) problems.push(`${label} did not scan back to its URL`);
  }
  if (layout.qrs.length === 2 && layout.qrs[0].url === layout.qrs[1].url) {
    problems.push("Review and feedback QR codes point to the same URL");
  }
  if (problems.length) throw new QrVerificationError(problems);
}

export class QrVerificationError extends Error {
  constructor(public problems: string[]) {
    super(problems.join("; "));
  }
}

/** Rasterises at print resolution and scans every QR back. Used before any export. */
export async function verifyCardForPrint(layout: CardLayout, dpi = 300) {
  const { canvas, scale } = await rasterize(layout, dpi, "#ffffff");
  verifyRenderedQrs(canvas, layout, scale);
  return canvas;
}

export async function exportRaster(layout: CardLayout, format: "png" | "jpg", dpi = 300): Promise<Blob> {
  const canvas = await verifyCardForPrint(layout, dpi);
  const type = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))), type, 0.95),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const withDpi = format === "png" ? setPngDpi(bytes, dpi) : setJpegDpi(bytes, dpi);
  return new Blob([withDpi as BlobPart], { type });
}

/* ------------------------------------------------------------------ pdf */

/** Vector PDF: text with embedded fonts, QR codes as vector paths. One page per layout. */
export async function exportPdf(layouts: CardLayout[], title: string): Promise<Blob> {
  for (const layout of layouts) {
    const canvas = await verifyCardForPrint(layout, 150);
    canvas.width = 0; // release memory early
  }

  const [{ jsPDF }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const first = layouts[0];
  const orientation = (l: CardLayout) => (l.width > l.height ? "landscape" : "portrait");
  const doc = new jsPDF({
    unit: "pt",
    format: [first.width, first.height],
    orientation: orientation(first),
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (const f of usedFonts(layouts)) {
    doc.addFileToVFS(f.file, await fontBase64(f.file));
    doc.addFont(f.file, f.family, f.style);
  }

  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    if (i > 0) doc.addPage([layout.width, layout.height], orientation(layout));
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;";
    host.innerHTML = cardSvgMarkup(layout);
    document.body.appendChild(host);
    try {
      await doc.svg(host.firstElementChild as SVGSVGElement, {
        x: 0,
        y: 0,
        width: layout.width,
        height: layout.height,
      });
    } finally {
      host.remove();
    }
  }

  doc.setProperties({ title, creator: "ThankCard Studio", subject: "Thank you card" });
  return doc.output("blob");
}

/* ------------------------------------------------------------------ helpers */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(brand: string, product: string, ext: string) {
  const slug = `${brand}-${product}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "thank-you-card"}-thank-you-card.${ext}`;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Inserts a pHYs chunk after IHDR so print software reads the intended DPI. */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const ihdrEnd = 8 + 25;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

/** Sets the JFIF density fields (canvas JPEGs default to 96 dpi / aspect only). */
export function setJpegDpi(jpg: Uint8Array, dpi: number): Uint8Array {
  const isJfif = jpg[2] === 0xff && jpg[3] === 0xe0 && String.fromCharCode(...jpg.subarray(6, 10)) === "JFIF";
  if (!isJfif) return jpg;
  const out = jpg.slice();
  out[13] = 1; // dots per inch
  out[14] = dpi >> 8;
  out[15] = dpi & 0xff;
  out[16] = dpi >> 8;
  out[17] = dpi & 0xff;
  return out;
}
