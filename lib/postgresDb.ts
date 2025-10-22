// PostgreSQL database operations layer for SwiftShip
// Replaces SQLite functionality with PostgreSQL/Neon DB operations

import { PoolClient } from 'pg'
import { 
  getDatabase, 
  closePool, 
  generateId, 
  validatePackageDataForPostgres,
  validateContactSubmissionForPostgres,
  validateStatusUpdateForPostgres,
  handlePostgresError,
  withTimeout
} from './neonDb'
import type { PackageData, StatusUpdate, ContactSubmission } from './types'
import { PackageStatus } from './types'

// Re-export types and utilities
export type { PackageData, StatusUpdate, ContactSubmission } from './types'
export { PackageStatus } from './types'
export { 
  generateId, 
  isValidEmail, 
  formatTrackingNumber, 
  isValidTrackingNumber,
  getPoolStatus,
  validateConnection,
  closePool as closeDatabase
} from './neonDb'

// Database initialization for PostgreSQL
export const initDatabase = async (): Promise<void> => {
  const maxRetries = 3
  let attempt = 1

  while (attempt <= maxRetries) {
    try {
      console.log(`PostgreSQL database initialization attempt ${attempt}/${maxRetries}`)
      const client = await getDatabase()
      
      try {
        // Check if database is already initialized
        const isInitialized = await checkDatabaseInitialization(client)
        if (isInitialized) {
          console.log('PostgreSQL database already initialized, skipping schema creation')
          return
        }

        // Import and run schema setup
        const { setupPostgresSchema } = await import('./postgresSchema')
        const schemaResult = await setupPostgresSchema(client)
        
        if (!schemaResult.success) {
          throw new Error(schemaResult.error || 'Schema setup failed')
        }

        // Verify initialization was successful
        const verificationResult = await verifyDatabaseInitialization(client)
        if (!verificationResult.success) {
          throw new Error(`Database verification failed: ${verificationResult.error}`)
        }

        console.log('PostgreSQL database initialized successfully')
        return
        
      } finally {
        client.release()
      }
      
    } catch (error) {
      console.error(`PostgreSQL database initialization attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        console.error('PostgreSQL database initialization failed after all retry attempts')
        throw new Error(`Database initialization failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000
      console.log(`Retrying database initialization in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      attempt++
    }
  }
}

// Check if database is already initialized
const checkDatabaseInitialization = async (client: PoolClient): Promise<boolean> => {
  try {
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('packages', 'status_updates', 'contact_submissions')
    `)
    
    const tableCount = parseInt(result.rows[0].count)
    return tableCount === 3 // All 3 tables should exist
  } catch (error) {
    console.warn('Could not check database initialization status:', error)
    return false
  }
}

// Verify database initialization
const verifyDatabaseInitialization = async (client: PoolClient): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check that all tables exist and are accessible
    const tables = ['packages', 'status_updates', 'contact_submissions']
    
    for (const tableName of tables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`)
      // If we can count records, the table is accessible
    }

    // Test write capability
    await client.query('BEGIN')
    try {
      const testId = `init_test_${Date.now()}`
      await client.query('CREATE TEMP TABLE IF NOT EXISTS init_test (id VARCHAR(255))')
      await client.query('INSERT INTO init_test (id) VALUES ($1)', [testId])
      await client.query('DELETE FROM init_test WHERE id = $1', [testId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown verification error' 
    }
  }
}

// Data transformation utilities
const transformPackageForDB = (pkg: PackageData): any => ({
  id: pkg.id,
  tracking_number: pkg.trackingNumber,
  status: pkg.status,
  current_location: pkg.currentLocation,
  destination: pkg.destination,
  estimated_delivery: pkg.estimatedDelivery?.toISOString() || null,
  last_updated: pkg.lastUpdated.toISOString(),
  customer_name: pkg.customerName || null,
  customer_email: pkg.customerEmail || null
})

const transformPackageFromDB = (row: any): PackageData => ({
  id: row.id,
  trackingNumber: row.tracking_number,
  status: row.status,
  currentLocation: row.current_location,
  destination: row.destination,
  estimatedDelivery: row.estimated_delivery ? new Date(row.estimated_delivery) : undefined,
  lastUpdated: new Date(row.last_updated),
  customerName: row.customer_name || undefined,
  customerEmail: row.customer_email || undefined
})

const transformStatusUpdateForDB = (update: StatusUpdate): any => ({
  id: update.id,
  package_id: update.packageId,
  status: update.status,
  location: update.location,
  timestamp: update.timestamp.toISOString(),
  notes: update.notes || null
})

const transformStatusUpdateFromDB = (row: any): StatusUpdate => ({
  id: row.id,
  packageId: row.package_id,
  status: row.status,
  location: row.location,
  timestamp: new Date(row.timestamp),
  notes: row.notes || undefined
})

const transformContactSubmissionForDB = (submission: ContactSubmission): any => ({
  id: submission.id,
  name: submission.name,
  email: submission.email,
  message: submission.message,
  submitted_at: submission.submittedAt.toISOString(),
  resolved: submission.resolved
})

const transformContactSubmissionFromDB = (row: any): ContactSubmission => ({
  id: row.id,
  name: row.name,
  email: row.email,
  message: row.message,
  submittedAt: new Date(row.submitted_at),
  resolved: Boolean(row.resolved)
})

// Package CRUD operations
export const createPackage = async (packageData: Omit<PackageData, 'id' | 'lastUpdated'>): Promise<PackageData> => {
  const client = await getDatabase()
  
  try {
    // Validate input data
    const errors = validatePackageDataForPostgres(packageData)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }
    
    const id = generateId()
    const lastUpdated = new Date()
    
    const newPackage: PackageData = {
      ...packageData,
      id,
      lastUpdated,
      trackingNumber: packageData.trackingNumber.toUpperCase().replace(/\s+/g, '')
    }
    
    const dbData = transformPackageForDB(newPackage)
    
    const queryPromise = client.query(`
      INSERT INTO packages (
        id, tracking_number, status, current_location, destination,
        estimated_delivery, last_updated, customer_name, customer_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      dbData.id,
      dbData.tracking_number,
      dbData.status,
      dbData.current_location,
      dbData.destination,
      dbData.estimated_delivery,
      dbData.last_updated,
      dbData.customer_name,
      dbData.customer_email
    ])
    
    const result = await withTimeout(queryPromise, 15000, 'Create package')
    return transformPackageFromDB(result.rows[0])
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to create package: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getPackageByTrackingNumber = async (trackingNumber: string): Promise<PackageData | null> => {
  const client = await getDatabase()
  
  try {
    const formattedTrackingNumber = trackingNumber.toUpperCase().replace(/\s+/g, '')
    
    if (!/^[A-Z0-9]{8,20}$/.test(formattedTrackingNumber)) {
      return null
    }
    
    const queryPromise = client.query(
      'SELECT * FROM packages WHERE tracking_number = $1',
      [formattedTrackingNumber]
    )
    
    const result = await withTimeout(queryPromise, 15000, 'Get package by tracking number')
    
    if (result.rows.length === 0) {
      return null
    }
    
    return transformPackageFromDB(result.rows[0])
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get package: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getPackageById = async (id: string): Promise<PackageData | null> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query('SELECT * FROM packages WHERE id = $1', [id])
    
    if (result.rows.length === 0) {
      return null
    }
    
    return transformPackageFromDB(result.rows[0])
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get package: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const updatePackage = async (id: string, updates: Partial<PackageData>): Promise<PackageData | null> => {
  const client = await getDatabase()
  
  try {
    // Get existing package
    const existingPackage = await getPackageById(id)
    if (!existingPackage) {
      return null
    }
    
    // Merge updates with existing data
    const updatedData = { ...existingPackage, ...updates, lastUpdated: new Date() }
    
    // Validate merged data
    const errors = validatePackageDataForPostgres(updatedData)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }
    
    const dbData = transformPackageForDB(updatedData)
    
    const result = await client.query(`
      UPDATE packages SET
        status = $2, current_location = $3, destination = $4,
        estimated_delivery = $5, last_updated = $6,
        customer_name = $7, customer_email = $8
      WHERE id = $1
      RETURNING *
    `, [
      id,
      dbData.status,
      dbData.current_location,
      dbData.destination,
      dbData.estimated_delivery,
      dbData.last_updated,
      dbData.customer_name,
      dbData.customer_email
    ])
    
    if (result.rows.length === 0) {
      return null
    }
    
    return transformPackageFromDB(result.rows[0])
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to update package: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getAllPackages = async (): Promise<PackageData[]> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query('SELECT * FROM packages ORDER BY last_updated DESC')
    return result.rows.map(transformPackageFromDB)
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get packages: ${pgError.message}`)
  } finally {
    client.release()
  }
}

// Status update operations
export const createStatusUpdate = async (statusUpdate: Omit<StatusUpdate, 'id' | 'timestamp'>): Promise<StatusUpdate> => {
  const client = await getDatabase()
  
  try {
    // Validate input data
    const errors = validateStatusUpdateForPostgres(statusUpdate)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }
    
    const id = generateId()
    const timestamp = new Date()
    
    const newStatusUpdate: StatusUpdate = {
      ...statusUpdate,
      id,
      timestamp
    }
    
    const dbData = transformStatusUpdateForDB(newStatusUpdate)
    
    const result = await client.query(`
      INSERT INTO status_updates (id, package_id, status, location, timestamp, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      dbData.id,
      dbData.package_id,
      dbData.status,
      dbData.location,
      dbData.timestamp,
      dbData.notes
    ])
    
    return transformStatusUpdateFromDB(result.rows[0])
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to create status update: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getStatusUpdatesByPackageId = async (packageId: string): Promise<StatusUpdate[]> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query(
      'SELECT * FROM status_updates WHERE package_id = $1 ORDER BY timestamp DESC',
      [packageId]
    )
    
    return result.rows.map(transformStatusUpdateFromDB)
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get status updates: ${pgError.message}`)
  } finally {
    client.release()
  }
}

// Contact submission operations
export const createContactSubmission = async (submission: Omit<ContactSubmission, 'id' | 'submittedAt' | 'resolved'>): Promise<ContactSubmission> => {
  const client = await getDatabase()
  
  try {
    // Validate input data
    const errors = validateContactSubmissionForPostgres(submission)
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }
    
    const id = generateId()
    const submittedAt = new Date()
    
    const newSubmission: ContactSubmission = {
      ...submission,
      id,
      submittedAt,
      resolved: false,
      name: submission.name.trim(),
      email: submission.email.trim(),
      message: submission.message.trim()
    }
    
    const dbData = transformContactSubmissionForDB(newSubmission)
    
    const result = await client.query(`
      INSERT INTO contact_submissions (id, name, email, message, submitted_at, resolved)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      dbData.id,
      dbData.name,
      dbData.email,
      dbData.message,
      dbData.submitted_at,
      dbData.resolved
    ])
    
    return transformContactSubmissionFromDB(result.rows[0])
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to create contact submission: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getAllContactSubmissions = async (): Promise<ContactSubmission[]> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query('SELECT * FROM contact_submissions ORDER BY submitted_at DESC')
    return result.rows.map(transformContactSubmissionFromDB)
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get contact submissions: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const markContactSubmissionResolved = async (id: string): Promise<boolean> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query(
      'UPDATE contact_submissions SET resolved = $1 WHERE id = $2',
      [true, id]
    )
    
    return result.rowCount !== null && result.rowCount > 0
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to mark contact submission resolved: ${pgError.message}`)
  } finally {
    client.release()
  }
}

// Enhanced query operations for PostgreSQL
export const getPackagesByStatus = async (status: PackageStatus): Promise<PackageData[]> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query(
      'SELECT * FROM packages WHERE status = $1 ORDER BY last_updated DESC',
      [status]
    )
    
    return result.rows.map(transformPackageFromDB)
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get packages by status: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getRecentPackages = async (limit: number = 10): Promise<PackageData[]> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query(
      'SELECT * FROM packages ORDER BY last_updated DESC LIMIT $1',
      [limit]
    )
    
    return result.rows.map(transformPackageFromDB)
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get recent packages: ${pgError.message}`)
  } finally {
    client.release()
  }
}

