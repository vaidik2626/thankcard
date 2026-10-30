import type { FontId } from "./fonts";
import { createQrMatrix, qrPath, verifyQrMatrix } from "./qr";
import type { CardContent, CardDesign } from "./types";
import { isValidHttpUrl } from "../validation";

/* ------------------------------------------------------------------ primitives */

export interface TextRun {
  x: number;
  y: number; // baseline
  text: string;
  family: FontId;
  size: number;
  bold: boolean;
  italic: boolean;
  placeholder?: boolean;
}

export interface LinePrim {
  x1: number;
  x2: number;
  y: number;
  thickness: number;
}

export interface RectPrim {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  strokeWidth: number;
  dashed?: boolean;
}

export interface QrPrim {
  kind: "review" | "feedback";
  x: number;
  y: number;
  size: number;
  url: string;
  /** Path in module units; empty when the URL is missing/invalid. */
  path: string;
  /** Modules per side including quiet zone. */
  viewSize: number;
  version: number;
  verified: boolean;
}

export interface ImagePrim {
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
}

export interface SectionLayout {
  runs: TextRun[];
  lines: LinePrim[];
  rects: RectPrim[];
  qrs: QrPrim[];
  images: ImagePrim[];
}

export type SectionId =
  | "logo"
  | "heading"
  | "brand"
  | "intro"
  | "product"
  | "message"
  | "qr"
  | "whatsapp"
  | "contact"
  | "signature";

export interface CardLayout {
  width: number; // pt
  height: number; // pt
  margin: number; // pt
  sections: Partial<Record<SectionId, SectionLayout>>;
  /** Uniform shrink applied so content fits (1 = design sizes used as-is). */
  fitScale: number;
  qrs: QrPrim[];
}

/* ------------------------------------------------------------------ measuring */

export interface TextMeasurer {
  width(text: string, family: FontId, size: number, bold: boolean, italic: boolean): number;
  /** Ascent / descent as a fraction of font size. */
  metrics(family: FontId, bold: boolean, italic: boolean): { ascent: number; descent: number };
}

export function createCanvasMeasurer(): TextMeasurer {
  const ctx = document.createElement("canvas").getContext("2d")!;
  const widthCache = new Map<string, number>();
  const metricCache = new Map<string, { ascent: number; descent: number }>();
  const REF = 100; // measure at a fixed size and scale linearly for stable results
  const setFont = (family: FontId, bold: boolean, italic: boolean) => {
    ctx.font = `${italic ? "italic " : ""}${bold ? 700 : 400} ${REF}px "${family}"`;
  };
  return {
    width(text, family, size, bold, italic) {
      const key = `${family}|${bold}|${italic}|${text}`;
      let w = widthCache.get(key);
      if (w === undefined) {
        setFont(family, bold, italic);
        w = ctx.measureText(text).width / REF;
        widthCache.set(key, w);
      }
      return w * size;
    },
    metrics(family, bold, italic) {
      const key = `${family}|${bold}|${italic}`;
      let m = metricCache.get(key);
      if (!m) {
        setFont(family, bold, italic);
        const tm = ctx.measureText("Hgjy");
        m = {
          ascent: (tm.fontBoundingBoxAscent ?? tm.actualBoundingBoxAscent) / REF,
          descent: (tm.fontBoundingBoxDescent ?? tm.actualBoundingBoxDescent) / REF,
        };
        metricCache.set(key, m);
      }
      return m;
    },
  };
}

/* ------------------------------------------------------------------ rich text */

