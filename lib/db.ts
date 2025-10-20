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

// Database connection management
let db: sqlite3.Database | null = null

const getDatabasePath = (): string => {
  const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
  const dir = path.dirname(dbPath)
  
  // Ensure data directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  return dbPath
}

export const getDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const dbPath = getDatabasePath()
    
    db = new sqlite.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message)
        reject(err)
      } else {
        console.log('Connected to SQLite database at:', dbPath)
        resolve(db!)
      }
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

// Database initialization and schema creation
export const initDatabase = async (): Promise<void> => {
  try {
    const database = await getDatabase()
    
    // Create tables using promises
    await new Promise<void>((resolve, reject) => {
      database.run(`
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
      `, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise<void>((resolve, reject) => {
      database.run(`
        CREATE TABLE IF NOT EXISTS status_updates (
          id TEXT PRIMARY KEY,
          package_id TEXT NOT NULL,
          status TEXT NOT NULL,
          location TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          notes TEXT,
          FOREIGN KEY (package_id) REFERENCES packages (id)
        )
      `, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise<void>((resolve, reject) => {
      database.run(`
        CREATE TABLE IF NOT EXISTS contact_submissions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          message TEXT NOT NULL,
          submitted_at TEXT NOT NULL,
          resolved BOOLEAN DEFAULT FALSE
        )
      `, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_packages_tracking_number ON packages(tracking_number)',
      'CREATE INDEX IF NOT EXISTS idx_status_updates_package_id ON status_updates(package_id)',
      'CREATE INDEX IF NOT EXISTS idx_status_updates_timestamp ON status_updates(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at ON contact_submissions(submitted_at)'
    ]

    for (const indexSql of indexes) {
      await new Promise<void>((resolve, reject) => {
        database.run(indexSql, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

// Utility functions
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
  
  return new Promise((resolve, reject) => {
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