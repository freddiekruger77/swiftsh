import type { NextApiRequest, NextApiResponse } from 'next'
import { checkDatabaseHealthDetailed, checkDatabaseHealthWithRetry } from '@/lib/dbInit'

interface DetailedHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  environment: string
  platform: string
  uptime: number
  database: {
    status: 'connected' | 'disconnected' | 'error' | 'degraded'
    connectionTime: number
    tablesExist: boolean
    canWrite: boolean
    canRead: boolean
    indexesExist: boolean
    diskSpace?: number
    tableCount: number
    indexCount: number
    error?: string
    retryAttempts?: number
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
      database: {
        status: 'error',
        connectionTime: 0,
        tablesExist: false,
        canWrite: false,
        canRead: false,
        indexesExist: false,
        tableCount: 0,
        indexCount: 0,
        error: 'Method not allowed'
      },
      system: getSystemInfo(),
      deployment: getDeploymentInfo(),
      recommendations: ['Use GET method for health check']
    })
  }

  const startTime = Date.now()
  const recommendations: string[] = []

  try {
    // Perform detailed database health check
    const dbHealth = await checkDatabaseHealthDetailed()
    
    // Determine database status
    let dbStatus: 'connected' | 'disconnected' | 'error' | 'degraded' = 'disconnected'
    if (dbHealth.healthy) {
      dbStatus = 'connected'
    } else if (dbHealth.details.basicConnectivity && (dbHealth.canRead || dbHealth.canWrite)) {
      dbStatus = 'degraded'
    } else if (dbHealth.error) {
      dbStatus = 'error'
    }

    // Generate recommendations based on health check results
    if (!dbHealth.tablesExist) {
      recommendations.push('Database tables are missing - run database initialization')
    }
    if (!dbHealth.canWrite) {
      recommendations.push('Database write operations are failing - check file permissions')
    }
    if (!dbHealth.canRead) {
      recommendations.push('Database read operations are failing - check database integrity')
    }
    if (!dbHealth.indexesExist) {
      recommendations.push('Database indexes are missing - performance may be degraded')
    }
    if (dbHealth.connectionTime > 5000) {
      recommendations.push('Database connection is slow - consider optimizing database configuration')
    }

    // System health recommendations
    const memoryUsage = process.memoryUsage()
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    
    if (memoryPercentage > 80) {
      recommendations.push('High memory usage detected - consider optimizing memory consumption')
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    if (!dbHealth.healthy) {
      if (dbStatus === 'degraded') {
        overallStatus = 'degraded'
      } else {
        overallStatus = 'unhealthy'
      }
    }

    const response: DetailedHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      platform: 'netlify',
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        connectionTime: dbHealth.connectionTime,
        tablesExist: dbHealth.tablesExist,
        canWrite: dbHealth.canWrite,
        canRead: dbHealth.canRead,
        indexesExist: dbHealth.indexesExist,
        diskSpace: dbHealth.diskSpace,
        tableCount: dbHealth.details.tableCount,
        indexCount: dbHealth.details.indexCount,
        error: dbHealth.error
      },
      system: getSystemInfo(),
      deployment: getDeploymentInfo(),
      recommendations
    }

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : (overallStatus === 'degraded' ? 200 : 503)

    // Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(statusCode).json(response)
  } catch (error) {
    console.error('Detailed health check error:', error)
    
    const errorResponse: DetailedHealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      platform: 'netlify',
      uptime: process.uptime(),
      database: {
        status: 'error',
        connectionTime: Date.now() - startTime,
        tablesExist: false,
        canWrite: false,
        canRead: false,
        indexesExist: false,
        tableCount: 0,
        indexCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      system: getSystemInfo(),
      deployment: getDeploymentInfo(),
      recommendations: ['Check application logs for detailed error information']
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
