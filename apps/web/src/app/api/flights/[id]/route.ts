import { NextRequest, NextResponse } from "next/server";
import { getFlightDetail } from "@/server/services/flight.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const flight = await getFlightDetail(id);

    if (!flight) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Flight not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ flight });
  } catch (err) {
    console.error("[api/flights/id] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch flight" } },
      { status: 500 },
    );
  }
}
