interface DarkModeToggleProps {
  isDark: boolean
  onToggle: () => void
}

function DarkModeToggle({ isDark, onToggle }: DarkModeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
      title={isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
      className="fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-300 bg-white text-xl shadow-md transition-all hover:scale-110 hover:shadow-lg dark:border-slate-600 dark:bg-slate-800 sm:absolute sm:right-4 sm:top-4"
    >
      {isDark ? '🌙' : '☀️'}
    </button>
  )
}

export default DarkModeToggle
