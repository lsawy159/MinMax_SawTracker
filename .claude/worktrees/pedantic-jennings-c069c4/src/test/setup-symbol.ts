// This file must be loaded BEFORE any other modules to fix Symbol issue
// It's imported in vitest.config.ts as the first setupFile
// The problem: webidl-conversions tries to access Symbol.get before modules are loaded
// Solution: Ensure Symbol is available on all global objects immediately

// Immediate execution - no imports before this
(function() {
  'use strict'
  
  // Check if Symbol exists
  if (typeof Symbol === 'undefined') {
    throw new Error('Symbol is not available in this environment. Node.js version may be too old.')
  }
  
  // Node.js global object
  if (typeof global !== 'undefined') {
    try {
      Object.defineProperty(global, 'Symbol', {
        value: Symbol,
        writable: true,
        enumerable: false,
        configurable: true,
      })
    } catch {
      // Fallback if defineProperty fails
      try {
        (global as unknown as Record<string, unknown>).Symbol = Symbol
      } catch {
        // Ignore
      }
    }
  }
  
  // globalThis (ES2020+)
  if (typeof globalThis !== 'undefined') {
    try {
      Object.defineProperty(globalThis, 'Symbol', {
        value: Symbol,
        writable: true,
        enumerable: false,
        configurable: true,
      })
    } catch {
      try {
        (globalThis as unknown as Record<string, unknown>).Symbol = Symbol
      } catch {
        // Ignore
      }
    }
  }
  
  // window (jsdom/browser)
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'Symbol', {
        value: Symbol,
        writable: true,
        enumerable: false,
        configurable: true,
      })
    } catch {
      try {
        (window as unknown as Record<string, unknown>).Symbol = Symbol
      } catch {
        // Ignore
      }
    }
  }
  
  // Ensure global.globalThis exists (for older Node.js)
  if (typeof global !== 'undefined' && typeof (global as unknown as Record<string, unknown>).globalThis === 'undefined') {
    try {
      Object.defineProperty(global, 'globalThis', {
        value: global,
        writable: true,
        enumerable: false,
        configurable: true,
      })
    } catch {
      try {
        (global as unknown as Record<string, unknown>).globalThis = global
      } catch {
        // Ignore
      }
    }
  }
})()
