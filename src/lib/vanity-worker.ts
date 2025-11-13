// Background worker to keep server vanity pool filled
// SECURITY: This worker has been disabled - it previously called insecure endpoints
export class VanityPoolWorker {
  private static interval: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  static start() {
    if (this.interval) return; // Already running
    console.log('⚠️ VanityPoolWorker disabled - deprecated endpoints removed for security');
  }

  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('⏹️ Stopped vanity pool background worker');
    }
  }
}

// Auto-start disabled for security
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // VanityPoolWorker.start(); // Disabled - old endpoint removed
}
