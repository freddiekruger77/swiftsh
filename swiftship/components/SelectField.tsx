import { forwardRef } from 'react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectFieldProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void
  options: SelectOption[]
  error?: string | null
  touched?: boolean
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  helpText?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(({
  label,
  name,
  value,
  onChange,
  onBlur,
  options,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder = 'Select an option...',
  className = '',
  helpText,
  ...props
}, ref) => {
  const hasError = touched && error
  const fieldId = `field-${name}`
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`

  return (
    <div className={`select-field ${className}`}>
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="required">*</span>}
      </label>
      
      <div className="select-wrapper">
        <select
          ref={ref}
          id={fieldId}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`form-control ${hasError ? 'is-invalid' : ''} ${touched && !error ? 'is-valid' : ''}`}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={`${hasError ? errorId : ''} ${helpText ? helpId : ''}`.trim()}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="select-arrow" aria-hidden="true">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
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
        .select-field {
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

        .select-wrapper {
          position: relative;
        }

        .form-control {
          width: 100%;
          padding: 0.875rem 2.5rem 0.875rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background-color: #fff;
          appearance: none;
          cursor: pointer;
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

        .select-arrow {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #6c757d;
          transition: color 0.2s ease;
        }

        .form-control:focus + .select-arrow {
          color: #0070f3;
        }

        .form-control:disabled + .select-arrow {
          opacity: 0.5;
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
            padding: 1rem 2.5rem 1rem 1rem;
          }
        }
      `}</style>
    </div>
  )
})

SelectField.displayName = 'SelectField'