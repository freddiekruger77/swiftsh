// PostgreSQL index management utilities for query optimization

import { PoolClient } from 'pg'

// Index definitions optimized for SwiftShip application query patterns
export const INDEX_DEFINITIONS = {
  // Primary lookup indexes - Critical for core functionality
  primary_lookups: {
    packages_tracking_number: {
      name: 'idx_packages_tracking_number',
      table: 'packages',
      columns: ['tracking_number'],
      unique: false,
      description: 'Fast lookup by tracking number (most common query)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_packages_tracking_number ON packages(tracking_number)'
    },
    status_updates_package_id: {
      name: 'idx_status_updates_package_id',
      table: 'status_updates',
      columns: ['package_id'],
      unique: false,
      description: 'Fast lookup of status history for packages',
      sql: 'CREATE INDEX IF NOT EXISTS idx_status_updates_package_id ON status_updates(package_id)'
    }
  },

  // Timestamp indexes - For sorting and filtering by date
  timestamp_indexes: {
    status_updates_timestamp: {
      name: 'idx_status_updates_timestamp',
      table: 'status_updates',
      columns: ['timestamp DESC'],
      unique: false,
      description: 'Sort status updates by timestamp (newest first)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_status_updates_timestamp ON status_updates(timestamp DESC)'
    },
    packages_last_updated: {
      name: 'idx_packages_last_updated',
      table: 'packages',
      columns: ['last_updated DESC'],
      unique: false,
      description: 'Sort packages by last update (admin dashboard)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_packages_last_updated ON packages(last_updated DESC)'
    },
    contact_submissions_submitted_at: {
      name: 'idx_contact_submissions_submitted_at',
      table: 'contact_submissions',
      columns: ['submitted_at DESC'],
      unique: false,
      description: 'Sort contact submissions by date (admin dashboard)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at ON contact_submissions(submitted_at DESC)'
    }
  },

  // Status filtering indexes - For admin dashboard queries
  status_indexes: {
    packages_status: {
      name: 'idx_packages_status',
      table: 'packages',
      columns: ['status'],
      unique: false,
      description: 'Filter packages by status (admin dashboard)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)'
    },
    contact_submissions_resolved: {
      name: 'idx_contact_submissions_resolved',
      table: 'contact_submissions',
      columns: ['resolved'],
      unique: false,
      description: 'Filter contact submissions by resolution status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contact_submissions_resolved ON contact_submissions(resolved)'
    }
  },

  // Composite indexes - For complex queries combining multiple conditions
  composite_indexes: {
    packages_status_updated: {
      name: 'idx_packages_status_updated',
      table: 'packages',
      columns: ['status', 'last_updated DESC'],
      unique: false,
      description: 'Filter by status and sort by update time (admin dashboard)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_packages_status_updated ON packages(status, last_updated DESC)'
    },
    status_updates_package_timestamp: {
      name: 'idx_status_updates_package_timestamp',
      table: 'status_updates',
      columns: ['package_id', 'timestamp DESC'],
      unique: false,
      description: 'Get status history for package sorted by time',
      sql: 'CREATE INDEX IF NOT EXISTS idx_status_updates_package_timestamp ON status_updates(package_id, timestamp DESC)'
    },
    contact_submissions_resolved_date: {
      name: 'idx_contact_submissions_resolved_date',
      table: 'contact_submissions',
      columns: ['resolved', 'submitted_at DESC'],
      unique: false,
      description: 'Filter by resolution status and sort by date',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contact_submissions_resolved_date ON contact_submissions(resolved, submitted_at DESC)'
    }
  }
}

// Get all index SQL statements
export const getAllIndexSQL = (): string[] => {
  const allIndexes: string[] = []
  
  Object.values(INDEX_DEFINITIONS).forEach(category => {
    Object.values(category).forEach(index => {
      allIndexes.push(index.sql)
    })
  })
  
  return allIndexes
}

