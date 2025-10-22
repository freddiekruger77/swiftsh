// Comprehensive diagnostics endpoint for PostgreSQL/Neon DB
import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  performPostgresHealthCheck,
  getDetailedPoolMetrics,
  collectDatabaseDiagnostics 
} from '../../lib/postgresHealthCheck'
import { validateNeonConfig } from '../../lib/neonDb'
import { validateNeonEnvironment } from '../../lib/configValidation'

interface DiagnosticsResponse {
  timestamp: string
  status: 'pass' | 'fail' | 'warn'
  responseTime: number
  checks: {
    configuration: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        environmentVariables: { [key: string]: 'present' | 'missing' | 'invalid' }
        neonConfig: {
          valid: boolean
          errors: string[]
        }
        connectionString: {
          valid: boolean
          masked: string
        }
      }
    }
    database: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        connection: {
          connected: boolean
          latency: number
          ssl: boolean
          version?: string
          error?: string
        }
        pool: {
          totalConnections: number
          activeConnections: number
          idleConnections: number
          maxConnections: number
          efficiency: number
          status: string
        }
        operations: {
          canRead: boolean
          canWrite: boolean
          canTransaction: boolean
          indexesWorking: boolean
          foreignKeysWorking: boolean
        }
        structure: {
          tablesExist: boolean
          tableCount: number
          indexesExist: boolean
          indexCount: number
          constraintsValid: boolean
        }
        performance: {
          avgQueryTime: number
          slowQueries: number
          cacheHitRatio: number
          connectionPoolEfficiency: number
        }
      }
    }
    environment: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        nodeVersion: string
        platform: string
        isServerless: boolean
        memoryUsage: {
          used: number
          total: number
          percentage: number
        }
        uptime: number
        timezone: string
      }
    }
    system: {
      status: 'pass' | 'fail' | 'warn'
      details: {
        diskUsage: {
          totalSize: string
          totalSizeBytes: number
          tablesSizes: Array<{ table: string; size: string; sizeBytes: number }>
        }
        databaseStats: any
        activeConnections: any[]
      }
    }
  }
  recommendations: string[]
  troubleshooting: {
    commonIssues: Array<{
      issue: string
      solution: string
      priority: 'high' | 'medium' | 'low'
      category: 'configuration' | 'connection' | 'performance' | 'structure'
    }>
  }
  metadata: {
    version: string
    environment: string
    deployment: {
      region?: string
      function?: string
      netlifyUrl?: string
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnosticsResponse>
) {
  const startTime = Date.now()

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({
        timestamp: new Date().toISOString(),
        status: 'fail',
        responseTime: Date.now() - startTime,
        checks: {
          configuration: {
            status: 'fail',
            details: {
              environmentVariables: {},
              neonConfig: { valid: false, errors: ['Method not allowed'] },
              connectionString: { valid: false, masked: 'N/A' }
            }
          },
          database: {
            status: 'fail',
            details: {
              connection: { connected: false, latency: 0, ssl: false, error: 'Method not allowed' },
              pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 0, efficiency: 0, status: 'unavailable' },
              operations: { canRead: false, canWrite: false, canTransaction: false, indexesWorking: false, foreignKeysWorking: false },
              structure: { tablesExist: false, tableCount: 0, indexesExist: false, indexCount: 0, constraintsValid: false },
              performance: { avgQueryTime: 0, slowQueries: 0, cacheHitRatio: 0, connectionPoolEfficiency: 0 }
            }
          },
          environment: {
            status: 'fail',
            details: {
              nodeVersion: process.version,
              platform: process.platform,
              isServerless: false,
              memoryUsage: { used: 0, total: 0, percentage: 0 },
              uptime: process.uptime(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
          },
          system: {
            status: 'fail',
            details: {
              diskUsage: { totalSize: '0 B', totalSizeBytes: 0, tablesSizes: [] },
              databaseStats: {},
              activeConnections: []
            }
          }
        },
        recommendations: [],
        troubleshooting: { commonIssues: [] },
        metadata: {
          version: process.env.npm_package_version || '0.1.0',
          environment: process.env.NODE_ENV || 'development',
          deployment: {
            region: process.env.NETLIFY_REGION,
            function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
            netlifyUrl: process.env.NETLIFY_URL || process.env.URL
          }
        }
      })
    }

    // 1. Check environment variables and configuration
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
        environmentVariables[varName] = isNaN(parseInt(value)) ? 'invalid' : 'present'
      } else if (varName === 'NEON_DATABASE_URL') {
        environmentVariables[varName] = value.startsWith('postgresql://') ? 'present' : 'invalid'
      } else {
        environmentVariables[varName] = 'present'
      }
    })

    // Validate Neon configuration
    const neonConfigValidation = validateNeonConfig()
    const envValidation = validateNeonEnvironment()
    
    const configStatus = neonConfigValidation.valid && envValidation.errors.length === 0 ? 'pass' : 'fail'

    // Connection string validation
    const connectionString = process.env.NEON_DATABASE_URL || ''
    const maskedConnectionString = connectionString ? 
      connectionString.replace(/:[^:@]*@/, ':***@') : 'NOT_SET'

    // 2. Perform comprehensive health check
    let healthResult: any = {
      healthy: false,
      details: {
        connection: { canConnect: false, latency: 0, ssl: false },
        pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 0, healthy: false },
        queries: { canRead: false, canWrite: false, canTransaction: false, indexesWorking: false, foreignKeysWorking: false, readLatency: 0, writeLatency: 0 },
        constraints: { tablesExist: false, indexesExist: false, foreignKeysExist: false, constraintsValid: false, tableCount: 0, indexCount: 0 },
        performance: { avgQueryTime: 0, slowQueries: 0, connectionPoolEfficiency: 0, cacheHitRatio: 0, diskUsage: { totalSize: '0 B', totalSizeBytes: 0, tablesSizes: [] } }
      },
      errors: [],
      warnings: []
    }

    let poolMetrics: any = {
      pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 0, healthy: false },
      connections: [],
      recommendations: []
    }

    let diagnostics: any = {
      config: {},
      stats: {},
      locks: [],
      replication: [],
      extensions: []
    }

    if (configStatus === 'pass') {
      try {
        healthResult = await performPostgresHealthCheck()
        poolMetrics = await getDetailedPoolMetrics()
        diagnostics = await collectDatabaseDiagnostics()
      } catch (error) {
        healthResult.errors.push(error instanceof Error ? error.message : 'Health check failed')
      }
    }

    const databaseStatus = healthResult.healthy ? 'pass' : 
                          (healthResult.details.connection.canConnect ? 'warn' : 'fail')

    // 3. Environment checks
    const memoryUsage = process.memoryUsage()
    const memoryInfo = {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    }

    const isServerless = !!(
      process.env.NETLIFY || 
      process.env.AWS_LAMBDA_FUNCTION_NAME || 
      process.env.VERCEL
    )

    const environmentStatus = memoryInfo.percentage > 90 ? 'warn' : 'pass'

    // 4. System checks
    const systemStatus = healthResult.details.performance.diskUsage.totalSizeBytes > 0 ? 'pass' : 'warn'

    // 5. Overall status
    const overallStatus = [configStatus, databaseStatus, environmentStatus, systemStatus].includes('fail') ? 'fail' :
                         [configStatus, databaseStatus, environmentStatus, systemStatus].includes('warn') ? 'warn' : 'pass'

    // 6. Generate recommendations
    const recommendations: string[] = [...poolMetrics.recommendations]

    if (healthResult.details.performance.avgQueryTime > 1000) {
      recommendations.push('High average query time detected - optimize slow queries')
    }

    if (healthResult.details.performance.cacheHitRatio < 90) {
      recommendations.push('Low cache hit ratio - consider increasing shared_buffers')
    }

    if (memoryInfo.percentage > 80) {
      recommendations.push('High memory usage - monitor for memory leaks')
    }

    if (healthResult.details.pool.activeConnections / healthResult.details.pool.maxConnections > 0.8) {
      recommendations.push('High connection pool utilization - consider scaling')
    }

    // 7. Common troubleshooting issues
    const commonIssues = [
      {
        issue: 'NEON_DATABASE_URL is missing or invalid',
        solution: 'Set NEON_DATABASE_URL to your Neon database connection string',
        priority: 'high' as const,
        category: 'configuration' as const
      },
      {
        issue: 'Database connection timeout',
        solution: 'Check network connectivity and increase NEON_CONNECTION_TIMEOUT',
        priority: 'high' as const,
        category: 'connection' as const
      },
      {
        issue: 'High query latency',
        solution: 'Optimize database queries and consider adding indexes',
        priority: 'medium' as const,
        category: 'performance' as const
      },
      {
        issue: 'Missing database tables or indexes',
        solution: 'Run database migration to create required schema',
        priority: 'high' as const,
        category: 'structure' as const
      },
      {
        issue: 'Connection pool exhaustion',
        solution: 'Reduce NEON_MAX_CONNECTIONS or optimize connection usage',
        priority: 'medium' as const,
        category: 'connection' as const
      },
      {
        issue: 'SSL connection errors',
        solution: 'Ensure connection string includes proper SSL parameters',
        priority: 'medium' as const,
        category: 'configuration' as const
      }
    ]

    const response: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      responseTime: Date.now() - startTime,
      checks: {
        configuration: {
          status: configStatus,
          details: {
            environmentVariables,
            neonConfig: {
              valid: neonConfigValidation.valid,
              errors: [...neonConfigValidation.errors, ...envValidation.errors]
            },
            connectionString: {
              valid: !!connectionString && connectionString.startsWith('postgresql://'),
              masked: maskedConnectionString
            }
          }
        },
        database: {
          status: databaseStatus,
          details: {
            connection: {
              connected: healthResult.details.connection.canConnect,
              latency: healthResult.details.connection.latency,
              ssl: healthResult.details.connection.ssl,
              version: healthResult.details.connection.version,
              error: healthResult.details.connection.error
            },
            pool: {
              totalConnections: healthResult.details.pool.totalConnections,
              activeConnections: healthResult.details.pool.activeConnections,
              idleConnections: healthResult.details.pool.idleConnections,
              maxConnections: healthResult.details.pool.maxConnections,
              efficiency: healthResult.details.performance.connectionPoolEfficiency,
              status: healthResult.details.pool.healthy ? 'healthy' : 'unhealthy'
            },
            operations: {
              canRead: healthResult.details.queries.canRead,
              canWrite: healthResult.details.queries.canWrite,
              canTransaction: healthResult.details.queries.canTransaction,
              indexesWorking: healthResult.details.queries.indexesWorking,
              foreignKeysWorking: healthResult.details.queries.foreignKeysWorking
            },
            structure: {
              tablesExist: healthResult.details.constraints.tablesExist,
              tableCount: healthResult.details.constraints.tableCount,
              indexesExist: healthResult.details.constraints.indexesExist,
              indexCount: healthResult.details.constraints.indexCount,
              constraintsValid: healthResult.details.constraints.constraintsValid
            },
            performance: {
              avgQueryTime: healthResult.details.performance.avgQueryTime,
              slowQueries: healthResult.details.performance.slowQueries,
              cacheHitRatio: healthResult.details.performance.cacheHitRatio,
              connectionPoolEfficiency: healthResult.details.performance.connectionPoolEfficiency
            }
          }
        },
        environment: {
          status: environmentStatus,
          details: {
            nodeVersion: process.version,
            platform: process.platform,
            isServerless,
            memoryUsage: memoryInfo,
            uptime: Math.round(process.uptime()),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        },
        system: {
          status: systemStatus,
          details: {
            diskUsage: healthResult.details.performance.diskUsage,
            databaseStats: diagnostics.stats,
            activeConnections: poolMetrics.connections
          }
        }
      },
      recommendations,
      troubleshooting: {
        commonIssues
      },
      metadata: {
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        deployment: {
          region: process.env.NETLIFY_REGION,
          function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
          netlifyUrl: process.env.NETLIFY_URL || process.env.URL
        }
      }
    }

    // Set response headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')
    
    // Return appropriate status code
    const httpStatus = overallStatus === 'fail' ? 500 : 200
    
    return res.status(httpStatus).json(response)
    
  } catch (error) {
    console.error('PostgreSQL diagnostics error:', error)
    
    const errorResponse: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      status: 'fail',
      responseTime: Date.now() - startTime,
      checks: {
        configuration: {
          status: 'fail',
          details: {
            environmentVariables: {},
            neonConfig: { valid: false, errors: ['Diagnostics failed'] },
            connectionString: { valid: false, masked: 'ERROR' }
          }
        },
        database: {
          status: 'fail',
          details: {
            connection: { connected: false, latency: 0, ssl: false, error: 'Diagnostics failed' },
            pool: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 0, efficiency: 0, status: 'error' },
            operations: { canRead: false, canWrite: false, canTransaction: false, indexesWorking: false, foreignKeysWorking: false },
            structure: { tablesExist: false, tableCount: 0, indexesExist: false, indexCount: 0, constraintsValid: false },
            performance: { avgQueryTime: 0, slowQueries: 0, cacheHitRatio: 0, connectionPoolEfficiency: 0 }
          }
        },
        environment: {
          status: 'fail',
          details: {
            nodeVersion: process.version,
            platform: process.platform,
            isServerless: false,
            memoryUsage: { used: 0, total: 0, percentage: 0 },
            uptime: process.uptime(),
            timezone: 'UTC'
          }
        },
        system: {
          status: 'fail',
          details: {
            diskUsage: { totalSize: '0 B', totalSizeBytes: 0, tablesSizes: [] },
            databaseStats: {},
            activeConnections: []
          }
        }
      },
      recommendations: ['Fix configuration errors before running diagnostics'],
      troubleshooting: {
        commonIssues: [{
          issue: 'Diagnostics endpoint failed',
          solution: 'Check server logs for detailed error information',
          priority: 'high',
          category: 'configuration'
        }]
      },
      metadata: {
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        deployment: {
          region: process.env.NETLIFY_REGION,
          function: process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTION_NAME,
          netlifyUrl: process.env.NETLIFY_URL || process.env.URL
        }
      }
    }
    
    return res.status(500).json(errorResponse)
  }
}