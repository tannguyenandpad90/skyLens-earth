import { NextRequest, NextResponse } from "next/server";
import type { Region } from "@skylens/types";
import { getStats } from "@/server/services/stats.service";

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get("region") as Region | null;
    const stats = await getStats(region ?? undefined);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/stats] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch stats" } },
      { status: 500 },
    );
  }
}
