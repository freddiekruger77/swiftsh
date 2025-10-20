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

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const { getDatabase } = await import('./db')
    const db = await getDatabase()
    
    // Simple query to check if database is accessible
    return new Promise((resolve) => {
      db.get('SELECT 1 as test', (err, row) => {
        if (err) {
          console.error('Database health check failed:', err)
          resolve(false)
        } else {
          console.log('Database health check passed')
          resolve(true)
        }
      })
    })
  } catch (error) {
    console.error('Database health check error:', error)
    return false
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