// Updated health endpoint for PostgreSQL/Neon DB
import type { NextApiRequest, NextApiResponse } from 'next'
import { performQuickHealthCheck } from '../../lib/postgresHealthCheck'

type HealthResponse = {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  database: {
    status: 'connected' | 'disconnected'
    message: string
    latency?: number
    type: 'postgresql'
  }
  environment: string
  uptime: number
  platform: string
  deployment: {
    region?: string
    function?: string
    netlifyUrl?: string
  }
  diagnostics?: {
    available: boolean
    endpoint: string
  }
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
        message: 'Method not allowed',
        type: 'postgresql'
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      platform: 'netlify',
      deployment: {
        region: process.env.NETLIFY_REGION,
        function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
        netlifyUrl: process.env.NETLIFY_URL || process.env.URL
      },
      diagnostics: {
        available: true,
        endpoint: '/.netlify/functions/diagnostics-postgres'
      }
    })
  }

  try {
    // Perform quick PostgreSQL health check
    const healthResult = await performQuickHealthCheck()

    const response: HealthResponse = {
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      database: {
        status: healthResult.healthy ? 'connected' : 'disconnected',
        message: healthResult.healthy 
          ? `PostgreSQL connection successful (${healthResult.latency}ms)` 
          : healthResult.error || 'PostgreSQL connection failed',
        latency: healthResult.latency,
        type: 'postgresql'
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      platform: 'netlify',
      deployment: {
        region: process.env.NETLIFY_REGION,
        function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
        netlifyUrl: process.env.NETLIFY_URL || process.env.URL
      },
      diagnostics: {
        available: true,
        endpoint: '/.netlify/functions/diagnostics-postgres'
      }
    }

    // Set appropriate status code
    const statusCode = healthResult.healthy ? 200 : 503

    // Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(statusCode).json(response)
  } catch (error) {
    console.error('PostgreSQL health check error:', error)
    
    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      database: {
        status: 'disconnected',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'postgresql'
      },
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      platform: 'netlify',
      deployment: {
        region: process.env.NETLIFY_REGION,
        function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
        netlifyUrl: process.env.NETLIFY_URL || process.env.URL
      },
      diagnostics: {
        available: true,
        endpoint: '/.netlify/functions/diagnostics-postgres'
      }
    }

    return res.status(503).json(errorResponse)
  }
}