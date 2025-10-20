import type { NextApiRequest, NextApiResponse } from 'next'

interface TestResponse {
  status: 'success' | 'error'
  timestamp: string
  tests: {
    name: string
    passed: boolean
    message: string
    duration: number
  }[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0 }
    })
  }

  const tests: TestResponse['tests'] = []
  const startTime = Date.now()

  // Test 1: Environment Variables
  const envTestStart = Date.now()
  try {
    const requiredEnvs = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'DATABASE_PATH']
    const missingEnvs = requiredEnvs.filter(env => !process.env[env])
    
    tests.push({
      name: 'Environment Variables',
      passed: missingEnvs.length === 0,
      message: missingEnvs.length === 0 
        ? 'All required environment variables are set'
        : `Missing: ${missingEnvs.join(', ')}`,
      duration: Date.now() - envTestStart
    })
  } catch (error) {
    tests.push({
      name: 'Environment Variables',
      passed: false,
      message: `Error checking environment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - envTestStart
    })
  }

  // Test 2: Database Connection
  const dbTestStart = Date.now()
  try {
    const { checkDatabaseHealth } = await import('@/lib/dbInit')
    const isHealthy = await checkDatabaseHealth()
    
    tests.push({
      name: 'Database Connection',
      passed: isHealthy,
      message: isHealthy ? 'Database connection successful' : 'Database connection failed',
      duration: Date.now() - dbTestStart
    })
  } catch (error) {
    tests.push({
      name: 'Database Connection',
      passed: false,
      message: `Database test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - dbTestStart
    })
  }

  // Test 3: File System Access
  const fsTestStart = Date.now()
  try {
    const fs = await import('fs')
    const path = await import('path')
    
    // Test /tmp directory access
    const testFile = path.join('/tmp', '.deployment-test')
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
    
    tests.push({
      name: 'File System Access',
      passed: true,
      message: 'File system write access confirmed',
      duration: Date.now() - fsTestStart
    })
  } catch (error) {
    tests.push({
      name: 'File System Access',
      passed: false,
      message: `File system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - fsTestStart
    })
  }

  // Test 4: SQLite3 Module
  const sqliteTestStart = Date.now()
  try {
    require('sqlite3')
    tests.push({
      name: 'SQLite3 Module',
      passed: true,
      message: 'SQLite3 module loaded successfully',
      duration: Date.now() - sqliteTestStart
    })
  } catch (error) {
    tests.push({
      name: 'SQLite3 Module',
      passed: false,
      message: `SQLite3 module error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - sqliteTestStart
    })
  }

  // Test 5: API Routes
  const apiTestStart = Date.now()
  try {
    // Test if we can import other API modules
    await import('./health')
    await import('./diagnostics')
    
    tests.push({
      name: 'API Routes',
      passed: true,
      message: 'API route modules loaded successfully',
      duration: Date.now() - apiTestStart
    })
  } catch (error) {
    tests.push({
      name: 'API Routes',
      passed: false,
      message: `API routes error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - apiTestStart
    })
  }

  const summary = {
    total: tests.length,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length
  }

  const response: TestResponse = {
    status: summary.failed === 0 ? 'success' : 'error',
    timestamp: new Date().toISOString(),
    tests,
    summary
  }

  const statusCode = summary.failed === 0 ? 200 : 500

  // Set cache headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  return res.status(statusCode).json(response)
}