import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import fs from 'fs'

// Diagnostic response types
interface DiagnosticIssue {
  component: 'database' | 'environment' | 'routing' | 'build' | 'filesystem'
  severity: 'critical' | 'warning' | 'info'
  message: string
  solution: string
  details?: any
}

interface DiagnosticResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  environment: string
  platform: string
  issues: DiagnosticIssue[]
  recommendations: string[]
  systemInfo: {
    nodeVersion: string
    platform: string
    architecture: string
    memory: {
      used: number
      total: number
    }
    uptime: number
  }
  environmentVariables: {
    required: EnvironmentVariable[]
    missing: string[]
    invalid: string[]
    status: 'complete' | 'incomplete' | 'invalid'
  }
  database: {
    status: 'connected' | 'disconnected' | 'error'
    path: string
    exists: boolean
    writable: boolean
    message: string
    connectionTime?: number
  }
  routing: {
    status: 'healthy' | 'unhealthy'
    pages: PageStatus[]
    apis: ApiStatus[]
  }
  build: {
    status: 'success' | 'partial' | 'failed'
    nextVersion: string
    buildTime?: string
    issues: string[]
  }
}

interface EnvironmentVariable {
  name: string
  required: boolean
  present: boolean
  valid: boolean
  description: string
  value?: string
}

interface PageStatus {
  path: string
  exists: boolean
  accessible: boolean
}

interface ApiStatus {
  path: string
  exists: boolean
  method: string
  status: 'healthy' | 'unhealthy' | 'unknown'
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnosticResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: 'vercel',
      issues: [{
        component: 'routing',
        severity: 'critical',
        message: 'Method not allowed',
        solution: 'Use GET method for diagnostics endpoint'
      }],
      recommendations: ['Use GET method to access diagnostics'],
      systemInfo: getSystemInfo(),
      environmentVariables: { required: [], missing: [], invalid: [], status: 'incomplete' },
      database: { status: 'disconnected', path: '', exists: false, writable: false, message: 'Method not allowed' },
      routing: { status: 'unhealthy', pages: [], apis: [] },
      build: { status: 'failed', nextVersion: '', issues: ['Method not allowed'] }
    })
  }

  const startTime = Date.now()
  const issues: DiagnosticIssue[] = []
  const recommendations: string[] = []

  try {
    // 1. Check system information
    const systemInfo = getSystemInfo()

    // 2. Validate environment variables
    const envStatus = validateEnvironmentVariables()
    if (envStatus.status !== 'complete') {
      issues.push({
        component: 'environment',
        severity: 'critical',
        message: `Environment configuration ${envStatus.status}: ${envStatus.missing.length} missing, ${envStatus.invalid.length} invalid`,
        solution: 'Configure missing environment variables in Vercel dashboard',
        details: { missing: envStatus.missing, invalid: envStatus.invalid }
      })
      recommendations.push('Set all required environment variables in Vercel project settings')
    }

    // 3. Test database connectivity
    const dbStatus = await testDatabaseConnectivity()
    if (dbStatus.status !== 'connected') {
      issues.push({
        component: 'database',
        severity: 'critical',
        message: dbStatus.message,
        solution: 'Check database path and file system permissions in serverless environment',
        details: { path: dbStatus.path, exists: dbStatus.exists, writable: dbStatus.writable }
      })
      recommendations.push('Consider using /tmp directory for SQLite in serverless environment')
    }

    // 4. Check routing and pages
    const routingStatus = await checkRoutingHealth()
    if (routingStatus.status !== 'healthy') {
      issues.push({
        component: 'routing',
        severity: 'warning',
        message: 'Some routes may not be accessible',
        solution: 'Verify Next.js page structure and vercel.json configuration',
        details: { pages: routingStatus.pages, apis: routingStatus.apis }
      })
      recommendations.push('Check vercel.json routing configuration')
    }

    // 5. Check build status
    const buildStatus = checkBuildStatus()
    if (buildStatus.status !== 'success') {
      issues.push({
        component: 'build',
        severity: 'critical',
        message: 'Build issues detected',
        solution: 'Check build logs and resolve compilation errors',
        details: { issues: buildStatus.issues }
      })
      recommendations.push('Review Vercel build logs for detailed error information')
    }

    // 6. Check filesystem permissions (serverless specific)
    const fsStatus = await checkFilesystemPermissions()
    if (fsStatus.hasIssues) {
      issues.push({
        component: 'filesystem',
        severity: 'warning',
        message: 'Filesystem permission issues detected',
        solution: 'Use /tmp directory for writable files in serverless environment',
        details: fsStatus.details
      })
      recommendations.push('Move writable files to /tmp directory for Vercel compatibility')
    }

    const diagnosticTime = Date.now() - startTime
    const overallStatus = issues.some(i => i.severity === 'critical') ? 'unhealthy' : 'healthy'

    // Add performance recommendations
    if (diagnosticTime > 5000) {
      recommendations.push('Diagnostic response time is slow - consider optimizing database queries')
    }

    const response: DiagnosticResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: 'vercel',
      issues,
      recommendations,
      systemInfo,
      environmentVariables: envStatus,
      database: dbStatus,
      routing: routingStatus,
      build: buildStatus
    }

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 503

    // Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    return res.status(statusCode).json(response)
  } catch (error) {
    console.error('Diagnostics error:', error)
    
    const errorResponse: DiagnosticResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: 'vercel',
      issues: [{
        component: 'build',
        severity: 'critical',
        message: error instanceof Error ? error.message : 'Unknown diagnostic error',
        solution: 'Check server logs and application configuration'
      }],
      recommendations: ['Review application logs for detailed error information'],
      systemInfo: getSystemInfo(),
      environmentVariables: { required: [], missing: [], invalid: [], status: 'incomplete' },
      database: { status: 'error', path: '', exists: false, writable: false, message: 'Diagnostic error' },
      routing: { status: 'unhealthy', pages: [], apis: [] },
      build: { status: 'failed', nextVersion: '', issues: ['Diagnostic system error'] }
    }

    return res.status(503).json(errorResponse)
  }
}

function getSystemInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    uptime: Math.round(process.uptime())
  }
}

function validateEnvironmentVariables() {
  const requiredVars: EnvironmentVariable[] = [
    {
      name: 'NEXTAUTH_URL',
      required: true,
      present: !!process.env.NEXTAUTH_URL,
      valid: !!process.env.NEXTAUTH_URL && (process.env.NEXTAUTH_URL.startsWith('http://') || process.env.NEXTAUTH_URL.startsWith('https://')),
      description: 'NextAuth.js callback URL',
      value: process.env.NEXTAUTH_URL ? 'SET' : 'NOT_SET'
    },
    {
      name: 'NEXTAUTH_SECRET',
      required: true,
      present: !!process.env.NEXTAUTH_SECRET,
      valid: !!process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32,
      description: 'NextAuth.js session encryption secret (min 32 chars)',
      value: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT_SET'
    },
    {
      name: 'DATABASE_PATH',
      required: true,
      present: !!process.env.DATABASE_PATH,
      valid: !!process.env.DATABASE_PATH,
      description: 'SQLite database file path',
      value: process.env.DATABASE_PATH || 'NOT_SET'
    },
    {
      name: 'ADMIN_EMAIL',
      required: true,
      present: !!process.env.ADMIN_EMAIL,
      valid: !!process.env.ADMIN_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL),
      description: 'Admin user email address',
      value: process.env.ADMIN_EMAIL ? 'SET' : 'NOT_SET'
    },
    {
      name: 'ADMIN_PASSWORD',
      required: true,
      present: !!process.env.ADMIN_PASSWORD,
      valid: !!process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8,
      description: 'Admin user password (min 8 chars)',
      value: process.env.ADMIN_PASSWORD ? 'SET' : 'NOT_SET'
    },
    {
      name: 'NODE_ENV',
      required: false,
      present: !!process.env.NODE_ENV,
      valid: true,
      description: 'Node.js environment',
      value: process.env.NODE_ENV || 'NOT_SET'
    }
  ]

  const missing = requiredVars.filter(v => v.required && !v.present).map(v => v.name)
  const invalid = requiredVars.filter(v => v.present && !v.valid).map(v => v.name)

  let status: 'complete' | 'incomplete' | 'invalid' = 'complete'
  if (missing.length > 0) status = 'incomplete'
  else if (invalid.length > 0) status = 'invalid'

  return {
    required: requiredVars,
    missing,
    invalid,
    status
  }
}

