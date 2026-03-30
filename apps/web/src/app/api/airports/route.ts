import { NextRequest, NextResponse } from "next/server";
import { searchAirports } from "@/server/services/airport.service";

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search") ?? "";

    if (search.length < 2) {
      return NextResponse.json({ airports: [] });
    }

    const airports = await searchAirports(search);
    return NextResponse.json({ airports });
  } catch (err) {
    console.error("[api/airports] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to search airports" } },
      { status: 500 },
    );
  }
}
