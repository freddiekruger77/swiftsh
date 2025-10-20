import { useState } from 'react'
import { AppError, ErrorType, ErrorSeverity, getErrorMessage, getRecoveryActions } from '@/lib/errorHandling'

interface ErrorAlertProps {
  error: AppError | string | null
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  showDetails?: boolean
  compact?: boolean
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  showDetails = false,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!error) return null

  const appError: AppError = typeof error === 'string' 
    ? { 
        type: ErrorType.UNKNOWN, 
        message: error, 
        userMessage: error,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        actionable: true,
        timestamp: new Date()
      } 
    : error

  const recoveryActions = typeof error === 'string' ? [] : getRecoveryActions(appError)
  const message = getErrorMessage(appError)

  const handleAction = (action: string) => {
    switch (action) {
      case 'retry':
        onRetry?.()
        break
      case 'refresh':
        window.location.reload()
        break
      case 'back':
        window.history.back()
        break
      default:
        break
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return '#28a745'
      case 'MEDIUM': return '#ffc107'
      case 'HIGH': return '#fd7e14'
      case 'CRITICAL': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'ℹ️'
      case 'MEDIUM': return '⚠️'
      case 'HIGH': return '🚨'
      case 'CRITICAL': return '💥'
      default: return '❗'
    }
  }

  return (
    <div className={`error-alert ${compact ? 'compact' : ''} ${className}`}>
      <div className="error-header">
        <div className="error-icon">
          {getSeverityIcon(appError.severity)}
        </div>
        
        <div className="error-content">
          <div className="error-message">
            {message}
          </div>
          
          {!compact && recoveryActions.length > 0 && (
            <div className="error-actions">
              {recoveryActions.slice(0, 2).map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(action.action)}
                  className={`action-btn ${action.primary ? 'primary' : 'secondary'}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="error-controls">
          {showDetails && typeof error !== 'string' && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="details-btn"
              aria-expanded={isExpanded}
              aria-label="Toggle error details"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="dismiss-btn"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {isExpanded && typeof error !== 'string' && (
        <div className="error-details">
          <div className="detail-row">
            <strong>Type:</strong> {appError.type}
          </div>
          <div className="detail-row">
            <strong>Severity:</strong> {appError.severity}
          </div>
          {appError.code && (
            <div className="detail-row">
              <strong>Code:</strong> {appError.code}
            </div>
          )}
          <div className="detail-row">
            <strong>Time:</strong> {appError.timestamp.toLocaleString()}
          </div>
          {appError.details && (
            <div className="detail-row">
              <strong>Details:</strong>
              <pre>{JSON.stringify(appError.details, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .error-alert {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-left: 4px solid ${getSeverityColor(appError.severity)};
          border-radius: 8px;
          margin-bottom: 1rem;
          animation: slideIn 0.3s ease-out;
        }

        .error-alert.compact {
          padding: 0.75rem;
        }

        .error-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
        }

        .error-alert.compact .error-header {
          padding: 0.75rem;
        }

        .error-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .error-content {
          flex: 1;
          min-width: 0;
        }

        .error-message {
          color: #721c24;
          font-weight: 500;
          line-height: 1.5;
          margin-bottom: 0.75rem;
        }

        .error-alert.compact .error-message {
          margin-bottom: 0;
        }

        .error-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn.primary {
          background-color: #721c24;
          color: white;
        }

        .action-btn.primary:hover {
          background-color: #5a161c;
        }

        .action-btn.secondary {
          background-color: transparent;
          color: #721c24;
          border: 1px solid #721c24;
        }

        .action-btn.secondary:hover {
          background-color: #721c24;
          color: white;
        }

        .error-controls {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .details-btn,
        .dismiss-btn {
          background: none;
          border: none;
          color: #721c24;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background-color 0.2s ease;
          font-size: 0.875rem;
          line-height: 1;
        }

        .details-btn:hover,
        .dismiss-btn:hover {
          background-color: rgba(114, 28, 36, 0.1);
        }

        .dismiss-btn {
          font-weight: bold;
        }

        .error-details {
          border-top: 1px solid #f5c6cb;
          padding: 1rem;
          background-color: rgba(248, 215, 218, 0.5);
          font-size: 0.875rem;
        }

        .detail-row {
          margin-bottom: 0.5rem;
          color: #721c24;
        }

        .detail-row:last-child {
          margin-bottom: 0;
        }

        .detail-row strong {
          display: inline-block;
          min-width: 80px;
          font-weight: 600;
        }

        .detail-row pre {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 0.5rem;
          margin-top: 0.5rem;
          overflow-x: auto;
          font-size: 0.8rem;
          color: #495057;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .error-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .error-controls {
            align-self: flex-end;
            margin-top: -2rem;
          }

          .error-actions {
            margin-top: 0.5rem;
          }

          .action-btn {
            flex: 1;
            min-width: 80px;
          }
        }
      `}</style>
    </div>
  )
}

// Loading error component for async operations
interface LoadingErrorProps {
  error: AppError | string | null
  loading: boolean
  onRetry?: () => void
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const LoadingError: React.FC<LoadingErrorProps> = ({
  error,
  loading,
  onRetry,
  children,
  fallback
}) => {
  if (loading) {
    return (
      <div className="loading-container">
        {fallback || (
          <>
            <div className="spinner"></div>
            <p>Loading...</p>
          </>
        )}
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            color: #6c757d;
          }

          .spinner {
            width: 2rem;
            height: 2rem;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #0070f3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return <ErrorAlert error={error} onRetry={onRetry} />
  }

  return <>{children}</>
}