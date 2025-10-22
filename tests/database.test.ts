// Unit tests for database layer - PostgreSQL/Neon DB operations
// Tests core functionality without requiring real database connections

import { 
  generateId,
  isValidEmail,
  formatTrackingNumber,
  isValidTrackingNumber,
  validateNeonConfig,
  withTimeout,
  handlePostgresError
} from '../lib/neonDb'

import {
  validatePackageDataForPostgres,
  validateContactSubmissionForPostgres,
  validateStatusUpdateForPostgres,
  handlePostgresConstraintError,
  formatDateForPostgres,
  formatBooleanForPostgres,
  sanitizeStringForPostgres
} from '../lib/postgresValidation'

import { PackageStatus } from '../lib/types'

describe('Connection Pool Management (Unit Tests)', () => {
  test('should handle timeout wrapper correctly', async () => {
    // Test successful promise
    const fastPromise = Promise.resolve('success')
    const result = await withTimeout(fastPromise, 1000, 'Fast operation')
    expect(result).toBe('success')

    // Test timeout
    const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 2000))
    await expect(
      withTimeout(slowPromise, 100, 'Slow operation')
    ).rejects.toThrow('Slow operation timed out after 100ms')
  })

  test('should handle promise rejection in timeout wrapper', async () => {
    const failingPromise = Promise.reject(new Error('Operation failed'))
    await expect(
      withTimeout(failingPromise, 1000, 'Failing operation')
    ).rejects.toThrow('Operation failed')
  })
})

describe('Error Handling for Different Failure Scenarios', () => {
  test('should handle PostgreSQL error codes correctly', () => {
    const uniqueViolationError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const handledError = handlePostgresError(uniqueViolationError)
    expect(handledError.message).toContain('already exists')

    const foreignKeyError = { code: '23503', message: 'foreign key constraint violation' }
    const handledFkError = handlePostgresError(foreignKeyError)
    expect(handledFkError.message).toContain('does not exist')

    const notNullError = { code: '23502', message: 'null value in column violates not-null constraint' }
    const handledNullError = handlePostgresError(notNullError)
    expect(handledNullError.message).toContain('missing')

    const connectionError = { code: '08006', message: 'connection failure' }
    const handledConnError = handlePostgresError(connectionError)
    expect(handledConnError.message).toContain('connection failed')

    const unknownError = { code: '99999', message: 'unknown error' }
    const handledUnknownError = handlePostgresError(unknownError)
    expect(handledUnknownError.message).toContain('Database error')
  })

  test('should handle constraint violation errors with detailed information', () => {
    const constraintError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "packages_tracking_number_key"'
    }
    
    const handled = handlePostgresConstraintError(constraintError)
    expect(handled.type).toBe('unique_violation')
    expect(handled.field).toBe('tracking_number')
    expect(handled.userMessage).toContain('tracking number already exists')

    const fkError = {
      code: '23503',
      message: 'foreign key constraint violation on package_id'
    }
    
    const handledFk = handlePostgresConstraintError(fkError)
    expect(handledFk.type).toBe('foreign_key_violation')
    expect(handledFk.userMessage).toContain('does not exist')

    const notNullError = {
      code: '23502',
      message: 'null value in column "name" violates not-null constraint'
    }
    
    const handledNotNull = handlePostgresConstraintError(notNullError)
    expect(handledNotNull.type).toBe('not_null_violation')
    expect(handledNotNull.field).toBe('name')
    expect(handledNotNull.userMessage).toContain('name is required')
  })
})

describe('Environment Configuration Handling', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should validate complete Neon configuration', () => {
    process.env.NEON_DATABASE_URL = 'postgresql://user:pass@host:5432/db'
    process.env.NEON_MAX_CONNECTIONS = '10'
    process.env.NEON_IDLE_TIMEOUT = '30000'
    process.env.NEON_CONNECTION_TIMEOUT = '10000'

    const result = validateNeonConfig()
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('should detect missing required environment variables', () => {
    delete process.env.NEON_DATABASE_URL

    const result = validateNeonConfig()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('NEON_DATABASE_URL environment variable is required')
  })

  test('should validate connection string format', () => {
    process.env.NEON_DATABASE_URL = 'invalid-connection-string'

    const result = validateNeonConfig()
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('valid PostgreSQL connection string'))).toBe(true)
  })

  test('should validate numeric configuration values', () => {
    process.env.NEON_DATABASE_URL = 'postgresql://user:pass@host:5432/db'
    process.env.NEON_MAX_CONNECTIONS = 'invalid'
    process.env.NEON_IDLE_TIMEOUT = '-1'

    const result = validateNeonConfig()
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('positive integer'))).toBe(true)
  })
})

