// SECURITY WARNING: This worker has been disabled
// It previously generated and exposed private keys to the browser context
// This is a CRITICAL security vulnerability

// DEPRECATION NOTICE:
// This vanity worker generated keypairs client-side and exposed private keys
// to the application JavaScript context, making them vulnerable to:
// - XSS attacks
// - Malicious browser extensions
// - Compromised dependencies
// - Memory inspection
//
// SECURE ALTERNATIVE:
// Use PDA (Program Derived Address) generation instead:
// - No private keys generated
// - Deterministic addresses from public inputs
// - Cannot be stolen or compromised
// - Use /api/vanity-pda-pool endpoint

self.onmessage = function(e) {
  console.error('🚨 SECURITY: vanity-worker.js is deprecated and disabled');
  console.error('🚨 This worker previously generated private keys in the browser');
  console.error('🚨 Use PDA-based vanity generation instead');

  self.postMessage({
    type: 'error',
    id: e.data.id,
    workerId: e.data.workerId,
    error: 'This worker has been disabled due to security vulnerabilities. Use PDA-based vanity generation instead.',
    migration: {
      reason: 'Client-side private key generation exposes keys to XSS and malicious code',
      alternative: 'Use /api/vanity-pda-pool for secure PDA generation',
      auditReference: 'audit.md - Issue #1 & #9: Private key exposure'
    }
  });
};