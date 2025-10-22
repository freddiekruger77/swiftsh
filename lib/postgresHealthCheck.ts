// PostgreSQL health check and monitoring utilities for Neon DB
// Comprehensive health monitoring for connection pools, query performance, and diagnostics

import { PoolClient } from 'pg'
import { 
  getDatabase, 
  getPoolStatus, 
  validateConnection,
  validateNeonConfig 
} from './neonDb'

// Health check result interfaces
export interface DatabaseHealthResult {
  healthy: boolean
  timestamp: Date
  responseTime: number
  details: {
    connection: ConnectionHealth
    pool: PoolHealth
    queries: QueryHealth
    constraints: ConstraintHealth
    performance: PerformanceMetrics
  }
  errors: string[]
  warnings: string[]
}

export interface ConnectionHealth {
  canConnect: boolean
  latency: number
  ssl: boolean
  version?: string
  error?: string
}

export interface PoolHealth {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingClients: number
  maxConnections: number
  healthy: boolean
}

export interface QueryHealth {
  canRead: boolean
  canWrite: boolean
  canTransaction: boolean
  indexesWorking: boolean
  foreignKeysWorking: boolean
  readLatency: number
  writeLatency: number
}

export interface ConstraintHealth {
  tablesExist: boolean
  indexesExist: boolean
  foreignKeysExist: boolean
  constraintsValid: boolean
  tableCount: number
  indexCount: number
}

export interface PerformanceMetrics {
  avgQueryTime: number
  slowQueries: number
  connectionPoolEfficiency: number
  cacheHitRatio: number
  diskUsage: {
    totalSize: string
    totalSizeBytes: number
    tablesSizes: Array<{ table: string; size: string; sizeBytes: number }>
  }
}

// Comprehensive PostgreSQL health check
export const performPostgresHealthCheck = async (): Promise<DatabaseHealthResult> => {
  const startTime = Date.now()
  const result: DatabaseHealthResult = {
    healthy: false,
    timestamp: new Date(),
    responseTime: 0,
    details: {
      connection: { canConnect: false, latency: 0, ssl: false },
      pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, waitingClients: 0, maxConnections: 0, healthy: false },
      queries: { canRead: false, canWrite: false, canTransaction: false, indexesWorking: false, foreignKeysWorking: false, readLatency: 0, writeLatency: 0 },
      constraints: { tablesExist: false, indexesExist: false, foreignKeysExist: false, constraintsValid: false, tableCount: 0, indexCount: 0 },
      performance: { avgQueryTime: 0, slowQueries: 0, connectionPoolEfficiency: 0, cacheHitRatio: 0, diskUsage: { totalSize: '0 B', totalSizeBytes: 0, tablesSizes: [] } }
    },
    errors: [],
    warnings: []
  }

  try {
    // 1. Check configuration
    const configValidation = validateNeonConfig()
    if (!configValidation.valid) {
      result.errors.push(...configValidation.errors)
      return result
    }

    // 2. Test connection
    const connectionResult = await checkConnectionHealth()
    result.details.connection = connectionResult
    
    if (!connectionResult.canConnect) {
      result.errors.push(connectionResult.error || 'Cannot connect to database')
      return result
    }

    // 3. Check connection pool
    result.details.pool = checkPoolHealth()

    // 4. Test database operations
    const client = await getDatabase()
    try {
      result.details.queries = await checkQueryHealth(client)
      result.details.constraints = await checkConstraintHealth(client)
      result.details.performance = await checkPerformanceMetrics(client)
    } finally {
      client.release()
    }

    // 5. Determine overall health
    result.healthy = determineOverallHealth(result.details, result.errors, result.warnings)
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown health check error')
  } finally {
    result.responseTime = Date.now() - startTime
  }

  return result
}

