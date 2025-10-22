#!/usr/bin/env node

// JavaScript version of the migration script for environments without ts-node

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Simple migration configuration
const config = {
  neonConnectionString: process.env.NEON_DATABASE_URL || '',
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose')
}

// Parse connection string from command line
const connectionStringIndex = process.argv.indexOf('--connection-string')
if (connectionStringIndex !== -1 && process.argv[connectionStringIndex + 1]) {
  config.neonConnectionString = process.argv[connectionStringIndex + 1]
}

// Print help
if (process.argv.includes('--help')) {
  console.log(`
SwiftShip SQLite to PostgreSQL Migration Tool (JavaScript)

Usage: node scripts/migrate-to-postgres.js [options]

Options:
  --connection-string <url>  Neon database connection string
  --dry-run                  Test migration without transferring data
  --verbose                 Enable verbose logging
  --help                    Show this help message

Environment Variables:
  NEON_DATABASE_URL         Neon PostgreSQL connection string

Examples:
  node scripts/migrate-to-postgres.js
  node scripts/migrate-to-postgres.js --dry-run --verbose
  `)
  process.exit(0)
}

// PostgreSQL schema
const POSTGRES_SCHEMA = {
  packages: `
    CREATE TABLE IF NOT EXISTS packages (
      id VARCHAR(255) PRIMARY KEY,
      tracking_number VARCHAR(255) UNIQUE NOT NULL,
      status VARCHAR(50) NOT NULL,
      current_location TEXT NOT NULL,
      destination TEXT NOT NULL,
      estimated_delivery TIMESTAMP WITH TIME ZONE,
      last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
      customer_name VARCHAR(255),
      customer_email VARCHAR(255)
    )
  `,
  status_updates: `
    CREATE TABLE IF NOT EXISTS status_updates (
      id VARCHAR(255) PRIMARY KEY,
      package_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      location TEXT NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      notes TEXT,
      FOREIGN KEY (package_id) REFERENCES packages (id) ON DELETE CASCADE
    )
  `,
  contact_submissions: `
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
      resolved BOOLEAN DEFAULT FALSE
    )
  `
}

// Basic indexes
const POSTGRES_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_packages_tracking_number ON packages(tracking_number)',
  'CREATE INDEX IF NOT EXISTS idx_status_updates_package_id ON status_updates(package_id)',
  'CREATE INDEX IF NOT EXISTS idx_status_updates_timestamp ON status_updates(timestamp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_packages_last_updated ON packages(last_updated DESC)',
  'CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at ON contact_submissions(submitted_at DESC)'
]

// Validate prerequisites
const validatePrerequisites = () => {
  console.log('Validating migration prerequisites...')
  
  if (!config.neonConnectionString) {
    throw new Error('Neon database connection string is required. Set NEON_DATABASE_URL or use --connection-string')
  }
  
  if (!config.neonConnectionString.startsWith('postgresql://') && !config.neonConnectionString.startsWith('postgres://')) {
    throw new Error('Invalid PostgreSQL connection string format')
  }
  
  const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database not found at: ${dbPath}`)
  }
  
  console.log('✓ Prerequisites validated')
}

// Test PostgreSQL connection
const testConnection = async () => {
  console.log('Testing PostgreSQL connection...')
  
  const pool = new Pool({
    connectionString: config.neonConnectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    console.log('✓ PostgreSQL connection successful')
  } catch (error) {
    throw new Error(`PostgreSQL connection failed: ${error.message}`)
  } finally {
    await pool.end()
  }
}

// Create schema
const createSchema = async (client) => {
  console.log('Creating PostgreSQL schema...')
  
  await client.query('BEGIN')
  
  try {
    for (const [tableName, sql] of Object.entries(POSTGRES_SCHEMA)) {
      if (config.verbose) console.log(`Creating table: ${tableName}`)
      await client.query(sql)
    }
    
    for (const indexSql of POSTGRES_INDEXES) {
      if (config.verbose) console.log(`Creating index...`)
      await client.query(indexSql)
    }
    
    await client.query('COMMIT')
    console.log('✓ Schema created successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

// Simple dry run
const performDryRun = async () => {
  console.log('\n=== DRY RUN MODE ===')
  console.log('Testing migration process...\n')
  
  const pool = new Pool({
    connectionString: config.neonConnectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    const client = await pool.connect()
    
    // Test schema creation
    await createSchema(client)
    
    // Check SQLite data
    const sqlite3 = require('sqlite3')
    const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
    
    const db = new sqlite3.Database(dbPath)
    
    const packageCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM packages', (err, row) => {
        if (err) reject(err)
        else resolve(row.count)
      })
    })
    
    const statusCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM status_updates', (err, row) => {
        if (err) reject(err)
        else resolve(row.count)
      })
    })
    
    const contactCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM contact_submissions', (err, row) => {
        if (err) reject(err)
        else resolve(row.count)
      })
    })
    
    db.close()
    
    console.log(`✓ Found ${packageCount} packages, ${statusCount} status updates, ${contactCount} contact submissions`)
    console.log('✓ Dry run completed successfully - migration is ready to proceed')
    
    client.release()
  } catch (error) {
    console.error('✗ Dry run failed:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Main function
const main = async () => {
  try {
    console.log('SwiftShip SQLite to PostgreSQL Migration Tool')
    console.log('=' .repeat(50))
    
    if (config.verbose) {
      console.log('Configuration:')
      console.log(`  Connection String: ${config.neonConnectionString.replace(/:[^:@]*@/, ':***@')}`)
      console.log(`  Dry Run: ${config.dryRun}`)
      console.log('')
    }
    
    validatePrerequisites()
    await testConnection()
    
    if (config.dryRun) {
      await performDryRun()
    } else {
      console.log('\n⚠️  This is a simplified migration script.')
      console.log('For full migration with data transfer, use the TypeScript version:')
      console.log('npm run migrate:postgres')
      console.log('\nThis script only creates the schema. Use --dry-run to test.')
    }
    
  } catch (error) {
    console.error('\nMigration failed:', error.message)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
}

module.exports = { main }