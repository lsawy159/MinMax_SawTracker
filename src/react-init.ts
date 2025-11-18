/**
 * React Initialization Wrapper
 * 
 * This file ensures React is loaded and initialized before any other code uses it.
 * It prevents TDZ (Temporal Dead Zone) errors by providing a stable React export
 * that is guaranteed to be initialized before any JSX is processed.
 * 
 * All files should import React from this file instead of directly from 'react'
 * when using classic JSX runtime, or this will be used as a fallback initialization.
 */

// Import React and ReactDOM first to ensure they are initialized
import React from 'react'
import ReactDOM from 'react-dom/client'

// Validate that React is loaded correctly
if (!React) {
  throw new Error('React failed to initialize - React is undefined')
}

if (!ReactDOM) {
  throw new Error('ReactDOM failed to initialize - ReactDOM is undefined')
}

// Validate React version if needed
if (typeof React.createElement !== 'function') {
  throw new Error('React.createElement is not a function - React may not be initialized correctly')
}

// Export React and ReactDOM with explicit validation
export { ReactDOM }
export default React

// Also export common React utilities
export { StrictMode, Fragment, useState, useEffect, useContext, useRef, useCallback, useMemo, useReducer } from 'react'
export type { ReactNode, FC, ComponentType } from 'react'