// Get all index names
export const getAllIndexNames = (): string[] => {
  const allNames: string[] = []
  
  Object.values(INDEX_DEFINITIONS).forEach(category => {
    Object.values(category).forEach(index => {
      allNames.push(index.name)
    })
  })
  
  return allNames
}

// Create all indexes with progress tracking
export const createAllIndexes = async (client: PoolClient): Promise<{
  success: boolean
  created: string[]
  failed: { name: string; error: string }[]
  total: number
}> => {
  console.log('Creating PostgreSQL indexes for query optimization...')
  
  const created: string[] = []
  const failed: { name: string; error: string }[] = []
  const allIndexes = getAllIndexSQL()
  const allNames = getAllIndexNames()
  
  for (let i = 0; i < allIndexes.length; i++) {
    const sql = allIndexes[i]
    const name = allNames[i]
    
    try {
      console.log(`Creating index ${i + 1}/${allIndexes.length}: ${name}`)
      await client.query(sql)
      created.push(name)
      console.log(`✓ Index ${name} created successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`✗ Failed to create index ${name}: ${errorMessage}`)
      failed.push({ name, error: errorMessage })
    }
  }
  
  const success = failed.length === 0
  console.log(`Index creation completed: ${created.length} created, ${failed.length} failed`)
  
  if (failed.length > 0) {
    console.warn('Failed indexes:', failed.map(f => f.name).join(', '))
  }
  
  return {
    success,
    created,
    failed,
    total: allIndexes.length
  }
}

// Create indexes by category
export const createIndexesByCategory = async (
  client: PoolClient, 
  category: keyof typeof INDEX_DEFINITIONS
): Promise<{
  success: boolean
  created: string[]
  failed: { name: string; error: string }[]
}> => {
  console.log(`Creating ${category} indexes...`)
  
  const created: string[] = []
  const failed: { name: string; error: string }[] = []
  const categoryIndexes = INDEX_DEFINITIONS[category]
  
  for (const [key, index] of Object.entries(categoryIndexes)) {
    try {
      console.log(`Creating ${category} index: ${index.name}`)
      await client.query(index.sql)
      created.push(index.name)
      console.log(`✓ Index ${index.name} created successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`✗ Failed to create index ${index.name}: ${errorMessage}`)
      failed.push({ name: index.name, error: errorMessage })
    }
  }
  
  const success = failed.length === 0
  console.log(`${category} index creation completed: ${created.length} created, ${failed.length} failed`)
  
  return {
    success,
    created,
    failed
  }
}

// Verify index existence
export const verifyIndexes = async (client: PoolClient): Promise<{
  success: boolean
  existing: string[]
  missing: string[]
  total: number
}> => {
  try {
    console.log('Verifying PostgreSQL indexes...')
    
    // Get all existing indexes
    const result = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `)
    
    const existingIndexes = result.rows.map(row => row.indexname)
    const expectedIndexes = getAllIndexNames()
    
    const existing: string[] = []
    const missing: string[] = []
    
    for (const expectedIndex of expectedIndexes) {
      if (existingIndexes.includes(expectedIndex)) {
        existing.push(expectedIndex)
      } else {
        missing.push(expectedIndex)
      }
    }
    
    const success = missing.length === 0
    
    console.log(`Index verification completed: ${existing.length} existing, ${missing.length} missing`)
    
    if (missing.length > 0) {
      console.warn('Missing indexes:', missing.join(', '))
    }
    
    return {
      success,
      existing,
      missing,
      total: expectedIndexes.length
    }
    
  } catch (error) {
    console.error('Index verification failed:', error)
    return {
      success: false,
      existing: [],
      missing: getAllIndexNames(),
      total: getAllIndexNames().length
    }
  }
}

// Drop all application indexes (for cleanup/reset)
export const dropAllIndexes = async (client: PoolClient): Promise<{
  success: boolean
  dropped: string[]
  failed: { name: string; error: string }[]
}> => {
  console.log('Dropping all application indexes...')
  
  const dropped: string[] = []
  const failed: { name: string; error: string }[] = []
  const indexNames = getAllIndexNames()
  
  for (const indexName of indexNames) {
    try {
      console.log(`Dropping index: ${indexName}`)
      await client.query(`DROP INDEX IF EXISTS ${indexName}`)
      dropped.push(indexName)
      console.log(`✓ Index ${indexName} dropped successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`✗ Failed to drop index ${indexName}: ${errorMessage}`)
      failed.push({ name: indexName, error: errorMessage })
    }
  }
  
  const success = failed.length === 0
  console.log(`Index dropping completed: ${dropped.length} dropped, ${failed.length} failed`)
  
  return {
    success,
    dropped,
    failed
  }
}

