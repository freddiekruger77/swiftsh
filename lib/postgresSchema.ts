// PostgreSQL schema creation utilities for Neon DB migration

import { Pool, PoolClient } from 'pg'

// PostgreSQL schema DDL statements converted from SQLite
export const POSTGRES_SCHEMA = {
  // Main packages table with PostgreSQL-compatible data types
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

  // Status updates table with foreign key relationship
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

  // Contact submissions table with PostgreSQL boolean type
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

// PostgreSQL indexes for query optimization
export const POSTGRES_INDEXES = {
  // Primary lookup indexes
  packages_tracking_number: 'CREATE INDEX IF NOT EXISTS idx_packages_tracking_number ON packages(tracking_number)',
  status_updates_package_id: 'CREATE INDEX IF NOT EXISTS idx_status_updates_package_id ON status_updates(package_id)',
  
  // Query optimization indexes
  status_updates_timestamp: 'CREATE INDEX IF NOT EXISTS idx_status_updates_timestamp ON status_updates(timestamp DESC)',
  contact_submissions_submitted_at: 'CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at ON contact_submissions(submitted_at DESC)',
  packages_status: 'CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)',
  packages_last_updated: 'CREATE INDEX IF NOT EXISTS idx_packages_last_updated ON packages(last_updated DESC)',
  
  // Composite indexes for complex queries
  packages_status_updated: 'CREATE INDEX IF NOT EXISTS idx_packages_status_updated ON packages(status, last_updated DESC)',
  status_updates_package_timestamp: 'CREATE INDEX IF NOT EXISTS idx_status_updates_package_timestamp ON status_updates(package_id, timestamp DESC)'
}

// Schema creation function with transaction safety
export const createPostgresSchema = async (client: PoolClient): Promise<void> => {
  try {
    console.log('Starting PostgreSQL schema creation...')
    
    // Begin transaction for atomic schema creation
    await client.query('BEGIN')
    
    // Create tables in dependency order
    const tableOrder = ['packages', 'status_updates', 'contact_submissions']
    
    for (const tableName of tableOrder) {
      const sql = POSTGRES_SCHEMA[tableName as keyof typeof POSTGRES_SCHEMA]
      console.log(`Creating table: ${tableName}`)
      await client.query(sql)
      console.log(`✓ Table ${tableName} created successfully`)
    }
    
    // Commit transaction
    await client.query('COMMIT')
    console.log('PostgreSQL schema creation completed successfully')
    
  } catch (error) {
    // Rollback on error
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error('Failed to rollback schema creation:', rollbackError)
    }
    
    console.error('PostgreSQL schema creation failed:', error)
    throw new Error(`Schema creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Index creation function with error handling
export const createPostgresIndexes = async (client: PoolClient): Promise<void> => {
  try {
    console.log('Starting PostgreSQL index creation...')
    
    const indexNames = Object.keys(POSTGRES_INDEXES)
    const createdIndexes: string[] = []
    const failedIndexes: string[] = []
    
    for (const indexName of indexNames) {
      try {
        const sql = POSTGRES_INDEXES[indexName as keyof typeof POSTGRES_INDEXES]
        console.log(`Creating index: ${indexName}`)
        await client.query(sql)
        createdIndexes.push(indexName)
        console.log(`✓ Index ${indexName} created successfully`)
      } catch (error) {
        console.warn(`Failed to create index ${indexName}:`, error instanceof Error ? error.message : 'Unknown error')
        failedIndexes.push(indexName)
      }
    }
    
    console.log(`Index creation completed: ${createdIndexes.length} created, ${failedIndexes.length} failed`)
    
    if (failedIndexes.length > 0) {
      console.warn('Failed indexes:', failedIndexes.join(', '))
    }
    
  } catch (error) {
    console.error('PostgreSQL index creation failed:', error)
    throw new Error(`Index creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Verify schema creation
export const verifyPostgresSchema = async (client: PoolClient): Promise<{
  success: boolean
  tables: { name: string; exists: boolean; columns: number }[]
  indexes: { name: string; exists: boolean }[]
  error?: string
}> => {
  try {
    console.log('Verifying PostgreSQL schema...')
    
    // Check tables
    const tableResults = await client.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name IN ('packages', 'status_updates', 'contact_submissions')
      ORDER BY table_name
    `)
    
    const expectedTables = ['packages', 'status_updates', 'contact_submissions']
    const tables = expectedTables.map(tableName => {
      const tableInfo = tableResults.rows.find(row => row.table_name === tableName)
      return {
        name: tableName,
        exists: !!tableInfo,
        columns: tableInfo ? parseInt(tableInfo.column_count) : 0
      }
    })
    
    // Check indexes
    const indexResults = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `)
    
    const expectedIndexes = Object.keys(POSTGRES_INDEXES)
    const indexes = expectedIndexes.map(indexName => {
      const actualIndexName = `idx_${indexName.replace(/^packages_|^status_updates_|^contact_submissions_/, '')}`
      const exists = indexResults.rows.some(row => 
        row.indexname.includes(indexName.split('_').slice(-1)[0]) ||
        row.indexname === `idx_${indexName}`
      )
      return {
        name: indexName,
        exists
      }
    })
    
    const allTablesExist = tables.every(t => t.exists)
    const allIndexesExist = indexes.every(i => i.exists)
    
    console.log('Schema verification results:')
    console.log('Tables:', tables)
    console.log('Indexes:', indexes)
    
    return {
      success: allTablesExist,
      tables,
      indexes,
      error: allTablesExist ? undefined : 'Some tables are missing'
    }
    
  } catch (error) {
    console.error('Schema verification failed:', error)
    return {
      success: false,
      tables: [],
      indexes: [],
      error: error instanceof Error ? error.message : 'Unknown verification error'
    }
  }
}

// Complete schema setup function
export const setupPostgresSchema = async (client: PoolClient): Promise<{
  success: boolean
  tablesCreated: number
  indexesCreated: number
  error?: string
}> => {
  try {
    console.log('Setting up complete PostgreSQL schema...')
    
    // Create schema
    await createPostgresSchema(client)
    
    // Create indexes
    await createPostgresIndexes(client)
    
    // Verify setup
    const verification = await verifyPostgresSchema(client)
    
    if (!verification.success) {
      throw new Error(verification.error || 'Schema verification failed')
    }
    
    const tablesCreated = verification.tables.filter(t => t.exists).length
    const indexesCreated = verification.indexes.filter(i => i.exists).length
    
    console.log(`Schema setup completed: ${tablesCreated} tables, ${indexesCreated} indexes`)
    
    return {
      success: true,
      tablesCreated,
      indexesCreated
    }
    
  } catch (error) {
    console.error('Schema setup failed:', error)
    return {
      success: false,
      tablesCreated: 0,
      indexesCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown setup error'
    }
  }
}