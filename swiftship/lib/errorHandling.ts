// Comprehensive error handling utilities

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  API = 'API',
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  code?: string
  details?: any
  timestamp: Date
  userMessage: string
  actionable: boolean
  retryable: boolean
}

export interface ErrorContext {
  userId?: string
  sessionId?: string
  url?: string
  userAgent?: string
  component?: string
  action?: string
  errorId?: string
  additionalData?: Record<string, any>
}

// Error factory functions
export const createError = (
  type: ErrorType,
  message: string,
  options: Partial<AppError> = {}
): AppError => {
  const defaultUserMessages = {
    [ErrorType.VALIDATION]: 'Please check your input and try again.',
    [ErrorType.NETWORK]: 'Network connection issue. Please check your internet connection.',
    [ErrorType.API]: 'Service temporarily unavailable. Please try again later.',
    [ErrorType.AUTH]: 'Authentication required. Please log in again.',
    [ErrorType.DATABASE]: 'Data service unavailable. Please try again later.',
    [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.'
  }

  const defaultSeverity = {
    [ErrorType.VALIDATION]: ErrorSeverity.LOW,
    [ErrorType.NETWORK]: ErrorSeverity.MEDIUM,
    [ErrorType.API]: ErrorSeverity.MEDIUM,
    [ErrorType.AUTH]: ErrorSeverity.HIGH,
    [ErrorType.DATABASE]: ErrorSeverity.HIGH,
    [ErrorType.UNKNOWN]: ErrorSeverity.MEDIUM
  }

  const defaultRetryable = {
    [ErrorType.VALIDATION]: false,
    [ErrorType.NETWORK]: true,
    [ErrorType.API]: true,
    [ErrorType.AUTH]: false,
    [ErrorType.DATABASE]: true,
    [ErrorType.UNKNOWN]: false
  }

  return {
    type,
    severity: options.severity || defaultSeverity[type],
    message,
    code: options.code,
    details: options.details,
    timestamp: new Date(),
    userMessage: options.userMessage || defaultUserMessages[type],
    actionable: options.actionable ?? true,
    retryable: options.retryable ?? defaultRetryable[type],
    ...options
  }
}

// Specific error creators
export const createValidationError = (message: string, details?: any): AppError => {
  return createError(ErrorType.VALIDATION, message, {
    details,
    userMessage: 'Please correct the highlighted fields and try again.',
    retryable: false
  })
}

export const createNetworkError = (message: string, details?: any): AppError => {
  return createError(ErrorType.NETWORK, message, {
    details,
    userMessage: 'Connection problem. Please check your internet and try again.',
    retryable: true
  })
}

export const createApiError = (message: string, code?: string, details?: any): AppError => {
  return createError(ErrorType.API, message, {
    code,
    details,
    userMessage: 'Service temporarily unavailable. Please try again in a moment.',
    retryable: true
  })
}

export const createAuthError = (message: string): AppError => {
  return createError(ErrorType.AUTH, message, {
    userMessage: 'Please log in again to continue.',
    retryable: false,
    severity: ErrorSeverity.HIGH
  })
}

export const createDatabaseError = (message: string, details?: any): AppError => {
  return createError(ErrorType.DATABASE, message, {
    details,
    userMessage: 'Data service unavailable. Please try again later.',
    retryable: true,
    severity: ErrorSeverity.HIGH
  })
}

// Error parsing from different sources
export const parseApiError = (error: any): AppError => {
  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createNetworkError('Network request failed', { originalError: error.message })
  }

  // Handle HTTP response errors
  if (error.response) {
    const status = error.response.status
    const data = error.response.data

    if (status === 400) {
      return createValidationError(
        data?.message || 'Invalid request data',
        { status, data }
      )
    }

    if (status === 401) {
      return createAuthError(data?.message || 'Authentication required')
    }

    if (status === 403) {
      return createAuthError(data?.message || 'Access denied')
    }

    if (status === 404) {
      return createApiError(
        data?.message || 'Resource not found',
        'NOT_FOUND',
        { status, data }
      )
    }

    if (status >= 500) {
      return createApiError(
        data?.message || 'Server error',
        'SERVER_ERROR',
        { status, data }
      )
    }

    return createApiError(
      data?.message || 'Request failed',
      status.toString(),
      { status, data }
    )
  }

  // Handle network errors
  if (error.code === 'NETWORK_ERROR' || !navigator.onLine) {
    return createNetworkError('No internet connection', { originalError: error })
  }

  // Handle timeout errors
  if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
    return createNetworkError('Request timeout', { originalError: error })
  }

  // Default to unknown error
  return createError(ErrorType.UNKNOWN, error.message || 'An unexpected error occurred', {
    details: { originalError: error }
  })
}

