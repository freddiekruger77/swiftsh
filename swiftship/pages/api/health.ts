import type { NextApiRequest, NextApiResponse } from 'next'
import { checkDatabaseHealth } from '@/lib/dbInit'

type HealthResponse = {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  database: {
    status: 'connected' | 'disconnected'
    message: string
  }
  environment: string
  uptime: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      database: {
        status: 'disconnected',
        message: 'Method not allowed'
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    })
  }

  const startTime = Date.now()
  
  try {
    // Check database health
    const isDatabaseHealthy = await checkDatabaseHealth()
    const responseTime = Date.now() - startTime

    const response: HealthResponse = {
      status: isDatabaseHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      database: {
        status: isDatabaseHealthy ? 'connected' : 'disconnected',
        message: isDatabaseHealthy 
          ? `Database connection successful (${responseTime}ms)` 
          : 'Database connection failed'
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    }

    // Set appropriate status code
    const statusCode = isDatabaseHealthy ? 200 : 503

    // Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(statusCode).json(response)
  } catch (error) {
    console.error('Health check error:', error)
    
    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      database: {
        status: 'disconnected',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    }

    return res.status(503).json(errorResponse)
  }
}