import { prisma } from "../db/prisma";

/**
 * Nightly job: recompute hourly_stats baselines from flight_snapshots.
 * Run via cron or manually: `npx tsx src/server/workers/stats-computer.ts`
 *
 * Logic:
 *   For each airport with enough data, group snapshots by (hour, day-of-week).
 *   Within each bucket, count DISTINCT flights per poll cycle (15-min window),
 *   then compute the mean and stddev of those per-cycle counts.
 *   This gives us "how many flights typically touch this airport at this hour."
 */
export async function recomputeBaselines(): Promise<void> {
  console.log("[stats] Recomputing hourly baselines...");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get airports with enough snapshot data
  const airports = await prisma.flightSnapshot.groupBy({
    by: ["originIcao"],
    _count: true,
    having: { originIcao: { _count: { gt: 50 } } },
  });

  let updated = 0;

  for (const { originIcao } of airports) {
    if (!originIcao) continue;

    // Fetch snapshots from the last 7 days
    const snapshots = await prisma.flightSnapshot.findMany({
      where: {
        originIcao,
        capturedAt: { gte: sevenDaysAgo },
      },
      select: { flightId: true, capturedAt: true },
    });

    // Group by (hour, dow) → then by 15-minute poll cycle → count distinct flights
    // This gives us a list of "flights per cycle" values for each (hour, dow) bucket.
    const buckets = new Map<string, number[]>();

    for (const s of snapshots) {
      const hour = s.capturedAt.getUTCHours();
      const dow = (s.capturedAt.getUTCDay() + 6) % 7; // 0=Mon
      const bucketKey = `${hour}-${dow}`;

      // Round to 15-min cycle boundary for grouping
      const cycleKey = `${bucketKey}-${Math.floor(s.capturedAt.getTime() / (15 * 60 * 1000))}`;

      // We need to track distinct flights per cycle, then aggregate per bucket.
      // Build a nested structure: bucket → cycle → Set<flightId>
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }

      // Use a temporary map to track per-cycle distinct flight counts
      const cycle = cycleKey; // unique per 15-min window
      void cycle; // handled below
    }

    // Rebuild with proper per-cycle counting
    const cycleCounts = new Map<string, Map<string, Set<string>>>();
    // bucketKey → (cycleKey → Set<flightId>)

    for (const s of snapshots) {
      const hour = s.capturedAt.getUTCHours();
      const dow = (s.capturedAt.getUTCDay() + 6) % 7;
      const bucketKey = `${hour}-${dow}`;
      const cycleKey = Math.floor(s.capturedAt.getTime() / (15 * 60 * 1000)).toString();

      if (!cycleCounts.has(bucketKey)) {
        cycleCounts.set(bucketKey, new Map());
      }
      const cycles = cycleCounts.get(bucketKey)!;

      if (!cycles.has(cycleKey)) {
        cycles.set(cycleKey, new Set());
      }
      cycles.get(cycleKey)!.add(s.flightId);
    }

    // For each (hour, dow) bucket, compute mean and stddev of per-cycle flight counts
    for (const [bucketKey, cycles] of cycleCounts) {
      const [hourStr, dowStr] = bucketKey.split("-");

      // Each cycle's count = number of distinct flights in that 15-min window
      const counts = [...cycles.values()].map((flightIds) => flightIds.size);

      if (counts.length === 0) continue;

      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance =
        counts.length > 1
          ? counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / (counts.length - 1)
          : 0;

      await prisma.hourlyStat.upsert({
        where: {
          airportIcao_hourUtc_dayOfWeek: {
            airportIcao: originIcao,
            hourUtc: parseInt(hourStr!, 10),
            dayOfWeek: parseInt(dowStr!, 10),
          },
        },
        update: {
          avgFlights: mean,
          stddevFlights: Math.sqrt(variance),
          sampleCount: counts.length,
          updatedAt: new Date(),
        },
        create: {
          airportIcao: originIcao,
          hourUtc: parseInt(hourStr!, 10),
          dayOfWeek: parseInt(dowStr!, 10),
          avgFlights: mean,
          stddevFlights: Math.sqrt(variance),
          sampleCount: counts.length,
        },
      });

      updated++;
    }
  }

  console.log(`[stats] Baseline recomputation complete. Updated ${updated} buckets.`);
}

// Allow direct execution
if (require.main === module) {
  recomputeBaselines()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
