import { prisma } from "../db/prisma";

/**
 * Nightly job: recompute hourly_stats baselines from flight_snapshots.
 * Run via cron or manually: `npx tsx src/server/workers/stats-computer.ts`
 */
export async function recomputeBaselines(): Promise<void> {
  console.log("[stats] Recomputing hourly baselines...");

  // Get distinct airports with enough data
  const airports = await prisma.flightSnapshot.groupBy({
    by: ["originIcao"],
    _count: true,
    having: { originIcao: { _count: { gt: 50 } } },
  });

  for (const { originIcao } of airports) {
    if (!originIcao) continue;

    // Compute average flight count per hour-of-day and day-of-week
    const snapshots = await prisma.flightSnapshot.findMany({
      where: { originIcao, capturedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { capturedAt: true },
    });

    const buckets = new Map<string, number[]>();

    for (const s of snapshots) {
      const hour = s.capturedAt.getUTCHours();
      const dow = (s.capturedAt.getUTCDay() + 6) % 7;
      const key = `${hour}-${dow}`;
      const arr = buckets.get(key) ?? [];
      arr.push(1);
      buckets.set(key, arr);
    }

    for (const [key, counts] of buckets) {
      const [hourStr, dowStr] = key.split("-");
      const avg = counts.length;
      const mean = avg;
      const variance = 0; // Simplified for MVP
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
    }
  }

  console.log("[stats] Baseline recomputation complete.");
}

// Allow direct execution
if (require.main === module) {
  recomputeBaselines().then(() => process.exit(0));
}
