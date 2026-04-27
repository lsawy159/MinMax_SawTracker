import { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

// AppShell is a passthrough wrapper.
// Each page manages its own Layout (sidebar, header, etc.)
export function AppShell({ children }: AppShellProps) {
  return <>{children}</>
}
