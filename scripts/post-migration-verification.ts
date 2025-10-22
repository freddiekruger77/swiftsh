#!/usr/bin/env node

// Post-migration verification system for SQLite to PostgreSQL migration

import { Pool, PoolClient } from 'pg'
import { promises as fs } from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { validateNeonConfig, getPoolStatus } from '../lib/neonDb'
import { exportSQLiteData } from '../lib/dataMigration'
import type { PackageData, StatusUpdate, ContactSubmission } from '../lib/types'

// Verification configuration
interface VerificationConfig {
  neonConnectionString: string
  verbose: boolean
  skipApiTests: boolean
  skipPerformanceTests: boolean
  concurrentConnections: number
  performanceThresholds: {
    queryResponseTime: number // milliseconds
    connectionTime: number // milliseconds
    concurrentQueryTime: number // milliseconds
  }
}

// Verification results
interface VerificationResult {
  success: boolean
  duration: number
  dataIntegrity: DataIntegrityResult
  apiEndpoints: ApiEndpointResult
  concurrentAccess: ConcurrentAccessResult
  performance: PerformanceResult
  errors: string[]
  warnings: string[]
}

interface DataIntegrityResult {
  success: boolean
  recordCounts: {
    packages: { sqlite: number; postgres: number; match: boolean }
    statusUpdates: { sqlite: number; postgres: number; match: boolean }
    contactSubmissions: { sqlite: number; postgres: number; match: boolean }
  }
  foreignKeyIntegrity: { valid: boolean; orphanedRecords: number }
  sampleDataVerification: { tested: number; passed: number; failed: number }
  errors: string[]
}

interface ApiEndpointResult {
  success: boolean
  endpoints: {
    name: string
    url: string
    method: string
    status: 'passed' | 'failed' | 'skipped'
    responseTime: number
    error?: string
  }[]
  errors: string[]
}

interface ConcurrentAccessResult {
  success: boolean
  connectionsCreated: number
  connectionsSuccessful: number
  averageConnectionTime: number
  concurrentQueriesExecuted: number
  concurrentQueriesSuccessful: number
  averageQueryTime: number
  errors: string[]
}

interface PerformanceResult {
  success: boolean
  connectionPoolStatus: {
    totalConnections: number
    idleConnections: number
    activeConnections: number
  }
  queryBenchmarks: {
    simpleSelect: number
    complexJoin: number
    bulkInsert: number
    indexedLookup: number
  }
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  errors: string[]
}

// Post-migration verification system
class PostMigrationVerifier {
  private pool: Pool | null = null
  
  constructor(private config: VerificationConfig) {}
  
  async verify(): Promise<VerificationResult> {
    const startTime = performance.now()
    const result: VerificationResult = {
      success: false,
      duration: 0,
      dataIntegrity: this.createEmptyDataIntegrityResult(),
      apiEndpoints: this.createEmptyApiEndpointResult(),
      concurrentAccess: this.createEmptyConcurrentAccessResult(),
      performance: this.createEmptyPerformanceResult(),
      errors: [],
      warnings: []
    }
    
    try {
      console.log('🔍 Starting post-migration verification...')
      
      // Initialize connection pool
      this.pool = new Pool({
        connectionString: this.config.neonConnectionString,
        ssl: { rejectUnauthorized: false },
        max: this.config.concurrentConnections
      })
      
      // Step 1: Data integrity verification
      console.log('📊 Verifying data integrity...')
      result.dataIntegrity = await this.verifyDataIntegrity()
      
      // Step 2: API endpoint verification
      if (!this.config.skipApiTests) {
        console.log('🌐 Testing API endpoints...')
        result.apiEndpoints = await this.verifyApiEndpoints()
      } else {
        console.log('⏭️  Skipping API endpoint tests')
      }
      
      // Step 3: Concurrent access verification
      console.log('🔄 Testing concurrent access...')
      result.concurrentAccess = await this.verifyConcurrentAccess()
      
      // Step 4: Performance verification
      if (!this.config.skipPerformanceTests) {
        console.log('⚡ Running performance tests...')
        result.performance = await this.verifyPerformance()
      } else {
        console.log('⏭️  Skipping performance tests')
      }
      
      // Determine overall success
      result.success = result.dataIntegrity.success && 
                      (this.config.skipApiTests || result.apiEndpoints.success) &&
                      result.concurrentAccess.success &&
                      (this.config.skipPerformanceTests || result.performance.success)
      
      result.duration = performance.now() - startTime
      
      if (result.success) {
        console.log('✅ Post-migration verification completed successfully')
      } else {
        console.log('❌ Post-migration verification failed')
        this.logFailureDetails(result)
      }
      
      return result
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown verification error')
      result.duration = performance.now() - startTime
      
      console.error('💥 Verification failed:', error instanceof Error ? error.message : 'Unknown error')
      return result
      
    } finally {
      if (this.pool) {
        await this.pool.end()
      }
    }
  }
  
