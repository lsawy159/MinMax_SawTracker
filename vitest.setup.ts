// vitest.setup.ts
// This file runs before ALL tests to ensure all required globals are available
// This is a backup fix in case the fix in vitest.config.ts doesn't work

(function() {
    'use strict'
    
    // Ensure Symbol exists
    if (typeof Symbol === 'undefined') {
      console.error('ERROR: Symbol is not available in this environment. Node.js version may be too old.')
      process.exit(1)
    }
    
    // Ensure Map, Set, WeakMap, WeakSet exist
    if (typeof Map === 'undefined' || typeof Set === 'undefined' || 
        typeof WeakMap === 'undefined' || typeof WeakSet === 'undefined') {
      console.error('ERROR: Map, Set, WeakMap, or WeakSet is not available in this environment. Node.js version may be too old.')
      process.exit(1)
    }
    
    // Fix for Node.js global object
    if (typeof global !== 'undefined') {
      try {
        if (!global.Symbol) (global as any).Symbol = Symbol
        if (!global.Map) (global as any).Map = Map
        if (!global.Set) (global as any).Set = Set
        if (!global.WeakMap) (global as any).WeakMap = WeakMap
        if (!global.WeakSet) (global as any).WeakSet = WeakSet
      } catch (e) {
        // Ignore
      }
    }
    
    // Fix for globalThis
    if (typeof globalThis !== 'undefined') {
      try {
        if (!globalThis.Symbol) (globalThis as any).Symbol = Symbol
        if (!globalThis.Map) (globalThis as any).Map = Map
        if (!globalThis.Set) (globalThis as any).Set = Set
        if (!globalThis.WeakMap) (globalThis as any).WeakMap = WeakMap
        if (!globalThis.WeakSet) (globalThis as any).WeakSet = WeakSet
      } catch (e) {
        // Ignore
      }
    }
    
    // Ensure global.globalThis exists (for older Node.js)
    if (typeof global !== 'undefined' && typeof (global as any).globalThis === 'undefined') {
      try {
        (global as any).globalThis = global
      } catch (e) {
        // Ignore
      }
    }
  })()
  