interface Style {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface Segment extends Style {
  text: string;
}

type Word = Segment[];
/** A hard line from the source text; `null` marks a blank line (paragraph gap). */
type HardLine = Word[] | null;

/** Parses `**bold**` markup and newlines into words made of styled segments. */
export function parseRich(src: string, base: Style): HardLine[] {
  let bold = base.bold;
  return src.split(/\r?\n/).map((raw) => {
    if (raw.trim() === "") return null;
    const words: Word[] = [];
    let word: Word = [];
    const push = (text: string) => {
      if (!text) return;
      const last = word[word.length - 1];
      if (last && last.bold === bold) last.text += text;
      else word.push({ text, bold, italic: base.italic, underline: base.underline });
    };
    for (const part of raw.split(/(\*\*|\s+)/)) {
      if (part === "**") bold = !bold;
      else if (/^\s+$/.test(part)) {
        if (word.length) words.push(word);
        word = [];
      } else push(part);
    }
    if (word.length) words.push(word);
    return words;
  });
}

function plain(text: string, style: Partial<Style> = {}): HardLine[] {
  const s = { bold: false, italic: false, underline: false, ...style };
  return text
    .split(/\r?\n/)
    .map((l) => (l.trim() === "" ? null : l.trim().split(/\s+/).map((t) => [{ ...s, text: t }])));
}

interface TextOpts {
  family: FontId;
  size: number;
  lineHeight: number;
  maxWidth: number;
  centerX: number;
  placeholder?: boolean;
  /** Minimum line box as multiple of the font's natural height (for script fonts). */
  minNatural?: number;
}

interface TextBlock {
  height: number;
  runs: TextRun[];
  lines: LinePrim[];
  minX: number;
  maxX: number;
}

function wordWidth(m: TextMeasurer, word: Word, o: TextOpts) {
  return word.reduce((w, s) => w + m.width(s.text, o.family, o.size, s.bold, s.italic), 0);
}

/** Splits a word wider than the line into chunks (long URLs, unbroken strings). */
function splitLongWord(m: TextMeasurer, word: Word, o: TextOpts): Word[] {
  const out: Word[] = [];
  let cur: Word = [];
  let curW = 0;
  for (const seg of word) {
    for (const ch of Array.from(seg.text)) {
      const w = m.width(ch, o.family, o.size, seg.bold, seg.italic);
      if (curW + w > o.maxWidth && cur.length) {
        out.push(cur);
        cur = [];
        curW = 0;
      }
      const last = cur[cur.length - 1];
      if (last && last.bold === seg.bold && last.italic === seg.italic && last.underline === seg.underline)
        last.text += ch;
      else cur.push({ ...seg, text: ch });
      curW += w;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

function wrap(m: TextMeasurer, hardLines: HardLine[], o: TextOpts): (Word[] | null)[] {
  const out: (Word[] | null)[] = [];
  for (const hard of hardLines) {
    if (!hard) {
      out.push(null);
      continue;
    }
    let line: Word[] = [];
    let lineW = 0;
    const space = m.width(" ", o.family, o.size, false, false);
    const words = hard.flatMap((w) => (wordWidth(m, w, o) > o.maxWidth ? splitLongWord(m, w, o) : [w]));
    for (const word of words) {
      const w = wordWidth(m, word, o);
      const add = line.length ? space + w : w;
      if (line.length && lineW + add > o.maxWidth + 0.01) {
        out.push(line);
        line = [word];
        lineW = w;
      } else {
        line.push(word);
        lineW += add;
      }
    }
    if (line.length) out.push(line);
  }
  return out;
}

const sameStyle = (a: Style, b: Style) =>
  a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;

function layoutText(m: TextMeasurer, hardLines: HardLine[], o: TextOpts): TextBlock {
  const wrapped = wrap(m, hardLines, o);
  const runs: TextRun[] = [];
  const lines: LinePrim[] = [];
  let y = 0;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const line of wrapped) {
    if (!line) {
      y += o.size * o.lineHeight * 0.5;
      continue;
    }
    // Flatten into pieces (segments + inter-word spaces) and merge equal styles into runs.
    const pieces: Segment[] = [];
    line.forEach((word, i) => {
      if (i > 0) pieces.push({ ...pieces[pieces.length - 1], text: " " });
      pieces.push(...word);
    });
    const merged: Segment[] = [];
    for (const p of pieces) {
      const last = merged[merged.length - 1];
      if (last && sameStyle(last, p)) last.text += p.text;
      else merged.push({ ...p });
    }
    const widths = merged.map((r) => m.width(r.text, o.family, o.size, r.bold, r.italic));
    const total = widths.reduce((a, b) => a + b, 0);

    const anyBold = merged.some((r) => r.bold);
    const met = m.metrics(o.family, anyBold, merged[0].italic);
    const natural = (met.ascent + met.descent) * o.size;
    const box = Math.max(o.size * o.lineHeight, natural * (o.minNatural ?? 0));
    const baseline = y + (box - natural) / 2 + met.ascent * o.size;

    let x = o.centerX - total / 2;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + total);
    merged.forEach((r, i) => {
      const text = r.text.trimEnd();
      if (text) {
        runs.push({
          x,
          y: baseline,
          text,
          family: o.family,
          size: o.size,
          bold: r.bold,
          italic: r.italic,
          placeholder: o.placeholder,
        });
        if (r.underline) {
          lines.push({
            x1: x,
            x2: x + m.width(text, o.family, o.size, r.bold, r.italic),
            y: baseline + o.size * 0.13,
            thickness: o.size * 0.065,
          });
        }
      }
      x += widths[i];
    });
    y += box;
  }
  if (!isFinite(minX)) minX = maxX = o.centerX;
  return { height: y, runs, lines, minX, maxX };
}

/* ------------------------------------------------------------------ blocks */

interface Block {
  id: SectionId;
  height: number;
  gapAfter: number;
  section: SectionLayout;
}

const emptySection = (): SectionLayout => ({ runs: [], lines: [], rects: [], qrs: [], images: [] });

function shift(s: SectionLayout, dy: number): SectionLayout {
  return {
    runs: s.runs.map((r) => ({ ...r, y: r.y + dy })),
    lines: s.lines.map((l) => ({ ...l, y: l.y + dy })),
    rects: s.rects.map((r) => ({ ...r, y: r.y + dy })),
    qrs: s.qrs.map((q) => ({ ...q, y: q.y + dy })),
    images: s.images.map((i) => ({ ...i, y: i.y + dy })),
  };
}

function textSection(t: TextBlock): SectionLayout {
  return { ...emptySection(), runs: t.runs, lines: t.lines };
}

export interface LayoutOptions {
  /** width / height of the uploaded logo, if any. */
  logoAspect?: number;
  /** Show grey placeholder copy for empty required fields (editor preview only). */
  placeholders?: boolean;
  /** Decode-test each QR matrix (skip for thumbnails). Defaults to true. */
  verifyQr?: boolean;
}

const qrCache = new Map<string, Omit<QrPrim, "kind" | "x" | "y" | "size">>();

/** Forces QR codes to be re-encoded and re-verified on the next layout. */
export function clearQrCache() {
  qrCache.clear();
}

function buildQr(url: string, design: CardDesign, verify: boolean) {
  const key = `${design.qrErrorLevel}|${design.qrQuietZone}|${verify}|${url}`;
  let hit = qrCache.get(key);
  if (!hit) {
    if (!isValidHttpUrl(url)) {
      hit = { url, path: "", viewSize: 1, version: 0, verified: false };
    } else {
      try {
        const matrix = createQrMatrix(url, design.qrErrorLevel);
        hit = {
          url,
          path: qrPath(matrix, design.qrQuietZone),
          viewSize: matrix.size + design.qrQuietZone * 2,
          version: matrix.version,
          verified: verify && verifyQrMatrix(matrix, url),
        };
      } catch {
        hit = { url, path: "", viewSize: 1, version: 0, verified: false };
      }
    }
    if (qrCache.size > 200) qrCache.clear();
    qrCache.set(key, hit);
  }
  return hit;
}

function buildBlocks(
  m: TextMeasurer,
  content: CardContent,
  design: CardDesign,
  k: number,
  contentWidth: number,
  cx: number,
  opts: LayoutOptions,
): Block[] {
  const { sizes: S, spacing: G, texts: T, fonts: F } = design;
  const lh = G.lineHeight;
  const ph = opts.placeholders ?? false;
  const blocks: Block[] = [];
  const text = (src: HardLine[], family: FontId, size: number, extra: Partial<TextOpts> = {}) =>
    layoutText(m, src, { family, size: size * k, lineHeight: lh, maxWidth: contentWidth, centerX: cx, ...extra });

  // Logo
  if (content.logoDataUrl) {
    const h = S.logo * k;
    const w = Math.min(contentWidth, h * (opts.logoAspect ?? 1));
    const hh = w / (opts.logoAspect ?? 1);
    blocks.push({
      id: "logo",
      height: hh,
      gapAfter: G.afterLogo * k,
      section: { ...emptySection(), images: [{ x: cx - w / 2, y: 0, w, h: hh, href: content.logoDataUrl }] },
    });
  }

  // Heading
  const heading = text(plain(T.heading), F.heading, S.heading, { lineHeight: 1.12 });
  blocks.push({ id: "heading", height: heading.height, gapAfter: G.afterHeading * k, section: textSection(heading) });

  // Brand name (script)
  const brandName = content.brandName.trim() || (ph ? "Your Brand" : "");
  const brand = text(plain(brandName), F.brand, S.brand, {
    lineHeight: 1.1,
    minNatural: 0.95,
    placeholder: !content.brandName.trim(),
  });
  blocks.push({ id: "brand", height: brand.height, gapAfter: G.afterBrand * k, section: textSection(brand) });

  // Intro
  const intro = text(plain(T.intro), F.body, S.intro);
  blocks.push({ id: "intro", height: intro.height, gapAfter: G.afterIntro * k, section: textSection(intro) });

  // Product name in a rounded box
  {
    const padX = 5 * k;
    const padY = 1.6 * k;
    const name = content.productName.trim() || (ph ? "Your Product Name" : "");
    const src = plain(name, { bold: true, italic: true, underline: true });
    const lastLine = src[src.length - 1];
    if (T.productSuffix && lastLine && lastLine.length) {
      const lastWord = lastLine[lastLine.length - 1];
      lastWord.push({ text: T.productSuffix, bold: true, italic: true, underline: false });
    }
    const t = layoutText(m, src, {
      family: F.body,
      size: S.product * k,
      lineHeight: lh,
      maxWidth: contentWidth - padX * 2 - 2 * design.borderWidth * k,
      centerX: cx,
      placeholder: !content.productName.trim(),
    });
    const sec = shift(textSection(t), padY);
    const bw = design.borderWidth * k;
    sec.rects.push({
      x: t.minX - padX,
      y: bw / 2,
      w: t.maxX - t.minX + padX * 2,
      h: t.height + padY * 2 - bw,
      r: design.borderRadius * k,
      strokeWidth: bw,
    });
    blocks.push({ id: "product", height: t.height + padY * 2, gapAfter: G.afterProduct * k, section: sec });
  }

  // Review message
  const msgSrc = content.customMessage.trim() || T.message;
  const message = text(parseRich(msgSrc, { bold: false, italic: false, underline: false }), F.body, S.message);
  blocks.push({ id: "message", height: message.height, gapAfter: G.afterMessage * k, section: textSection(message) });

  // QR codes
  {
    const gap = G.qrGap * k;
    const size = Math.min(S.qr * k, (contentWidth - gap) / 2);
    const labelGap = 1.2 * k;
    const sec = emptySection();
    let labelH = 0;
    const items: [QrPrim["kind"], string, string][] = [
      ["review", content.reviewUrl.trim(), T.reviewLabel],
      ["feedback", content.feedbackUrl.trim(), T.feedbackLabel],
    ];
    items.forEach(([kind, url, label], i) => {
      const x = i === 0 ? cx - gap / 2 - size : cx + gap / 2;
      const qr = buildQr(url, design, opts.verifyQr ?? true);
      sec.qrs.push({ ...qr, kind, x, y: 0, size });
      if (!qr.path) {
        sec.rects.push({ x, y: 0, w: size, h: size, r: 2 * k, strokeWidth: 0.6 * k, dashed: true });
        const hint = layoutText(m, plain(url ? "Invalid URL" : "Paste URL to generate QR"), {
          family: F.body,
          size: S.qrLabel * k,
          lineHeight: lh,
          maxWidth: size * 0.8,
          centerX: x + size / 2,
          placeholder: true,
        });
        sec.runs.push(...shift(textSection(hint), size / 2 - hint.height / 2).runs);
      }
      const lab = layoutText(m, plain(label, { bold: true }), {
        family: F.body,
        size: S.qrLabel * k,
        lineHeight: lh,
        maxWidth: size + gap * 0.8,
        centerX: x + size / 2,
      });
      sec.runs.push(...shift(textSection(lab), size + labelGap).runs);
      labelH = Math.max(labelH, lab.height);
    });
    blocks.push({ id: "qr", height: size + labelGap + labelH, gapAfter: G.afterQr * k, section: sec });
  }

  // WhatsApp support + contact box (only with a number)
  if (content.whatsappNumber.trim()) {
    const wa = text(parseRich(T.whatsappText, { bold: false, italic: false, underline: false }), F.body, S.whatsapp);
    blocks.push({ id: "whatsapp", height: wa.height, gapAfter: G.afterWhatsapp * k, section: textSection(wa) });

    const padX = 7 * k;
    const padY = 2.4 * k;
    const bw = design.borderWidth * k;
    const t = layoutText(m, plain(`${T.contactLabel} ${content.whatsappNumber.trim()}`, { bold: true }), {
      family: F.body,
      size: S.contact * k,
      lineHeight: lh,
      maxWidth: contentWidth - padX * 2,
      centerX: cx,
    });
    const sec = shift(textSection(t), padY);
    sec.rects.push({
      x: t.minX - padX,
      y: bw / 2,
      w: t.maxX - t.minX + padX * 2,
      h: t.height + padY * 2 - bw,
      r: design.borderRadius * k,
      strokeWidth: bw,
    });
    blocks.push({ id: "contact", height: t.height + padY * 2, gapAfter: G.afterContact * k, section: sec });
  }

  // Signature
  const signer = content.businessName.trim() || content.brandName.trim() || (ph ? "Your Business" : "");
  const sigSrc: HardLine[] = [
    [
      ...(T.signoff.trim() ? T.signoff.trim().split(/\s+/).map((w) => [{ text: w, bold: false, italic: false, underline: false }]) : []),
      ...signer.split(/\s+/).filter(Boolean).map((w) => [{ text: w, bold: true, italic: false, underline: false }]),
    ],
  ];
  const sig = text(sigSrc, F.body, S.signature);
  blocks.push({ id: "signature", height: sig.height, gapAfter: 0, section: textSection(sig) });

  return blocks;
}

const stackHeight = (blocks: Block[]) =>
  blocks.reduce((h, b, i) => h + b.height + (i < blocks.length - 1 ? b.gapAfter : 0), 0);

/* ------------------------------------------------------------------ entry */

export function layoutCard(
  m: TextMeasurer,
  content: CardContent,
  design: CardDesign,
  opts: LayoutOptions = {},
): CardLayout {
  const width = design.widthIn * 72;
  const height = design.heightIn * 72;
  const margin = Math.max(0, design.marginIn * 72);
  const contentWidth = Math.max(36, width - margin * 2);
  const available = Math.max(36, height - margin * 2);
  const cx = width / 2;
  const base = design.widthIn / 4;

  // Shrink everything uniformly if the content would overflow the safe area.
  let fitScale = 1;
  let blocks = buildBlocks(m, content, design, base, contentWidth, cx, opts);
  if (stackHeight(blocks) > available) {
    let lo = 0.3;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const b = buildBlocks(m, content, design, base * mid, contentWidth, cx, opts);
      if (stackHeight(b) > available) hi = mid;
      else lo = mid;
    }
    fitScale = lo;
    blocks = buildBlocks(m, content, design, base * lo, contentWidth, cx, opts);
  }

  const extra = Math.max(0, available - stackHeight(blocks));
  const gaps = blocks.length - 1;
  let y = margin;
  let gapExtra = 0;
  if (design.fitMode === "center") y += extra / 2;
  else if (design.fitMode === "distribute" && gaps > 0) {
    const unit = extra / (gaps + 1);
    y += unit / 2;
    gapExtra = unit;
  }

  const sections: CardLayout["sections"] = {};
  const qrs: QrPrim[] = [];
  blocks.forEach((b) => {
    const s = shift(b.section, y);
    sections[b.id] = s;
    qrs.push(...s.qrs);
    y += b.height + b.gapAfter + gapExtra;
  });

  return { width, height, margin, sections, fitScale, qrs };
}

