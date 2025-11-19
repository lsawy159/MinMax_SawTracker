/**
 * JSX Runtime exports for react-init wrapper
 * 
 * This file provides JSX runtime functions (jsx, jsxs) and Fragment for automatic JSX runtime.
 * It re-exports from react/jsx-runtime and react to ensure JSX runtime is in the same chunk as React.
 * This prevents TDZ errors by ensuring JSX runtime functions are available before any JSX is processed.
 */

// Re-export JSX runtime functions from react/jsx-runtime
// This ensures they are bundled in the same chunk as React (react-vendor)
export { jsx, jsxs } from 'react/jsx-runtime'

// Export Fragment from react (needed for JSX fragments like <>...</>)
export { Fragment } from 'react'


