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
    } catch (e) {
      // Fallback if defineProperty fails
      try {
        (global as any).Symbol = Symbol
      } catch (e2) {
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
    } catch (e) {
      try {
        (globalThis as any).Symbol = Symbol
      } catch (e2) {
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
    } catch (e) {
      try {
        (window as any).Symbol = Symbol
      } catch (e2) {
        // Ignore
      }
    }
  }
  
  // Ensure global.globalThis exists (for older Node.js)
  if (typeof global !== 'undefined' && typeof (global as any).globalThis === 'undefined') {
    try {
      Object.defineProperty(global, 'globalThis', {
        value: global,
        writable: true,
        enumerable: false,
        configurable: true,
      })
    } catch (e) {
      try {
        (global as any).globalThis = global
      } catch (e2) {
        // Ignore
      }
    }
  }
})()