export const getUnresolvedContactSubmissions = async (): Promise<ContactSubmission[]> => {
  const client = await getDatabase()
  
  try {
    const result = await client.query(
      'SELECT * FROM contact_submissions WHERE resolved = false ORDER BY submitted_at DESC'
    )
    
    return result.rows.map(transformContactSubmissionFromDB)
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get unresolved contact submissions: ${pgError.message}`)
  } finally {
    client.release()
  }
}

// Database statistics and analytics
export const getDatabaseStats = async (): Promise<{
  packages: { total: number; byStatus: Record<string, number> }
  statusUpdates: { total: number }
  contactSubmissions: { total: number; resolved: number; unresolved: number }
}> => {
  const client = await getDatabase()
  
  try {
    // Get package statistics
    const packageStatsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'created') as created,
        COUNT(*) FILTER (WHERE status = 'picked_up') as picked_up,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'out_for_delivery') as out_for_delivery,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'exception') as exception
      FROM packages
    `)
    
    const packageStats = packageStatsResult.rows[0]
    
    // Get status update count
    const statusUpdateResult = await client.query('SELECT COUNT(*) as total FROM status_updates')
    const statusUpdateCount = parseInt(statusUpdateResult.rows[0].total)
    
    // Get contact submission statistics
    const contactStatsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE resolved = true) as resolved,
        COUNT(*) FILTER (WHERE resolved = false) as unresolved
      FROM contact_submissions
    `)
    
    const contactStats = contactStatsResult.rows[0]
    
    return {
      packages: {
        total: parseInt(packageStats.total),
        byStatus: {
          created: parseInt(packageStats.created),
          picked_up: parseInt(packageStats.picked_up),
          in_transit: parseInt(packageStats.in_transit),
          out_for_delivery: parseInt(packageStats.out_for_delivery),
          delivered: parseInt(packageStats.delivered),
          exception: parseInt(packageStats.exception)
        }
      },
      statusUpdates: {
        total: statusUpdateCount
      },
      contactSubmissions: {
        total: parseInt(contactStats.total),
        resolved: parseInt(contactStats.resolved),
        unresolved: parseInt(contactStats.unresolved)
      }
    }
    
  } catch (error) {
    const pgError = handlePostgresError(error)
    throw new Error(`Failed to get database statistics: ${pgError.message}`)
  } finally {
    client.release()
  }
}