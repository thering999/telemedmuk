import { useEffect, useState } from 'react'

const STORAGE_KEY = 'telemedmuk-dark-mode'

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(getInitialDarkMode)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
    window.localStorage.setItem(STORAGE_KEY, String(isDark))
  }, [isDark])

  const toggleDarkMode = () => setIsDark((prev) => !prev)

  return { isDark, toggleDarkMode }
}
