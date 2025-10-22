#!/usr/bin/env node

// Migration orchestrator that combines execution and verification

import { MigrationExecutor, type MigrationExecutorConfig, type MigrationExecutionResult } from './migration-executor'
import { PostMigrationVerifier, type VerificationConfig, type VerificationResult } from './post-migration-verification'
import { promises as fs } from 'fs'

// Orchestrator configuration
interface OrchestratorConfig {
  neonConnectionString: string
  dryRun: boolean
  skipBackup: boolean
  skipVerification: boolean
  verbose: boolean
  autoRollbackOnFailure: boolean
  verificationConfig: {
    skipApiTests: boolean
    skipPerformanceTests: boolean
    concurrentConnections: number
  }
}

// Orchestrator result
interface OrchestratorResult {
  success: boolean
  duration: number
  execution: MigrationExecutionResult
  verification?: VerificationResult | null
  rollbackPerformed: boolean
  errors: string[]
}

// Migration orchestrator
class MigrationOrchestrator {
  constructor(private config: OrchestratorConfig) {}
  
  async orchestrate(): Promise<OrchestratorResult> {
    const startTime = Date.now()
    const result: OrchestratorResult = {
      success: false,
      duration: 0,
      execution: {
        success: false,
        duration: 0,
        recordsMigrated: { packages: 0, statusUpdates: 0, contactSubmissions: 0 },
        errors: [],
        rollbackPerformed: false
      },
      rollbackPerformed: false,
      errors: []
    }
    
    try {
      console.log('🎯 Starting migration orchestration...')
      console.log('=' .repeat(60))
      
      // Phase 1: Execute migration
      console.log('\n📦 Phase 1: Migration Execution')
      console.log('-' .repeat(40))
      
      const executorConfig: MigrationExecutorConfig = {
        neonConnectionString: this.config.neonConnectionString,
        dryRun: this.config.dryRun,
        skipBackup: this.config.skipBackup,
        verbose: this.config.verbose,
        forceRollback: false
      }
      
      const executor = new MigrationExecutor(executorConfig)
      result.execution = await executor.execute()
      
      if (!result.execution.success) {
        result.errors.push('Migration execution failed')
        
        if (result.execution.rollbackPerformed) {
          result.rollbackPerformed = true
          console.log('🔄 Automatic rollback was performed during execution')
        }
        
        result.duration = Date.now() - startTime
        return result
      }
      
      console.log('✅ Migration execution completed successfully')
      
      // Phase 2: Post-migration verification (skip if dry run or explicitly disabled)
      if (!this.config.dryRun && !this.config.skipVerification) {
        console.log('\n🔍 Phase 2: Post-Migration Verification')
        console.log('-' .repeat(40))
        
        const verificationConfig: VerificationConfig = {
          neonConnectionString: this.config.neonConnectionString,
          verbose: this.config.verbose,
          skipApiTests: this.config.verificationConfig.skipApiTests,
          skipPerformanceTests: this.config.verificationConfig.skipPerformanceTests,
          concurrentConnections: this.config.verificationConfig.concurrentConnections,
          performanceThresholds: {
            queryResponseTime: 200,
            connectionTime: 100,
            concurrentQueryTime: 500
          }
        }
        
        const verifier = new PostMigrationVerifier(verificationConfig)
        result.verification = await verifier.verify()
        
        if (!result.verification.success) {
          result.errors.push('Post-migration verification failed')
          
          // Perform rollback if auto-rollback is enabled
          if (this.config.autoRollbackOnFailure) {
            console.log('\n🔄 Performing automatic rollback due to verification failure...')
            
            const rollbackExecutor = new MigrationExecutor({
              ...executorConfig,
              forceRollback: true,
              backupPath: result.execution.backupPath ?? undefined
            })
            
            const rollbackSuccess = await rollbackExecutor.forceRollback(result.execution.backupPath ?? undefined)
            result.rollbackPerformed = true
            
            if (rollbackSuccess) {
              console.log('✅ Automatic rollback completed successfully')
            } else {
              console.log('❌ Automatic rollback failed')
              result.errors.push('Automatic rollback failed')
            }
          }
          
          result.duration = Date.now() - startTime
          return result
        }
        
        console.log('✅ Post-migration verification completed successfully')
      } else {
        if (this.config.dryRun) {
          console.log('\n⏭️  Skipping verification (dry run mode)')
        } else {
          console.log('\n⏭️  Skipping verification (disabled by configuration)')
        }
      }
      
      // Phase 3: Generate comprehensive report
      console.log('\n📊 Phase 3: Report Generation')
      console.log('-' .repeat(40))
      
      await this.generateComprehensiveReport(result)
      
      result.success = true
      result.duration = Date.now() - startTime
      
      console.log('\n🎉 Migration orchestration completed successfully!')
      console.log(`Total duration: ${result.duration}ms`)
      
      return result
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown orchestration error')
      result.duration = Date.now() - startTime
      
      console.error('\n💥 Migration orchestration failed:', error instanceof Error ? error.message : 'Unknown error')
      return result
    }
  }
  
