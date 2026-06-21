import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

const TOAST_CONFIG: Record<ToastType, { bgColor: string; icon: string; textColor: string }> = {
  success: {
    bgColor: 'from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30',
    icon: '✅',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    bgColor: 'from-rose-50 to-orange-50 dark:from-rose-900/30 dark:to-orange-900/30',
    icon: '❌',
    textColor: 'text-rose-700 dark:text-rose-300',
  },
  info: {
    bgColor: 'from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30',
    icon: 'ℹ️',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
}

function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const config = TOAST_CONFIG[type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div
      className={`fixed bottom-4 right-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-gradient-to-r ${config.bgColor} p-4 shadow-lg animate-slide-in-up`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{config.icon}</span>
        <p className={`text-sm font-medium ${config.textColor}`}>{message}</p>
      </div>
    </div>
  )
}

export default Toast
