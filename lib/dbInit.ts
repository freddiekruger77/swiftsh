// Database initialization for production deployment

import { initDatabase } from './db'

// Initialize database with sample data for demo purposes
export const initializeProductionDatabase = async (): Promise<void> => {
  try {
    console.log('Initializing production database...')
    
    // Initialize database schema
    await initDatabase()
    
    // Check if we need to seed with sample data
    const shouldSeed = process.env.SEED_DATABASE === 'true' || process.env.NODE_ENV === 'development'
    
    if (shouldSeed) {
      await seedSampleData()
    }
    
    console.log('Database initialization completed successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

// Seed database with sample data for demo
const seedSampleData = async (): Promise<void> => {
  try {
    const { createPackage, createStatusUpdate, getPackageByTrackingNumber } = await import('./db')
    
    console.log('Seeding sample data...')
    
    // Sample packages for demo
    const samplePackages = [
      {
        trackingNumber: 'SW123456789',
        status: 'in_transit',
        currentLocation: 'New York, NY',
        destination: 'Los Angeles, CA',
        customerName: 'John Doe',
        customerEmail: 'john.doe@example.com',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      },
      {
        trackingNumber: 'SW987654321',
        status: 'delivered',
        currentLocation: 'Chicago, IL',
        destination: 'Chicago, IL',
        customerName: 'Jane Smith',
        customerEmail: 'jane.smith@example.com'
      },
      {
        trackingNumber: 'SW456789123',
        status: 'out_for_delivery',
        currentLocation: 'Miami, FL',
        destination: 'Miami Beach, FL',
        customerName: 'Bob Johnson',
        customerEmail: 'bob.johnson@example.com',
        estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
      },
      {
        trackingNumber: 'SW789123456',
        status: 'picked_up',
        currentLocation: 'Seattle, WA',
        destination: 'Portland, OR',
        customerName: 'Alice Brown',
        customerEmail: 'alice.brown@example.com',
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      },
      {
        trackingNumber: 'SW321654987',
        status: 'exception',
        currentLocation: 'Denver, CO',
        destination: 'Phoenix, AZ',
        customerName: 'Charlie Wilson',
        customerEmail: 'charlie.wilson@example.com'
      },
      {
        trackingNumber: 'SW240567MXC',
        status: 'in_transit',
        currentLocation: 'Mexico City Distribution Center',
        destination: 'Captain Carlos León Avenue, s/n, Peñón de los Baños Area, Venustiano Carranza Municipality, 15620, Mexico City, Mexico',
        customerName: 'Leovarda Franco Hesiquio',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      }
    ]
    
    // Create sample packages
    for (const packageData of samplePackages) {
      try {
        // Check if package already exists
        const existingPackage = await getPackageByTrackingNumber(packageData.trackingNumber)
        
        if (!existingPackage) {
          const createdPackage = await createPackage(packageData)
          console.log(`Created sample package: ${createdPackage.trackingNumber}`)
          
          // Add status history for more realistic data
          await createStatusHistory(createdPackage.id, packageData.status)
        } else {
          console.log(`Package ${packageData.trackingNumber} already exists, skipping...`)
        }
      } catch (error) {
        console.error(`Failed to create package ${packageData.trackingNumber}:`, error)
      }
    }
    
    console.log('Sample data seeding completed')
  } catch (error) {
    console.error('Failed to seed sample data:', error)
    // Don't throw error here as seeding is optional
  }
}

// Create realistic status history for packages
const createStatusHistory = async (packageId: string, currentStatus: string): Promise<void> => {
  const { createStatusUpdate } = await import('./db')
  
  const statusProgression = {
    'created': ['created'],
    'picked_up': ['created', 'picked_up'],
    'in_transit': ['created', 'picked_up', 'in_transit'],
    'out_for_delivery': ['created', 'picked_up', 'in_transit', 'out_for_delivery'],
    'delivered': ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'],
    'exception': ['created', 'picked_up', 'exception']
  }
  
  const locations = {
    'created': 'Origin Facility',
    'picked_up': 'Pickup Location',
    'in_transit': 'Transit Hub',
    'out_for_delivery': 'Local Delivery Center',
    'delivered': 'Destination',
    'exception': 'Exception Processing Center'
  }
  
  const notes = {
    'created': 'Package created and ready for pickup',
    'picked_up': 'Package picked up by carrier',
    'in_transit': 'Package in transit to destination',
    'out_for_delivery': 'Package out for delivery',
    'delivered': 'Package delivered successfully',
    'exception': 'Delivery exception - address verification required'
  }
  
  const statuses = statusProgression[currentStatus as keyof typeof statusProgression] || ['created']
  
  // Create status updates with realistic timestamps
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i]
    const hoursAgo = (statuses.length - i) * 8 // 8 hours between each status
    const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    
    try {
      await createStatusUpdate({
        packageId,
        status,
        location: locations[status as keyof typeof locations],
        notes: notes[status as keyof typeof notes]
      })
    } catch (error) {
      console.error(`Failed to create status update for ${status}:`, error)
    }
  }
}

// Enhanced database health check with comprehensive testing
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const healthResult = await checkDatabaseHealthDetailed()
    return healthResult.healthy
  } catch (error) {
    console.error('Database health check error:', error)
    return false
  }
}

