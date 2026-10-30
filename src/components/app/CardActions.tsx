"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CopyIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteCard, duplicateCard } from "@/app/actions";
import { ConfirmDialog } from "./ConfirmDialog";

export function CardActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Link href={`/cards/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <PencilIcon /> Edit
      </Link>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await duplicateCard(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Card duplicated");
            router.push(`/cards/${res.data.id}`);
          })
        }
      >
        <CopyIcon /> Duplicate
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => setConfirm(true)} aria-label="Delete card">
        <Trash2Icon />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this card?"
        description={`“${title}” will be removed from your history. This can’t be undone.`}
        onConfirm={() =>
          start(async () => {
            const res = await deleteCard(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Card deleted");
          })
        }
      />
    </div>
  );
}
