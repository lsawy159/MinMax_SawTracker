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

// Import React hooks and utilities directly as named imports
// This prevents TDZ errors by resolving imports at bundling time, not runtime
import {
  useState as _useState,
  useEffect as _useEffect,
  useContext as _useContext,
  createContext as _createContext,
  useMemo as _useMemo,
  useCallback as _useCallback,
  useRef as _useRef,
  useReducer as _useReducer,
  Fragment as _Fragment,
  StrictMode as _StrictMode,
  Component as _Component,
} from 'react'

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

// Re-export React members using direct named imports (Runtime Safe)
// This ensures all React exports are available while preventing TDZ errors
// Named imports are resolved at bundling time, not at runtime evaluation

// Hooks
export const useState = _useState
export const useEffect = _useEffect
export const useContext = _useContext
export const createContext = _createContext
export const useMemo = _useMemo
export const useCallback = _useCallback
export const useRef = _useRef
export const useReducer = _useReducer

// Components and utilities
export const Fragment = _Fragment
export const StrictMode = _StrictMode
export const Component = _Component

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

