import { NextRequest, NextResponse } from "next/server";
import { generateFlightExplanation } from "@/server/services/ai.service";
import { checkAIRateLimit } from "@/server/lib/rate-limiter";
import { AppError } from "@/server/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    await checkAIRateLimit(ip);

    const body = (await request.json()) as { flight_id: string };

    if (!body.flight_id) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "flight_id is required" } },
        { status: 400 },
      );
    }

    const result = await generateFlightExplanation(body.flight_id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    console.error("[api/ai/flight-explain] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate explanation" } },
      { status: 500 },
    );
  }
}
