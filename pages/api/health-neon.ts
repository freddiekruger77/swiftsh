import type { NextApiRequest, NextApiResponse } from 'next'
import { validateConnection, getPoolStatus, validateNeonConfig } from '../../lib/neonDb'
import { validateNeonEnvironment, getConfigurationSummary } from '../../lib/configValidation'

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  database: {
    connected: boolean
    latency?: number
    error?: string
    pool: {
      totalConnections: number
      idleConnections: number
      activeConnections: number
    }
  }
  configuration: {
    valid: boolean
    errors: string[]
    warnings: string[]
    summary: any
  }
  environment: {
    nodeEnv: string
    isServerless: boolean
    platform: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse>
) {
  const startTime = Date.now()
  
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          error: 'Method not allowed',
          pool: { totalConnections: 0, idleConnections: 0, activeConnections: 0 }
        },
        configuration: {
          valid: false,
          errors: ['Method not allowed'],
          warnings: [],
          summary: {}
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          isServerless: !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME),
          platform: process.platform
        }
      })
    }

    // Validate configuration
    const configValidation = validateNeonEnvironment()
    const configSummary = getConfigurationSummary()
    
    // Validate Neon DB specific configuration
    const neonConfigValidation = validateNeonConfig()
    
    // Combine configuration errors
    const allConfigErrors = [
      ...configValidation.errors,
      ...neonConfigValidation.errors
    ]
    
    // Get pool status
    const poolStatus = getPoolStatus()
    
    // Test database connection if configuration is valid
    let connectionResult: {
      valid: boolean
      error?: string
      latency?: number
    } = {
      valid: false,
      error: 'Configuration invalid',
      latency: undefined
    }
    
    if (allConfigErrors.length === 0) {
      try {
        connectionResult = await validateConnection(5000) // 5 second timeout
      } catch (error) {
        connectionResult = {
          valid: false,
          error: error instanceof Error ? error.message : 'Unknown connection error',
          latency: undefined
        }
      }
    }
    
    // Determine overall health status
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    
    if (allConfigErrors.length > 0 || !connectionResult.valid) {
      status = 'unhealthy'
    } else if (configValidation.warnings.length > 0 || (connectionResult.latency && connectionResult.latency > 1000)) {
      status = 'degraded'
    }
    
    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      database: {
        connected: connectionResult.valid,
        latency: connectionResult.latency,
        error: connectionResult.error,
        pool: poolStatus
      },
      configuration: {
        valid: allConfigErrors.length === 0,
        errors: allConfigErrors,
        warnings: configValidation.warnings,
        summary: configSummary
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        isServerless: !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL),
        platform: process.platform
      }
    }
    
    // Set appropriate HTTP status code
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503
    
    // Add response headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')
    
    return res.status(httpStatus).json(response)
    
  } catch (error) {
    console.error('Health check error:', error)
    
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pool: { totalConnections: 0, idleConnections: 0, activeConnections: 0 }
      },
      configuration: {
        valid: false,
        errors: ['Health check failed'],
        warnings: [],
        summary: {}
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        isServerless: !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME),
        platform: process.platform
      }
    }
    
    return res.status(503).json(errorResponse)
  }
}