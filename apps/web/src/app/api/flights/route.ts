import { NextRequest, NextResponse } from "next/server";
import type { BoundingBox } from "@skylens/types";
import { getLiveFlights } from "@/server/services/flight.service";

function parseBounds(raw: string): BoundingBox | null {
  const parts = raw.split(",");
  if (parts.length !== 4) return null;

  const [southStr, westStr, northStr, eastStr] = parts;
  const south = Number(southStr);
  const west = Number(westStr);
  const north = Number(northStr);
  const east = Number(eastStr);

  // All must be finite numbers (rejects NaN, Infinity, empty string → 0 via explicit check)
  if ([southStr, westStr, northStr, eastStr].some((s) => s!.trim() === "")) return null;
  if ([south, west, north, east].some((v) => !Number.isFinite(v))) return null;

  // Range validation
  if (south < -90 || south > 90) return null;
  if (north < -90 || north > 90) return null;
  if (west < -180 || west > 180) return null;
  if (east < -180 || east > 180) return null;

  // south must be less than north
  if (south > north) return null;

  // west > east is valid (antimeridian crossing), so no check there

  return { south, west, north, east };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const boundsParam = searchParams.get("bounds");

    let bounds: BoundingBox | undefined;
    if (boundsParam) {
      const parsed = parseBounds(boundsParam);
      if (!parsed) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message:
                "Invalid bounds. Expected: bounds=south,west,north,east " +
                "where south/north are [-90,90], west/east are [-180,180], and south <= north.",
            },
          },
          { status: 400 },
        );
      }
      bounds = parsed;
    }

    const result = await getLiveFlights(bounds);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/flights] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch flights" } },
      { status: 500 },
    );
  }
}
