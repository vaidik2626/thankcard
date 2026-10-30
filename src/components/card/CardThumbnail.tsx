"use client";

import { useMemo } from "react";
import { layoutCard } from "@/lib/card/layout";
import type { CardContent, CardDesign } from "@/lib/card/types";
import { useCardFonts, useImageAspect } from "@/components/editor/useCardLayout";
import { cn } from "@/lib/utils";
import { ThankYouCard } from "./ThankYouCard";

/** Small, non-interactive render of a card for lists. */
export function CardThumbnail({
  content,
  design,
  className,
}: {
  content: CardContent;
  design: CardDesign;
  className?: string;
}) {
  const { measurer } = useCardFonts();
  const logoAspect = useImageAspect(content.logoDataUrl);
  const layout = useMemo(
    () => (measurer ? layoutCard(measurer, content, design, { logoAspect, placeholders: true, verifyQr: false }) : null),
    [measurer, content, design, logoAspect],
  );
  return (
    <div
      className={cn("overflow-hidden rounded-sm bg-white ring-1 ring-black/10", className)}
      style={{ aspectRatio: `${design.widthIn} / ${design.heightIn}` }}
    >
      {layout && <ThankYouCard layout={layout} className="block h-full w-full" />}
    </div>
  );
}
