# ThankCard Studio

Generates print-ready Amazon / e-commerce thank-you cards that follow the reference design in
[`reference/`](reference/). Each card has two QR codes: one for a product review and one for seller feedback.

## Quick start

```bash
npm install
docker compose up -d        # PostgreSQL 16 on localhost:5432
npm run db:push             # create tables
npm run dev                 # http://localhost:3000
```

`DATABASE_URL` is set in `.env`. Copy `.env.example` to `.env` to start. Without a database, you can
still create, preview and download cards. Only saving, history, brands, templates and bulk save need it.

## How it works

- **One geometry, three outputs.** `src/lib/card/layout.ts` measures text with the real card fonts
  and returns positioned primitives in pt. These are runs, underlines, rounded boxes and QR paths.
  `ThankYouCard` renders them as one SVG. The same SVG is used for:
  - the live preview,
  - **PDF**: vector output through jsPDF + svg2pdf.js. Fonts are embedded and the text can be
    selected. QR codes are vector paths.
  - **PNG/JPG**: rasterised at 300 or 600 DPI with fonts embedded as data URIs. DPI metadata is
    written (PNG `pHYs`, JPEG JFIF).
- **QR codes** use error-correction level H and a 4-module quiet zone. Each one is decode-tested
  with jsQR as you type. Before any export, the card is rasterised and each QR is cropped and
  scanned again. The export is blocked if a code does not decode to its exact URL, or if both
  codes use the same URL.
- **Auto-fit.** Content always fits the safe margin, and text shrinks uniformly if needed. Spare
  space is spread between sections, as in the reference.
- **Sizes** are given for a 4 in wide card and scale with other widths, so A4, 5×7 and custom
  sizes keep the same proportions.

### Fonts

The reference uses Calibri, Lucida Sans and Script MT Bold. These are proprietary and cannot be
redistributed. The app ships close SIL-OFL substitutes in `public/fonts`:

| Reference      | Used here                          |
| -------------- | ---------------------------------- |
| Calibri        | Carlito (metric-compatible)        |
| Lucida Sans    | Fira Sans (SemiBold for “Demi”)    |
| Script MT Bold | Yesteryear (other scripts can be chosen in the editor) |

## Structure

```
src/lib/card/        types + defaults, fonts, layout engine, QR, export, mappers
src/components/card/ ThankYouCard, BrandHeader, ProductSection, ReviewMessage,
                     QRCodeSection, WhatsAppSection, BusinessSignature
src/components/editor/ CardEditor, ExportManager, form controls
src/app/             dashboard (history), cards/new, cards/[id], brands, templates, bulk
src/app/actions.ts   server actions (zod-validated) for cards, brands, templates, bulk jobs
prisma/schema.prisma BrandProfile, Template, Card, BulkJob
```

## Bulk CSV

Columns: `brand_name, product_name, review_url, feedback_url` (required), plus
`whatsapp_number, business_name, custom_message`. Each row is validated. You can download all
cards as one multi-page PDF, or save them to history as a `BulkJob`. Up to 500 rows per upload.
