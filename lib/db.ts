import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'
import type { PackageData, StatusUpdate, ContactSubmission } from './types'
import { PackageStatus } from './types'

// Enable verbose mode for better error reporting
const sqlite = sqlite3.verbose()

// Re-export types from types file
export type { PackageData, StatusUpdate, ContactSubmission } from './types'
export { PackageStatus } from './types'

// Database connection management with retry logic
let db: sqlite3.Database | null = null
let connectionRetries = 0
const MAX_CONNECTION_RETRIES = 3
const RETRY_DELAY_MS = 1000

const getDatabasePath = (): string => {
  let dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
  
  // In serverless environments (like Vercel), prefer /tmp directory
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_PATH) {
    dbPath = '/tmp/swiftship.db'
    console.log('Using /tmp directory for database in serverless environment')
  }
  
  const dir = path.dirname(dbPath)
  
  // Ensure data directory exists
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  } catch (error) {
    console.error('Failed to create database directory:', error)
    // Fallback to /tmp if directory creation fails
    if (dbPath !== '/tmp/swiftship.db') {
      console.log('Falling back to /tmp directory')
      dbPath = '/tmp/swiftship.db'
      try {
        fs.mkdirSync('/tmp', { recursive: true })
      } catch (tmpError) {
        console.error('Failed to create /tmp directory:', tmpError)
      }
    }
  }
  
  return dbPath
}

export const getDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const connectWithRetry = async (attempt: number = 1): Promise<void> => {
      const dbPath = getDatabasePath()
      
      // Add timeout for serverless environments
      const timeout = setTimeout(() => {
        reject(new Error(`Database connection timeout (attempt ${attempt}/${MAX_CONNECTION_RETRIES})`))
      }, 15000) // 15 second timeout

      db = new sqlite.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
        clearTimeout(timeout)
        
        if (err) {
          console.error(`Database connection attempt ${attempt} failed:`, err.message)
          console.error('Database path:', dbPath)
          console.error('Process platform:', process.platform)
          console.error('Process cwd:', process.cwd())
          
          // Reset db to null on failure
          db = null
          
          // Try to provide more helpful error information
          if (err.message.includes('SQLITE_CANTOPEN')) {
            console.error('Database file cannot be opened - check file permissions and directory structure')
          }
          
          // Retry logic for serverless cold starts
          if (attempt < MAX_CONNECTION_RETRIES) {
            console.log(`Retrying database connection in ${RETRY_DELAY_MS}ms... (attempt ${attempt + 1}/${MAX_CONNECTION_RETRIES})`)
            setTimeout(() => {
              connectWithRetry(attempt + 1).catch(reject)
            }, RETRY_DELAY_MS * attempt) // Exponential backoff
          } else {
            reject(new Error(`Database connection failed after ${MAX_CONNECTION_RETRIES} attempts: ${err.message}`))
          }
        } else {
          console.log(`Connected to SQLite database at: ${dbPath} (attempt ${attempt})`)
          connectionRetries = 0 // Reset retry counter on success
          
          // Configure database for better performance in serverless
          if (db) {
            try {
              // Set busy timeout for concurrent access
              db.configure('busyTimeout', 30000) // 30 second busy timeout
              
              // Optimize for serverless environment
              await configureDatabaseForServerless(db)
              
              resolve(db!)
            } catch (configError) {
              console.warn('Database configuration warning:', configError)
              // Still resolve even if configuration fails
              resolve(db!)
            }
          }
        }
      })
    }

    connectWithRetry().catch(reject)
  })
}

