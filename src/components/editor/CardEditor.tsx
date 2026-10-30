"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Loader2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent as CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThankYouCard } from "@/components/card/ThankYouCard";
import { saveCard, saveTemplate } from "@/app/actions";
import { clearQrCache } from "@/lib/card/layout";
import { verifyCardForPrint, QrVerificationError } from "@/lib/card/export";
import { BODY_FONTS, SCRIPT_FONTS, type BodyFontId, type ScriptFontId } from "@/lib/card/fonts";
import {
  DEFAULT_DESIGN,
  DEFAULT_TEXTS,
  SIZE_PRESETS,
  type CardContent,
  type CardDesign,
  type CardSizes,
  type CardSpacing,
  type CardTexts,
  type FitMode,
  type QrErrorLevel,
} from "@/lib/card/types";
import { cardContentSchema, fieldErrors } from "@/lib/validation";
import { ExportManager } from "./ExportManager";
import { Field, NativeSelect, NumberControl, TextField } from "./fields";
import { LogoInput } from "./LogoInput";
import { useCardLayout } from "./useCardLayout";

export interface BrandProfileOption {
  id: string;
  name: string;
  businessName: string | null;
  logoDataUrl: string | null;
  whatsappNumber: string | null;
  feedbackUrl: string | null;
}

export interface TemplateOption {
  id: string;
  name: string;
  design: CardDesign;
}

interface CardEditorProps {
  cardId?: string;
  initialContent: CardContent;
  initialDesign: CardDesign;
  initialBrandProfileId?: string | null;
  initialTemplateId?: string | null;
  brandProfiles: BrandProfileOption[];
  templates: TemplateOption[];
  dbAvailable: boolean;
}

const SIZE_LABELS: [keyof CardSizes, string, number, number, string][] = [
  ["heading", "Heading", 8, 36, "pt"],
  ["brand", "Brand name", 10, 60, "pt"],
  ["intro", "Intro line", 6, 20, "pt"],
  ["product", "Product name", 6, 20, "pt"],
  ["message", "Review message", 6, 20, "pt"],
  ["qr", "QR code size", 40, 140, "pt"],
  ["qrLabel", "QR labels", 4, 14, "pt"],
  ["whatsapp", "WhatsApp text", 6, 20, "pt"],
  ["contact", "Contact number", 6, 20, "pt"],
  ["signature", "Signature", 6, 22, "pt"],
  ["logo", "Logo height", 10, 80, "pt"],
];

const SPACING_LABELS: [keyof CardSpacing, string, number, number][] = [
  ["afterHeading", "Heading → brand", 0, 30],
  ["afterBrand", "Brand → intro", 0, 30],
  ["afterIntro", "Intro → product", 0, 30],
  ["afterProduct", "Product → message", 0, 40],
  ["afterMessage", "Message → QR codes", 0, 40],
  ["afterQr", "QR codes → WhatsApp", 0, 40],
  ["afterWhatsapp", "WhatsApp → number", 0, 30],
  ["afterContact", "Number → signature", 0, 40],
  ["afterLogo", "Logo → heading", 0, 30],
  ["qrGap", "Gap between QR codes", 4, 80],
];

const TEXT_FIELDS: { key: keyof CardTexts; label: string; multiline?: boolean; rich?: boolean }[] = [
  { key: "heading", label: "Heading" },
  { key: "intro", label: "Product intro line" },
  { key: "productSuffix", label: "Text after product name" },
  { key: "message", label: "Default review message", multiline: true, rich: true },
  { key: "reviewLabel", label: "Left QR label" },
  { key: "feedbackLabel", label: "Right QR label" },
  { key: "whatsappText", label: "WhatsApp support text", multiline: true, rich: true },
  { key: "contactLabel", label: "Contact label" },
  { key: "signoff", label: "Sign-off" },
];