// Get index usage statistics (PostgreSQL specific)
export const getIndexStats = async (client: PoolClient): Promise<{
  success: boolean
  stats: Array<{
    indexName: string
    tableName: string
    scans: number
    tuplesRead: number
    tuplesReturned: number
  }>
  error?: string
}> => {
  try {
    console.log('Retrieving index usage statistics...')
    
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_returned
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY idx_scan DESC
    `)
    
    const stats = result.rows.map(row => ({
      indexName: row.indexname,
      tableName: row.tablename,
      scans: parseInt(row.scans) || 0,
      tuplesRead: parseInt(row.tuples_read) || 0,
      tuplesReturned: parseInt(row.tuples_returned) || 0
    }))
    
    console.log(`Retrieved statistics for ${stats.length} indexes`)
    
    return {
      success: true,
      stats
    }
    
  } catch (error) {
    console.error('Failed to retrieve index statistics:', error)
    return {
      success: false,
      stats: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Analyze index performance and suggest optimizations
export const analyzeIndexPerformance = async (client: PoolClient): Promise<{
  success: boolean
  analysis: {
    totalIndexes: number
    activeIndexes: number
    unusedIndexes: string[]
    heavilyUsedIndexes: Array<{ name: string; scans: number }>
    recommendations: string[]
  }
  error?: string
}> => {
  try {
    console.log('Analyzing index performance...')
    
    const statsResult = await getIndexStats(client)
    
    if (!statsResult.success) {
      throw new Error(statsResult.error || 'Failed to get index statistics')
    }
    
    const stats = statsResult.stats
    const totalIndexes = stats.length
    const activeIndexes = stats.filter(s => s.scans > 0).length
    const unusedIndexes = stats.filter(s => s.scans === 0).map(s => s.indexName)
    const heavilyUsedIndexes = stats
      .filter(s => s.scans > 100)
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 5)
      .map(s => ({ name: s.indexName, scans: s.scans }))
    
    const recommendations: string[] = []
    
    if (unusedIndexes.length > 0) {
      recommendations.push(`Consider reviewing ${unusedIndexes.length} unused indexes: ${unusedIndexes.slice(0, 3).join(', ')}${unusedIndexes.length > 3 ? '...' : ''}`)
    }
    
    if (heavilyUsedIndexes.length > 0) {
      recommendations.push(`Top performing indexes: ${heavilyUsedIndexes.slice(0, 2).map(i => i.name).join(', ')}`)
    }
    
    if (activeIndexes / totalIndexes < 0.5) {
      recommendations.push('Less than 50% of indexes are being used - consider index cleanup')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Index performance looks good - no immediate optimizations needed')
    }
    
    console.log(`Index analysis completed: ${activeIndexes}/${totalIndexes} active indexes`)
    
    return {
      success: true,
      analysis: {
        totalIndexes,
        activeIndexes,
        unusedIndexes,
        heavilyUsedIndexes,
        recommendations
      }
    }
    
  } catch (error) {
    console.error('Index performance analysis failed:', error)
    return {
      success: false,
      analysis: {
        totalIndexes: 0,
        activeIndexes: 0,
        unusedIndexes: [],
        heavilyUsedIndexes: [],
        recommendations: ['Analysis failed - unable to provide recommendations']
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}