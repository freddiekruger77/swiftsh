import { forwardRef } from 'react'

interface TextAreaFieldProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  error?: string | null
  touched?: boolean
  required?: boolean
  disabled?: boolean
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  helpText?: string
  showCharacterCount?: boolean
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder,
  rows = 4,
  maxLength,
  className = '',
  helpText,
  showCharacterCount = false,
  ...props
}, ref) => {
  const hasError = touched && error
  const fieldId = `field-${name}`
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`
  const characterCount = value ? value.length : 0

  return (
    <div className={`textarea-field ${className}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="required">*</span>}
      </label>
      
      <textarea
        ref={ref}
        id={fieldId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={`form-control ${hasError ? 'is-invalid' : ''} ${touched && !error ? 'is-valid' : ''}`}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={`${hasError ? errorId : ''} ${helpText ? helpId : ''}`.trim()}
        {...props}
      />
      
      <div className="textarea-footer">
        {showCharacterCount && maxLength && (
          <div className={`character-count ${characterCount > maxLength * 0.9 ? 'warning' : ''}`}>
            {characterCount}/{maxLength}
          </div>
        )}
      </div>
      
      {helpText && !hasError && (
        <div id={helpId} className="form-help">
          {helpText}
        </div>
      )}
      
      {hasError && (
        <div id={errorId} className="form-error" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      <style jsx>{`
        .textarea-field {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #495057;
          font-size: 0.9rem;
        }

        .required-indicator {
          color: #dc3545;
          margin-left: 0.25rem;
          font-weight: bold;
        }

        .form-control {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          font-family: inherit;
          line-height: 1.5;
          transition: all 0.2s ease;
          background-color: #fff;
          resize: vertical;
          min-height: 100px;
        }

        .form-control:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
        }

        .form-control:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-control.is-invalid {
          border-color: #dc3545;
        }

        .form-control.is-invalid:focus {
          border-color: #dc3545;
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
        }

        .form-control.is-valid {
          border-color: #28a745;
        }

        .form-control.is-valid:focus {
          border-color: #28a745;
          box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
        }

        .textarea-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.25rem;
        }

        .character-count {
          font-size: 0.8rem;
          color: #6c757d;
          font-weight: 500;
        }

        .character-count.warning {
          color: #ffc107;
        }

        .form-help {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #6c757d;
          line-height: 1.4;
        }

        .form-error {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #dc3545;
          display: flex;
          align-items: flex-start;
          gap: 0.25rem;
          line-height: 1.4;
        }

        .error-icon {
          font-size: 0.875rem;
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        @media (max-width: 768px) {
          .form-control {
            font-size: 16px; /* Prevents zoom on iOS */
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
})

TextAreaField.displayName = 'TextAreaField'