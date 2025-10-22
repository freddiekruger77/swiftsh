import { Pool, PoolClient, PoolConfig } from 'pg'
import type { PackageData, StatusUpdate, ContactSubmission } from './types'
import { PackageStatus } from './types'

// Re-export types from types file
export type { PackageData, StatusUpdate, ContactSubmission } from './types'
export { PackageStatus } from './types'

// Connection pool management
let pool: Pool | null = null
let connectionRetries = 0
const MAX_CONNECTION_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Neon DB configuration interface
interface NeonConfig {
  connectionString: string
  ssl: boolean
  maxConnections: number
  idleTimeout: number
  connectionTimeout: number
}

// Get Neon DB configuration from environment variables
const getNeonConfig = (): NeonConfig => {
  const connectionString = process.env.NEON_DATABASE_URL
  
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL environment variable is required')
  }
  
  return {
    connectionString,
    ssl: true, // Always use SSL for Neon DB
    maxConnections: parseInt(process.env.NEON_MAX_CONNECTIONS || '10'),
    idleTimeout: parseInt(process.env.NEON_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.NEON_CONNECTION_TIMEOUT || '10000')
  }
}

// Validate environment configuration
export const validateNeonConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!process.env.NEON_DATABASE_URL) {
    errors.push('NEON_DATABASE_URL environment variable is required')
  }
  
  // Validate connection string format
  if (process.env.NEON_DATABASE_URL && !process.env.NEON_DATABASE_URL.startsWith('postgresql://')) {
    errors.push('NEON_DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://')
  }
  
  // Validate numeric environment variables
  const numericVars = [
    { name: 'NEON_MAX_CONNECTIONS', value: process.env.NEON_MAX_CONNECTIONS },
    { name: 'NEON_IDLE_TIMEOUT', value: process.env.NEON_IDLE_TIMEOUT },
    { name: 'NEON_CONNECTION_TIMEOUT', value: process.env.NEON_CONNECTION_TIMEOUT }
  ]
  
  numericVars.forEach(({ name, value }) => {
    if (value && (isNaN(parseInt(value)) || parseInt(value) <= 0)) {
      errors.push(`${name} must be a positive integer`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Initialize connection pool with retry logic
const initializePool = async (attempt: number = 1): Promise<Pool> => {
  try {
    const config = getNeonConfig()
    
    const poolConfig: PoolConfig = {
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeout,
      connectionTimeoutMillis: config.connectionTimeout,
      // Additional serverless optimizations
      allowExitOnIdle: true, // Allow pool to close when idle (good for serverless)
      keepAlive: false, // Disable keep-alive for serverless environments
    }
    
    console.log(`Initializing Neon DB connection pool (attempt ${attempt}/${MAX_CONNECTION_RETRIES})`)
    console.log(`Pool configuration: max=${poolConfig.max}, idleTimeout=${poolConfig.idleTimeoutMillis}ms, connectionTimeout=${poolConfig.connectionTimeoutMillis}ms`)
    
    const newPool = new Pool(poolConfig)
    
    // Test the connection
    const testClient = await newPool.connect()
    await testClient.query('SELECT NOW()')
    testClient.release()
    
    console.log('Neon DB connection pool initialized successfully')
    connectionRetries = 0 // Reset retry counter on success
    
    // Set up error handlers
    newPool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
    
    newPool.on('connect', (client) => {
      console.log('New client connected to Neon DB')
    })
    
    newPool.on('remove', (client) => {
      console.log('Client removed from Neon DB pool')
    })
    
    return newPool
    
  } catch (error) {
    console.error(`Neon DB connection attempt ${attempt} failed:`, error)
    
    if (attempt < MAX_CONNECTION_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) // Exponential backoff
      console.log(`Retrying Neon DB connection in ${delay}ms... (attempt ${attempt + 1}/${MAX_CONNECTION_RETRIES})`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return initializePool(attempt + 1)
    } else {
      throw new Error(`Neon DB connection failed after ${MAX_CONNECTION_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Get database client from pool
export const getDatabase = async (): Promise<PoolClient> => {
  if (!pool) {
    pool = await initializePool()
  }
  
  try {
    const client = await pool.connect()
    return client
  } catch (error) {
    console.error('Failed to get client from pool:', error)
    
    // Try to reinitialize pool on connection failure
    try {
      console.log('Attempting to reinitialize connection pool...')
      await closePool()
      pool = await initializePool()
      return await pool.connect()
    } catch (reinitError) {
      throw new Error(`Failed to get database connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Close connection pool
export const closePool = async (): Promise<void> => {
  if (pool) {
    try {
      await pool.end()
      console.log('Neon DB connection pool closed')
    } catch (error) {
      console.error('Error closing connection pool:', error)
    } finally {
      pool = null
    }
  }
}

// Health check for connection pool
export const getPoolStatus = () => {
  if (!pool) {
    return {
      connected: false,
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0
    }
  }
  
  return {
    connected: true,
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    activeConnections: pool.totalCount - pool.idleCount
  }
}

// Connection validation with timeout
export const validateConnection = async (timeoutMs: number = 5000): Promise<{ valid: boolean; error?: string; latency?: number }> => {
  const startTime = Date.now()
  
  try {
    const client = await Promise.race([
      getDatabase(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
      )
    ])
    
    try {
      await client.query('SELECT 1')
      const latency = Date.now() - startTime
      
      return {
        valid: true,
        latency
      }
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Timeout wrapper for database operations
export const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number = 30000, 
  operation: string = 'Database operation'
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then(result => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

// Utility functions (same as SQLite version)
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const formatTrackingNumber = (trackingNumber: string): string => {
  return trackingNumber.toUpperCase().replace(/\s+/g, '')
}

export const isValidTrackingNumber = (trackingNumber: string): boolean => {
  const formatted = formatTrackingNumber(trackingNumber)
  return /^[A-Z0-9]{8,20}$/.test(formatted)
}

// Enhanced data validation functions for PostgreSQL
export const validatePackageDataForPostgres = (data: Partial<PackageData>): string[] => {
  const errors: string[] = []
  
  if (!data.trackingNumber || data.trackingNumber.trim().length === 0) {
    errors.push('Tracking number is required')
  }
  
  if (data.trackingNumber && data.trackingNumber.length > 255) {
    errors.push('Tracking number exceeds maximum length (255 characters)')
  }
  
  if (!data.status || !Object.values(PackageStatus).includes(data.status as PackageStatus)) {
    errors.push('Valid status is required')
  }
  
  if (!data.currentLocation || data.currentLocation.trim().length === 0) {
    errors.push('Current location is required')
  }
  
  if (!data.destination || data.destination.trim().length === 0) {
    errors.push('Destination is required')
  }
  
  if (data.customerEmail && !isValidEmail(data.customerEmail)) {
    errors.push('Valid email address is required')
  }
  
  if (data.customerEmail && data.customerEmail.length > 255) {
    errors.push('Customer email exceeds maximum length (255 characters)')
  }
  
  if (data.customerName && data.customerName.length > 255) {
    errors.push('Customer name exceeds maximum length (255 characters)')
  }
  
  return errors
}

export const validateContactSubmissionForPostgres = (data: Partial<ContactSubmission>): string[] => {
  const errors: string[] = []
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required')
  }
  
  if (data.name && data.name.length > 255) {
    errors.push('Name exceeds maximum length (255 characters)')
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email address is required')
  }
  
  if (data.email && data.email.length > 255) {
    errors.push('Email exceeds maximum length (255 characters)')
  }
  
  if (!data.message || data.message.trim().length === 0) {
    errors.push('Message is required')
  }
  
  if (data.message && data.message.length > 1000) {
    errors.push('Message must be less than 1000 characters')
  }
  
  return errors
}

export const validateStatusUpdateForPostgres = (data: Partial<StatusUpdate>): string[] => {
  const errors: string[] = []
  
  if (!data.packageId || data.packageId.trim().length === 0) {
    errors.push('Package ID is required')
  }
  
  if (data.packageId && data.packageId.length > 255) {
    errors.push('Package ID exceeds maximum length (255 characters)')
  }
  
  if (!data.status || !Object.values(PackageStatus).includes(data.status as PackageStatus)) {
    errors.push('Valid status is required')
  }
  
  if (!data.location || data.location.trim().length === 0) {
    errors.push('Location is required')
  }
  
  return errors
}

// PostgreSQL error handling
export const handlePostgresError = (error: any): Error => {
  // Map common PostgreSQL error codes to user-friendly messages
  const errorCode = error.code
  
  switch (errorCode) {
    case '23505': // unique_violation
      return new Error('A record with this information already exists')
    case '23503': // foreign_key_violation
      return new Error('Referenced record does not exist')
    case '23502': // not_null_violation
      return new Error('Required field is missing')
    case '23514': // check_violation
      return new Error('Data does not meet validation requirements')
    case '08006': // connection_failure
      return new Error('Database connection failed')
    case '08001': // sqlclient_unable_to_establish_sqlconnection
      return new Error('Unable to establish database connection')
    case '57P01': // admin_shutdown
      return new Error('Database is temporarily unavailable')
    case '53300': // too_many_connections
      return new Error('Database is currently overloaded, please try again')
    default:
      return new Error(`Database error: ${error.message || 'Unknown error'}`)
  }
}