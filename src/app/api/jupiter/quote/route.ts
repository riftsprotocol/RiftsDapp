import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, quoteRateLimiter } from '@/lib/middleware/rate-limiter';
import { validateOrigin, createForbiddenResponse } from '@/lib/middleware/csrf-protection';
import { validatePublicKey, validateTokenAmount, validateFeeBps } from '@/lib/validation/input-validator';

// Use Node.js runtime with fetch support
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: CSRF Protection - validate origin
    if (!validateOrigin(request)) {
      return createForbiddenResponse();
    }

    // SECURITY FIX: Rate limiting to prevent abuse
    const rateLimit = checkRateLimit(request, quoteRateLimiter);
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

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps') || '300';
    const onlyDirectRoutes = searchParams.get('onlyDirectRoutes') || 'false';

    // SECURITY FIX: Validate required parameters
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: inputMint, outputMint, amount' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Validate input mint address
    const inputMintValidation = validatePublicKey(inputMint, 'Input Mint');
    if (!inputMintValidation.isValid) {
      return NextResponse.json(
        { error: inputMintValidation.error },
        { status: 400 }
      );
    }

    // SECURITY FIX: Validate output mint address
    const outputMintValidation = validatePublicKey(outputMint, 'Output Mint');
    if (!outputMintValidation.isValid) {
      return NextResponse.json(
        { error: outputMintValidation.error },
        { status: 400 }
      );
    }

    // SECURITY FIX: Validate amount
    const amountValidation = validateTokenAmount(amount, {
      min: 1,
      max: 1e15, // Max 1 quadrillion base units (reasonable limit)
      fieldName: 'Amount',
      decimals: 0 // Amount is in base units (lamports)
    });
    if (!amountValidation.isValid) {
      return NextResponse.json(
        { error: amountValidation.error },
        { status: 400 }
      );
    }

    // SECURITY FIX: Validate slippage (max 1000 bps = 10%)
    const slippageValidation = validateFeeBps(slippageBps, {
      max: 1000, // Max 10% slippage for safety
      fieldName: 'Slippage'
    });
    if (!slippageValidation.isValid) {
      return NextResponse.json(
        { error: slippageValidation.error, suggestion: 'Maximum allowed slippage is 10% (1000 bps)' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Token whitelist for production (optional but recommended)
    const ALLOWED_TOKENS = process.env.JUPITER_ALLOWED_TOKENS?.split(',') || [];
    if (ALLOWED_TOKENS.length > 0) {
      if (!ALLOWED_TOKENS.includes(inputMint) || !ALLOWED_TOKENS.includes(outputMint)) {
        return NextResponse.json(
          { error: 'Token not in whitelist. Only approved tokens are allowed for trading.' },
          { status: 403 }
        );
      }
    }

    // Forward request to Jupiter API (NEW v1 endpoint - old v6 is being sunset)
    const jupiterUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;

    console.log('🔄 Proxying Jupiter quote request to lite-api v1:', jupiterUrl);

    // Try fetch with retry logic and better error handling
    let response;
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await fetch(jupiterUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RIFTS-Trading-Interface/1.0',
          },
          signal: AbortSignal.timeout(10000),
        });
        break; // Success, exit retry loop
      } catch (fetchError) {
        lastError = fetchError;
        console.error(`Fetch attempt ${attempt} failed:`, fetchError);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to fetch after retries');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Jupiter quote failed:', response.status, errorText);
      return NextResponse.json(
        { error: `Jupiter API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Jupiter quote successful');

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
    console.error('❌ Jupiter quote proxy error:', error);
    const errorCause = error instanceof Error ? (error as any).cause : undefined;
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      cause: errorCause
    });

    // Check if it's a DNS error
    const isDnsError = errorCause && (errorCause.code === 'ENOTFOUND' || errorCause.code === 'EAI_AGAIN');

    return NextResponse.json(
      {
        error: isDnsError
          ? 'DNS resolution failed for Jupiter API. This might be a network or DNS configuration issue. Please try:\n1. Check your internet connection\n2. Try a different network\n3. Check if a VPN/proxy is blocking connections\n4. Flush DNS cache: ipconfig /flushdns'
          : 'Failed to fetch quote from Jupiter',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorCause: errorCause ? JSON.stringify(errorCause) : undefined,
        suggestion: isDnsError ? 'DNS_RESOLUTION_FAILED' : 'NETWORK_ERROR'
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