// Configure database settings optimized for serverless environments
const configureDatabaseForServerless = async (database: sqlite3.Database): Promise<void> => {
  return new Promise((resolve) => {
    const configurations = [
      // Use DELETE journal mode instead of WAL for serverless (WAL requires persistent storage)
      { sql: 'PRAGMA journal_mode = DELETE', description: 'journal mode' },
      // Reduce synchronous writes for better performance
      { sql: 'PRAGMA synchronous = NORMAL', description: 'synchronous mode' },
      // Optimize cache size for memory-constrained environments
      { sql: 'PRAGMA cache_size = 2000', description: 'cache size' },
      // Set reasonable timeout for busy database
      { sql: 'PRAGMA busy_timeout = 30000', description: 'busy timeout' },
      // Optimize for read-heavy workloads
      { sql: 'PRAGMA temp_store = MEMORY', description: 'temp store' },
      // Enable foreign key constraints
      { sql: 'PRAGMA foreign_keys = ON', description: 'foreign keys' }
    ]

    let completed = 0
    const total = configurations.length

    configurations.forEach(({ sql, description }) => {
      database.run(sql, (err) => {
        if (err) {
          console.warn(`Could not set ${description}:`, err.message)
        } else {
          console.log(`Database ${description} configured successfully`)
        }
        
        completed++
        if (completed === total) {
          resolve()
        }
      })
    })
  })
}

export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message)
          reject(err)
        } else {
          console.log('Database connection closed')
          db = null
          resolve()
        }
      })
    } else {
      resolve()
    }
  })
}

// Database initialization and schema creation with enhanced error handling
export const initDatabase = async (): Promise<void> => {
  const maxRetries = 3
  let attempt = 1

  while (attempt <= maxRetries) {
    try {
      console.log(`Database initialization attempt ${attempt}/${maxRetries}`)
      const database = await getDatabase()
      
      // Check if database is already initialized
      const isInitialized = await checkDatabaseInitialization(database)
      if (isInitialized) {
        console.log('Database already initialized, skipping schema creation')
        return
      }

      // Create tables with enhanced error handling
      await createDatabaseTables(database)
      
      // Create indexes for better performance
      await createDatabaseIndexes(database)
      
      // Verify initialization was successful
      const verificationResult = await verifyDatabaseInitialization(database)
      if (!verificationResult.success) {
        throw new Error(`Database verification failed: ${verificationResult.error}`)
      }

      console.log('Database initialized successfully')
      return
      
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        console.error('Database initialization failed after all retry attempts')
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
const checkDatabaseInitialization = async (database: sqlite3.Database): Promise<boolean> => {
  return new Promise((resolve) => {
    database.get(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('packages', 'status_updates', 'contact_submissions')",
      (err, row: any) => {
        if (err) {
          console.warn('Could not check database initialization status:', err.message)
          resolve(false)
        } else {
          const tableCount = row?.count || 0
          resolve(tableCount === 3) // All 3 tables should exist
        }
      }
    )
  })
}

// Create database tables with proper error handling
const createDatabaseTables = async (database: sqlite3.Database): Promise<void> => {
  const tables = [
    {
      name: 'packages',
      sql: `
        CREATE TABLE IF NOT EXISTS packages (
          id TEXT PRIMARY KEY,
          tracking_number TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          current_location TEXT NOT NULL,
          destination TEXT NOT NULL,
          estimated_delivery TEXT,
          last_updated TEXT NOT NULL,
          customer_name TEXT,
          customer_email TEXT
        )
      `
    },
    {
      name: 'status_updates',
      sql: `
        CREATE TABLE IF NOT EXISTS status_updates (
          id TEXT PRIMARY KEY,
          package_id TEXT NOT NULL,
          status TEXT NOT NULL,
          location TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          notes TEXT,
          FOREIGN KEY (package_id) REFERENCES packages (id)
        )
      `
    },
    {
      name: 'contact_submissions',
      sql: `
        CREATE TABLE IF NOT EXISTS contact_submissions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          message TEXT NOT NULL,
          submitted_at TEXT NOT NULL,
          resolved BOOLEAN DEFAULT FALSE
        )
      `
    }
  ]

  for (const table of tables) {
    await new Promise<void>((resolve, reject) => {
      database.run(table.sql, (err) => {
        if (err) {
          console.error(`Failed to create table ${table.name}:`, err.message)
          reject(new Error(`Failed to create table ${table.name}: ${err.message}`))
        } else {
          console.log(`Table ${table.name} created successfully`)
          resolve()
        }
      })
    })
  }
}

// Create database indexes for better performance
const createDatabaseIndexes = async (database: sqlite3.Database): Promise<void> => {
  const indexes = [
    { name: 'idx_packages_tracking_number', sql: 'CREATE INDEX IF NOT EXISTS idx_packages_tracking_number ON packages(tracking_number)' },
    { name: 'idx_status_updates_package_id', sql: 'CREATE INDEX IF NOT EXISTS idx_status_updates_package_id ON status_updates(package_id)' },
    { name: 'idx_status_updates_timestamp', sql: 'CREATE INDEX IF NOT EXISTS idx_status_updates_timestamp ON status_updates(timestamp)' },
    { name: 'idx_contact_submissions_submitted_at', sql: 'CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at ON contact_submissions(submitted_at)' }
  ]

  for (const index of indexes) {
    await new Promise<void>((resolve, reject) => {
      database.run(index.sql, (err) => {
        if (err) {
          console.warn(`Failed to create index ${index.name}:`, err.message)
          // Don't reject for index creation failures, just warn
          resolve()
        } else {
          console.log(`Index ${index.name} created successfully`)
          resolve()
        }
      })
    })
  }
}

// Verify database initialization was successful
const verifyDatabaseInitialization = async (database: sqlite3.Database): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check that all tables exist and are accessible
    const tables = ['packages', 'status_updates', 'contact_submissions']
    
    for (const tableName of tables) {
      await new Promise<void>((resolve, reject) => {
        database.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
          if (err) {
            reject(new Error(`Table ${tableName} is not accessible: ${err.message}`))
          } else {
            resolve()
          }
        })
      })
    }

    // Test write capability
    await new Promise<void>((resolve, reject) => {
      const testId = `init_test_${Date.now()}`
      database.run('CREATE TEMP TABLE IF NOT EXISTS init_test (id TEXT)', (createErr) => {
        if (createErr) {
          reject(new Error(`Cannot create temp table: ${createErr.message}`))
          return
        }
        
        database.run('INSERT INTO init_test (id) VALUES (?)', [testId], (insertErr) => {
          if (insertErr) {
            reject(new Error(`Cannot write to database: ${insertErr.message}`))
            return
          }
          
          database.run('DELETE FROM init_test WHERE id = ?', [testId], (deleteErr) => {
            if (deleteErr) {
              reject(new Error(`Cannot delete from database: ${deleteErr.message}`))
            } else {
              resolve()
            }
          })
        })
      })
    })

    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown verification error' 
    }
  }
}

