import { useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark'
export type CardColumns = 2 | 3 | 4

const THEME_STORAGE_KEY = 'sawtracker-theme-mode'

const CARD_GRID_CLASS_MAP: Record<CardColumns, string> = {
  2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  3: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4',
  4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4',
}

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  }
}

export function useCardColumns(storageKey: string, defaultColumns: CardColumns = 3) {
  const [cardColumns, setCardColumns] = useState<CardColumns>(() => {
    if (typeof window === 'undefined') {
      return defaultColumns
    }

    const savedValue = Number(window.localStorage.getItem(storageKey))
    if (savedValue === 2 || savedValue === 3 || savedValue === 4) {
      return savedValue
    }

    return defaultColumns
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, String(cardColumns))
    }
  }, [storageKey, cardColumns])

  const gridClass = useMemo(() => CARD_GRID_CLASS_MAP[cardColumns], [cardColumns])

  return {
    cardColumns,
    setCardColumns,
    gridClass,
  }
}
