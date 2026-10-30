"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteBrandProfile, saveBrandProfile } from "@/app/actions";
import { Field, TextField } from "@/components/editor/fields";
import { LogoInput } from "@/components/editor/LogoInput";
import { ConfirmDialog } from "./ConfirmDialog";

interface Brand {
  id: string;
  name: string;
  businessName: string | null;
  logoDataUrl: string | null;
  whatsappNumber: string | null;
  feedbackUrl: string | null;
  cardCount: number;
}

type Draft = {
  id?: string;
  name: string;
  businessName: string;
  logoDataUrl: string | null;
  whatsappNumber: string;
  feedbackUrl: string;
};

const EMPTY: Draft = { name: "", businessName: "", logoDataUrl: null, whatsappNumber: "", feedbackUrl: "" };

export function BrandManager({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Brand | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function open(d: Draft) {
    setErrors({});
    setDraft(d);
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await saveBrandProfile(draft);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(draft.id ? "Brand updated" : "Brand created");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => open(EMPTY)}>
        <PlusIcon /> New brand profile
      </Button>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No brand profiles yet. Selling under several brands? Add one for each.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => (
            <Card key={b.id} size="sm">
              <CardContent className="flex gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white text-lg font-semibold">
                  {b.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logoDataUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    b.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{b.businessName || "No signature set"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.whatsappNumber || "No WhatsApp"} · {b.cardCount} card{b.cardCount === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Link href={`/cards/new?brand=${b.id}`} className={buttonVariants({ size: "sm" })}>
                      <PlusIcon /> New card
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        open({
                          id: b.id,
                          name: b.name,
                          businessName: b.businessName ?? "",
                          logoDataUrl: b.logoDataUrl,
                          whatsappNumber: b.whatsappNumber ?? "",
                          feedbackUrl: b.feedbackUrl ?? "",
                        })
                      }
                    >
                      <PencilIcon /> Edit
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete brand" onClick={() => setToDelete(b)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit brand profile" : "New brand profile"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <TextField label="Brand name" required value={draft.name} onChange={(v) => set("name", v)} error={errors.name} />
              <TextField
                label="Business name / signature"
                value={draft.businessName}
                onChange={(v) => set("businessName", v)}
                error={errors.businessName}
              />
              <Field label="Logo" error={errors.logoDataUrl}>
                <LogoInput value={draft.logoDataUrl} onChange={(v) => set("logoDataUrl", v)} />
              </Field>
              <TextField
                label="WhatsApp number"
                type="tel"
                value={draft.whatsappNumber}
                onChange={(v) => set("whatsappNumber", v)}
                error={errors.whatsappNumber}
              />
              <TextField
                label="Default seller feedback URL"
                type="url"
                value={draft.feedbackUrl}
                onChange={(v) => set("feedbackUrl", v)}
                error={errors.feedbackUrl}
                hint="Your store feedback link is usually the same for every product."
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete brand profile?"
        description={`“${toDelete?.name ?? ""}” will be removed. Cards made with it are kept.`}
        onConfirm={() => {
          if (!toDelete) return;
          const id = toDelete.id;
          start(async () => {
            const res = await deleteBrandProfile(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Brand deleted");
            router.refresh();
          });
        }}
      />
    </div>
  );
}
