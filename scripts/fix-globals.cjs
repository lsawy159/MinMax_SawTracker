// This file is loaded via NODE_OPTIONS before vitest starts
// It ensures all required globals (Symbol, Map, Set, WeakMap, WeakSet) are available
// This fixes the webidl-conversions error in CI
// The error: "Cannot read properties of undefined (reading 'get')"
// happens because webidl-conversions tries to access Map.prototype.get or WeakMap.prototype.get
// before these are properly initialized

(function() {
  'use strict'
  
  // Ensure Symbol exists
  if (typeof Symbol === 'undefined') {
    console.error('ERROR: Symbol is not available in this environment. Node.js version may be too old.')
    process.exit(1)
  }
  
  // Ensure Map exists
  if (typeof Map === 'undefined') {
    console.error('ERROR: Map is not available in this environment. Node.js version may be too old.')
    process.exit(1)
  }
  
  // Ensure Set exists
  if (typeof Set === 'undefined') {
    console.error('ERROR: Set is not available in this environment. Node.js version may be too old.')
    process.exit(1)
  }
  
  // Ensure WeakMap exists
  if (typeof WeakMap === 'undefined') {
    console.error('ERROR: WeakMap is not available in this environment. Node.js version may be too old.')
    process.exit(1)
  }
  
  // Ensure WeakSet exists
  if (typeof WeakSet === 'undefined') {
    console.error('ERROR: WeakSet is not available in this environment. Node.js version may be too old.')
    process.exit(1)
  }
  
  // Fix for Node.js global object
  if (typeof global !== 'undefined') {
    try {
      // Symbol
      if (!global.Symbol) {
        Object.defineProperty(global, 'Symbol', {
          value: Symbol,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      
      // Map
      if (!global.Map) {
        Object.defineProperty(global, 'Map', {
          value: Map,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      
      // Set
      if (!global.Set) {
        Object.defineProperty(global, 'Set', {
          value: Set,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      
      // WeakMap
      if (!global.WeakMap) {
        Object.defineProperty(global, 'WeakMap', {
          value: WeakMap,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      
      // WeakSet
      if (!global.WeakSet) {
        Object.defineProperty(global, 'WeakSet', {
          value: WeakSet,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
    } catch (e) {
      // Fallback if defineProperty fails
      try {
        if (!global.Symbol) global.Symbol = Symbol
        if (!global.Map) global.Map = Map
        if (!global.Set) global.Set = Set
        if (!global.WeakMap) global.WeakMap = WeakMap
        if (!global.WeakSet) global.WeakSet = WeakSet
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
      if (!globalThis.Map) {
        Object.defineProperty(globalThis, 'Map', {
          value: Map,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      if (!globalThis.Set) {
        Object.defineProperty(globalThis, 'Set', {
          value: Set,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      if (!globalThis.WeakMap) {
        Object.defineProperty(globalThis, 'WeakMap', {
          value: WeakMap,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
      if (!globalThis.WeakSet) {
        Object.defineProperty(globalThis, 'WeakSet', {
          value: WeakSet,
          writable: true,
          enumerable: false,
          configurable: true,
        })
      }
    } catch (e) {
      // Fallback if defineProperty fails
      try {
        if (!globalThis.Symbol) globalThis.Symbol = Symbol
        if (!globalThis.Map) globalThis.Map = Map
        if (!globalThis.Set) globalThis.Set = Set
        if (!globalThis.WeakMap) globalThis.WeakMap = WeakMap
        if (!globalThis.WeakSet) globalThis.WeakSet = WeakSet
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
  
  // Ensure Map.prototype.get exists (this is what webidl-conversions needs)
  if (typeof Map !== 'undefined' && Map.prototype && !Map.prototype.get) {
    console.error('ERROR: Map.prototype.get is not available. This should not happen in Node.js 18+.')
  }
  
  // Ensure WeakMap.prototype.get exists
  if (typeof WeakMap !== 'undefined' && WeakMap.prototype && !WeakMap.prototype.get) {
    console.error('ERROR: WeakMap.prototype.get is not available. This should not happen in Node.js 18+.')
  }
})()

