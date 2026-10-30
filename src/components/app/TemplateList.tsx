"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardThumbnail } from "@/components/card/CardThumbnail";
import { deleteTemplate } from "@/app/actions";
import { DEFAULT_DESIGN, SAMPLE_CONTENT, type CardDesign } from "@/lib/card/types";
import { ConfirmDialog } from "./ConfirmDialog";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  design: CardDesign;
  cardCount: number;
}

export function TemplateList({ templates }: { templates: TemplateItem[] }) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState<TemplateItem | null>(null);
  const [, start] = useTransition();

  const builtIn: TemplateItem = {
    id: "",
    name: "Reference design",
    description: "The default layout, matching the reference card.",
    design: DEFAULT_DESIGN,
    cardCount: 0,
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[builtIn, ...templates].map((t) => (
          <Card key={t.id || "builtin"} size="sm">
            <CardContent className="space-y-3">
              <div className="flex justify-center rounded-lg bg-muted/60 p-4">
                <CardThumbnail content={SAMPLE_CONTENT} design={t.design} className="w-40" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{t.name}</p>
                  {!t.id && <Badge variant="secondary">Built-in</Badge>}
                </div>
                {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {t.design.widthIn} × {t.design.heightIn} in
                  {t.id ? ` · used by ${t.cardCount} card${t.cardCount === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Link
                  href={t.id ? `/cards/new?template=${t.id}` : "/cards/new"}
                  className={buttonVariants({ size: "sm" })}
                >
                  <PlusIcon /> Use template
                </Link>
                {t.id && (
                  <Button variant="ghost" size="icon-sm" aria-label="Delete template" onClick={() => setToDelete(t)}>
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No saved templates yet. Adjust a card’s text or layout in the editor, then choose “Save as template”.
        </p>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete template?"
        description={`“${toDelete?.name ?? ""}” will be removed. Existing cards keep their design.`}
        onConfirm={() => {
          if (!toDelete) return;
          const id = toDelete.id;
          start(async () => {
            const res = await deleteTemplate(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Template deleted");
            router.refresh();
          });
        }}
      />
    </>
  );
}
