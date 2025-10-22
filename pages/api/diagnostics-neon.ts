import type { NextApiRequest, NextApiResponse } from 'next'
import { validateConnection, getPoolStatus, validateNeonConfig } from '../../lib/neonDb'
import { validateNeonEnvironment, getConfigurationSummary, getEnvironmentRecommendations } from '../../lib/configValidation'

interface DiagnosticsResponse {
  timestamp: string
  status: 'pass' | 'fail' | 'warn'
  checks: {
    configuration: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        environmentVariables: { [key: string]: 'present' | 'missing' | 'invalid' }
        validation: {
          valid: boolean
          errors: string[]
          warnings: string[]
        }
        summary: any
      }
    }
    database: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        connection: {
          connected: boolean
          latency?: number
          error?: string
        }
        pool: {
          totalConnections: number
          idleConnections: number
          activeConnections: number
          status: string
        }
      }
    }
    environment: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        nodeVersion: string
        platform: string
        isServerless: boolean
        memoryUsage: NodeJS.MemoryUsage
        uptime: number
      }
    }
  }
  recommendations: string[]
  troubleshooting: {
    commonIssues: Array<{
      issue: string
      solution: string
      priority: 'high' | 'medium' | 'low'
    }>
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnosticsResponse>
) {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({
        timestamp: new Date().toISOString(),
        status: 'fail',
        checks: {
          configuration: {
            status: 'fail',
            details: {
              environmentVariables: {},
              validation: { valid: false, errors: ['Method not allowed'], warnings: [] },
              summary: {}
            }
          },
          database: {
            status: 'fail',
            details: {
              connection: { connected: false, error: 'Method not allowed' },
              pool: { totalConnections: 0, idleConnections: 0, activeConnections: 0, status: 'unavailable' }
            }
          },
          environment: {
            status: 'fail',
            details: {
              nodeVersion: process.version,
              platform: process.platform,
              isServerless: false,
              memoryUsage: process.memoryUsage(),
              uptime: process.uptime()
            }
          }
        },
        recommendations: [],
        troubleshooting: { commonIssues: [] }
      })
    }

    // Check environment variables
    const envVars = [
      'NEON_DATABASE_URL',
      'NEON_MAX_CONNECTIONS',
      'NEON_IDLE_TIMEOUT',
      'NEON_CONNECTION_TIMEOUT',
      'NEXTAUTH_SECRET',
      'ADMIN_EMAIL',
      'ADMIN_PASSWORD',
      'NODE_ENV'
    ]
    
    const environmentVariables: { [key: string]: 'present' | 'missing' | 'invalid' } = {}
    
    envVars.forEach(varName => {
      const value = process.env[varName]
      if (!value) {
        environmentVariables[varName] = 'missing'
      } else if (varName.includes('CONNECTIONS') || varName.includes('TIMEOUT')) {
        // Validate numeric values
        environmentVariables[varName] = isNaN(parseInt(value)) ? 'invalid' : 'present'
      } else if (varName === 'NEON_DATABASE_URL') {
        // Validate connection string format
        environmentVariables[varName] = value.startsWith('postgresql://') ? 'present' : 'invalid'
      } else {
        environmentVariables[varName] = 'present'
      }
    })

    // Validate configuration
    const configValidation = validateNeonEnvironment()
    const neonConfigValidation = validateNeonConfig()
    const configSummary = getConfigurationSummary()
    
    const allConfigErrors = [...configValidation.errors, ...neonConfigValidation.errors]
    const configStatus = allConfigErrors.length === 0 ? 'pass' : 'fail'

    // Test database connection
    let connectionResult: {
      connected: boolean
      error?: string
      latency?: number
    } = {
      connected: false,
      error: 'Configuration invalid',
      latency: undefined
    }
    
    let poolStatus = {
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0,
      status: 'unavailable'
    }
    
    if (allConfigErrors.length === 0) {
      try {
        const connResult = await validateConnection(10000) // 10 second timeout
        connectionResult = {
          connected: connResult.valid,
          error: connResult.error,
          latency: connResult.latency
        }
        
        const poolInfo = getPoolStatus()
        poolStatus = {
          ...poolInfo,
          status: poolInfo.connected ? 'connected' : 'disconnected'
        }
      } catch (error) {
        connectionResult = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown connection error',
          latency: undefined
        }
      }
    }
    
    const databaseStatus = connectionResult.connected ? 'pass' : 'fail'

    // Environment checks
    const isServerless = !!(
      process.env.NETLIFY || 
      process.env.AWS_LAMBDA_FUNCTION_NAME || 
      process.env.VERCEL
    )
    
    const environmentStatus = 'pass' // Environment checks rarely fail

    // Overall status
    const overallStatus = configStatus === 'fail' || databaseStatus === 'fail' ? 'fail' : 
                         configValidation.warnings.length > 0 ? 'warn' : 'pass'

    // Get recommendations
    const recommendations = getEnvironmentRecommendations()

    // Add specific recommendations based on diagnostics
    if (connectionResult.latency && connectionResult.latency > 1000) {
      recommendations.push('High database latency detected - consider optimizing queries or checking network connectivity')
    }
    
    if (poolStatus.activeConnections > poolStatus.totalConnections * 0.8) {
      recommendations.push('Connection pool utilization is high - consider increasing NEON_MAX_CONNECTIONS')
    }
    
    if (isServerless && parseInt(process.env.NEON_MAX_CONNECTIONS || '10') > 20) {
      recommendations.push('High connection limit in serverless environment - consider reducing to prevent connection exhaustion')
    }

    // Common troubleshooting issues
    const commonIssues = [
      {
        issue: 'NEON_DATABASE_URL is missing or invalid',
        solution: 'Set NEON_DATABASE_URL to your Neon database connection string from the Neon dashboard',
        priority: 'high' as const
      },
      {
        issue: 'Database connection timeout',
        solution: 'Check network connectivity and increase NEON_CONNECTION_TIMEOUT if needed',
        priority: 'high' as const
      },
      {
        issue: 'Too many database connections',
        solution: 'Reduce NEON_MAX_CONNECTIONS or upgrade your Neon plan for higher limits',
        priority: 'medium' as const
      },
      {
        issue: 'High connection latency',
        solution: 'Choose a Neon region closer to your deployment or optimize database queries',
        priority: 'medium' as const
      },
      {
        issue: 'SSL connection errors',
        solution: 'Ensure your NEON_DATABASE_URL includes sslmode=require parameter',
        priority: 'medium' as const
      },
      {
        issue: 'Environment variables not loading',
        solution: 'Check that environment variables are properly set in your deployment platform',
        priority: 'low' as const
      }
    ]

    const response: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      checks: {
        configuration: {
          status: configStatus,
          details: {
            environmentVariables,
            validation: {
              valid: allConfigErrors.length === 0,
              errors: allConfigErrors,
              warnings: configValidation.warnings
            },
            summary: configSummary
          }
        },
        database: {
          status: databaseStatus,
          details: {
            connection: connectionResult,
            pool: poolStatus
          }
        },
        environment: {
          status: environmentStatus,
          details: {
            nodeVersion: process.version,
            platform: process.platform as string,
            isServerless,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
          }
        }
      },
      recommendations,
      troubleshooting: {
        commonIssues
      }
    }

    // Set response headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')
    
    // Return appropriate status code
    const httpStatus = overallStatus === 'fail' ? 500 : 200
    
    return res.status(httpStatus).json(response)
    
  } catch (error) {
    console.error('Diagnostics error:', error)
    
    const errorResponse: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      status: 'fail',
      checks: {
        configuration: {
          status: 'fail',
          details: {
            environmentVariables: {},
            validation: { valid: false, errors: ['Diagnostics failed'], warnings: [] },
            summary: {}
          }
        },
        database: {
          status: 'fail',
          details: {
            connection: { connected: false, error: 'Diagnostics failed' },
            pool: { totalConnections: 0, idleConnections: 0, activeConnections: 0, status: 'error' }
          }
        },
        environment: {
          status: 'fail',
          details: {
            nodeVersion: process.version,
            platform: process.platform,
            isServerless: false,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
          }
        }
      },
      recommendations: ['Fix configuration errors before running diagnostics'],
      troubleshooting: {
        commonIssues: [{
          issue: 'Diagnostics endpoint failed',
          solution: 'Check server logs for detailed error information',
          priority: 'high'
        }]
      }
    }
    
    return res.status(500).json(errorResponse)
  }
}