// Comprehensive database health check with timeout and retry logic
export const checkDatabaseHealthWithRetry = async (maxRetries: number = 3): Promise<boolean> => {
  let attempt = 1
  
  while (attempt <= maxRetries) {
    try {
      console.log(`Database health check attempt ${attempt}/${maxRetries}`)
      
      const healthResult = await checkDatabaseHealthDetailed()
      
      if (healthResult.healthy) {
        console.log(`Database health check passed on attempt ${attempt}`)
        return true
      } else {
        console.warn(`Database health check failed on attempt ${attempt}:`, healthResult.error || 'Unknown issue')
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000 // Exponential backoff
          console.log(`Retrying health check in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    } catch (error) {
      console.error(`Database health check attempt ${attempt} threw error:`, error)
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`Retrying health check in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    attempt++
  }
  
  console.error(`Database health check failed after ${maxRetries} attempts`)
  return false
}

// Enhanced database health check with comprehensive diagnostics
export const checkDatabaseHealthDetailed = async (): Promise<{
  healthy: boolean
  connectionTime: number
  tablesExist: boolean
  canWrite: boolean
  canRead: boolean
  indexesExist: boolean
  diskSpace?: number
  error?: string
  details: {
    basicConnectivity: boolean
    tableCount: number
    indexCount: number
    lastError?: string
  }
}> => {
  const startTime = Date.now()
  const details = {
    basicConnectivity: false,
    tableCount: 0,
    indexCount: 0,
    lastError: undefined as string | undefined
  }
  
  try {
    // Add timeout wrapper for the entire health check
    const healthCheckPromise = performHealthCheck(details)
    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Health check timeout (30 seconds)'))
      }, 30000)
    })

    const result = await Promise.race([healthCheckPromise, timeoutPromise])
    
    return {
      ...result,
      connectionTime: Date.now() - startTime,
      details
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    details.lastError = errorMessage
    
    return {
      healthy: false,
      connectionTime: Date.now() - startTime,
      tablesExist: false,
      canWrite: false,
      canRead: false,
      indexesExist: false,
      error: errorMessage,
      details
    }
  }
}

