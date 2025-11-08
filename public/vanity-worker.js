// Web Worker for parallel vanity address generation
// This runs in a separate thread to avoid blocking the main thread

importScripts('https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js');

// Generate vanity addresses in parallel
self.onmessage = function(e) {
  const { id, pattern, maxAttempts = 2000000, workerId } = e.data;

  console.log(`Worker ${workerId}: Starting generation for pattern "${pattern}"`);

  const startTime = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate keypair using Solana Web3.js
    const keypair = solanaWeb3.Keypair.generate();
    const address = keypair.publicKey.toBase58();

    // Check if it matches our pattern
    if (address.toLowerCase().endsWith(pattern.toLowerCase())) {
      const duration = (Date.now() - startTime) / 1000;

      // Found a match! Send it back to main thread
      self.postMessage({
        type: 'success',
        id,
        workerId,
        result: {
          keypair: Array.from(keypair.secretKey), // Convert to transferable array
          address,
          attempts: attempt + 1,
          duration
        }
      });
      return;
    }

    // Send progress updates every 50k attempts
    if (attempt % 50000 === 0 && attempt > 0) {
      self.postMessage({
        type: 'progress',
        id,
        workerId,
        attempts: attempt,
        maxAttempts
      });
    }
  }

  // No match found
  self.postMessage({
    type: 'failed',
    id,
    workerId,
    attempts: maxAttempts,
    duration: (Date.now() - startTime) / 1000
  });
};