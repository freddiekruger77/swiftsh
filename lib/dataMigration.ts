// Data migration utilities for SQLite to PostgreSQL migration

import { PoolClient } from 'pg'
import { 
  getDatabase, 
  getAllPackages, 
  getAllContactSubmissions,
  rowToPackageData,
  rowToStatusUpdate,
  rowToContactSubmission
} from './db'
import type { PackageData, StatusUpdate, ContactSubmission } from './types'

// Migration result interface
export interface MigrationResult {
  success: boolean
  recordsCopied: {
    packages: number
    statusUpdates: number
    contactSubmissions: number
  }
  errors: string[]
  duration: number
  backupPath?: string | null
}

// Data transformation utilities for PostgreSQL compatibility
export const transformDataForPostgres = {
  // Transform package data for PostgreSQL
  package: (pkg: PackageData): any => ({
    id: pkg.id,
    tracking_number: pkg.trackingNumber,
    status: pkg.status,
    current_location: pkg.currentLocation,
    destination: pkg.destination,
    estimated_delivery: pkg.estimatedDelivery ? pkg.estimatedDelivery.toISOString() : null,
    last_updated: pkg.lastUpdated.toISOString(),
    customer_name: pkg.customerName || null,
    customer_email: pkg.customerEmail || null
  }),

  // Transform status update data for PostgreSQL
  statusUpdate: (update: StatusUpdate): any => ({
    id: update.id,
    package_id: update.packageId,
    status: update.status,
    location: update.location,
    timestamp: update.timestamp.toISOString(),
    notes: update.notes || null
  }),

  // Transform contact submission data for PostgreSQL
  contactSubmission: (submission: ContactSubmission): any => ({
    id: submission.id,
    name: submission.name,
    email: submission.email,
    message: submission.message,
    submitted_at: submission.submittedAt.toISOString(),
    resolved: submission.resolved
  })
}

// Export data from SQLite database
export const exportSQLiteData = async (): Promise<{
  success: boolean
  data: {
    packages: PackageData[]
    statusUpdates: StatusUpdate[]
    contactSubmissions: ContactSubmission[]
  }
  error?: string
}> => {
  try {
    console.log('Exporting data from SQLite database...')
    
    const db = await getDatabase()
    
    // Export packages
    console.log('Exporting packages...')
    const packages = await getAllPackages()
    console.log(`✓ Exported ${packages.length} packages`)
    
    // Export status updates
    console.log('Exporting status updates...')
    const statusUpdates: StatusUpdate[] = []
    
    await new Promise<void>((resolve, reject) => {
      db.all('SELECT * FROM status_updates ORDER BY timestamp', (err, rows) => {
        if (err) {
          reject(new Error(`Failed to export status updates: ${err.message}`))
        } else {
          statusUpdates.push(...rows.map(rowToStatusUpdate))
          resolve()
        }
      })
    })
    console.log(`✓ Exported ${statusUpdates.length} status updates`)
    
    // Export contact submissions
    console.log('Exporting contact submissions...')
    const contactSubmissions = await getAllContactSubmissions()
    console.log(`✓ Exported ${contactSubmissions.length} contact submissions`)
    
    const totalRecords = packages.length + statusUpdates.length + contactSubmissions.length
    console.log(`Data export completed: ${totalRecords} total records`)
    
    return {
      success: true,
      data: {
        packages,
        statusUpdates,
        contactSubmissions
      }
    }
    
  } catch (error) {
    console.error('SQLite data export failed:', error)
    return {
      success: false,
      data: {
        packages: [],
        statusUpdates: [],
        contactSubmissions: []
      },
      error: error instanceof Error ? error.message : 'Unknown export error'
    }
  }
}