  private async generateComprehensiveReport(result: OrchestratorResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = `./migration-report-${timestamp}.json`
    
    const report = {
      timestamp: new Date().toISOString(),
      configuration: {
        dryRun: this.config.dryRun,
        skipBackup: this.config.skipBackup,
        skipVerification: this.config.skipVerification,
        autoRollbackOnFailure: this.config.autoRollbackOnFailure
      },
      summary: {
        success: result.success,
        duration: result.duration,
        rollbackPerformed: result.rollbackPerformed,
        errors: result.errors
      },
      execution: result.execution,
      verification: result.verification || null
    }
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Comprehensive report saved to: ${reportPath}`)
    
    // Generate human-readable summary
    const summaryPath = `./migration-summary-${timestamp}.md`
    const summaryContent = this.generateMarkdownSummary(report)
    await fs.writeFile(summaryPath, summaryContent)
    console.log(`📝 Human-readable summary saved to: ${summaryPath}`)
  }
  
  private generateMarkdownSummary(report: any): string {
    const { summary, execution, verification } = report
    
    let content = `# Migration Report\n\n`
    content += `**Date:** ${new Date(report.timestamp).toLocaleString()}\n`
    content += `**Status:** ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}\n`
    content += `**Duration:** ${summary.duration}ms\n\n`
    
    // Configuration
    content += `## Configuration\n\n`
    content += `- Dry Run: ${report.configuration.dryRun ? 'Yes' : 'No'}\n`
    content += `- Skip Backup: ${report.configuration.skipBackup ? 'Yes' : 'No'}\n`
    content += `- Skip Verification: ${report.configuration.skipVerification ? 'Yes' : 'No'}\n`
    content += `- Auto Rollback: ${report.configuration.autoRollbackOnFailure ? 'Yes' : 'No'}\n\n`
    
    // Execution Results
    content += `## Migration Execution\n\n`
    content += `**Status:** ${execution.success ? '✅ SUCCESS' : '❌ FAILED'}\n`
    content += `**Duration:** ${execution.duration}ms\n`
    
    if (execution.backupPath) {
      content += `**Backup:** ${execution.backupPath}\n`
    }
    
    content += `\n### Records Migrated\n\n`
    content += `- Packages: ${execution.recordsMigrated.packages}\n`
    content += `- Status Updates: ${execution.recordsMigrated.statusUpdates}\n`
    content += `- Contact Submissions: ${execution.recordsMigrated.contactSubmissions}\n`
    content += `- **Total:** ${execution.recordsMigrated.packages + execution.recordsMigrated.statusUpdates + execution.recordsMigrated.contactSubmissions}\n\n`
    
    if (execution.errors.length > 0) {
      content += `### Execution Errors\n\n`
      execution.errors.forEach((error: string) => {
        content += `- ${error}\n`
      })
      content += `\n`
    }
    
    // Verification Results
    if (verification) {
      content += `## Post-Migration Verification\n\n`
      content += `**Status:** ${verification.success ? '✅ SUCCESS' : '❌ FAILED'}\n`
      content += `**Duration:** ${verification.duration.toFixed(2)}ms\n\n`
      
      // Data Integrity
      content += `### Data Integrity\n\n`
      content += `**Status:** ${verification.dataIntegrity.success ? '✅ PASSED' : '❌ FAILED'}\n\n`
      
      const { recordCounts } = verification.dataIntegrity
      content += `#### Record Count Verification\n\n`
      content += `| Table | SQLite | PostgreSQL | Match |\n`
      content += `|-------|--------|------------|-------|\n`
      content += `| Packages | ${recordCounts.packages.sqlite} | ${recordCounts.packages.postgres} | ${recordCounts.packages.match ? '✅' : '❌'} |\n`
      content += `| Status Updates | ${recordCounts.statusUpdates.sqlite} | ${recordCounts.statusUpdates.postgres} | ${recordCounts.statusUpdates.match ? '✅' : '❌'} |\n`
      content += `| Contact Submissions | ${recordCounts.contactSubmissions.sqlite} | ${recordCounts.contactSubmissions.postgres} | ${recordCounts.contactSubmissions.match ? '✅' : '❌'} |\n\n`
      
      content += `#### Foreign Key Integrity\n\n`
      content += `- **Status:** ${verification.dataIntegrity.foreignKeyIntegrity.valid ? '✅ VALID' : '❌ INVALID'}\n`
      content += `- **Orphaned Records:** ${verification.dataIntegrity.foreignKeyIntegrity.orphanedRecords}\n\n`
      
      // API Endpoints
      if (verification.apiEndpoints.endpoints.length > 0) {
        content += `### API Endpoint Testing\n\n`
        content += `**Status:** ${verification.apiEndpoints.success ? '✅ PASSED' : '❌ FAILED'}\n\n`
        
        content += `| Endpoint | Method | Status | Response Time |\n`
        content += `|----------|--------|--------|---------------|\n`
        
        verification.apiEndpoints.endpoints.forEach((endpoint: any) => {
          const statusIcon = endpoint.status === 'passed' ? '✅' : '❌'
          content += `| ${endpoint.name} | ${endpoint.method} | ${statusIcon} ${endpoint.status.toUpperCase()} | ${endpoint.responseTime.toFixed(2)}ms |\n`
        })
        content += `\n`
      }
      
      // Performance
      if (verification.performance.queryBenchmarks.simpleSelect > 0) {
        content += `### Performance Benchmarks\n\n`
        content += `**Status:** ${verification.performance.success ? '✅ PASSED' : '❌ FAILED'}\n\n`
        
        content += `#### Query Performance\n\n`
        content += `- Simple Select: ${verification.performance.queryBenchmarks.simpleSelect.toFixed(2)}ms\n`
        content += `- Complex Join: ${verification.performance.queryBenchmarks.complexJoin.toFixed(2)}ms\n`
        content += `- Indexed Lookup: ${verification.performance.queryBenchmarks.indexedLookup.toFixed(2)}ms\n`
        content += `- Bulk Insert: ${verification.performance.queryBenchmarks.bulkInsert.toFixed(2)}ms\n\n`
        
        content += `#### Connection Pool Status\n\n`
        content += `- Total Connections: ${verification.performance.connectionPoolStatus.totalConnections}\n`
        content += `- Idle Connections: ${verification.performance.connectionPoolStatus.idleConnections}\n`
        content += `- Active Connections: ${verification.performance.connectionPoolStatus.activeConnections}\n\n`
      }
    }
    
    // Rollback Information
    if (summary.rollbackPerformed) {
      content += `## Rollback Information\n\n`
      content += `**Rollback Performed:** Yes\n`
      content += `**Reason:** ${verification && !verification.success ? 'Verification failure' : 'Execution failure'}\n\n`
    }
    
    // Next Steps
    content += `## Next Steps\n\n`
    
    if (summary.success) {
      content += `✅ Migration completed successfully! You can now:\n\n`
      content += `1. Update your application environment variables to use PostgreSQL\n`
      content += `2. Deploy your application with the new database configuration\n`
      content += `3. Monitor application performance and optimize queries as needed\n`
      content += `4. Archive or remove the SQLite database backup after confirming stability\n\n`
    } else {
      content += `❌ Migration failed. Recommended actions:\n\n`
      content += `1. Review the error messages above\n`
      content += `2. Check your Neon database configuration\n`
      content += `3. Verify your SQLite database is accessible\n`
      content += `4. Run the migration with --dry-run to test the process\n`
      
      if (summary.rollbackPerformed) {
        content += `5. Your original SQLite database has been restored\n`
      }
      
      content += `\n`
    }
    
    return content
  }
}