export function CardEditor(props: CardEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<CardContent>(props.initialContent);
  const [design, setDesign] = useState<CardDesign>(props.initialDesign);
  const [brandProfileId, setBrandProfileId] = useState(props.initialBrandProfileId ?? "");
  const [templateId, setTemplateId] = useState(props.initialTemplateId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, startSaving] = useTransition();
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const { preview, buildExportLayout, fontError } = useCardLayout(content, design);

  const setField = <K extends keyof CardContent>(key: K, value: CardContent[K]) => {
    setContent((c) => ({ ...c, [key]: value }));
    setDirty(true);
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };
  const patchDesign = (patch: Partial<CardDesign>) => {
    setDesign((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setSize = (key: keyof CardSizes, v: number) => patchDesign({ sizes: { ...design.sizes, [key]: v } });
  const setSpacing = (key: keyof CardSpacing, v: number) => patchDesign({ spacing: { ...design.spacing, [key]: v } });
  const setText = (key: keyof CardTexts, v: string) => patchDesign({ texts: { ...design.texts, [key]: v } });

  const validate = useCallback(() => {
    const r = cardContentSchema.safeParse(content);
    if (r.success) {
      if (r.data.reviewUrl === r.data.feedbackUrl) {
        setErrors({ feedbackUrl: "Use a different URL from the product review URL so the two QR codes differ" });
        return false;
      }
      setErrors({});
      return true;
    }
    setErrors(fieldErrors(r.error));
    return false;
  }, [content]);

  function applyBrandProfile(id: string) {
    setBrandProfileId(id);
    const p = props.brandProfiles.find((b) => b.id === id);
    if (!p) return;
    setContent((c) => ({
      ...c,
      brandName: p.name,
      businessName: p.businessName ?? "",
      logoDataUrl: p.logoDataUrl,
      whatsappNumber: p.whatsappNumber ?? c.whatsappNumber,
      feedbackUrl: p.feedbackUrl || c.feedbackUrl,
    }));
    setDirty(true);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = props.templates.find((x) => x.id === id);
    setDesign(t ? t.design : DEFAULT_DESIGN);
    setDirty(true);
  }

  function persist(after?: (id: string) => void) {
    if (!props.dbAvailable) {
      toast.warning("Not saved: the database is offline", { description: "You can still download the card." });
      return;
    }
    startSaving(async () => {
      const res = await saveCard({ id: props.cardId, content, design, brandProfileId, templateId });
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      setDirty(false);
      toast.success(props.cardId ? "Card saved" : "Card created and saved");
      after?.(res.data.id);
    });
  }

  async function generate() {
    if (!validate()) {
      toast.error("Please fill in the required fields");
      return;
    }
    const layout = buildExportLayout();
    if (!layout) return;
    setGenerating(true);
    try {
      clearQrCache();
      await verifyCardForPrint(layout, 300);
      toast.success("Card generated", { description: "Both QR codes were scanned back and match your URLs." });
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      persist((id) => {
        if (!props.cardId) router.replace(`/cards/${id}`);
        else router.refresh();
      });
    } catch (err) {
      toast.error("Could not generate card", {
        description: err instanceof QrVerificationError ? err.problems.join(". ") : String(err),
      });
    } finally {
      setGenerating(false);
    }
  }

  function regenerateQrs() {
    clearQrCache();
    setDesign((d) => ({ ...d }));
    toast.info("QR codes regenerated and re-verified");
  }

  async function createTemplate() {
    const res = await saveTemplate({ name: templateName, design });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setTemplateId(res.data.id);
    setTemplateDialog(false);
    setTemplateName("");
    toast.success("Template saved");
    router.refresh();
  }

  const presetId =
    SIZE_PRESETS.find((p) => p.widthIn === design.widthIn && p.heightIn === design.heightIn)?.id ?? "custom";
  const scaleNote = design.widthIn !== 4 ? ` · sizes scale ×${(design.widthIn / 4).toFixed(2)} for this width` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ------------------------------------------------ left: form */}
      <div className="min-w-0 space-y-4">
        {(props.brandProfiles.length > 0 || props.templates.length > 0) && (
          <Card size="sm">
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand profile" htmlFor="brand-profile">
                <NativeSelect
                  id="brand-profile"
                  value={brandProfileId}
                  onChange={applyBrandProfile}
                  options={[
                    { value: "", label: "None" },
                    ...props.brandProfiles.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
              </Field>
              <Field label="Template" htmlFor="template">
                <NativeSelect
                  id="template"
                  value={templateId}
                  onChange={applyTemplate}
                  options={[
                    { value: "", label: "Reference design (default)" },
                    ...props.templates.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                />
              </Field>
            </CardBody>
          </Card>
        )}

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="text">Edit text</TabsTrigger>
            <TabsTrigger value="layout">Size &amp; layout</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Section title="Brand information">
              <TextField
                label="Brand name"
                required
                value={content.brandName}
                onChange={(v) => setField("brandName", v)}
                error={errors.brandName}
                placeholder="e.g. Hogitomist"
                maxLength={60}
              />
              <TextField
                label="Business name / signature"
                value={content.businessName}
                onChange={(v) => setField("businessName", v)}
                error={errors.businessName}
                placeholder="e.g. Sarvopari Enterprise"
                hint="Shown after “Best,”. Uses the brand name if left empty."
                maxLength={80}
              />
              <Field label="Brand logo" error={errors.logoDataUrl}>
                <LogoInput value={content.logoDataUrl} onChange={(v) => setField("logoDataUrl", v)} />
              </Field>
            </Section>

            <Section title="Product information">
              <TextField
                label="Product name"
                required
                value={content.productName}
                onChange={(v) => setField("productName", v)}
                error={errors.productName}
                placeholder="e.g. Car Armrest Cushion Pad With Side Pockets"
                maxLength={200}
              />
            </Section>

            <Section
              title="QR codes"
              action={
                <Button variant="ghost" size="sm" onClick={regenerateQrs}>
                  <RefreshCwIcon /> Regenerate
                </Button>
              }
            >
              <TextField
                label="Product review URL"
                required
                type="url"
                inputMode="url"
                value={content.reviewUrl}
                onChange={(v) => setField("reviewUrl", v)}
                error={errors.reviewUrl}
                placeholder="https://www.amazon.in/review/create-review?asin=…"
                hint={<QrStatus layout={preview} kind="review" />}
              />
              <TextField
                label="Seller feedback / store review URL"
                required
                type="url"
                inputMode="url"
                value={content.feedbackUrl}
                onChange={(v) => setField("feedbackUrl", v)}
                error={errors.feedbackUrl}
                placeholder="https://www.amazon.in/hz/feedback…"
                hint={<QrStatus layout={preview} kind="feedback" />}
              />
            </Section>

            <Section title="Contact information">
              <TextField
                label="WhatsApp number"
                type="tel"
                inputMode="tel"
                value={content.whatsappNumber}
                onChange={(v) => setField("whatsappNumber", v)}
                error={errors.whatsappNumber}
                placeholder="+91 92271 51536"
                hint="Leave empty to hide the WhatsApp section."
              />
              <Field
                label="Custom thank-you message"
                htmlFor="custom-message"
                error={errors.customMessage}
                hint={
                  <>
                    Replaces the default review message. Wrap phrases in <code>**double asterisks**</code> to make
                    them bold.
                  </>
                }
              >
                <Textarea
                  id="custom-message"
                  rows={4}
                  maxLength={1000}
                  value={content.customMessage}
                  placeholder={design.texts.message.replace(/\*\*/g, "")}
                  onChange={(e) => setField("customMessage", e.target.value)}
                />
              </Field>
            </Section>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <Section
              title="Card copy"
              description="Wrap words in **double asterisks** to make them bold in rich fields."
              action={
                <Button variant="ghost" size="sm" onClick={() => patchDesign({ texts: DEFAULT_TEXTS })}>
                  <RotateCcwIcon /> Reset text
                </Button>
              }
            >
              {TEXT_FIELDS.map((f) =>
                f.multiline ? (
                  <Field key={f.key} label={f.label} htmlFor={`text-${f.key}`} required>
                    <Textarea
                      id={`text-${f.key}`}
                      rows={4}
                      value={design.texts[f.key]}
                      onChange={(e) => setText(f.key, e.target.value)}
                    />
                  </Field>
                ) : (
                  <TextField
                    key={f.key}
                    label={f.label}
                    required={f.key !== "productSuffix"}
                    value={design.texts[f.key]}
                    onChange={(v) => setText(f.key, v)}
                  />
                ),
              )}
            </Section>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <Section
              title="Card dimensions"
              action={
                <Button variant="ghost" size="sm" onClick={() => patchDesign({ ...DEFAULT_DESIGN, texts: design.texts })}>
                  <RotateCcwIcon /> Reset layout
                </Button>
              }
            >
              <Field label="Size" htmlFor="size-preset" required>
                <NativeSelect
                  id="size-preset"
                  value={presetId}
                  onChange={(id) => {
                    const p = SIZE_PRESETS.find((x) => x.id === id);
                    if (p) patchDesign({ widthIn: p.widthIn, heightIn: p.heightIn });
                  }}
                  options={[
                    ...SIZE_PRESETS.map((p) => ({ value: p.id, label: p.label })),
                    ...(presetId === "custom" ? [{ value: "custom", label: "Custom" }] : []),
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <NumberControl label="Width" unit="in" value={design.widthIn} min={2} max={12} step={0.01} onChange={(v) => patchDesign({ widthIn: v })} />
                <NumberControl label="Height" unit="in" value={design.heightIn} min={2} max={17} step={0.01} onChange={(v) => patchDesign({ heightIn: v })} />
              </div>
              <NumberControl label="Print-safe margin" unit="in" value={design.marginIn} min={0} max={1} step={0.01} onChange={(v) => patchDesign({ marginIn: v })} />
              <Field label="Vertical fill" htmlFor="fit-mode" required hint="Content always shrinks to fit; this controls spare space.">
                <NativeSelect
                  id="fit-mode"
                  value={design.fitMode}
                  onChange={(v) => patchDesign({ fitMode: v as FitMode })}
                  options={[
                    { value: "distribute", label: "Spread sections evenly (reference)" },
                    { value: "center", label: "Center vertically" },
                    { value: "top", label: "Align to top" },
                  ]}
                />
              </Field>
            </Section>

            <Section title="Fonts">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Heading" htmlFor="font-heading" required>
                  <NativeSelect
                    id="font-heading"
                    value={design.fonts.heading}
                    onChange={(v) => patchDesign({ fonts: { ...design.fonts, heading: v as BodyFontId } })}
                    options={Object.entries(BODY_FONTS).map(([value, f]) => ({ value, label: f.label }))}
                  />
                </Field>
                <Field label="Brand script" htmlFor="font-brand" required>
                  <NativeSelect
                    id="font-brand"
                    value={design.fonts.brand}
                    onChange={(v) => patchDesign({ fonts: { ...design.fonts, brand: v as ScriptFontId } })}
                    options={Object.entries(SCRIPT_FONTS).map(([value, f]) => ({ value, label: f.label }))}
                  />
                </Field>
                <Field label="Body" htmlFor="font-body" required>
                  <NativeSelect
                    id="font-body"
                    value={design.fonts.body}
                    onChange={(v) => patchDesign({ fonts: { ...design.fonts, body: v as BodyFontId } })}
                    options={Object.entries(BODY_FONTS).map(([value, f]) => ({ value, label: f.label }))}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Font sizes" description={`Sizes are for a 4 in wide card${scaleNote}.`}>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {SIZE_LABELS.map(([key, label, min, max, unit]) => (
                  <NumberControl key={key} label={label} unit={unit} value={design.sizes[key]} min={min} max={max} step={0.1} onChange={(v) => setSize(key, v)} />
                ))}
              </div>
            </Section>

            <Section title="Spacing">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {SPACING_LABELS.map(([key, label, min, max]) => (
                  <NumberControl key={key} label={label} unit="pt" value={design.spacing[key]} min={min} max={max} step={0.5} onChange={(v) => setSpacing(key, v)} />
                ))}
                <NumberControl label="Line height" value={design.spacing.lineHeight} min={0.9} max={2} step={0.01} onChange={(v) => setSpacing("lineHeight", v)} />
              </div>
            </Section>

            <Section title="Borders & QR codes">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <NumberControl label="Border width" unit="pt" value={design.borderWidth} min={0} max={4} step={0.1} onChange={(v) => patchDesign({ borderWidth: v })} />
                <NumberControl label="Corner radius" unit="pt" value={design.borderRadius} min={0} max={30} step={0.5} onChange={(v) => patchDesign({ borderRadius: v })} />
                <NumberControl label="QR quiet zone" unit="mod" value={design.qrQuietZone} min={2} max={8} step={1} onChange={(v) => patchDesign({ qrQuietZone: Math.round(v) })} />
                <Field label="QR error correction" htmlFor="qr-ecc" required>
                  <NativeSelect
                    id="qr-ecc"
                    value={design.qrErrorLevel}
                    onChange={(v) => patchDesign({ qrErrorLevel: v as QrErrorLevel })}
                    options={[
                      { value: "H", label: "High (30%, recommended)" },
                      { value: "Q", label: "Quartile (25%)" },
                      { value: "M", label: "Medium (15%)" },
                      { value: "L", label: "Low (7%)" },
                    ]}
                  />
                </Field>
              </div>
            </Section>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-background via-background to-background/0 px-1 pt-4 pb-4">
          <Button className="h-11 w-full text-base" onClick={generate} disabled={generating || saving || !preview}>
            {generating || saving ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            Generate Thank You Card
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------ right: preview */}
      <div ref={previewRef} className="min-w-0 scroll-mt-20">
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Live preview</CardTitle>
                <CardDescription>
                  {design.widthIn} × {design.heightIn} in · {Math.round(design.widthIn * 300)} × {Math.round(design.heightIn * 300)} px at 300 dpi
                  {preview && preview.fitScale < 0.999 ? ` · text shrunk to ${Math.round(preview.fitScale * 100)}% to fit` : ""}
                </CardDescription>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={showSafeArea} onCheckedChange={setShowSafeArea} size="sm" />
                Safe area
              </label>
            </CardHeader>
            <CardBody>
              <div className="flex justify-center rounded-lg bg-muted/60 p-4 sm:p-6">
                {preview ? (
                  <ThankYouCard
                    layout={preview}
                    showSafeArea={showSafeArea}
                    className="h-auto max-h-[calc(100vh-22rem)] min-h-[420px] w-auto max-w-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.08)]"
                  />
                ) : (
                  <div
                    className="flex w-full max-w-sm animate-pulse items-center justify-center rounded bg-white text-sm text-muted-foreground"
                    style={{ aspectRatio: `${design.widthIn} / ${design.heightIn}` }}
                  >
                    {fontError ?? "Loading fonts…"}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card size="sm">
            <CardBody className="space-y-3">
              <ExportManager
                getLayout={buildExportLayout}
                validate={validate}
                brandName={content.brandName}
                productName={content.productName}
                cardId={props.cardId}
              />
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => persist((id) => !props.cardId && router.replace(`/cards/${id}`))} disabled={saving}>
                  <SaveIcon /> {props.cardId ? (dirty ? "Save changes" : "Saved") : "Save card"}
                </Button>
                <Button variant="secondary" onClick={() => setTemplateDialog(true)} disabled={!props.dbAvailable}>
                  <LayoutTemplateIcon /> Save as template
                </Button>
              </div>
              {!props.dbAvailable && (
                <p className="text-xs text-muted-foreground">
                  Database offline: generating and downloading still work, saving is disabled.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Saves the text, fonts, sizes, spacing and dimensions so you can reuse them for other products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={templateName}
              maxLength={80}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Hogitomist 4×6 standard"
              onKeyDown={(e) => e.key === "Enter" && templateName.trim() && createTemplate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createTemplate} disabled={!templateName.trim()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

function QrStatus({ layout, kind }: { layout: ReturnType<typeof useCardLayout>["preview"]; kind: "review" | "feedback" }) {
  const qr = layout?.qrs.find((q) => q.kind === kind);
  if (!qr || !qr.url) return <span>Generates the {kind === "review" ? "left" : "right"} QR code.</span>;
  if (!qr.path) return null;
  return qr.verified ? (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <CheckCircle2Icon className="size-3.5" /> QR generated and scan-tested (version {qr.version})
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-destructive">
      <CircleAlertIcon className="size-3.5" /> QR failed its scan test. Try a shorter URL.
    </span>
  );
}