// Import data to PostgreSQL with bulk operations
export const importDataToPostgres = async (
  client: PoolClient,
  data: {
    packages: PackageData[]
    statusUpdates: StatusUpdate[]
    contactSubmissions: ContactSubmission[]
  }
): Promise<{
  success: boolean
  imported: {
    packages: number
    statusUpdates: number
    contactSubmissions: number
  }
  errors: string[]
}> => {
  const imported = { packages: 0, statusUpdates: 0, contactSubmissions: 0 }
  const errors: string[] = []
  
  try {
    console.log('Starting PostgreSQL data import...')
    
    // Begin transaction for atomic import
    await client.query('BEGIN')
    
    // Import packages
    if (data.packages.length > 0) {
      console.log(`Importing ${data.packages.length} packages...`)
      
      const packageValues = data.packages.map(pkg => {
        const transformed = transformDataForPostgres.package(pkg)
        return [
          transformed.id,
          transformed.tracking_number,
          transformed.status,
          transformed.current_location,
          transformed.destination,
          transformed.estimated_delivery,
          transformed.last_updated,
          transformed.customer_name,
          transformed.customer_email
        ]
      })
      
      // Use bulk insert for better performance
      const packageQuery = `
        INSERT INTO packages (
          id, tracking_number, status, current_location, destination,
          estimated_delivery, last_updated, customer_name, customer_email
        ) VALUES ${packageValues.map((_, i) => 
          `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
        ).join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          current_location = EXCLUDED.current_location,
          destination = EXCLUDED.destination,
          estimated_delivery = EXCLUDED.estimated_delivery,
          last_updated = EXCLUDED.last_updated,
          customer_name = EXCLUDED.customer_name,
          customer_email = EXCLUDED.customer_email
      `
      
      const flatValues = packageValues.flat()
      await client.query(packageQuery, flatValues)
      imported.packages = data.packages.length
      console.log(`✓ Imported ${imported.packages} packages`)
    }
    
    // Import status updates
    if (data.statusUpdates.length > 0) {
      console.log(`Importing ${data.statusUpdates.length} status updates...`)
      
      const statusValues = data.statusUpdates.map(update => {
        const transformed = transformDataForPostgres.statusUpdate(update)
        return [
          transformed.id,
          transformed.package_id,
          transformed.status,
          transformed.location,
          transformed.timestamp,
          transformed.notes
        ]
      })
      
      const statusQuery = `
        INSERT INTO status_updates (
          id, package_id, status, location, timestamp, notes
        ) VALUES ${statusValues.map((_, i) => 
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
        ).join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          location = EXCLUDED.location,
          timestamp = EXCLUDED.timestamp,
          notes = EXCLUDED.notes
      `
      
      const flatStatusValues = statusValues.flat()
      await client.query(statusQuery, flatStatusValues)
      imported.statusUpdates = data.statusUpdates.length
      console.log(`✓ Imported ${imported.statusUpdates} status updates`)
    }
    
    // Import contact submissions
    if (data.contactSubmissions.length > 0) {
      console.log(`Importing ${data.contactSubmissions.length} contact submissions...`)
      
      const contactValues = data.contactSubmissions.map(submission => {
        const transformed = transformDataForPostgres.contactSubmission(submission)
        return [
          transformed.id,
          transformed.name,
          transformed.email,
          transformed.message,
          transformed.submitted_at,
          transformed.resolved
        ]
      })
      
      const contactQuery = `
        INSERT INTO contact_submissions (
          id, name, email, message, submitted_at, resolved
        ) VALUES ${contactValues.map((_, i) => 
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
        ).join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          message = EXCLUDED.message,
          submitted_at = EXCLUDED.submitted_at,
          resolved = EXCLUDED.resolved
      `
      
      const flatContactValues = contactValues.flat()
      await client.query(contactQuery, flatContactValues)
      imported.contactSubmissions = data.contactSubmissions.length
      console.log(`✓ Imported ${imported.contactSubmissions} contact submissions`)
    }
    
    // Commit transaction
    await client.query('COMMIT')
    
    const totalImported = imported.packages + imported.statusUpdates + imported.contactSubmissions
    console.log(`Data import completed successfully: ${totalImported} total records`)
    
    return {
      success: true,
      imported,
      errors
    }
    
  } catch (error) {
    // Rollback on error
    try {
      await client.query('ROLLBACK')
      console.log('Transaction rolled back due to error')
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError)
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown import error'
    console.error('PostgreSQL data import failed:', errorMessage)
    errors.push(errorMessage)
    
    return {
      success: false,
      imported,
      errors
    }
  }
}

// Verify data integrity after migration
export const verifyDataIntegrity = async (
  client: PoolClient,
  originalData: {
    packages: PackageData[]
    statusUpdates: StatusUpdate[]
    contactSubmissions: ContactSubmission[]
  }
): Promise<{
  success: boolean
  verification: {
    packages: { expected: number; actual: number; match: boolean }
    statusUpdates: { expected: number; actual: number; match: boolean }
    contactSubmissions: { expected: number; actual: number; match: boolean }
    foreignKeys: { valid: boolean; orphanedRecords: number }
  }
  errors: string[]
}> => {
  const errors: string[] = []
  
  try {
    console.log('Verifying data integrity after migration...')
    
    // Check record counts
    const packageCountResult = await client.query('SELECT COUNT(*) as count FROM packages')
    const statusCountResult = await client.query('SELECT COUNT(*) as count FROM status_updates')
    const contactCountResult = await client.query('SELECT COUNT(*) as count FROM contact_submissions')
    
    const packageCount = parseInt(packageCountResult.rows[0].count)
    const statusCount = parseInt(statusCountResult.rows[0].count)
    const contactCount = parseInt(contactCountResult.rows[0].count)
    
    const packageMatch = packageCount === originalData.packages.length
    const statusMatch = statusCount === originalData.statusUpdates.length
    const contactMatch = contactCount === originalData.contactSubmissions.length
    
    if (!packageMatch) {
      errors.push(`Package count mismatch: expected ${originalData.packages.length}, got ${packageCount}`)
    }
    if (!statusMatch) {
      errors.push(`Status update count mismatch: expected ${originalData.statusUpdates.length}, got ${statusCount}`)
    }
    if (!contactMatch) {
      errors.push(`Contact submission count mismatch: expected ${originalData.contactSubmissions.length}, got ${contactCount}`)
    }
    
    // Check foreign key integrity
    const orphanedStatusResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM status_updates su 
      LEFT JOIN packages p ON su.package_id = p.id 
      WHERE p.id IS NULL
    `)
    
    const orphanedRecords = parseInt(orphanedStatusResult.rows[0].count)
    const foreignKeysValid = orphanedRecords === 0
    
    if (!foreignKeysValid) {
      errors.push(`Found ${orphanedRecords} orphaned status update records`)
    }
    
    // Sample data verification
    if (originalData.packages.length > 0) {
      const samplePackage = originalData.packages[0]
      const verifyResult = await client.query(
        'SELECT * FROM packages WHERE id = $1',
        [samplePackage.id]
      )
      
      if (verifyResult.rows.length === 0) {
        errors.push(`Sample package verification failed: package ${samplePackage.id} not found`)
      } else {
        const pgPackage = verifyResult.rows[0]
        if (pgPackage.tracking_number !== samplePackage.trackingNumber) {
          errors.push(`Sample package data mismatch: tracking number`)
        }
      }
    }
    
    const success = packageMatch && statusMatch && contactMatch && foreignKeysValid && errors.length === 0
    
    console.log('Data integrity verification results:')
    console.log(`- Packages: ${packageCount}/${originalData.packages.length} (${packageMatch ? '✓' : '✗'})`)
    console.log(`- Status Updates: ${statusCount}/${originalData.statusUpdates.length} (${statusMatch ? '✓' : '✗'})`)
    console.log(`- Contact Submissions: ${contactCount}/${originalData.contactSubmissions.length} (${contactMatch ? '✓' : '✗'})`)
    console.log(`- Foreign Keys: ${foreignKeysValid ? '✓' : '✗'} (${orphanedRecords} orphaned records)`)
    
    return {
      success,
      verification: {
        packages: { expected: originalData.packages.length, actual: packageCount, match: packageMatch },
        statusUpdates: { expected: originalData.statusUpdates.length, actual: statusCount, match: statusMatch },
        contactSubmissions: { expected: originalData.contactSubmissions.length, actual: contactCount, match: contactMatch },
        foreignKeys: { valid: foreignKeysValid, orphanedRecords }
      },
      errors
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown verification error'
    console.error('Data integrity verification failed:', errorMessage)
    errors.push(errorMessage)
    
    return {
      success: false,
      verification: {
        packages: { expected: originalData.packages.length, actual: 0, match: false },
        statusUpdates: { expected: originalData.statusUpdates.length, actual: 0, match: false },
        contactSubmissions: { expected: originalData.contactSubmissions.length, actual: 0, match: false },
        foreignKeys: { valid: false, orphanedRecords: 0 }
      },
      errors
    }
  }
}

// Create backup of SQLite database before migration
export const createSQLiteBackup = async (): Promise<string | null> => {
  try {
    console.log('Creating SQLite database backup...')
    
    const fs = await import('fs')
    const path = await import('path')
    
    const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
    const backupDir = './backups'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `swiftship-pre-migration-${timestamp}.db`)
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    
    // Copy database file
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath)
      console.log(`✓ SQLite database backed up to: ${backupPath}`)
      return backupPath
    } else {
      console.warn('SQLite database file not found for backup')
      return null
    }
  } catch (error) {
    console.error('SQLite backup failed:', error)
    return null
  }
}

