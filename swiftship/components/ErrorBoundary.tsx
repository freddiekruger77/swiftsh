import React, { Component, ReactNode } from 'react'
import { 
  AppError, 
  createErrorBoundaryState, 
  ErrorBoundaryState,
  getErrorMessage,
  getRecoveryActions
} from '@/lib/errorHandling'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: AppError, errorId: string, retry: () => void) => ReactNode
  onError?: (error: AppError, errorId: string) => void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = createErrorBoundaryState()
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return createErrorBoundaryState(error)
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorState = createErrorBoundaryState(error)
    
    if (this.props.onError && errorState.error && errorState.errorId) {
      this.props.onError(errorState.error, errorState.errorId)
    }
  }

  retry = () => {
    this.setState(createErrorBoundaryState())
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorId) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorId, this.retry)
      }

      return (
        <DefaultErrorFallback 
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.retry}
        />
      )
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error: AppError
  errorId: string
  onRetry: () => void
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ 
  error, 
  errorId, 
  onRetry 
}) => {
  const recoveryActions = getRecoveryActions(error)

  const handleAction = (action: string) => {
    switch (action) {
      case 'retry':
        onRetry()
        break
      case 'refresh':
        window.location.reload()
        break
      case 'back':
        window.history.back()
        break
      case 'login':
        window.location.href = '/admin/login'
        break
      default:
        break
    }
  }

  return (
    <div className="error-boundary">
      <div className="error-container">
        <div className="error-icon">
          {error.severity === 'CRITICAL' ? '🚨' : '⚠️'}
        </div>
        
        <div className="error-content">
          <h2 className="error-title">
            {error.severity === 'CRITICAL' ? 'Critical Error' : 'Something went wrong'}
          </h2>
          
          <p className="error-message">
            {getErrorMessage(error)}
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="error-details">
              <summary>Technical Details</summary>
              <div className="error-technical">
                <p><strong>Type:</strong> {error.type}</p>
                <p><strong>Code:</strong> {error.code || 'N/A'}</p>
                <p><strong>Error ID:</strong> {errorId}</p>
                <p><strong>Timestamp:</strong> {error.timestamp.toISOString()}</p>
                {error.details && (
                  <div>
                    <strong>Details:</strong>
                    <pre>{JSON.stringify(error.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            </details>
          )}
          
          <div className="error-actions">
            {recoveryActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleAction(action.action)}
                className={`error-action-btn ${action.primary ? 'primary' : 'secondary'}`}
              >
                {action.label}
              </button>
            ))}
          </div>
          
          {error.severity === 'CRITICAL' && (
            <div className="error-support">
              <p>If this problem persists, please contact support with Error ID: <code>{errorId}</code></p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .error-boundary {
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background-color: #f8f9fa;
        }

        .error-container {
          max-width: 600px;
          width: 100%;
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e9ecef;
          text-align: center;
        }

        .error-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .error-title {
          color: #dc3545;
          margin-bottom: 1rem;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .error-message {
          color: #6c757d;
          margin-bottom: 2rem;
          font-size: 1.1rem;
          line-height: 1.6;
        }

        .error-details {
          text-align: left;
          margin-bottom: 2rem;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .error-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #495057;
          margin-bottom: 1rem;
        }

        .error-technical {
          font-size: 0.9rem;
          color: #6c757d;
        }

        .error-technical p {
          margin: 0.5rem 0;
        }

        .error-technical pre {
          background-color: #f1f3f4;
          padding: 0.5rem;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }

        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .error-action-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 120px;
        }

        .error-action-btn.primary {
          background-color: #0070f3;
          color: white;
        }

        .error-action-btn.primary:hover {
          background-color: #0051a2;
          transform: translateY(-1px);
        }

        .error-action-btn.secondary {
          background-color: #6c757d;
          color: white;
        }

        .error-action-btn.secondary:hover {
          background-color: #5a6268;
        }

        .error-support {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .error-support p {
          margin: 0;
          color: #856404;
          font-size: 0.9rem;
        }

        .error-support code {
          background-color: #f8f9fa;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
        }

        @media (max-width: 768px) {
          .error-boundary {
            padding: 1rem;
          }

          .error-container {
            padding: 1.5rem;
          }

          .error-icon {
            font-size: 3rem;
          }

          .error-title {
            font-size: 1.25rem;
          }

          .error-actions {
            flex-direction: column;
            align-items: center;
          }

          .error-action-btn {
            width: 100%;
            max-width: 200px;
          }
        }
      `}</style>
    </div>
  )
}

// Hook for handling async errors in components
export const useErrorHandler = () => {
  const handleError = (error: any, context?: any) => {
    const errorState = createErrorBoundaryState(error)
    
    if (errorState.error && errorState.errorId) {
      // In a real app, you might want to show a toast notification
      // or update global error state instead of throwing
      console.error('Async error handled:', errorState.error)
      
      // You could dispatch to a global error state here
      // dispatch({ type: 'SET_ERROR', payload: errorState.error })
    }
    
    return errorState.error
  }

  return { handleError }
}