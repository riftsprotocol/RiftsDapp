// Background task to refresh rifts cache
// Call this endpoint every 5 minutes to keep cache warm
// Can be triggered by Vercel Cron Jobs or external service
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // SECURITY FIX: Fail-closed by default - authentication is REQUIRED
    const authToken = req.headers.authorization;
    const expectedToken = process.env.RIFTS_REFRESH_TOKEN;

    // SECURITY: Authentication token is MANDATORY
    if (!expectedToken) {
      console.error('🚨 RIFTS_REFRESH_TOKEN environment variable not set');
      console.error('🚨 This endpoint cannot be used without authentication');
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Authentication not configured for this endpoint'
      });
    }

    if (authToken !== `Bearer ${expectedToken}`) {
      console.warn('🚫 Unauthorized refresh attempt');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      });
    }

    console.log('🔄 Manual refresh requested, triggering cache refresh...');

    // Call the rifts-cache API to trigger a refresh
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/rifts-cache`, {
      headers: {
        'x-refresh': 'true' // Signal to bypass cache
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Cache refreshed: ${data.rifts.length} rifts`);
      return res.status(200).json({
        success: true,
        message: 'Cache refreshed successfully',
        riftsCount: data.rifts.length,
        timestamp: Date.now()
      });
    } else {
      console.error('❌ Cache refresh failed:', data.error);
      return res.status(500).json({
        success: false,
        error: data.error
      });
    }
  } catch (error) {
    console.error('❌ Refresh error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Refresh failed'
    });
  }
}
