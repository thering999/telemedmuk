import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional label shown in the fallback UI to identify which section crashed. */
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

const isDev = import.meta.env.DEV

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isDev) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null })
  }

  render() {
    const { error, errorInfo } = this.state
    const { label } = this.props

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-orange-50 p-6 text-center shadow-md sm:p-8 dark:border-rose-700 dark:from-slate-800 dark:to-slate-800">
          <p className="text-2xl">⚠️</p>
          <h2 className="text-lg font-bold text-rose-700 sm:text-xl dark:text-rose-400">
            เกิดข้อผิดพลาด{label ? ` ใน${label}` : ''}
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Something went wrong.</p>

          {isDev && (
            <pre className="mt-2 max-h-48 w-full overflow-auto rounded-lg bg-slate-900/90 p-3 text-left text-xs text-rose-200">
              {error.message}
              {errorInfo?.componentStack}
            </pre>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="mt-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
          >
            ลองใหม่
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
