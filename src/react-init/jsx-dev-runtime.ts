/**
 * JSX DEV Runtime exports for react-init wrapper (development only)
 * 
 * This file provides JSX development runtime functions (jsxDEV) for automatic JSX runtime in development mode.
 * It re-exports from react/jsx-dev-runtime to ensure JSX runtime is in the same chunk as React.
 * This prevents TDZ errors by ensuring JSX runtime functions are available before any JSX is processed.
 */

// Import react-init first to ensure React is initialized before any exports
import '../react-init'

// Re-export JSX DEV runtime functions from react/jsx-dev-runtime (development only)
// This ensures they are bundled in the same chunk as React (react-vendor)
export { jsxDEV } from 'react/jsx-dev-runtime'

// Export Fragment from react (needed for JSX fragments like <>...</>)
export { Fragment } from 'react'

