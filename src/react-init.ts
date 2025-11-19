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

// Manually export React members to avoid TS2498 error with 'export *'
// This ensures all React exports are available while maintaining initialization order

// Hooks
export const useState = React.useState
export const useEffect = React.useEffect
export const useContext = React.useContext
export const createContext = React.createContext
export const useMemo = React.useMemo
export const useCallback = React.useCallback
export const useRef = React.useRef
export const useReducer = React.useReducer

// Components and utilities
export const Fragment = React.Fragment
export const StrictMode = React.StrictMode
export const Component = React.Component

// Types (re-exporting types directly is allowed)
export type { 
  ReactNode, 
  FC, 
  ChangeEvent, 
  FormEvent, 
  ComponentType, 
  PropsWithChildren,
  ReactElement,
  ErrorInfo
} from 'react'

// Note: JSX Runtime functions (jsx, jsxs) are exported from './react-init/jsx-runtime'
// This separate file is required for TypeScript's jsxImportSource resolution

