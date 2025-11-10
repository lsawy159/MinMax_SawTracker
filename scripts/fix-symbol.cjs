// This file is loaded via NODE_OPTIONS before vitest starts
// It ensures Symbol is available on all global objects before any modules are loaded
// This fixes the webidl-conversions error in CI

(function() {
  'use strict'
  
  // Check if Symbol exists
  if (typeof Symbol === 'undefined') {
    console.error('ERROR: Symbol is not available in this environment. Node.js version may be too old.')
    process.exit(1)
  }
  
  // Fix for Node.js global object
  if (typeof global !== 'undefined') {
    try {
      if (!global.Symbol) {
        Object.defineProperty(global, 'Symbol', {
          value: Symbol,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
    } catch (e) {
      try {
        global.Symbol = Symbol
      } catch (e2) {
        // Ignore
      }
    }
  }
  
  // Fix for globalThis
  if (typeof globalThis !== 'undefined') {
    try {
      if (!globalThis.Symbol) {
        Object.defineProperty(globalThis, 'Symbol', {
          value: Symbol,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
    } catch (e) {
      try {
        globalThis.Symbol = Symbol
      } catch (e2) {
        // Ignore
      }
    }
  }
  
  // Ensure global.globalThis exists (for older Node.js)
  if (typeof global !== 'undefined' && typeof global.globalThis === 'undefined') {
    try {
      Object.defineProperty(global, 'globalThis', {
        value: global,
        writable: true,
        enumerable: false,
        configurable: true,
      })
    } catch (e) {
      try {
        global.globalThis = global
      } catch (e2) {
        // Ignore
      }
    }
  }
})()

