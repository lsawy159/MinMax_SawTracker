// Register DOM matchers from Testing Library so tests can use e.g. toBeInTheDocument()
// This file should be listed AFTER src/test/setup-symbol.ts in vitest.config.ts setupFiles

import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})