// This file is loaded via NODE_OPTIONS before vitest starts
// It ensures all required globals (Symbol, Map, Set, WeakMap, WeakSet) are available
// This fixes the webidl-conversions error in CI
// The error: "Cannot read properties of undefined (reading 'get')"
// happens because webidl-conversions tries to access Map.prototype.get or WeakMap.prototype.get
// before these are properly initialized

(function() {
  'use strict'
  
  // Debug log to verify this file is loaded early (only in test/CI environment)
  if (process.env.NODE_ENV === 'test' || process.env.CI || process.argv.some(arg => arg.includes('vitest'))) {
    console.log('[fix-globals] preloaded at process start')
  }
  
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
  
  // CRITICAL: Ensure Map.prototype.get exists (this is what webidl-conversions needs)
  // webidl-conversions tries to access Map.prototype.get before it's initialized
  if (typeof Map !== 'undefined' && Map.prototype) {
    if (!Map.prototype.get) {
      console.error('ERROR: Map.prototype.get is not available. This should not happen in Node.js 18+.')
    } else {
      // Force ensure Map.prototype.get is accessible
      try {
        const testMap = new Map()
        testMap.set('test', 'value')
        const result = testMap.get('test')
        if (result !== 'value') {
          console.error('ERROR: Map.prototype.get is not working correctly')
        }
      } catch (e) {
        console.error('ERROR: Map.prototype.get test failed:', e.message)
      }
    }
  }
  
  // CRITICAL: Ensure WeakMap.prototype.get exists
  if (typeof WeakMap !== 'undefined' && WeakMap.prototype) {
    if (!WeakMap.prototype.get) {
      console.error('ERROR: WeakMap.prototype.get is not available. This should not happen in Node.js 18+.')
    }
  }
  
  // Force ensure all globals are set on all possible global objects
  // This is critical for webidl-conversions to work
  const globalObjects = [global, globalThis]
  if (typeof window !== 'undefined') {
    globalObjects.push(window)
  }
  
  globalObjects.forEach((obj) => {
    if (obj && typeof obj !== 'undefined') {
      try {
        if (!obj.Symbol && typeof Symbol !== 'undefined') obj.Symbol = Symbol
        if (!obj.Map && typeof Map !== 'undefined') obj.Map = Map
        if (!obj.Set && typeof Set !== 'undefined') obj.Set = Set
        if (!obj.WeakMap && typeof WeakMap !== 'undefined') obj.WeakMap = WeakMap
        if (!obj.WeakSet && typeof WeakSet !== 'undefined') obj.WeakSet = WeakSet
      } catch (e) {
        // Ignore errors
      }
    }
  })
  
  // Final verification log
  if (process.env.NODE_ENV === 'test' || process.env.CI || process.argv.some(arg => arg.includes('vitest'))) {
    console.log('[fix-globals] All globals verified and set:', {
      Symbol: typeof Symbol !== 'undefined',
      Map: typeof Map !== 'undefined',
      Set: typeof Set !== 'undefined',
      WeakMap: typeof WeakMap !== 'undefined',
      WeakSet: typeof WeakSet !== 'undefined',
      MapPrototypeGet: typeof Map !== 'undefined' && Map.prototype && typeof Map.prototype.get === 'function',
      WeakMapPrototypeGet: typeof WeakMap !== 'undefined' && WeakMap.prototype && typeof WeakMap.prototype.get === 'function'
    })
  }
})()