  private async verifyDataIntegrity(): Promise<DataIntegrityResult> {
    const result = this.createEmptyDataIntegrityResult()
    
    try {
      const client = await this.pool!.connect()
      
      try {
        // Step 1: Export SQLite data for comparison
        console.log('  Exporting SQLite data for comparison...')
        const sqliteData = await exportSQLiteData()
        
        if (!sqliteData.success) {
          result.errors.push('Failed to export SQLite data for comparison')
          return result
        }
        
        // Step 2: Compare record counts
        console.log('  Comparing record counts...')
        const pgPackageCount = await this.getRecordCount(client, 'packages')
        const pgStatusCount = await this.getRecordCount(client, 'status_updates')
        const pgContactCount = await this.getRecordCount(client, 'contact_submissions')
        
        result.recordCounts = {
          packages: {
            sqlite: sqliteData.data.packages.length,
            postgres: pgPackageCount,
            match: sqliteData.data.packages.length === pgPackageCount
          },
          statusUpdates: {
            sqlite: sqliteData.data.statusUpdates.length,
            postgres: pgStatusCount,
            match: sqliteData.data.statusUpdates.length === pgStatusCount
          },
          contactSubmissions: {
            sqlite: sqliteData.data.contactSubmissions.length,
            postgres: pgContactCount,
            match: sqliteData.data.contactSubmissions.length === pgContactCount
          }
        }
        
        // Step 3: Check foreign key integrity
        console.log('  Checking foreign key integrity...')
        const orphanedResult = await client.query(`
          SELECT COUNT(*) as count 
          FROM status_updates su 
          LEFT JOIN packages p ON su.package_id = p.id 
          WHERE p.id IS NULL
        `)
        
        const orphanedCount = parseInt(orphanedResult.rows[0].count)
        result.foreignKeyIntegrity = {
          valid: orphanedCount === 0,
          orphanedRecords: orphanedCount
        }
        
        // Step 4: Sample data verification
        console.log('  Verifying sample data...')
        const sampleVerification = await this.verifySampleData(client, sqliteData.data)
        result.sampleDataVerification = sampleVerification
        
        // Determine success
        result.success = result.recordCounts.packages.match &&
                        result.recordCounts.statusUpdates.match &&
                        result.recordCounts.contactSubmissions.match &&
                        result.foreignKeyIntegrity.valid &&
                        sampleVerification.failed === 0
        
        if (this.config.verbose) {
          this.logDataIntegrityDetails(result)
        }
        
      } finally {
        client.release()
      }
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Data integrity check failed')
    }
    
    return result
  }
  
