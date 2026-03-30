/**
 * Cleanup old flight snapshots.
 * Usage: npx tsx scripts/cleanup-snapshots.ts
 * Schedule as a daily cron job.
 */

import { PrismaClient } from "@prisma/client";

const RETENTION_DAYS = 7;
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Deleting flight snapshots older than ${cutoff.toISOString()}...`);

  const result = await prisma.flightSnapshot.deleteMany({
    where: { capturedAt: { lt: cutoff } },
  });

  console.log(`Deleted ${result.count} snapshots.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
