import { redis } from "../db/redis";
import { REDIS_KEYS, CACHE_TTL } from "@skylens/lib";
import { RateLimitError } from "./errors";

const MAX_AI_REQUESTS_PER_MINUTE = 5;

/**
 * Simple Redis-based rate limiter for AI endpoints.
 * Falls back to in-memory if Redis is unavailable.
 */
export async function checkAIRateLimit(ip: string): Promise<void> {
  const key = REDIS_KEYS.RATE_LIMIT_AI(ip);

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, CACHE_TTL.RATE_LIMIT);
    }
    if (current > MAX_AI_REQUESTS_PER_MINUTE) {
      const ttl = await redis.ttl(key);
      throw new RateLimitError(ttl > 0 ? ttl : CACHE_TTL.RATE_LIMIT);
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    // Redis down — allow through but log
    console.warn("[rate-limiter] Redis unavailable, allowing request");
  }
}
