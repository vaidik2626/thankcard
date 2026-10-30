"use client";

import { useRef, useState } from "react";
import { ImageUpIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1000;

/** Normalises any uploaded image to a trimmed-size PNG data URL (works in PDF + raster export). */
async function toPngDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || MAX_EDGE, img.naturalHeight || MAX_EDGE));
    const w = Math.max(1, Math.round((img.naturalWidth || MAX_EDGE) * ratio));
    const h = Math.max(1, Math.round((img.naturalHeight || MAX_EDGE) * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setError("Use a PNG, JPG, WEBP or SVG image");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("Image must be under 5 MB");
      return;
    }
    try {
      onChange(await toPngDataUrl(file));
    } catch {
      setError("Could not read that image");
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Brand logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageUpIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {value ? "Replace" : "Upload logo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <XIcon /> Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Shown small above the heading. The reference design has no logo.</p>
      )}
    </div>
  );
}
