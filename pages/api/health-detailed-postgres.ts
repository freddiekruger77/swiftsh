// Detailed health endpoint for PostgreSQL/Neon DB
import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  performPostgresHealthCheck, 
  getDetailedPoolMetrics,
  collectDatabaseDiagnostics 
} from '../../lib/postgresHealthCheck'

interface DetailedHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  environment: string
  platform: string
  uptime: number
  responseTime: number
  database: {
    status: 'connected' | 'disconnected' | 'error' | 'degraded'
    type: 'postgresql'
    connection: {
      latency: number
      ssl: boolean
      version?: string
    }
    pool: {
      totalConnections: number
      activeConnections: number
      idleConnections: number
      maxConnections: number
      efficiency: number
    }
    operations: {
      canRead: boolean
      canWrite: boolean
      canTransaction: boolean
      readLatency: number
      writeLatency: number
    }
    structure: {
      tablesExist: boolean
      indexesExist: boolean
      foreignKeysExist: boolean
      tableCount: number
      indexCount: number
    }
    performance: {
      avgQueryTime: number
      slowQueries: number
      cacheHitRatio: number
      diskUsage: {
        totalSize: string
        totalSizeBytes: number
      }
    }
  }
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    nodeVersion: string
    platform: string
    architecture: string
  }
  deployment: {
    region?: string
    function?: string
    netlifyUrl?: string
  }
  recommendations: string[]
  warnings: string[]
  errors: string[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DetailedHealthResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      platform: 'netlify',
      uptime: process.uptime(),
      responseTime: 0,
      database: {
        status: 'error',
        type: 'postgresql',
        connection: { latency: 0, ssl: false },
        pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 0, efficiency: 0 },
        operations: { canRead: false, canWrite: false, canTransaction: false, readLatency: 0, writeLatency: 0 },
        structure: { tablesExist: false, indexesExist: false, foreignKeysExist: false, tableCount: 0, indexCount: 0 },
        performance: { avgQueryTime: 0, slowQueries: 0, cacheHitRatio: 0, diskUsage: { totalSize: '0 B', totalSizeBytes: 0 } }
      },
      system: getSystemInfo(),
      deployment: getDeploymentInfo(),
      recommendations: ['Use GET method for health check'],
      warnings: [],
      errors: ['Method not allowed']
    })
  }

  const startTime = Date.now()

  try {
    // Perform comprehensive PostgreSQL health check
    const healthResult = await performPostgresHealthCheck()
    
    // Get detailed pool metrics
    const poolMetrics = await getDetailedPoolMetrics()
    
    // Determine database status
    let dbStatus: 'connected' | 'disconnected' | 'error' | 'degraded' = 'disconnected'
    if (healthResult.healthy) {
      dbStatus = 'connected'
    } else if (healthResult.details.connection.canConnect && 
               (healthResult.details.queries.canRead || healthResult.details.queries.canWrite)) {
      dbStatus = 'degraded'
    } else if (healthResult.errors.length > 0) {
      dbStatus = 'error'
    }

    // Generate additional recommendations
    const recommendations = [...poolMetrics.recommendations]
    
    if (healthResult.details.performance.avgQueryTime > 1000) {
      recommendations.push('Average query time is high - consider query optimization')
    }
    
    if (healthResult.details.performance.cacheHitRatio < 90) {
      recommendations.push('Cache hit ratio is low - consider increasing shared_buffers')
    }
    
    if (healthResult.details.pool.activeConnections / healthResult.details.pool.maxConnections > 0.8) {
      recommendations.push('Connection pool utilization is high - consider scaling')
    }

    // System health recommendations
    const memoryUsage = process.memoryUsage()
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    
    if (memoryPercentage > 80) {
      recommendations.push('High memory usage detected - consider optimizing memory consumption')
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    if (!healthResult.healthy) {
      if (dbStatus === 'degraded') {
        overallStatus = 'degraded'
      } else {
        overallStatus = 'unhealthy'
      }
    } else if (healthResult.warnings.length > 0) {
      overallStatus = 'degraded'
    }

    const response: DetailedHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      platform: 'netlify',
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      database: {
        status: dbStatus,
        type: 'postgresql',
        connection: {
          latency: healthResult.details.connection.latency,
          ssl: healthResult.details.connection.ssl,
          version: healthResult.details.connection.version
        },
        pool: {
          totalConnections: healthResult.details.pool.totalConnections,
          activeConnections: healthResult.details.pool.activeConnections,
          idleConnections: healthResult.details.pool.idleConnections,
          maxConnections: healthResult.details.pool.maxConnections,
          efficiency: healthResult.details.performance.connectionPoolEfficiency
        },
        operations: {
          canRead: healthResult.details.queries.canRead,
          canWrite: healthResult.details.queries.canWrite,
          canTransaction: healthResult.details.queries.canTransaction,
          readLatency: healthResult.details.queries.readLatency,
          writeLatency: healthResult.details.queries.writeLatency
        },
        structure: {
          tablesExist: healthResult.details.constraints.tablesExist,
          indexesExist: healthResult.details.constraints.indexesExist,
          foreignKeysExist: healthResult.details.constraints.foreignKeysExist,
          tableCount: healthResult.details.constraints.tableCount,
          indexCount: healthResult.details.constraints.indexCount
        },
        performance: {
          avgQueryTime: healthResult.details.performance.avgQueryTime,
          slowQueries: healthResult.details.performance.slowQueries,
          cacheHitRatio: healthResult.details.performance.cacheHitRatio,
          diskUsage: {
            totalSize: healthResult.details.performance.diskUsage.totalSize,
            totalSizeBytes: healthResult.details.performance.diskUsage.totalSizeBytes
          }
        }
      },
      system: getSystemInfo(),
      deployment: getDeploymentInfo(),
      recommendations,
      warnings: healthResult.warnings,
      errors: healthResult.errors
    }

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : (overallStatus === 'degraded' ? 200 : 503)

    // Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(statusCode).json(response)
  } catch (error) {
    console.error('Detailed PostgreSQL health check error:', error)
    
    const errorResponse: DetailedHealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      platform: 'netlify',
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      database: {
        status: 'error',
        type: 'postgresql',
        connection: { latency: 0, ssl: false },
        pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 0, efficiency: 0 },
        operations: { canRead: false, canWrite: false, canTransaction: false, readLatency: 0, writeLatency: 0 },
        structure: { tablesExist: false, indexesExist: false, foreignKeysExist: false, tableCount: 0, indexCount: 0 },
        performance: { avgQueryTime: 0, slowQueries: 0, cacheHitRatio: 0, diskUsage: { totalSize: '0 B', totalSizeBytes: 0 } }
      },
      system: getSystemInfo(),
      deployment: getDeploymentInfo(),
      recommendations: ['Check application logs for detailed error information'],
      warnings: [],
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }

    return res.status(503).json(errorResponse)
  }
}

function getSystemInfo() {
  const memoryUsage = process.memoryUsage()
  
  return {
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    },
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch
  }
}

function getDeploymentInfo() {
  return {
    region: process.env.NETLIFY_REGION,
    function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
    netlifyUrl: process.env.NETLIFY_URL || process.env.URL
  }
}