// Error logging
export const logError = (error: AppError, context?: ErrorContext): void => {
  const logData = {
    ...error,
    context,
    stack: new Error().stack
  }

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 ${error.type} Error - ${error.severity}`)
    console.error('Message:', error.message)
    console.error('User Message:', error.userMessage)
    if (error.details) console.error('Details:', error.details)
    if (context) console.error('Context:', context)
    console.groupEnd()
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // This would integrate with services like Sentry, LogRocket, etc.
    try {
      // Example: Sentry.captureException(error, { extra: logData })
      console.error('Error logged:', logData)
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError)
    }
  }
}

// Retry logic
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  backoff: number = 2
): Promise<T> => {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const appError = parseApiError(error)

      // Don't retry non-retryable errors
      if (!appError.retryable) {
        throw appError
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Wait before retrying with exponential backoff
      const waitTime = delay * Math.pow(backoff, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw parseApiError(lastError)
}

// Error boundary helpers
export const handleAsyncError = (error: any, context?: ErrorContext): AppError => {
  const appError = parseApiError(error)
  logError(appError, context)
  return appError
}

// User-friendly error messages
export const getErrorMessage = (error: AppError): string => {
  return error.userMessage || error.message
}

export const getErrorActions = (error: AppError): string[] => {
  const actions: string[] = []

  if (error.retryable) {
    actions.push('Try again')
  }

  switch (error.type) {
    case ErrorType.NETWORK:
      actions.push('Check your internet connection')
      break
    case ErrorType.AUTH:
      actions.push('Log in again')
      break
    case ErrorType.VALIDATION:
      actions.push('Correct the highlighted fields')
      break
    case ErrorType.API:
      if (error.code === 'NOT_FOUND') {
        actions.push('Check the information and try again')
      }
      break
  }

  if (error.severity === ErrorSeverity.CRITICAL) {
    actions.push('Contact support if the problem persists')
  }

  return actions
}

// Error recovery suggestions
export const getRecoveryActions = (error: AppError): Array<{
  label: string
  action: string
  primary?: boolean
}> => {
  const actions: Array<{ label: string; action: string; primary?: boolean }> = []

  if (error.retryable) {
    actions.push({
      label: 'Try Again',
      action: 'retry',
      primary: true
    })
  }

  switch (error.type) {
    case ErrorType.AUTH:
      actions.push({
        label: 'Log In',
        action: 'login',
        primary: true
      })
      break
    case ErrorType.NETWORK:
      actions.push({
        label: 'Refresh Page',
        action: 'refresh'
      })
      break
    case ErrorType.VALIDATION:
      actions.push({
        label: 'Fix Errors',
        action: 'fix',
        primary: true
      })
      break
  }

  actions.push({
    label: 'Go Back',
    action: 'back'
  })

  return actions
}

// Error boundary component data
export interface ErrorBoundaryState {
  hasError: boolean
  error: AppError | null
  errorId: string | null
}

export const createErrorBoundaryState = (error?: any): ErrorBoundaryState => {
  if (!error) {
    return {
      hasError: false,
      error: null,
      errorId: null
    }
  }

  const appError = parseApiError(error)
  const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logError(appError, {
    component: 'ErrorBoundary',
    errorId
  })

  return {
    hasError: true,
    error: appError,
    errorId
  }
}