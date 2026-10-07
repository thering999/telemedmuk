import { useEffect, useState } from 'react'

// v2: old key auto-persisted the OS dark preference; reset everyone to the bright light theme.
const STORAGE_KEY = 'telemedmuk-dark-mode-v2'

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
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