// Perform comprehensive health check operations
const performHealthCheck = async (details: any) => {
  const { getDatabase } = await import('./db')
  const db = await getDatabase()
  
  // Test 1: Basic connectivity
  const basicTest = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000) // 5 second timeout for basic test
    
    db.get('SELECT 1 as test', (err) => {
      clearTimeout(timeout)
      const success = !err
      details.basicConnectivity = success
      if (err) details.lastError = err.message
      resolve(success)
    })
  })

  if (!basicTest) {
    return {
      healthy: false,
      tablesExist: false,
      canWrite: false,
      canRead: false,
      indexesExist: false,
      error: 'Basic connectivity test failed'
    }
  }

  // Test 2: Check table existence and count
  const tableInfo = await new Promise<{ exists: boolean; count: number }>((resolve) => {
    db.get(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('packages', 'status_updates', 'contact_submissions')",
      (err, row: any) => {
        if (err) {
          details.lastError = err.message
          resolve({ exists: false, count: 0 })
        } else {
          const count = row?.count || 0
          details.tableCount = count
          resolve({ exists: count === 3, count })
        }
      }
    )
  })

  // Test 3: Check index existence
  const indexInfo = await new Promise<{ exists: boolean; count: number }>((resolve) => {
    db.get(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
      (err, row: any) => {
        if (err) {
          details.lastError = err.message
          resolve({ exists: false, count: 0 })
        } else {
          const count = row?.count || 0
          details.indexCount = count
          resolve({ exists: count >= 4, count }) // We expect at least 4 indexes
        }
      }
    )
  })

  // Test 4: Read capability
  const canRead = await new Promise<boolean>((resolve) => {
    if (!tableInfo.exists) {
      resolve(false)
      return
    }
    
    db.get('SELECT COUNT(*) as count FROM packages LIMIT 1', (err) => {
      if (err) details.lastError = err.message
      resolve(!err)
    })
  })

  // Test 5: Write capability
  const canWrite = await new Promise<boolean>((resolve) => {
    const testId = `health_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.run('CREATE TEMP TABLE IF NOT EXISTS health_test (id TEXT, created_at TEXT)', (createErr) => {
      if (createErr) {
        details.lastError = createErr.message
        resolve(false)
        return
      }
      
      const timestamp = new Date().toISOString()
      db.run('INSERT INTO health_test (id, created_at) VALUES (?, ?)', [testId, timestamp], (insertErr) => {
        if (insertErr) {
          details.lastError = insertErr.message
          resolve(false)
          return
        }
        
        db.get('SELECT id FROM health_test WHERE id = ?', [testId], (selectErr, row) => {
          if (selectErr) {
            details.lastError = selectErr.message
            resolve(false)
            return
          }
          
          db.run('DELETE FROM health_test WHERE id = ?', [testId], (deleteErr) => {
            if (deleteErr) {
              details.lastError = deleteErr.message
              resolve(false)
            } else {
              resolve(true)
            }
          })
        })
      })
    })
  })

  // Test 6: Check available disk space (if possible)
  let diskSpace: number | undefined
  try {
    const fs = await import('fs')
    const dbPath = process.env.DATABASE_PATH || '/tmp/swiftship.db'
    const stats = fs.statSync(dbPath)
    diskSpace = stats.size
  } catch (error) {
    // Disk space check is optional
  }

  const healthy = basicTest && tableInfo.exists && canRead && canWrite && indexInfo.exists

  return {
    healthy,
    tablesExist: tableInfo.exists,
    canWrite,
    canRead,
    indexesExist: indexInfo.exists,
    diskSpace,
    error: healthy ? undefined : (details.lastError || 'One or more health checks failed')
  }
}

// Backup database (for SQLite)
export const backupDatabase = async (): Promise<string | null> => {
  try {
    const fs = await import('fs')
    const path = await import('path')
    
    const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
    const backupDir = './backups'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `swiftship-backup-${timestamp}.db`)
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    
    // Copy database file
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath)
      console.log(`Database backed up to: ${backupPath}`)
      return backupPath
    } else {
      console.warn('Database file not found for backup')
      return null
    }
  } catch (error) {
    console.error('Database backup failed:', error)
    return null
  }
}

// Clean up old backups (keep last 5)
export const cleanupOldBackups = async (): Promise<void> => {
  try {
    const fs = await import('fs')
    const path = await import('path')
    
    const backupDir = './backups'
    
    if (!fs.existsSync(backupDir)) {
      return
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('swiftship-backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        mtime: fs.statSync(path.join(backupDir, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    
    // Keep only the 5 most recent backups
    const filesToDelete = files.slice(5)
    
    for (const file of filesToDelete) {
      fs.unlinkSync(file.path)
      console.log(`Deleted old backup: ${file.name}`)
    }
  } catch (error) {
    console.error('Failed to cleanup old backups:', error)
  }
}