import type { CardLayout } from "@/lib/card/layout";
import {
  BrandHeader,
  BusinessSignature,
  ProductSection,
  QRCodeSection,
  ReviewMessage,
  WhatsAppSection,
} from "./sections";

interface ThankYouCardProps {
  layout: CardLayout;
  className?: string;
  /** Draw the print-safe margin guide (preview only). */
  showSafeArea?: boolean;
}

/**
 * The card as a single SVG in pt units. The same markup is used for the live
 * preview, the PNG/JPG rasteriser and the vector PDF export.
 */
export function ThankYouCard({ layout, className, showSafeArea }: ThankYouCardProps) {
  const { width, height, margin } = layout;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}pt`}
      height={`${height}pt`}
      className={className}
      textRendering="geometricPrecision"
    >
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
      {showSafeArea && (
        <rect
          x={margin}
          y={margin}
          width={width - margin * 2}
          height={height - margin * 2}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={0.5}
          strokeDasharray="3 3"
          data-guide="safe-area"
        />
      )}
      <BrandHeader layout={layout} />
      <ProductSection layout={layout} />
      <ReviewMessage layout={layout} />
      <QRCodeSection layout={layout} />
      <WhatsAppSection layout={layout} />
      <BusinessSignature layout={layout} />
    </svg>
  );
}