  private async verifyApiEndpoints(): Promise<ApiEndpointResult> {
    const result = this.createEmptyApiEndpointResult()
    
    // Define API endpoints to test
    const endpoints = [
      { name: 'Health Check', url: '/api/health-neon', method: 'GET' },
      { name: 'Detailed Health', url: '/api/health-detailed-neon', method: 'GET' },
      { name: 'Diagnostics', url: '/api/diagnostics-neon', method: 'GET' },
      { name: 'Package Tracking', url: '/api/track', method: 'POST' },
      { name: 'Admin Create Package', url: '/api/admin/create-package', method: 'POST' }
    ]
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    for (const endpoint of endpoints) {
      const startTime = performance.now()
      
      try {
        const response = await this.makeApiRequest(baseUrl + endpoint.url, endpoint.method)
        const responseTime = performance.now() - startTime
        
        result.endpoints.push({
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          status: response.ok ? 'passed' : 'failed',
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        })
        
        if (this.config.verbose) {
          console.log(`  ✓ ${endpoint.name}: ${response.status} (${responseTime.toFixed(2)}ms)`)
        }
        
      } catch (error) {
        const responseTime = performance.now() - startTime
        
        result.endpoints.push({
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          status: 'failed',
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        
        result.errors.push(`${endpoint.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    const passedCount = result.endpoints.filter(e => e.status === 'passed').length
    result.success = passedCount === result.endpoints.length
    
    console.log(`  API endpoints: ${passedCount}/${result.endpoints.length} passed`)
    
    return result
  }
  
  private async verifyConcurrentAccess(): Promise<ConcurrentAccessResult> {
    const result = this.createEmptyConcurrentAccessResult()
    
    try {
      const connectionPromises: Promise<{ success: boolean; time: number; error?: string }>[] = []
      
      // Test concurrent connections
      console.log(`  Testing ${this.config.concurrentConnections} concurrent connections...`)
      
      for (let i = 0; i < this.config.concurrentConnections; i++) {
        connectionPromises.push(this.testSingleConnection())
      }
      
      const connectionResults = await Promise.all(connectionPromises)
      
      result.connectionsCreated = connectionResults.length
      result.connectionsSuccessful = connectionResults.filter(r => r.success).length
      result.averageConnectionTime = connectionResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.time, 0) / result.connectionsSuccessful || 0
      
      // Test concurrent queries
      console.log('  Testing concurrent query execution...')
      const queryPromises: Promise<{ success: boolean; time: number; error?: string }>[] = []
      
      for (let i = 0; i < this.config.concurrentConnections; i++) {
        queryPromises.push(this.testConcurrentQuery())
      }
      
      const queryResults = await Promise.all(queryPromises)
      
      result.concurrentQueriesExecuted = queryResults.length
      result.concurrentQueriesSuccessful = queryResults.filter(r => r.success).length
      result.averageQueryTime = queryResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.time, 0) / result.concurrentQueriesSuccessful || 0
      
      // Collect errors
      connectionResults.concat(queryResults).forEach(r => {
        if (!r.success && r.error) {
          result.errors.push(r.error)
        }
      })
      
      // Check performance thresholds
      const connectionTimeOk = result.averageConnectionTime <= this.config.performanceThresholds.connectionTime
      const queryTimeOk = result.averageQueryTime <= this.config.performanceThresholds.concurrentQueryTime
      
      result.success = result.connectionsSuccessful === result.connectionsCreated &&
                      result.concurrentQueriesSuccessful === result.concurrentQueriesExecuted &&
                      connectionTimeOk && queryTimeOk
      
      if (this.config.verbose) {
        console.log(`  Connections: ${result.connectionsSuccessful}/${result.connectionsCreated} (avg: ${result.averageConnectionTime.toFixed(2)}ms)`)
        console.log(`  Queries: ${result.concurrentQueriesSuccessful}/${result.concurrentQueriesExecuted} (avg: ${result.averageQueryTime.toFixed(2)}ms)`)
      }
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Concurrent access test failed')
    }
    
    return result
  }
  
  private async verifyPerformance(): Promise<PerformanceResult> {
    const result = this.createEmptyPerformanceResult()
    
    try {
      const client = await this.pool!.connect()
      
      try {
        // Get connection pool status
        result.connectionPoolStatus = getPoolStatus()
        
        // Run query benchmarks
        console.log('  Running query benchmarks...')
        
        // Simple select benchmark
        const simpleStart = performance.now()
        await client.query('SELECT COUNT(*) FROM packages')
        result.queryBenchmarks.simpleSelect = performance.now() - simpleStart
        
        // Complex join benchmark
        const joinStart = performance.now()
        await client.query(`
          SELECT p.*, COUNT(su.id) as update_count 
          FROM packages p 
          LEFT JOIN status_updates su ON p.id = su.package_id 
          GROUP BY p.id 
          LIMIT 10
        `)
        result.queryBenchmarks.complexJoin = performance.now() - joinStart
        
        // Indexed lookup benchmark
        const indexStart = performance.now()
        await client.query('SELECT * FROM packages WHERE tracking_number = $1', ['TEST123'])
        result.queryBenchmarks.indexedLookup = performance.now() - indexStart
        
        // Bulk insert benchmark (using temp table)
        const bulkStart = performance.now()
        await client.query('CREATE TEMP TABLE perf_test (id VARCHAR(255), data TEXT)')
        
        const bulkValues = Array.from({ length: 100 }, (_, i) => `('test_${i}', 'data_${i}')`).join(', ')
        await client.query(`INSERT INTO perf_test (id, data) VALUES ${bulkValues}`)
        await client.query('DROP TABLE perf_test')
        
        result.queryBenchmarks.bulkInsert = performance.now() - bulkStart
        
        // Get memory usage
        const memUsage = process.memoryUsage()
        result.memoryUsage = {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        }
        
        // Check performance thresholds
        const queryPerformanceOk = result.queryBenchmarks.simpleSelect <= this.config.performanceThresholds.queryResponseTime &&
                                  result.queryBenchmarks.indexedLookup <= this.config.performanceThresholds.queryResponseTime
        
        result.success = queryPerformanceOk
        
        if (this.config.verbose) {
          console.log(`  Simple select: ${result.queryBenchmarks.simpleSelect.toFixed(2)}ms`)
          console.log(`  Complex join: ${result.queryBenchmarks.complexJoin.toFixed(2)}ms`)
          console.log(`  Indexed lookup: ${result.queryBenchmarks.indexedLookup.toFixed(2)}ms`)
          console.log(`  Bulk insert: ${result.queryBenchmarks.bulkInsert.toFixed(2)}ms`)
          console.log(`  Memory usage: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`)
        }
        
      } finally {
        client.release()
      }
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Performance test failed')
    }
    
    return result
  }
  
  // Helper methods
  private async getRecordCount(client: PoolClient, tableName: string): Promise<number> {
    const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`)
    return parseInt(result.rows[0].count)
  }
  
  private async verifySampleData(
    client: PoolClient, 
    sqliteData: { packages: PackageData[]; statusUpdates: StatusUpdate[]; contactSubmissions: ContactSubmission[] }
  ): Promise<{ tested: number; passed: number; failed: number }> {
    let tested = 0
    let passed = 0
    let failed = 0
    
    // Test sample packages (up to 5)
    const samplePackages = sqliteData.packages.slice(0, 5)
    
    for (const pkg of samplePackages) {
      tested++
      
      try {
        const result = await client.query('SELECT * FROM packages WHERE id = $1', [pkg.id])
        
        if (result.rows.length === 1) {
          const pgPkg = result.rows[0]
          
          if (pgPkg.tracking_number === pkg.trackingNumber &&
              pgPkg.status === pkg.status &&
              pgPkg.current_location === pkg.currentLocation) {
            passed++
          } else {
            failed++
          }
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
    
    return { tested, passed, failed }
  }
  
  private async testSingleConnection(): Promise<{ success: boolean; time: number; error?: string }> {
    const startTime = performance.now()
    
    try {
      const testPool = new Pool({
        connectionString: this.config.neonConnectionString,
        ssl: { rejectUnauthorized: false },
        max: 1
      })
      
      const client = await testPool.connect()
      await client.query('SELECT 1')
      client.release()
      await testPool.end()
      
      return {
        success: true,
        time: performance.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        time: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }
  
  private async testConcurrentQuery(): Promise<{ success: boolean; time: number; error?: string }> {
    const startTime = performance.now()
    
    try {
      const client = await this.pool!.connect()
      
      try {
        await client.query('SELECT COUNT(*) FROM packages')
        
        return {
          success: true,
          time: performance.now() - startTime
        }
      } finally {
        client.release()
      }
    } catch (error) {
      return {
        success: false,
        time: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Query test failed'
      }
    }
  }
  
  private async makeApiRequest(url: string, method: string): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    // Add sample data for POST requests
    if (method === 'POST') {
      if (url.includes('/api/track')) {
        options.body = JSON.stringify({ trackingNumber: 'TEST123' })
      } else if (url.includes('/api/admin/create-package')) {
        options.body = JSON.stringify({
          trackingNumber: 'VERIFY123',
          status: 'in_transit',
          currentLocation: 'Test Location',
          destination: 'Test Destination'
        })
      }
    }
    
    const response = await fetch(url, options)
    return response
  }
  
  // Result creation helpers
  private createEmptyDataIntegrityResult(): DataIntegrityResult {
    return {
      success: false,
      recordCounts: {
        packages: { sqlite: 0, postgres: 0, match: false },
        statusUpdates: { sqlite: 0, postgres: 0, match: false },
        contactSubmissions: { sqlite: 0, postgres: 0, match: false }
      },
      foreignKeyIntegrity: { valid: false, orphanedRecords: 0 },
      sampleDataVerification: { tested: 0, passed: 0, failed: 0 },
      errors: []
    }
  }
  
  private createEmptyApiEndpointResult(): ApiEndpointResult {
    return {
      success: false,
      endpoints: [],
      errors: []
    }
  }
  
  private createEmptyConcurrentAccessResult(): ConcurrentAccessResult {
    return {
      success: false,
      connectionsCreated: 0,
      connectionsSuccessful: 0,
      averageConnectionTime: 0,
      concurrentQueriesExecuted: 0,
      concurrentQueriesSuccessful: 0,
      averageQueryTime: 0,
      errors: []
    }
  }
  
  private createEmptyPerformanceResult(): PerformanceResult {
    return {
      success: false,
      connectionPoolStatus: {
        totalConnections: 0,
        idleConnections: 0,
        activeConnections: 0
      },
      queryBenchmarks: {
        simpleSelect: 0,
        complexJoin: 0,
        bulkInsert: 0,
        indexedLookup: 0
      },
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      errors: []
    }
  }
  
  private logDataIntegrityDetails(result: DataIntegrityResult): void {
    console.log('  Data Integrity Details:')
    console.log(`    Packages: ${result.recordCounts.packages.postgres}/${result.recordCounts.packages.sqlite} (${result.recordCounts.packages.match ? '✓' : '✗'})`)
    console.log(`    Status Updates: ${result.recordCounts.statusUpdates.postgres}/${result.recordCounts.statusUpdates.sqlite} (${result.recordCounts.statusUpdates.match ? '✓' : '✗'})`)
    console.log(`    Contact Submissions: ${result.recordCounts.contactSubmissions.postgres}/${result.recordCounts.contactSubmissions.sqlite} (${result.recordCounts.contactSubmissions.match ? '✓' : '✗'})`)
    console.log(`    Foreign Keys: ${result.foreignKeyIntegrity.valid ? '✓' : '✗'} (${result.foreignKeyIntegrity.orphanedRecords} orphaned)`)
    console.log(`    Sample Data: ${result.sampleDataVerification.passed}/${result.sampleDataVerification.tested} passed`)
  }
  
  private logFailureDetails(result: VerificationResult): void {
    console.log('\nFailure Details:')
    
    if (!result.dataIntegrity.success) {
      console.log('❌ Data Integrity Issues:')
      result.dataIntegrity.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    if (!result.apiEndpoints.success) {
      console.log('❌ API Endpoint Issues:')
      result.apiEndpoints.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    if (!result.concurrentAccess.success) {
      console.log('❌ Concurrent Access Issues:')
      result.concurrentAccess.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    if (!result.performance.success) {
      console.log('❌ Performance Issues:')
      result.performance.errors.forEach(error => console.log(`  - ${error}`))
    }
  }
}

// Command-line interface
const parseArgs = (): VerificationConfig => {
  const args = process.argv.slice(2)
  const config: VerificationConfig = {
    neonConnectionString: process.env.NEON_DATABASE_URL || '',
    verbose: false,
    skipApiTests: false,
    skipPerformanceTests: false,
    concurrentConnections: 5,
    performanceThresholds: {
      queryResponseTime: 200, // 200ms
      connectionTime: 100, // 100ms
      concurrentQueryTime: 500 // 500ms
    }
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--verbose':
        config.verbose = true
        break
      case '--skip-api-tests':
        config.skipApiTests = true
        break
      case '--skip-performance-tests':
        config.skipPerformanceTests = true
        break
      case '--connection-string':
        config.neonConnectionString = args[i + 1]
        i++
        break
      case '--concurrent-connections':
        config.concurrentConnections = parseInt(args[i + 1]) || 5
        i++
        break
      case '--help':
        printHelp()
        process.exit(0)
        break
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`)
          printHelp()
          process.exit(1)
        }
    }
  }
  
  return config
}

const printHelp = (): void => {
  console.log(`
SwiftShip Post-Migration Verification Tool

Usage: npm run verify:migration [options]

Options:
  --connection-string <url>     Neon database connection string
  --verbose                     Enable detailed logging
  --skip-api-tests             Skip API endpoint testing
  --skip-performance-tests     Skip performance benchmarks
  --concurrent-connections <n>  Number of concurrent connections to test (default: 5)
  --help                       Show this help message

Examples:
  npm run verify:migration
  npm run verify:migration --verbose --skip-api-tests
  npm run verify:migration --concurrent-connections 10
  `)
}

// Main execution function
const main = async (): Promise<void> => {
  try {
    const config = parseArgs()
    
    if (!config.neonConnectionString) {
      console.error('Error: NEON_DATABASE_URL environment variable is required')
      process.exit(1)
    }
    
    const verifier = new PostMigrationVerifier(config)
    const result = await verifier.verify()
    
    // Generate summary report
    console.log('\n📋 Verification Summary:')
    console.log(`Duration: ${result.duration.toFixed(2)}ms`)
    console.log(`Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`)
    
    if (result.errors.length > 0) {
      console.log('\nErrors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:')
      result.warnings.forEach(warning => console.log(`  - ${warning}`))
    }
    
    // Save detailed report
    const reportPath = `./verification-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2))
    console.log(`\nDetailed report saved to: ${reportPath}`)
    
    process.exit(result.success ? 0 : 1)
    
  } catch (error) {
    console.error('Verification failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
}

export { PostMigrationVerifier, type VerificationConfig, type VerificationResult }