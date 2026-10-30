import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Runs a query and reports a missing/unreachable database as `{ ok: false }` instead of
 * throwing, so pages can still render the editor (generate + export work without a DB).
 */
export async function tryDb<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error("[db]", err);
    return { ok: false, error: "Database unavailable. Check DATABASE_URL and run `npm run db:push`." };
  }
}
