import { NextRequest, NextResponse } from "next/server";
import type { BoundingBox } from "@skylens/types";
import { getLiveFlights } from "@/server/services/flight.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const boundsParam = searchParams.get("bounds");

    let bounds: BoundingBox | undefined;
    if (boundsParam) {
      const [south, west, north, east] = boundsParam.split(",").map(Number);
      if ([south, west, north, east].some((v) => v == null || isNaN(v!))) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid bounds format" } },
          { status: 400 },
        );
      }
      bounds = { south: south!, west: west!, north: north!, east: east! };
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
