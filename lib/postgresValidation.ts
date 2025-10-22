// Enhanced data validation utilities for PostgreSQL constraints
// Handles PostgreSQL-specific field lengths, data types, and constraint validations

import type { PackageData, StatusUpdate, ContactSubmission } from './types'
import { PackageStatus } from './types'

// PostgreSQL field length constraints (based on schema definitions)
export const POSTGRES_CONSTRAINTS = {
  packages: {
    id: { maxLength: 255, required: true },
    tracking_number: { maxLength: 255, required: true, pattern: /^[A-Z0-9]{8,20}$/ },
    status: { maxLength: 50, required: true, enum: Object.values(PackageStatus) },
    current_location: { required: true },
    destination: { required: true },
    customer_name: { maxLength: 255, required: false },
    customer_email: { maxLength: 255, required: false, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
  },
  status_updates: {
    id: { maxLength: 255, required: true },
    package_id: { maxLength: 255, required: true },
    status: { maxLength: 50, required: true, enum: Object.values(PackageStatus) },
    location: { required: true },
    notes: { required: false }
  },
  contact_submissions: {
    id: { maxLength: 255, required: true },
    name: { maxLength: 255, required: true },
    email: { maxLength: 255, required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    message: { maxLength: 1000, required: true },
    resolved: { required: true, type: 'boolean' }
  }
}

// PostgreSQL data type validation
export const validatePostgresDataType = (value: any, expectedType: string): { valid: boolean; error?: string } => {
  switch (expectedType.toLowerCase()) {
    case 'varchar':
    case 'text':
      if (typeof value !== 'string') {
        return { valid: false, error: `Expected string, got ${typeof value}` }
      }
      break
      
    case 'integer':
      if (!Number.isInteger(value)) {
        return { valid: false, error: `Expected integer, got ${typeof value}` }
      }
      break
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Expected boolean, got ${typeof value}` }
      }
      break
      
    case 'timestamp':
    case 'timestamp with time zone':
      if (!(value instanceof Date) && typeof value !== 'string') {
        return { valid: false, error: `Expected Date or ISO string, got ${typeof value}` }
      }
      if (typeof value === 'string') {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          return { valid: false, error: 'Invalid date format' }
        }
      }
      break
      
    case 'decimal':
    case 'numeric':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: `Expected number, got ${typeof value}` }
      }
      break
      
    default:
      // Unknown type, assume valid
      break
  }
  
  return { valid: true }
}

// Enhanced field validation with PostgreSQL constraints
export const validateField = (
  value: any, 
  fieldName: string, 
  constraints: any
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  // Required field validation
  if (constraints.required && (value === null || value === undefined || value === '')) {
    errors.push(`${fieldName} is required`)
    return { valid: false, errors }
  }
  
  // Skip further validation if field is not required and empty
  if (!constraints.required && (value === null || value === undefined || value === '')) {
    return { valid: true, errors: [] }
  }
  
  // String length validation
  if (constraints.maxLength && typeof value === 'string' && value.length > constraints.maxLength) {
    errors.push(`${fieldName} exceeds maximum length of ${constraints.maxLength} characters`)
  }
  
  if (constraints.minLength && typeof value === 'string' && value.length < constraints.minLength) {
    errors.push(`${fieldName} must be at least ${constraints.minLength} characters`)
  }
  
  // Pattern validation (regex)
  if (constraints.pattern && typeof value === 'string' && !constraints.pattern.test(value)) {
    errors.push(`${fieldName} format is invalid`)
  }
  
  // Enum validation
  if (constraints.enum && !constraints.enum.includes(value)) {
    errors.push(`${fieldName} must be one of: ${constraints.enum.join(', ')}`)
  }
  
  // Type validation
  if (constraints.type) {
    const typeValidation = validatePostgresDataType(value, constraints.type)
    if (!typeValidation.valid) {
      errors.push(`${fieldName}: ${typeValidation.error}`)
    }
  }
  
  // Numeric range validation
  if (constraints.min !== undefined && typeof value === 'number' && value < constraints.min) {
    errors.push(`${fieldName} must be at least ${constraints.min}`)
  }
  
  if (constraints.max !== undefined && typeof value === 'number' && value > constraints.max) {
    errors.push(`${fieldName} must be at most ${constraints.max}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Enhanced package data validation for PostgreSQL
export const validatePackageDataForPostgres = (data: Partial<PackageData>): string[] => {
  const errors: string[] = []
  const constraints = POSTGRES_CONSTRAINTS.packages
  
  // Validate each field
  Object.entries(constraints).forEach(([fieldName, fieldConstraints]) => {
    let value: any
    
    // Map field names to data properties
    switch (fieldName) {
      case 'tracking_number':
        value = data.trackingNumber
        break
      case 'current_location':
        value = data.currentLocation
        break
      case 'customer_name':
        value = data.customerName
        break
      case 'customer_email':
        value = data.customerEmail
        break
      default:
        value = (data as any)[fieldName]
    }
    
    const validation = validateField(value, fieldName, fieldConstraints)
    errors.push(...validation.errors)
  })
  
  // Additional business logic validations
  if (data.trackingNumber) {
    const formatted = data.trackingNumber.toUpperCase().replace(/\s+/g, '')
    if (formatted !== data.trackingNumber) {
      // This is more of a normalization than an error, but we can warn
    }
  }
  
  if (data.estimatedDelivery && data.estimatedDelivery < new Date()) {
    errors.push('Estimated delivery date cannot be in the past')
  }
  
  return errors
}

// Enhanced status update validation for PostgreSQL
export const validateStatusUpdateForPostgres = (data: Partial<StatusUpdate>): string[] => {
  const errors: string[] = []
  const constraints = POSTGRES_CONSTRAINTS.status_updates
  
  // Validate each field
  Object.entries(constraints).forEach(([fieldName, fieldConstraints]) => {
    let value: any
    
    // Map field names to data properties
    switch (fieldName) {
      case 'package_id':
        value = data.packageId
        break
      default:
        value = (data as any)[fieldName]
    }
    
    const validation = validateField(value, fieldName, fieldConstraints)
    errors.push(...validation.errors)
  })
  
  // Additional business logic validations
  if (data.timestamp && data.timestamp > new Date()) {
    errors.push('Status update timestamp cannot be in the future')
  }
  
  return errors
}

// Enhanced contact submission validation for PostgreSQL
export const validateContactSubmissionForPostgres = (data: Partial<ContactSubmission>): string[] => {
  const errors: string[] = []
  const constraints = POSTGRES_CONSTRAINTS.contact_submissions
  
  // Validate each field
  Object.entries(constraints).forEach(([fieldName, fieldConstraints]) => {
    const value = (data as any)[fieldName]
    const validation = validateField(value, fieldName, fieldConstraints)
    errors.push(...validation.errors)
  })
  
  // Additional business logic validations
  if (data.message && data.message.trim().length < 10) {
    errors.push('Message must be at least 10 characters long')
  }
  
  if (data.submittedAt && data.submittedAt > new Date()) {
    errors.push('Submission date cannot be in the future')
  }
  
  return errors
}

// PostgreSQL constraint violation error handling
export const handlePostgresConstraintError = (error: any): { 
  type: string
  field?: string
  message: string
  userMessage: string
} => {
  const errorCode = error.code
  const errorMessage = error.message || ''
  
  // Parse constraint violation details
  const constraintMatch = errorMessage.match(/constraint "([^"]+)"/i)
  const constraintName = constraintMatch ? constraintMatch[1] : ''
  
  switch (errorCode) {
    case '23505': // unique_violation
      let field = 'field'
      let userMessage = 'This record already exists'
      
      if (constraintName.includes('tracking_number')) {
        field = 'tracking_number'
        userMessage = 'A package with this tracking number already exists'
      } else if (constraintName.includes('email')) {
        field = 'email'
        userMessage = 'This email address is already in use'
      }
      
      return {
        type: 'unique_violation',
        field,
        message: errorMessage,
        userMessage
      }
      
    case '23503': // foreign_key_violation
      let fkField = 'reference'
      let fkMessage = 'Referenced record does not exist'
      
      if (constraintName.includes('package_id')) {
        fkField = 'package_id'
        fkMessage = 'The specified package does not exist'
      }
      
      return {
        type: 'foreign_key_violation',
        field: fkField,
        message: errorMessage,
        userMessage: fkMessage
      }
      
    case '23502': // not_null_violation
      const columnMatch = errorMessage.match(/column "([^"]+)"/i)
      const columnName = columnMatch ? columnMatch[1] : 'field'
      
      return {
        type: 'not_null_violation',
        field: columnName,
        message: errorMessage,
        userMessage: `${columnName.replace('_', ' ')} is required`
      }
      
    case '23514': // check_violation
      return {
        type: 'check_violation',
        message: errorMessage,
        userMessage: 'Data does not meet validation requirements'
      }
      
    case '22001': // string_data_right_truncation
      return {
        type: 'string_too_long',
        message: errorMessage,
        userMessage: 'One or more fields exceed the maximum allowed length'
      }
      
    case '22007': // invalid_datetime_format
      return {
        type: 'invalid_datetime',
        message: errorMessage,
        userMessage: 'Invalid date or time format'
      }
      
    case '22P02': // invalid_text_representation
      return {
        type: 'invalid_data_type',
        message: errorMessage,
        userMessage: 'Invalid data format for one or more fields'
      }
      
    default:
      return {
        type: 'unknown',
        message: errorMessage,
        userMessage: 'A database error occurred. Please check your data and try again.'
      }
  }
}

// Date and timestamp handling for PostgreSQL
export const formatDateForPostgres = (date: Date | string | null | undefined): string | null => {
  if (!date) return null
  
  if (typeof date === 'string') {
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date format')
    }
    return parsedDate.toISOString()
  }
  
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    return date.toISOString()
  }
  
  throw new Error('Date must be a Date object or ISO string')
}

