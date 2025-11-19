/**
 * React Initialization Side-Effect Module
 * 
 * This file ensures React is loaded and initialized before any other code uses it.
 * It uses a side-effect pattern: importing this file runs initialization code that
 * ensures React is ready before any JSX is processed.
 * 
 * This file should be imported as a side-effect (import './react-init') at the very
 * first line of entry points (main.tsx, jsx-runtime.ts, jsx-dev-runtime.ts).
 * 
 * All component files should import directly from 'react', not from this file.
 */

// Import React and ReactDOM first to ensure they are initialized
import React from 'react'
import ReactDOM from 'react-dom/client'

// Side-effect: Validate that React is loaded correctly
// This runs when the module is imported, ensuring React is initialized early
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

// No exports - this is a side-effect module only
// All components should import directly from 'react'

