// Import React and ReactDOM first to ensure they are initialized
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import App from './App.tsx'
import { logger } from './utils/logger'

// Validate that React is loaded correctly
// This ensures React is initialized before any other code runs
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

// Global error handlers to catch all errors
// This helps debug production build issues
window.addEventListener('error', (event) => {
  console.error('Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
  })
  
  // Log to console with full details
  if (event.error) {
    console.error('Error object:', event.error)
    console.error('Error stack:', event.error.stack)
  }
})

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
  })
  
  if (event.reason instanceof Error) {
    console.error('Rejection error:', event.reason)
    console.error('Rejection stack:', event.reason.stack)
  } else {
    console.error('Rejection reason (non-Error):', event.reason)
  }
})

// Log when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    logger.debug('DOM Content Loaded - Starting React app')
  })
} else {
  logger.debug('DOM already ready - Starting React app')
}

// Log when window is fully loaded
window.addEventListener('load', () => {
  logger.debug('Window fully loaded')
})

// Try to render the app
try {
  const rootElement = document.getElementById('root')
  
  if (!rootElement) {
    throw new Error('Root element not found! Make sure there is a <div id="root"></div> in index.html')
  }

  logger.debug('Root element found, creating React root...')
  
  const root = createRoot(rootElement)
  
  logger.debug('React root created, rendering app...')
  
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  
  logger.debug('App rendered successfully')
} catch (error) {
  console.error('Failed to render app:', error)
  
  // Display error in the root element if it exists
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: monospace;">
        <h1>Failed to initialize application</h1>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
        <pre>${error instanceof Error ? error.stack : ''}</pre>
      </div>
    `
  }
}
