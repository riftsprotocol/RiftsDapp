/**
 * Distributed Rate Limiting with Upstash Redis
 * SECURITY FIX: Replaces memory-based rate limiter for serverless environments
 *
 * This limiter works across all serverless instances and prevents bypass through scaling
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Fallback to memory-based limiter if Redis not configured
let redis: Redis | null = null;
let isRedisAvailable = false;

try {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    isRedisAvailable = true;
    console.log('✅ Distributed rate limiting enabled (Upstash Redis)');
  } else {
    console.warn('⚠️ Upstash Redis not configured - using memory-based rate limiting');
    console.warn('⚠️ Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production');
  }
} catch (error) {
  console.error('❌ Failed to initialize Redis:', error);
  console.warn('⚠️ Falling back to memory-based rate limiting');
}

// Create rate limiters with different configs
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
      analytics: true,
      prefix: '@rifts/api',
    })
  : null;

export const swapRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 swaps per minute
      analytics: true,
      prefix: '@rifts/swap',
    })
  : null;

export const quoteRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '10 s'), // 30 quotes per 10 seconds
      analytics: true,
      prefix: '@rifts/quote',
    })
  : null;

export const adminRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 admin actions per minute
      analytics: true,
      prefix: '@rifts/admin',
    })
  : null;

/**
 * Get client identifier from request (with anti-spoofing)
 */
export function getClientIdentifier(request: Request): string {
  // Priority 1: Vercel forwarded IP (most reliable on Vercel)
  const vercelIp = request.headers.get('x-real-ip');
  if (vercelIp) {
    return vercelIp;
  }

  // Priority 2: Standard forwarded-for (take first IP only to prevent spoofing)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take only the first IP (client IP, not proxy chain)
    const clientIp = forwardedFor.split(',')[0].trim();
    if (clientIp) {
      return clientIp;
    }
  }

  // Priority 3: CF-Connecting-IP (if using Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  // Fallback: Use user-agent as identifier (less reliable but better than nothing)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `ua-${userAgent.substring(0, 50)}`;
}

/**
 * Check rate limit with Upstash Redis (or fallback to memory)
 */
export async function checkDistributedRateLimit(
  request: Request,
  limiter: Ratelimit | null
): Promise<{ allowed: boolean; remaining?: number; retryAfter?: number }> {
  if (!limiter || !isRedisAvailable) {
    // Fallback to old memory-based limiter
    const { checkRateLimit, apiRateLimiter: memoryLimiter } = await import('./rate-limiter');
    return checkRateLimit(request, memoryLimiter);
  }

  const identifier = getClientIdentifier(request);

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    console.error('❌ Rate limit check failed:', error);
    // Allow request on error to prevent blocking legitimate traffic
    return { allowed: true };
  }
}

/**
 * Unified rate limit check function for easy migration
 */
export async function checkRateLimit(
  request: Request,
  limiterType: 'api' | 'swap' | 'quote' | 'admin' = 'api'
): Promise<{ allowed: boolean; remaining?: number; retryAfter?: number }> {
  let limiter: Ratelimit | null = null;

  switch (limiterType) {
    case 'swap':
      limiter = swapRateLimiter;
      break;
    case 'quote':
      limiter = quoteRateLimiter;
      break;
    case 'admin':
      limiter = adminRateLimiter;
      break;
    case 'api':
    default:
      limiter = apiRateLimiter;
      break;
  }

  return checkDistributedRateLimit(request, limiter);
}

// Export Redis availability status
export const isDistributedRateLimitingEnabled = isRedisAvailable;