// Command-line interface
const parseArgs = (): OrchestratorConfig => {
  const args = process.argv.slice(2)
  const config: OrchestratorConfig = {
    neonConnectionString: process.env.NEON_DATABASE_URL || '',
    dryRun: false,
    skipBackup: false,
    skipVerification: false,
    verbose: false,
    autoRollbackOnFailure: true,
    verificationConfig: {
      skipApiTests: false,
      skipPerformanceTests: false,
      concurrentConnections: 5
    }
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--dry-run':
        config.dryRun = true
        break
      case '--skip-backup':
        config.skipBackup = true
        break
      case '--skip-verification':
        config.skipVerification = true
        break
      case '--verbose':
        config.verbose = true
        break
      case '--no-auto-rollback':
        config.autoRollbackOnFailure = false
        break
      case '--skip-api-tests':
        config.verificationConfig.skipApiTests = true
        break
      case '--skip-performance-tests':
        config.verificationConfig.skipPerformanceTests = true
        break
      case '--connection-string':
        config.neonConnectionString = args[i + 1]
        i++
        break
      case '--concurrent-connections':
        config.verificationConfig.concurrentConnections = parseInt(args[i + 1]) || 5
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
SwiftShip Migration Orchestrator

Usage: npm run migrate:full [options]

Options:
  --connection-string <url>     Neon database connection string
  --dry-run                     Validate migration without executing
  --skip-backup                Skip SQLite backup creation
  --skip-verification          Skip post-migration verification
  --verbose                    Enable detailed logging
  --no-auto-rollback          Disable automatic rollback on failure
  --skip-api-tests            Skip API endpoint testing in verification
  --skip-performance-tests    Skip performance benchmarks in verification
  --concurrent-connections <n> Number of concurrent connections to test (default: 5)
  --help                      Show this help message

Examples:
  npm run migrate:full
  npm run migrate:full --dry-run --verbose
  npm run migrate:full --skip-verification --no-auto-rollback
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
    
    const orchestrator = new MigrationOrchestrator(config)
    const result = await orchestrator.orchestrate()
    
    console.log('\n' + '=' .repeat(60))
    console.log(`🎯 Migration Orchestration ${result.success ? 'COMPLETED' : 'FAILED'}`)
    console.log('=' .repeat(60))
    
    if (result.success) {
      console.log('✅ All phases completed successfully')
      console.log(`📊 Total records migrated: ${result.execution.recordsMigrated.packages + result.execution.recordsMigrated.statusUpdates + result.execution.recordsMigrated.contactSubmissions}`)
      console.log(`⏱️  Total duration: ${result.duration}ms`)
    } else {
      console.log('❌ Migration orchestration failed')
      console.log('Errors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
      
      if (result.rollbackPerformed) {
        console.log('🔄 Automatic rollback was performed')
      }
    }
    
    process.exit(result.success ? 0 : 1)
    
  } catch (error) {
    console.error('Migration orchestration failed:', error instanceof Error ? error.message : 'Unknown error')
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

export { MigrationOrchestrator, type OrchestratorConfig, type OrchestratorResult }