// Utility functions
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Timeout wrapper for database operations in serverless environments
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

// Data validation functions
export const validatePackageData = (data: Partial<PackageData>): string[] => {
  const errors: string[] = []
  
  if (!data.trackingNumber || data.trackingNumber.trim().length === 0) {
    errors.push('Tracking number is required')
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
  
  return errors
}

export const validateContactSubmission = (data: Partial<ContactSubmission>): string[] => {
  const errors: string[] = []
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required')
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email address is required')
  }
  
  if (!data.message || data.message.trim().length === 0) {
    errors.push('Message is required')
  }
  
  if (data.message && data.message.length > 1000) {
    errors.push('Message must be less than 1000 characters')
  }
  
  return errors
}

export const validateStatusUpdate = (data: Partial<StatusUpdate>): string[] => {
  const errors: string[] = []
  
  if (!data.packageId || data.packageId.trim().length === 0) {
    errors.push('Package ID is required')
  }
  
  if (!data.status || !Object.values(PackageStatus).includes(data.status as PackageStatus)) {
    errors.push('Valid status is required')
  }
  
  if (!data.location || data.location.trim().length === 0) {
    errors.push('Location is required')
  }
  
  return errors
}

// Database row to model conversion functions
export const rowToPackageData = (row: any): PackageData => {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    status: row.status,
    currentLocation: row.current_location,
    destination: row.destination,
    estimatedDelivery: row.estimated_delivery ? new Date(row.estimated_delivery) : undefined,
    lastUpdated: new Date(row.last_updated),
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined
  }
}