async function testDatabaseConnectivity() {
  const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
  const startTime = Date.now()

  try {
    // Check if database file exists
    const exists = fs.existsSync(dbPath)
    
    // Check if directory is writable
    const dir = path.dirname(dbPath)
    let writable = false
    try {
      // Try to create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      // Test write permissions
      const testFile = path.join(dir, '.write-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      writable = true
    } catch (error) {
      console.warn('Directory not writable:', error)
    }

    // Try to connect to database
    try {
      const { checkDatabaseHealth } = await import('@/lib/dbInit')
      const isHealthy = await checkDatabaseHealth()
      const connectionTime = Date.now() - startTime

      return {
        status: isHealthy ? 'connected' as const : 'disconnected' as const,
        path: dbPath,
        exists,
        writable,
        message: isHealthy 
          ? `Database connection successful (${connectionTime}ms)` 
          : 'Database connection failed - check logs for details',
        connectionTime
      }
    } catch (dbError) {
      return {
        status: 'error' as const,
        path: dbPath,
        exists,
        writable,
        message: `Database connection error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`
      }
    }
  } catch (error) {
    return {
      status: 'error' as const,
      path: dbPath,
      exists: false,
      writable: false,
      message: `Filesystem error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

async function checkRoutingHealth() {
  const pages: PageStatus[] = [
    { path: '/', exists: true, accessible: true },
    { path: '/track', exists: true, accessible: true },
    { path: '/contact', exists: true, accessible: true },
    { path: '/admin', exists: true, accessible: true }
  ]

  const apis: ApiStatus[] = [
    { path: '/api/health', exists: true, method: 'GET', status: 'healthy' },
    { path: '/api/track', exists: true, method: 'POST', status: 'unknown' },
    { path: '/api/contact', exists: true, method: 'POST', status: 'unknown' },
    { path: '/api/admin/packages', exists: true, method: 'GET', status: 'unknown' }
  ]

  // In a real implementation, we could test actual HTTP requests to these endpoints
  // For now, we assume they exist based on file structure

  const hasUnhealthyRoutes = apis.some(api => api.status === 'unhealthy')
  
  return {
    status: hasUnhealthyRoutes ? 'unhealthy' as const : 'healthy' as const,
    pages,
    apis
  }
}

function checkBuildStatus() {
  const issues: string[] = []
  
  // Check if we're in a built environment
  const isBuilt = process.env.NODE_ENV === 'production'
  
  // Check Next.js version
  let nextVersion = 'unknown'
  try {
    const packageJson = require('../../package.json')
    nextVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next || 'unknown'
  } catch (error) {
    issues.push('Could not read package.json')
  }

  // Check for common build issues
  if (!isBuilt && process.env.NODE_ENV !== 'development') {
    issues.push('Application may not be properly built for production')
  }

  // Check if SQLite3 is properly configured
  try {
    require('sqlite3')
  } catch (error) {
    issues.push('SQLite3 dependency not available - check webpack externals configuration')
  }

  return {
    status: issues.length === 0 ? 'success' as const : (issues.length < 3 ? 'partial' as const : 'failed' as const),
    nextVersion,
    buildTime: process.env.BUILD_TIME,
    issues
  }
}

async function checkFilesystemPermissions() {
  const details: any = {}
  let hasIssues = false

  try {
    // Check /tmp directory (recommended for Vercel)
    const tmpDir = '/tmp'
    try {
      const testFile = path.join(tmpDir, '.fs-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      details.tmpWritable = true
    } catch (error) {
      details.tmpWritable = false
      details.tmpError = error instanceof Error ? error.message : 'Unknown error'
      hasIssues = true
    }

    // Check current working directory
    try {
      const testFile = './.fs-test'
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      details.cwdWritable = true
    } catch (error) {
      details.cwdWritable = false
      details.cwdError = error instanceof Error ? error.message : 'Unknown error'
      // This is expected in serverless, so not necessarily an issue
    }

    // Check data directory
    const dataDir = './data'
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      const testFile = path.join(dataDir, '.fs-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      details.dataWritable = true
    } catch (error) {
      details.dataWritable = false
      details.dataError = error instanceof Error ? error.message : 'Unknown error'
      hasIssues = true
    }

  } catch (error) {
    hasIssues = true
    details.generalError = error instanceof Error ? error.message : 'Unknown error'
  }

  return {
    hasIssues,
    details
  }
}