// Check connection health
const checkConnectionHealth = async (): Promise<ConnectionHealth> => {
  const startTime = Date.now()
  
  try {
    const validation = await validateConnection(10000) // 10 second timeout
    
    if (!validation.valid) {
      return {
        canConnect: false,
        latency: Date.now() - startTime,
        ssl: false,
        error: validation.error
      }
    }

    // Get database version and SSL info
    const client = await getDatabase()
    let version: string | undefined
    let ssl = false
    
    try {
      const versionResult = await client.query('SELECT version()')
      version = versionResult.rows[0]?.version
      
      const sslResult = await client.query('SHOW ssl')
      ssl = sslResult.rows[0]?.ssl === 'on'
    } catch (error) {
      // Version/SSL check is optional
    } finally {
      client.release()
    }

    return {
      canConnect: true,
      latency: validation.latency || (Date.now() - startTime),
      ssl,
      version
    }
    
  } catch (error) {
    return {
      canConnect: false,
      latency: Date.now() - startTime,
      ssl: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

// Check connection pool health
const checkPoolHealth = (): PoolHealth => {
  const poolStatus = getPoolStatus()
  
  const healthy = poolStatus.connected && 
                  poolStatus.totalConnections > 0 && 
                  poolStatus.activeConnections < poolStatus.totalConnections * 0.9 // Less than 90% utilization
  
  return {
    totalConnections: poolStatus.totalConnections,
    activeConnections: poolStatus.activeConnections,
    idleConnections: poolStatus.idleConnections,
    waitingClients: 0, // pg pool doesn't expose this directly
    maxConnections: parseInt(process.env.NEON_MAX_CONNECTIONS || '10'),
    healthy
  }
}

// Check query operations health
const checkQueryHealth = async (client: PoolClient): Promise<QueryHealth> => {
  const result: QueryHealth = {
    canRead: false,
    canWrite: false,
    canTransaction: false,
    indexesWorking: false,
    foreignKeysWorking: false,
    readLatency: 0,
    writeLatency: 0
  }

  try {
    // Test read operations
    const readStart = Date.now()
    await client.query('SELECT 1 as test')
    result.readLatency = Date.now() - readStart
    result.canRead = true

    // Test write operations (using temp table)
    const writeStart = Date.now()
    const testId = `health_${Date.now()}`
    
    await client.query('CREATE TEMP TABLE IF NOT EXISTS health_test (id VARCHAR(255), created_at TIMESTAMP)')
    await client.query('INSERT INTO health_test (id, created_at) VALUES ($1, NOW())', [testId])
    await client.query('DELETE FROM health_test WHERE id = $1', [testId])
    
    result.writeLatency = Date.now() - writeStart
    result.canWrite = true

    // Test transaction operations
    await client.query('BEGIN')
    await client.query('INSERT INTO health_test (id, created_at) VALUES ($1, NOW())', [`tx_${testId}`])
    await client.query('ROLLBACK')
    result.canTransaction = true

    // Test indexes (check if they're being used)
    const indexTest = await client.query(`
      EXPLAIN (FORMAT JSON) 
      SELECT * FROM packages WHERE tracking_number = 'TEST123'
    `)
    
    const plan = indexTest.rows[0]?.['QUERY PLAN']?.[0]
    result.indexesWorking = plan && JSON.stringify(plan).includes('Index')

    // Test foreign keys (check constraint)
    try {
      await client.query('BEGIN')
      await client.query(`
        INSERT INTO status_updates (id, package_id, status, location, timestamp) 
        VALUES ('test', 'nonexistent', 'test', 'test', NOW())
      `)
      await client.query('ROLLBACK')
      result.foreignKeysWorking = false // Should have failed
    } catch (error) {
      await client.query('ROLLBACK')
      result.foreignKeysWorking = true // Failed as expected
    }

  } catch (error) {
    // Some operations failed, but we've captured what we can
  }

  return result
}

// Check database constraints and structure
const checkConstraintHealth = async (client: PoolClient): Promise<ConstraintHealth> => {
  const result: ConstraintHealth = {
    tablesExist: false,
    indexesExist: false,
    foreignKeysExist: false,
    constraintsValid: false,
    tableCount: 0,
    indexCount: 0
  }

  try {
    // Check tables
    const tablesResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('packages', 'status_updates', 'contact_submissions')
    `)
    
    result.tableCount = parseInt(tablesResult.rows[0].count)
    result.tablesExist = result.tableCount === 3

    // Check indexes
    const indexesResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    `)
    
    result.indexCount = parseInt(indexesResult.rows[0].count)
    result.indexesExist = result.indexCount > 0

    // Check foreign keys
    const fkResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public'
    `)
    
    const fkCount = parseInt(fkResult.rows[0].count)
    result.foreignKeysExist = fkCount > 0

    // Overall constraint validity
    result.constraintsValid = result.tablesExist && result.indexesExist && result.foreignKeysExist

  } catch (error) {
    // Constraint check failed
  }

  return result
}

// Check performance metrics
const checkPerformanceMetrics = async (client: PoolClient): Promise<PerformanceMetrics> => {
  const result: PerformanceMetrics = {
    avgQueryTime: 0,
    slowQueries: 0,
    connectionPoolEfficiency: 0,
    cacheHitRatio: 0,
    diskUsage: {
      totalSize: '0 B',
      totalSizeBytes: 0,
      tablesSizes: []
    }
  }

  try {
    // Get query statistics
    const queryStatsResult = await client.query(`
      SELECT 
        COALESCE(AVG(mean_exec_time), 0) as avg_time,
        COUNT(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries
      FROM pg_stat_statements 
      WHERE query NOT LIKE '%pg_stat_statements%'
      LIMIT 1
    `)
    
    if (queryStatsResult.rows.length > 0) {
      result.avgQueryTime = parseFloat(queryStatsResult.rows[0].avg_time) || 0
      result.slowQueries = parseInt(queryStatsResult.rows[0].slow_queries) || 0
    }

    // Get cache hit ratio
    const cacheResult = await client.query(`
      SELECT 
        CASE 
          WHEN (blks_hit + blks_read) = 0 THEN 0
          ELSE ROUND(blks_hit::numeric / (blks_hit + blks_read) * 100, 2)
        END as cache_hit_ratio
      FROM pg_stat_database 
      WHERE datname = current_database()
    `)
    
    if (cacheResult.rows.length > 0) {
      result.cacheHitRatio = parseFloat(cacheResult.rows[0].cache_hit_ratio) || 0
    }

    // Get database size
    const sizeResult = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size,
        pg_database_size(current_database()) as size_bytes
    `)
    
    if (sizeResult.rows.length > 0) {
      result.diskUsage.totalSize = sizeResult.rows[0].size
      result.diskUsage.totalSizeBytes = parseInt(sizeResult.rows[0].size_bytes)
    }

    // Get table sizes
    const tableSizesResult = await client.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `)
    
    result.diskUsage.tablesSizes = tableSizesResult.rows.map(row => ({
      table: row.tablename,
      size: row.size,
      sizeBytes: parseInt(row.size_bytes)
    }))

    // Calculate connection pool efficiency
    const poolStatus = getPoolStatus()
    if (poolStatus.totalConnections > 0) {
      result.connectionPoolEfficiency = (poolStatus.activeConnections / poolStatus.totalConnections) * 100
    }

  } catch (error) {
    // Performance metrics are optional
  }

  return result
}

// Determine overall health status
const determineOverallHealth = (
  details: DatabaseHealthResult['details'],
  errors: string[],
  warnings: string[]
): boolean => {
  // Critical requirements for health
  const criticalChecks = [
    details.connection.canConnect,
    details.pool.healthy,
    details.queries.canRead,
    details.queries.canWrite,
    details.constraints.tablesExist
  ]

  // All critical checks must pass
  const criticalHealth = criticalChecks.every(check => check)

  // Warning conditions (don't fail health but should be noted)
  if (details.performance.avgQueryTime > 1000) {
    warnings.push('Average query time is high (>1000ms)')
  }

  if (details.performance.cacheHitRatio < 90) {
    warnings.push('Cache hit ratio is low (<90%)')
  }

  if (details.pool.activeConnections / details.pool.maxConnections > 0.8) {
    warnings.push('Connection pool utilization is high (>80%)')
  }

  if (!details.queries.indexesWorking) {
    warnings.push('Database indexes may not be working optimally')
  }

  if (!details.queries.foreignKeysWorking) {
    warnings.push('Foreign key constraints may not be enforced')
  }

  return criticalHealth && errors.length === 0
}

// Quick health check (lightweight version)
export const performQuickHealthCheck = async (): Promise<{
  healthy: boolean
  latency: number
  error?: string
}> => {
  const startTime = Date.now()
  
  try {
    const validation = await validateConnection(5000) // 5 second timeout
    
    return {
      healthy: validation.valid,
      latency: validation.latency || (Date.now() - startTime),
      error: validation.error
    }
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Health check failed'
    }
  }
}

// Connection pool monitoring
export const getDetailedPoolMetrics = async (): Promise<{
  pool: PoolHealth
  connections: Array<{
    pid: number
    state: string
    queryStart?: Date
    stateChange?: Date
    query?: string
  }>
  recommendations: string[]
}> => {
  const recommendations: string[] = []
  const pool = checkPoolHealth()
  let connections: any[] = []

  try {
    const client = await getDatabase()
    
    try {
      const connectionsResult = await client.query(`
        SELECT 
          pid,
          state,
          query_start,
          state_change,
          LEFT(query, 100) as query
        FROM pg_stat_activity
        WHERE datname = current_database()
        AND pid != pg_backend_pid()
        ORDER BY query_start DESC
      `)
      
      connections = connectionsResult.rows.map(row => ({
        pid: row.pid,
        state: row.state,
        queryStart: row.query_start ? new Date(row.query_start) : undefined,
        stateChange: row.state_change ? new Date(row.state_change) : undefined,
        query: row.query
      }))
    } finally {
      client.release()
    }
  } catch (error) {
    // Connection details are optional
  }

  // Generate recommendations
  if (pool.activeConnections / pool.maxConnections > 0.8) {
    recommendations.push('Consider increasing max connections or optimizing query performance')
  }

  if (connections.filter(c => c.state === 'idle in transaction').length > 0) {
    recommendations.push('Some connections are idle in transaction - check for uncommitted transactions')
  }

  const longRunningQueries = connections.filter(c => 
    c.queryStart && (Date.now() - c.queryStart.getTime()) > 30000
  )
  
  if (longRunningQueries.length > 0) {
    recommendations.push(`${longRunningQueries.length} queries running for >30 seconds`)
  }

  return {
    pool,
    connections,
    recommendations
  }
}

// Database diagnostics collection
export const collectDatabaseDiagnostics = async (): Promise<{
  config: Record<string, any>
  stats: Record<string, any>
  locks: any[]
  replication: any[]
  extensions: string[]
}> => {
  const diagnostics = {
    config: {},
    stats: {},
    locks: [],
    replication: [],
    extensions: []
  }

  try {
    const client = await getDatabase()
    
    try {
      // Get important configuration settings
      const configResult = await client.query(`
        SELECT name, setting, unit, context 
        FROM pg_settings 
        WHERE name IN (
          'max_connections', 'shared_buffers', 'effective_cache_size',
          'maintenance_work_mem', 'checkpoint_completion_target',
          'wal_buffers', 'default_statistics_target'
        )
      `)
      
      diagnostics.config = configResult.rows.reduce((acc, row) => {
        acc[row.name] = {
          value: row.setting,
          unit: row.unit,
          context: row.context
        }
        return acc
      }, {})

      // Get database statistics
      const statsResult = await client.query(`
        SELECT 
          numbackends,
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted
        FROM pg_stat_database 
        WHERE datname = current_database()
      `)
      
      if (statsResult.rows.length > 0) {
        diagnostics.stats = statsResult.rows[0]
      }

      // Get current locks
      const locksResult = await client.query(`
        SELECT 
          locktype,
          mode,
          granted,
          pid,
          query_start
        FROM pg_locks l
        JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE NOT granted OR locktype != 'relation'
        ORDER BY query_start
      `)
      
      diagnostics.locks = locksResult.rows

      // Get installed extensions
      const extensionsResult = await client.query(`
        SELECT extname 
        FROM pg_extension 
        ORDER BY extname
      `)
      
      diagnostics.extensions = extensionsResult.rows.map(row => row.extname)

    } finally {
      client.release()
    }
  } catch (error) {
    // Diagnostics collection is optional
  }

  return diagnostics
}