// Registers handlers to capture any unhandled rejections / uncaught exceptions
// during the test run and fail the run in a controlled way.
//
// This file should be listed in vitest.config.ts setupFiles so it is executed
// early (after any required global polyfills).
//
// Behavior:
//  - Captures errors in runtime and stores them in an array
//  - After all tests (afterAll) re-throws the first captured error so Vitest
//    surfaces it as a failing test with a proper stack trace.

const __capturedUnhandledErrors: Array<{ type: 'unhandledRejection' | 'uncaughtException'; reason: any }> =
  (globalThis as any).__capturedUnhandledErrors || []

;(globalThis as any).__capturedUnhandledErrors = __capturedUnhandledErrors

process.on('unhandledRejection', (reason: unknown) => {
  __capturedUnhandledErrors.push({ type: 'unhandledRejection', reason })
})

process.on('uncaughtException', (err: unknown) => {
  __capturedUnhandledErrors.push({ type: 'uncaughtException', reason: err })
})

// Use vitest hook to fail the run after tests have finished if any were captured.
// If tests never run because the error occurred during collection/prepare phase,
// this file when loaded as a setupFile will still register the handlers early.
import { afterAll } from 'vitest'

afterAll(() => {
  if (__capturedUnhandledErrors.length > 0) {
    const first = __capturedUnhandledErrors[0]
    const reason = first.reason
    // Normalize to an Error for a clean stack in test output:
    if (reason instanceof Error) {
      throw reason
    } else {
      // If it's not an Error, wrap it so Vitest prints something useful
      throw new Error(
        `Unhandled ${first.type} captured during tests: ${
          typeof reason === 'string' ? reason : JSON.stringify(reason, null, 2)
        }`
      )
    }
  }
})