"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { loadCardFonts } from "@/lib/card/fonts";
import { createCanvasMeasurer, layoutCard, type CardLayout, type TextMeasurer } from "@/lib/card/layout";
import type { CardContent, CardDesign } from "@/lib/card/types";

export function useCardFonts() {
  const [measurer, setMeasurer] = useState<TextMeasurer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadCardFonts()
      .then(() => alive && setMeasurer(createCanvasMeasurer()))
      .catch(() => alive && setError("Card fonts failed to load. Check your connection and reload."));
    return () => {
      alive = false;
    };
  }, []);
  return { measurer, error };
}

export function useImageAspect(src: string | null) {
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setAspect(img.naturalWidth / Math.max(1, img.naturalHeight));
    img.src = src;
  }, [src]);
  return src ? aspect : undefined;
}

/** Live layout for the preview (with placeholders) and the export layout (without). */
export function useCardLayout(content: CardContent, design: CardDesign) {
  const { measurer, error } = useCardFonts();
  const deferredContent = useDeferredValue(content);
  const deferredDesign = useDeferredValue(design);
  const logoAspect = useImageAspect(content.logoDataUrl);

  const preview: CardLayout | null = useMemo(
    () =>
      measurer
        ? layoutCard(measurer, deferredContent, deferredDesign, { logoAspect, placeholders: true })
        : null,
    [measurer, deferredContent, deferredDesign, logoAspect],
  );

  const buildExportLayout = useMemo(
    () => () => (measurer ? layoutCard(measurer, content, design, { logoAspect, placeholders: false }) : null),
    [measurer, content, design, logoAspect],
  );

  return { preview, buildExportLayout, measurer, fontError: error };
}