export const rowToStatusUpdate = (row: any): StatusUpdate => {
  return {
    id: row.id,
    packageId: row.package_id,
    status: row.status,
    location: row.location,
    timestamp: new Date(row.timestamp),
    notes: row.notes || undefined
  }
}

export const rowToContactSubmission = (row: any): ContactSubmission => {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    submittedAt: new Date(row.submitted_at),
    resolved: Boolean(row.resolved)
  }
}

// Package CRUD operations
export const createPackage = async (packageData: Omit<PackageData, 'id' | 'lastUpdated'>): Promise<PackageData> => {
  const database = await getDatabase()
  
  // Validate input data
  const errors = validatePackageData(packageData)
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }
  
  const id = generateId()
  const lastUpdated = new Date().toISOString()
  
  return new Promise((resolve, reject) => {
    database.run(`
      INSERT INTO packages (
        id, tracking_number, status, current_location, destination,
        estimated_delivery, last_updated, customer_name, customer_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      formatTrackingNumber(packageData.trackingNumber),
      packageData.status,
      packageData.currentLocation,
      packageData.destination,
      packageData.estimatedDelivery?.toISOString() || null,
      lastUpdated,
      packageData.customerName || null,
      packageData.customerEmail || null
    ], (err) => {
      if (err) {
        reject(new Error(`Failed to create package: ${err.message}`))
      } else {
        resolve({
          ...packageData,
          id,
          trackingNumber: formatTrackingNumber(packageData.trackingNumber),
          lastUpdated: new Date(lastUpdated)
        })
      }
    })
  })
}

export const getPackageByTrackingNumber = async (trackingNumber: string): Promise<PackageData | null> => {
  const database = await getDatabase()
  const formattedTrackingNumber = formatTrackingNumber(trackingNumber)
  
  if (!isValidTrackingNumber(formattedTrackingNumber)) {
    return null
  }
  
  const queryPromise = new Promise<PackageData | null>((resolve, reject) => {
    database.get(
      'SELECT * FROM packages WHERE tracking_number = ?',
      [formattedTrackingNumber],
      (err, row) => {
        if (err) {
          reject(new Error(`Failed to get package: ${err.message}`))
        } else {
          resolve(row ? rowToPackageData(row) : null)
        }
      }
    )
  })
  
  return withTimeout(queryPromise, 15000, 'Get package by tracking number')
}

export const getPackageById = async (id: string): Promise<PackageData | null> => {
  const database = await getDatabase()
  
  return new Promise((resolve, reject) => {
    database.get('SELECT * FROM packages WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(new Error(`Failed to get package: ${err.message}`))
      } else {
        resolve(row ? rowToPackageData(row) : null)
      }
    })
  })
}

export const updatePackage = async (id: string, updates: Partial<PackageData>): Promise<PackageData | null> => {
  const database = await getDatabase()
  
  // Get existing package
  const existingPackage = await getPackageById(id)
  if (!existingPackage) {
    return null
  }
  
  // Merge updates with existing data
  const updatedData = { ...existingPackage, ...updates }
  
  // Validate merged data
  const errors = validatePackageData(updatedData)
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }
  
  const lastUpdated = new Date().toISOString()
  
  return new Promise((resolve, reject) => {
    database.run(`
      UPDATE packages SET
        status = ?, current_location = ?, destination = ?,
        estimated_delivery = ?, last_updated = ?,
        customer_name = ?, customer_email = ?
      WHERE id = ?
    `, [
      updatedData.status,
      updatedData.currentLocation,
      updatedData.destination,
      updatedData.estimatedDelivery?.toISOString() || null,
      lastUpdated,
      updatedData.customerName || null,
      updatedData.customerEmail || null,
      id
    ], (err) => {
      if (err) {
        reject(new Error(`Failed to update package: ${err.message}`))
      } else {
        resolve({
          ...updatedData,
          lastUpdated: new Date(lastUpdated)
        })
      }
    })
  })
}

export const getAllPackages = async (): Promise<PackageData[]> => {
  const database = await getDatabase()
  
  return new Promise((resolve, reject) => {
    database.all('SELECT * FROM packages ORDER BY last_updated DESC', (err, rows) => {
      if (err) {
        reject(new Error(`Failed to get packages: ${err.message}`))
      } else {
        resolve(rows.map(rowToPackageData))
      }
    })
  })
}

// Status update operations
export const createStatusUpdate = async (statusUpdate: Omit<StatusUpdate, 'id' | 'timestamp'>): Promise<StatusUpdate> => {
  const database = await getDatabase()
  
  // Validate input data
  const errors = validateStatusUpdate(statusUpdate)
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }
  
  const id = generateId()
  const timestamp = new Date().toISOString()
  
  return new Promise((resolve, reject) => {
    database.run(`
      INSERT INTO status_updates (id, package_id, status, location, timestamp, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      statusUpdate.packageId,
      statusUpdate.status,
      statusUpdate.location,
      timestamp,
      statusUpdate.notes || null
    ], (err) => {
      if (err) {
        reject(new Error(`Failed to create status update: ${err.message}`))
      } else {
        resolve({
          ...statusUpdate,
          id,
          timestamp: new Date(timestamp)
        })
      }
    })
  })
}

