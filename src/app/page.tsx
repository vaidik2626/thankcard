import Link from "next/link";
import { ArrowRightIcon, PlusIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { DbNotice } from "@/components/app/DbNotice";
import { CardActions } from "@/components/app/CardActions";
import { CardThumbnail } from "@/components/card/CardThumbnail";
import { getDashboardStats, listCards } from "@/lib/server/queries";
import { recordToContent, recordToDesign } from "@/lib/card/mappers";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [stats, cards] = await Promise.all([getDashboardStats(), listCards(q)]);
  const dbOk = stats.ok && cards.ok;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Create print-ready thank-you cards with review and feedback QR codes."
        actions={
          <>
            <Link href="/cards/new?example=1" className={buttonVariants({ variant: "outline" })}>
              <SparklesIcon /> Try with example
            </Link>
            <Link href="/cards/new" className={buttonVariants()}>
              <PlusIcon /> Create new card
            </Link>
          </>
        }
      />

      {!dbOk && <DbNotice />}

      {stats.ok && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Cards", stats.data.cards, "/"],
            ["Brand profiles", stats.data.brands, "/brands"],
            ["Templates", stats.data.templates, "/templates"],
            ["Downloads", stats.data.exports, "/"],
          ].map(([label, value, href]) => (
            <Link key={label as string} href={href as string}>
              <Card size="sm" className="transition-colors hover:bg-muted/40">
                <CardContent>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {cards.ok && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Card history</h2>
            <form className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Search brand or product" className="h-9 pl-8" />
            </form>
          </div>

          {cards.data.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="font-medium">{q ? `No cards match “${q}”` : "No cards yet"}</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Enter your brand, product and two review links. You get a card that matches the reference design
                  and is ready to print.
                </p>
                <Link href="/cards/new" className={cn(buttonVariants(), "mt-2")}>
                  Create your first card <ArrowRightIcon />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.data.map((card) => {
                const design = recordToDesign(card);
                return (
                  <Card key={card.id} size="sm">
                    <CardContent className="flex gap-4">
                      <Link href={`/cards/${card.id}`} className="w-24 shrink-0">
                        <CardThumbnail content={recordToContent(card)} design={design} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="min-w-0">
                          <Link href={`/cards/${card.id}`} className="line-clamp-2 font-medium hover:underline">
                            {card.productName}
                          </Link>
                          <p className="truncate text-sm text-muted-foreground">{card.brandName}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary">
                            {design.widthIn}×{design.heightIn} in
                          </Badge>
                          {card.exportCount > 0 && <Badge variant="outline">{card.exportCount} downloads</Badge>}
                          {card.brandProfile && <Badge variant="outline">{card.brandProfile.name}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Updated {card.updatedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </p>
                        <div className="mt-auto">
                          <CardActions id={card.id} title={card.title} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
