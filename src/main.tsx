// Import React and ReactDOM first to ensure they are initialized
import React, { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import App from './App.tsx'
import { logger } from './utils/logger'
import { initializeSecurity } from './utils/securityIntegration'

// Register global handlers once and clean up on HMR to avoid listener duplication
const registerGlobalHandlers = () => {
  const onError = (event: ErrorEvent) => {
    console.error('Global error caught:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      stack: event.error?.stack,
    })

    if (event.error) {
      console.error('Error object:', event.error)
      console.error('Error stack:', event.error.stack)
    }
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
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
  }

  const onDomContentLoaded = () => {
    logger.debug('DOM Content Loaded - Starting React app')
  }

  const onWindowLoad = () => {
    logger.debug('Window fully loaded')
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomContentLoaded, { once: true })
  } else {
    logger.debug('DOM already ready - Starting React app')
  }

  window.addEventListener('load', onWindowLoad, { once: true })

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
    document.removeEventListener('DOMContentLoaded', onDomContentLoaded)
    window.removeEventListener('load', onWindowLoad)
  }
}

const cleanupGlobalHandlers = registerGlobalHandlers()

// Initialize security features
initializeSecurity()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupGlobalHandlers()
  })
}

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
        <SpeedInsights />
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