export const getStatusUpdatesByPackageId = async (packageId: string): Promise<StatusUpdate[]> => {
  const database = await getDatabase()
  
  return new Promise((resolve, reject) => {
    database.all(
      'SELECT * FROM status_updates WHERE package_id = ? ORDER BY timestamp DESC',
      [packageId],
      (err, rows) => {
        if (err) {
          reject(new Error(`Failed to get status updates: ${err.message}`))
        } else {
          resolve(rows.map(rowToStatusUpdate))
        }
      }
    )
  })
}

// Contact submission operations
export const createContactSubmission = async (submission: Omit<ContactSubmission, 'id' | 'submittedAt' | 'resolved'>): Promise<ContactSubmission> => {
  const database = await getDatabase()
  
  // Validate input data
  const errors = validateContactSubmission(submission)
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }
  
  const id = generateId()
  const submittedAt = new Date().toISOString()
  
  return new Promise((resolve, reject) => {
    database.run(`
      INSERT INTO contact_submissions (id, name, email, message, submitted_at, resolved)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      submission.name.trim(),
      submission.email.trim(),
      submission.message.trim(),
      submittedAt,
      false
    ], (err) => {
      if (err) {
        reject(new Error(`Failed to create contact submission: ${err.message}`))
      } else {
        resolve({
          ...submission,
          id,
          submittedAt: new Date(submittedAt),
          resolved: false
        })
      }
    })
  })
}

export const getAllContactSubmissions = async (): Promise<ContactSubmission[]> => {
  const database = await getDatabase()
  
  return new Promise((resolve, reject) => {
    database.all('SELECT * FROM contact_submissions ORDER BY submitted_at DESC', (err, rows) => {
      if (err) {
        reject(new Error(`Failed to get contact submissions: ${err.message}`))
      } else {
        resolve(rows.map(rowToContactSubmission))
      }
    })
  })
}

export const markContactSubmissionResolved = async (id: string): Promise<boolean> => {
  const database = await getDatabase()
  
  return new Promise((resolve, reject) => {
    database.run('UPDATE contact_submissions SET resolved = ? WHERE id = ?', [true, id], function(err) {
      if (err) {
        reject(new Error(`Failed to mark contact submission resolved: ${err.message}`))
      } else {
        resolve(this.changes > 0)
      }
    })
  })
}