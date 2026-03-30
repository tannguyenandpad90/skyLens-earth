import { NextRequest, NextResponse } from "next/server";
import { getAirportDetail } from "@/server/services/airport.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ icao: string }> },
) {
  try {
    const { icao } = await params;
    const airport = await getAirportDetail(icao);

    if (!airport) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Airport not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ airport });
  } catch (err) {
    console.error("[api/airports/icao] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch airport" } },
      { status: 500 },
    );
  }
}
