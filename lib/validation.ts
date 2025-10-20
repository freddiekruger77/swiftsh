// Validation utilities for client-side form validation

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => boolean
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface FieldValidation {
  [fieldName: string]: ValidationRule[]
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  trackingNumber: /^[A-Z0-9]{8,20}$/,
  phone: /^\+?[\d\s\-\(\)]{10,}$/,
  postalCode: /^[A-Z0-9\s\-]{3,10}$/i,
  name: /^[a-zA-Z\s\-']{2,50}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s\-_]+$/
}

// Common validation rules
export const VALIDATION_RULES = {
  required: (message = 'This field is required'): ValidationRule => ({
    required: true,
    message
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.email,
    message
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    minLength: min,
    message: message || `Must be at least ${min} characters long`
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    maxLength: max,
    message: message || `Must be no more than ${max} characters long`
  }),

  trackingNumber: (message = 'Please enter a valid tracking number (8-20 alphanumeric characters)'): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.trackingNumber,
    message
  }),

  name: (message = 'Please enter a valid name (letters, spaces, hyphens, and apostrophes only)'): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.name,
    message
  }),

  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.phone,
    message
  }),

  custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
    custom: validator,
    message
  })
}

// Validate a single field
export const validateField = (value: any, rules: ValidationRule[]): ValidationResult => {
  const errors: string[] = []

  for (const rule of rules) {
    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors.push(rule.message)
      continue // Skip other validations if required field is empty
    }

    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      continue
    }

    const stringValue = typeof value === 'string' ? value.trim() : String(value)

    // Min length validation
    if (rule.minLength && stringValue.length < rule.minLength) {
      errors.push(rule.message)
    }

    // Max length validation
    if (rule.maxLength && stringValue.length > rule.maxLength) {
      errors.push(rule.message)
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(stringValue)) {
      errors.push(rule.message)
    }

    // Custom validation
    if (rule.custom && !rule.custom(value)) {
      errors.push(rule.message)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Validate multiple fields
export const validateForm = (data: Record<string, any>, schema: FieldValidation): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {}

  for (const [fieldName, rules] of Object.entries(schema)) {
    results[fieldName] = validateField(data[fieldName], rules)
  }

  return results
}

// Check if entire form is valid
export const isFormValid = (validationResults: Record<string, ValidationResult>): boolean => {
  return Object.values(validationResults).every(result => result.isValid)
}

// Get all errors from validation results
export const getAllErrors = (validationResults: Record<string, ValidationResult>): string[] => {
  const allErrors: string[] = []
  
  for (const result of Object.values(validationResults)) {
    allErrors.push(...result.errors)
  }
  
  return allErrors
}

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
}

// Format tracking number
export const formatTrackingNumber = (trackingNumber: string): string => {
  return trackingNumber.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '')
}

// Validate and format phone number
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  
  return phone // Return original if can't format
}

// Debounce function for real-time validation
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Form validation schemas
export const FORM_SCHEMAS = {
  tracking: {
    trackingNumber: [
      VALIDATION_RULES.required('Please enter a tracking number'),
      VALIDATION_RULES.trackingNumber()
    ]
  },

  contact: {
    name: [
      VALIDATION_RULES.required('Please enter your name'),
      VALIDATION_RULES.minLength(2, 'Name must be at least 2 characters'),
      VALIDATION_RULES.maxLength(50, 'Name must be less than 50 characters'),
      VALIDATION_RULES.name()
    ],
    email: [
      VALIDATION_RULES.required('Please enter your email address'),
      VALIDATION_RULES.email()
    ],
    message: [
      VALIDATION_RULES.required('Please enter a message'),
      VALIDATION_RULES.minLength(10, 'Message must be at least 10 characters'),
      VALIDATION_RULES.maxLength(1000, 'Message must be less than 1000 characters')
    ]
  },

  adminPackage: {
    trackingNumber: [
      VALIDATION_RULES.required('Please enter a tracking number'),
      VALIDATION_RULES.trackingNumber()
    ],
    status: [
      VALIDATION_RULES.required('Please select a status')
    ],
    location: [
      VALIDATION_RULES.required('Please enter current location'),
      VALIDATION_RULES.minLength(2, 'Location must be at least 2 characters'),
      VALIDATION_RULES.maxLength(100, 'Location must be less than 100 characters')
    ],
    destination: [
      VALIDATION_RULES.required('Please enter destination'),
      VALIDATION_RULES.minLength(2, 'Destination must be at least 2 characters'),
      VALIDATION_RULES.maxLength(100, 'Destination must be less than 100 characters')
    ],
    customerName: [
      VALIDATION_RULES.maxLength(50, 'Customer name must be less than 50 characters'),
      VALIDATION_RULES.name('Please enter a valid customer name')
    ],
    customerEmail: [
      VALIDATION_RULES.email('Please enter a valid email address')
    ],
    notes: [
      VALIDATION_RULES.maxLength(500, 'Notes must be less than 500 characters')
    ]
  },

  login: {
    email: [
      VALIDATION_RULES.required('Please enter your email address'),
      VALIDATION_RULES.email()
    ],
    password: [
      VALIDATION_RULES.required('Please enter your password'),
      VALIDATION_RULES.minLength(6, 'Password must be at least 6 characters')
    ]
  }
}

// Real-time validation hook data structure
export interface UseValidationOptions {
  schema: FieldValidation
  validateOnChange?: boolean
  validateOnBlur?: boolean
  debounceMs?: number
}

export interface ValidationState {
  values: Record<string, any>
  errors: Record<string, string[]>
  touched: Record<string, boolean>
  isValid: boolean
  isSubmitting: boolean
}

// Helper to get first error for a field
export const getFieldError = (fieldName: string, validationResults: Record<string, ValidationResult>): string | null => {
  const result = validationResults[fieldName]
  return result && result.errors.length > 0 ? result.errors[0] : null
}

// Helper to check if field has error
export const hasFieldError = (fieldName: string, validationResults: Record<string, ValidationResult>): boolean => {
  const result = validationResults[fieldName]
  return result ? !result.isValid : false
}