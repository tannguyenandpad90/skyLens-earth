/**
 * Seed airports table from a CSV or JSON source.
 * Usage: npx tsx scripts/seed-airports.ts
 *
 * Downloads OurAirports data and inserts into PostgreSQL.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AIRPORTS_URL =
  "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv";

async function main() {
  console.log("Fetching airports data...");
  const res = await fetch(AIRPORTS_URL);
  const csv = await res.text();
  const lines = csv.split("\n").slice(1); // Skip header

  const airports: Array<{
    icaoCode: string;
    iataCode: string | null;
    name: string;
    city: string | null;
    country: string | null;
    latitude: number;
    longitude: number;
    timezone: string | null;
    elevationFt: number | null;
  }> = [];

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.replace(/"/g, "").trim());
    const type = cols[2]; // "large_airport", "medium_airport", etc.
    const icao = cols[1];

    // Only seed large and medium airports
    if (!icao || icao.length !== 4 || !["large_airport", "medium_airport"].includes(type ?? "")) {
      continue;
    }

    airports.push({
      icaoCode: icao,
      iataCode: cols[13] && cols[13].length === 3 ? cols[13] : null,
      name: cols[3] ?? "",
      city: cols[10] || null,
      country: cols[8] || null,
      latitude: parseFloat(cols[4] ?? "0"),
      longitude: parseFloat(cols[5] ?? "0"),
      timezone: null,
      elevationFt: cols[6] ? parseInt(cols[6], 10) || null : null,
    });
  }

  console.log(`Inserting ${airports.length} airports...`);

  // Batch upsert
  for (let i = 0; i < airports.length; i += 100) {
    const batch = airports.slice(i, i + 100);
    await Promise.all(
      batch.map((a) =>
        prisma.airport.upsert({
          where: { icaoCode: a.icaoCode },
          update: a,
          create: a,
        }),
      ),
    );
    console.log(`  ${Math.min(i + 100, airports.length)} / ${airports.length}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
