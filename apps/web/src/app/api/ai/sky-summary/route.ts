import { NextRequest, NextResponse } from "next/server";
import { generateSkySummary } from "@/server/services/ai.service";
import { checkAIRateLimit } from "@/server/lib/rate-limiter";
import { AppError } from "@/server/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    await checkAIRateLimit(ip);

    const body = (await request.json()) as { region?: string };
    const result = await generateSkySummary(body.region);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    console.error("[api/ai/sky-summary] Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate summary" } },
      { status: 500 },
    );
  }
}
