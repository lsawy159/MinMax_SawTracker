import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean
  onNavigate?: () => void
}

/**
 * Hook to guard against navigation when there are unsaved changes.
 * Shows a confirmation dialog before allowing navigation away from the current page.
 */
export function useUnsavedChangesGuard(options: UseUnsavedChangesGuardOptions): void {
  const { isDirty, onNavigate } = options

  useBlocker(({ currentLocation, nextLocation }) => {
    if (!isDirty) return false

    if (currentLocation.pathname !== nextLocation.pathname) {
      onNavigate?.()
      const shouldBlock = !window.confirm(
        'لديك تغييرات غير محفوظة. هل تريد المتابعة؟\n\nYou have unsaved changes. Do you want to continue?'
      )
      return shouldBlock
    }

    return false
  })

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