// Boolean handling for PostgreSQL
export const formatBooleanForPostgres = (value: any): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false
    }
  }
  
  if (typeof value === 'number') {
    return value !== 0
  }
  
  throw new Error('Cannot convert value to boolean')
}

// Sanitize string input for PostgreSQL
export const sanitizeStringForPostgres = (value: string | null | undefined): string | null => {
  if (!value) return null
  
  if (typeof value !== 'string') {
    throw new Error('Value must be a string')
  }
  
  // Trim whitespace
  let sanitized = value.trim()
  
  // Remove null bytes (PostgreSQL doesn't allow them)
  sanitized = sanitized.replace(/\0/g, '')
  
  // Normalize line endings
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  return sanitized
}

// Comprehensive data sanitization for PostgreSQL
export const sanitizeDataForPostgres = (data: any): any => {
  if (data === null || data === undefined) {
    return null
  }
  
  if (typeof data === 'string') {
    return sanitizeStringForPostgres(data)
  }
  
  if (typeof data === 'boolean') {
    return data
  }
  
  if (typeof data === 'number') {
    if (isNaN(data) || !isFinite(data)) {
      throw new Error('Invalid number value')
    }
    return data
  }
  
  if (data instanceof Date) {
    return formatDateForPostgres(data)
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeDataForPostgres)
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {}
    Object.entries(data).forEach(([key, value]) => {
      sanitized[key] = sanitizeDataForPostgres(value)
    })
    return sanitized
  }
  
  return data
}

// Export all validation functions
export const postgresValidation = {
  validatePackageDataForPostgres,
  validateStatusUpdateForPostgres,
  validateContactSubmissionForPostgres,
  handlePostgresConstraintError,
  formatDateForPostgres,
  formatBooleanForPostgres,
  sanitizeStringForPostgres,
  sanitizeDataForPostgres,
  validateField,
  validatePostgresDataType
}