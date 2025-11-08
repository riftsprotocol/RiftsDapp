import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, swapRateLimiter } from '@/lib/middleware/rate-limiter';
import { validateOrigin, createForbiddenResponse } from '@/lib/middleware/csrf-protection';

// Use Node.js runtime with fetch support
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: CSRF Protection - validate origin
    if (!validateOrigin(request)) {
      return createForbiddenResponse();
    }

    // SECURITY FIX: Rate limiting to prevent abuse
    const rateLimit = checkRateLimit(request, swapRateLimiter);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 10)
          }
        }
      );
    }

    // Get the request body
    const body = await request.json();

    // Validate required fields
    if (!body.quoteResponse || !body.userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: quoteResponse, userPublicKey' },
        { status: 400 }
      );
    }

    // Forward request to Jupiter API (NEW v1 endpoint - old v6 is being sunset)
    const jupiterUrl = 'https://lite-api.jup.ag/swap/v1/swap';

    console.log('🔄 Proxying Jupiter swap request to lite-api v1');

    const response = await fetch(jupiterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000), // 15 second timeout for swap
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Jupiter swap failed:', response.status, errorText);
      return NextResponse.json(
        { error: `Jupiter API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Jupiter swap transaction received');

    // Return the data with proper CORS headers (only allowed origin)
    const origin = request.headers.get('origin') || 'https://www.rifts.finance';
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  } catch (error) {
    console.error('❌ Jupiter swap proxy error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined
    });

    return NextResponse.json(
      {
        error: 'Failed to get swap transaction from Jupiter',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorCause: error instanceof Error ? JSON.stringify((error as any).cause) : undefined
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  // SECURITY FIX: CSRF Protection on preflight requests
  if (!validateOrigin(request)) {
    return createForbiddenResponse();
  }

  const origin = request.headers.get('origin') || 'https://www.rifts.finance';
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
