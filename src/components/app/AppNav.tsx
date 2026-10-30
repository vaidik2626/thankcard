"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/brands", label: "Brands" },
  { href: "/templates", label: "Templates" },
  { href: "/bulk", label: "Bulk CSV" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground font-serif text-sm text-background italic">
            T
          </span>
          <span className="hidden sm:inline">ThankCard Studio</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/cards/new" className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
          <PlusIcon /> <span className="hidden sm:inline">Create new card</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>
    </header>
  );
}
