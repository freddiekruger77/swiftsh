import { forwardRef } from 'react'

interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'search' | 'url'
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  error?: string | null
  touched?: boolean
  required?: boolean
  disabled?: boolean
  placeholder?: string
  autoComplete?: string
  className?: string
  helpText?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder,
  autoComplete,
  className = '',
  helpText,
  ...props
}, ref) => {
  const hasError = touched && error
  const fieldId = `field-${name}`
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`

  return (
    <div className={`form-field ${className}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="required">*</span>}
      </label>
      
      <input
        ref={ref}
        id={fieldId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        className={`form-control ${hasError ? 'is-invalid' : ''} ${touched && !error ? 'is-valid' : ''}`}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={`${hasError ? errorId : ''} ${helpText ? helpId : ''}`.trim()}
        {...props}
      />
      
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
        .form-field {
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
          transition: all 0.2s ease;
          background-color: #fff;
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
          align-items: center;
          gap: 0.25rem;
          line-height: 1.4;
        }

        .error-icon {
          font-size: 0.875rem;
          flex-shrink: 0;
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

FormField.displayName = 'FormField'