describe('Data Validation Functions', () => {
  test('should validate package data for PostgreSQL constraints', () => {
    // Test valid package data (including id for complete validation)
    const validPackage = {
      id: 'pkg_123456789',
      trackingNumber: 'ABC123456789',
      status: PackageStatus.CREATED,
      currentLocation: 'Warehouse A',
      destination: 'Customer Address',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe'
    }

    const errors = validatePackageDataForPostgres(validPackage)
    expect(errors).toHaveLength(0)

    // Test invalid data
    const invalidPackage = {
      id: '', // Empty
      trackingNumber: '', // Empty
      status: 'invalid_status' as any,
      currentLocation: '',
      destination: '',
      customerEmail: 'invalid-email',
      customerName: 'x'.repeat(300) // Too long
    }

    const invalidErrors = validatePackageDataForPostgres(invalidPackage)
    expect(invalidErrors.length).toBeGreaterThan(0)
    expect(invalidErrors.some(error => error.includes('required'))).toBe(true)
    expect(invalidErrors.some(error => error.includes('maximum length'))).toBe(true)
  })

  test('should validate contact submission data', () => {
    // Test valid submission data (including id and resolved for complete validation)
    const validSubmission = {
      id: 'contact_123456789',
      name: 'John Doe',
      email: 'john@example.com',
      message: 'This is a test message with sufficient length.',
      resolved: false
    }

    const errors = validateContactSubmissionForPostgres(validSubmission)
    expect(errors).toHaveLength(0)

    // Test invalid data
    const invalidSubmission = {
      id: '', // Empty
      name: '',
      email: 'invalid-email',
      message: 'x'.repeat(1001), // Too long
      resolved: 'not-a-boolean' as any
    }

    const invalidErrors = validateContactSubmissionForPostgres(invalidSubmission)
    expect(invalidErrors.length).toBeGreaterThan(0)
    expect(invalidErrors.some(error => error.includes('required'))).toBe(true)
    expect(invalidErrors.some(error => error.includes('maximum length'))).toBe(true)
  })

  test('should validate status update data', () => {
    // Test valid update data (including id for complete validation)
    const validUpdate = {
      id: 'update_123456789',
      packageId: 'pkg123',
      status: PackageStatus.IN_TRANSIT,
      location: 'Distribution Center',
      notes: 'Package processed successfully'
    }

    const errors = validateStatusUpdateForPostgres(validUpdate)
    expect(errors).toHaveLength(0)

    // Test invalid data
    const invalidUpdate = {
      id: '', // Empty
      packageId: '', // Empty
      status: 'invalid_status' as any,
      location: '',
      notes: 'x'.repeat(2000) // Very long notes
    }

    const invalidErrors = validateStatusUpdateForPostgres(invalidUpdate)
    expect(invalidErrors.length).toBeGreaterThan(0)
    expect(invalidErrors.some(error => error.includes('required'))).toBe(true)
  })
})

describe('Utility Functions', () => {
  test('should generate unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    
    expect(typeof id1).toBe('string')
    expect(typeof id2).toBe('string')
    expect(id1).not.toBe(id2)
    expect(id1.length).toBeGreaterThan(0)
  })

  test('should validate email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true)
    expect(isValidEmail('invalid-email')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
  })

  test('should format tracking numbers', () => {
    expect(formatTrackingNumber('abc 123 def')).toBe('ABC123DEF')
    expect(formatTrackingNumber('  xyz789  ')).toBe('XYZ789')
    expect(formatTrackingNumber('lower123')).toBe('LOWER123')
  })

  test('should validate tracking numbers', () => {
    expect(isValidTrackingNumber('ABC123456789')).toBe(true)
    expect(isValidTrackingNumber('XYZ987654321')).toBe(true)
    expect(isValidTrackingNumber('abc123')).toBe(false) // Too short
    expect(isValidTrackingNumber('ABC123456789012345678901')).toBe(false) // Too long
    expect(isValidTrackingNumber('ABC-123')).toBe(false) // Invalid characters
  })

  test('should format dates for PostgreSQL', () => {
    const date = new Date('2023-12-25T10:30:00Z')
    const formatted = formatDateForPostgres(date)
    expect(formatted).toBe('2023-12-25T10:30:00.000Z')

    expect(formatDateForPostgres(null)).toBeNull()
    expect(formatDateForPostgres(undefined)).toBeNull()

    expect(() => formatDateForPostgres('invalid-date')).toThrow('Invalid date format')
  })

  test('should format booleans for PostgreSQL', () => {
    expect(formatBooleanForPostgres(true)).toBe(true)
    expect(formatBooleanForPostgres(false)).toBe(false)
    expect(formatBooleanForPostgres('true')).toBe(true)
    expect(formatBooleanForPostgres('false')).toBe(false)
    expect(formatBooleanForPostgres('1')).toBe(true)
    expect(formatBooleanForPostgres('0')).toBe(false)
    expect(formatBooleanForPostgres(1)).toBe(true)
    expect(formatBooleanForPostgres(0)).toBe(false)

    expect(() => formatBooleanForPostgres('invalid')).toThrow('Cannot convert value to boolean')
  })

  test('should sanitize strings for PostgreSQL', () => {
    expect(sanitizeStringForPostgres('  test  ')).toBe('test')
    expect(sanitizeStringForPostgres('line1\r\nline2')).toBe('line1\nline2')
    expect(sanitizeStringForPostgres('test\0null')).toBe('testnull')
    expect(sanitizeStringForPostgres(null)).toBeNull()
    expect(sanitizeStringForPostgres(undefined)).toBeNull()
  })
})