// Complete migration process
export const performCompleteMigration = async (client: PoolClient): Promise<MigrationResult> => {
  const startTime = Date.now()
  const result: MigrationResult = {
    success: false,
    recordsCopied: {
      packages: 0,
      statusUpdates: 0,
      contactSubmissions: 0
    },
    errors: [],
    duration: 0
  }
  
  try {
    console.log('Starting complete SQLite to PostgreSQL migration...')
    
    // Step 1: Create backup
    console.log('Step 1: Creating backup...')
    result.backupPath = await createSQLiteBackup()
    if (!result.backupPath) {
      result.errors.push('Failed to create backup - proceeding without backup')
    }
    
    // Step 2: Export data from SQLite
    console.log('Step 2: Exporting data from SQLite...')
    const exportResult = await exportSQLiteData()
    if (!exportResult.success) {
      result.errors.push(exportResult.error || 'Data export failed')
      throw new Error('Data export failed')
    }
    
    // Step 3: Import data to PostgreSQL
    console.log('Step 3: Importing data to PostgreSQL...')
    const importResult = await importDataToPostgres(client, exportResult.data)
    if (!importResult.success) {
      result.errors.push(...importResult.errors)
      throw new Error('Data import failed')
    }
    
    result.recordsCopied = importResult.imported
    
    // Step 4: Verify data integrity
    console.log('Step 4: Verifying data integrity...')
    const verificationResult = await verifyDataIntegrity(client, exportResult.data)
    if (!verificationResult.success) {
      result.errors.push(...verificationResult.errors)
      console.warn('Data integrity verification failed, but migration completed')
    }
    
    result.success = importResult.success
    result.duration = Date.now() - startTime
    
    const totalRecords = result.recordsCopied.packages + result.recordsCopied.statusUpdates + result.recordsCopied.contactSubmissions
    console.log(`Migration completed successfully in ${result.duration}ms`)
    console.log(`Total records migrated: ${totalRecords}`)
    console.log(`- Packages: ${result.recordsCopied.packages}`)
    console.log(`- Status Updates: ${result.recordsCopied.statusUpdates}`)
    console.log(`- Contact Submissions: ${result.recordsCopied.contactSubmissions}`)
    
    return result
    
  } catch (error) {
    result.success = false
    result.duration = Date.now() - startTime
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown migration error'
    result.errors.push(errorMessage)
    
    console.error(`Migration failed after ${result.duration}ms:`, errorMessage)
    return result
  }
}