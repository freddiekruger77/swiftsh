#!/usr/bin/env node

// Enhanced migration execution script with backup, progress reporting, and rollback functionality

import { Pool, PoolClient } from 'pg'
import { promises as fs } from 'fs'
import path from 'path'
import { setupPostgresSchema } from '../lib/postgresSchema'
import { createAllIndexes } from '../lib/postgresIndexes'
import { performCompleteMigration, exportSQLiteData } from '../lib/dataMigration'
import { validateNeonConfig } from '../lib/neonDb'

// Migration execution configuration
interface MigrationExecutorConfig {
  neonConnectionString: string
  dryRun: boolean
  skipBackup: boolean
  verbose: boolean
  forceRollback: boolean
  backupPath?: string
  progressCallback?: (step: string, progress: number) => void
}

// Migration execution result
interface MigrationExecutionResult {
  success: boolean
  duration: number
  backupPath?: string | null
  recordsMigrated: {
    packages: number
    statusUpdates: number
    contactSubmissions: number
  }
  errors: string[]
  rollbackPerformed: boolean
  rollbackSuccess?: boolean
}

// Progress tracking
class MigrationProgress {
  private currentStep = 0
  private totalSteps = 6
  private stepNames = [
    'Validating prerequisites',
    'Creating backup',
    'Setting up schema',
    'Creating indexes',
    'Migrating data',
    'Verifying integrity'
  ]
  
  constructor(private callback?: (step: string, progress: number) => void) {}
  
  nextStep(): void {
    this.currentStep++
    const progress = Math.round((this.currentStep / this.totalSteps) * 100)
    const stepName = this.stepNames[this.currentStep - 1] || 'Unknown step'
    
    console.log(`[${progress}%] ${stepName}...`)
    
    if (this.callback) {
      this.callback(stepName, progress)
    }
  }
  
  setError(error: string): void {
    console.error(`[ERROR] ${error}`)
    if (this.callback) {
      this.callback(`Error: ${error}`, this.currentStep / this.totalSteps * 100)
    }
  }
}

// Enhanced backup management
class BackupManager {
  private backupDir = './backups'
  
  async createBackup(skipBackup: boolean = false): Promise<string | null> {
    if (skipBackup) {
      console.log('Skipping backup creation as requested')
      return null
    }
    
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(this.backupDir, `swiftship-pre-migration-${timestamp}.db`)
      
      const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
      
      // Check if source database exists
      try {
        await fs.access(dbPath)
      } catch {
        throw new Error(`Source database not found at: ${dbPath}`)
      }
      
      // Create backup
      await fs.copyFile(dbPath, backupPath)
      
      // Verify backup was created successfully
      const backupStats = await fs.stat(backupPath)
      const sourceStats = await fs.stat(dbPath)
      
      if (backupStats.size !== sourceStats.size) {
        throw new Error('Backup file size does not match source database')
      }
      
      console.log(`✓ Database backup created: ${backupPath} (${backupStats.size} bytes)`)
      return backupPath
      
    } catch (error) {
      throw new Error(`Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
      
      // Verify backup exists
      await fs.access(backupPath)
      
      // Create database directory if needed
      const dbDir = path.dirname(dbPath)
      await fs.mkdir(dbDir, { recursive: true })
      
      // Restore backup
      await fs.copyFile(backupPath, dbPath)
      
      console.log(`✓ Database restored from backup: ${backupPath}`)
      
    } catch (error) {
      throw new Error(`Backup restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir)
      return files
        .filter(file => file.startsWith('swiftship-') && file.endsWith('.db'))
        .sort()
        .reverse() // Most recent first
    } catch {
      return []
    }
  }
}

// Rollback manager
class RollbackManager {
  constructor(private backupManager: BackupManager) {}
  
  async performRollback(backupPath: string | null, pgClient?: PoolClient | null): Promise<boolean> {
    console.log('\n🔄 Performing rollback...')
    
    let rollbackSuccess = true
    const rollbackErrors: string[] = []
    
    try {
      // Step 1: Clean up PostgreSQL if client is available
      if (pgClient) {
        try {
          console.log('Cleaning up PostgreSQL tables...')
          await pgClient.query('BEGIN')
          
          // Drop tables in reverse dependency order
          const dropQueries = [
            'DROP TABLE IF EXISTS status_updates CASCADE',
            'DROP TABLE IF EXISTS contact_submissions CASCADE',
            'DROP TABLE IF EXISTS packages CASCADE'
          ]
          
          for (const query of dropQueries) {
            await pgClient.query(query)
          }
          
          await pgClient.query('COMMIT')
          console.log('✓ PostgreSQL cleanup completed')
          
        } catch (pgError) {
          await pgClient.query('ROLLBACK')
          rollbackErrors.push(`PostgreSQL cleanup failed: ${pgError instanceof Error ? pgError.message : 'Unknown error'}`)
          rollbackSuccess = false
        }
      }
      
      // Step 2: Restore SQLite backup if available
      if (backupPath) {
        try {
          await this.backupManager.restoreFromBackup(backupPath)
          console.log('✓ SQLite database restored from backup')
        } catch (restoreError) {
          rollbackErrors.push(`Backup restoration failed: ${restoreError instanceof Error ? restoreError.message : 'Unknown error'}`)
          rollbackSuccess = false
        }
      } else {
        console.log('⚠️  No backup available for restoration')
      }
      
      if (rollbackSuccess) {
        console.log('✅ Rollback completed successfully')
      } else {
        console.error('❌ Rollback completed with errors:')
        rollbackErrors.forEach(error => console.error(`  - ${error}`))
      }
      
    } catch (error) {
      console.error('❌ Rollback failed:', error instanceof Error ? error.message : 'Unknown error')
      rollbackSuccess = false
    }
    
    return rollbackSuccess
  }
}

// Enhanced migration executor
class MigrationExecutor {
  private progress: MigrationProgress
  private backupManager: BackupManager
  private rollbackManager: RollbackManager
  
  constructor(private config: MigrationExecutorConfig) {
    this.progress = new MigrationProgress(config.progressCallback)
    this.backupManager = new BackupManager()
    this.rollbackManager = new RollbackManager(this.backupManager)
  }
  
  async execute(): Promise<MigrationExecutionResult> {
    const startTime = Date.now()
    const result: MigrationExecutionResult = {
      success: false,
      duration: 0,
      recordsMigrated: {
        packages: 0,
        statusUpdates: 0,
        contactSubmissions: 0
      },
      errors: [],
      rollbackPerformed: false
    }
    
    let pgClient: PoolClient | null = null
    let pool: Pool | null = null
    
    try {
      console.log('🚀 Starting enhanced migration execution...')
      console.log(`Configuration: dryRun=${this.config.dryRun}, skipBackup=${this.config.skipBackup}, verbose=${this.config.verbose}`)
      
      // Step 1: Validate prerequisites
      this.progress.nextStep()
      await this.validatePrerequisites()
      
      // Step 2: Create backup
      this.progress.nextStep()
      if (!this.config.dryRun) {
        result.backupPath = await this.backupManager.createBackup(this.config.skipBackup)
      }
      
      // Initialize PostgreSQL connection
      pool = new Pool({
        connectionString: this.config.neonConnectionString,
        ssl: { rejectUnauthorized: false }
      })
      
      pgClient = await pool.connect()
      
      if (this.config.dryRun) {
        return await this.performDryRun(pgClient, result)
      }
      
      // Step 3: Setup schema
      this.progress.nextStep()
      const schemaResult = await setupPostgresSchema(pgClient)
      if (!schemaResult.success) {
        throw new Error(schemaResult.error || 'Schema setup failed')
      }
      
      if (this.config.verbose) {
        console.log(`Schema setup: ${schemaResult.tablesCreated} tables, ${schemaResult.indexesCreated} indexes`)
      }
      
      // Step 4: Create indexes
      this.progress.nextStep()
      const indexResult = await createAllIndexes(pgClient)
      if (this.config.verbose) {
        console.log(`Indexes: ${indexResult.created.length} created, ${indexResult.failed.length} failed`)
      }
      
      // Step 5: Migrate data
      this.progress.nextStep()
      const migrationResult = await performCompleteMigration(pgClient)
      
      if (!migrationResult.success) {
        throw new Error(`Data migration failed: ${migrationResult.errors.join(', ')}`)
      }
      
      result.recordsMigrated = migrationResult.recordsCopied
      result.errors.push(...migrationResult.errors)
      
      // Step 6: Verify integrity
      this.progress.nextStep()
      await this.verifyMigrationIntegrity(pgClient)
      
      result.success = true
      result.duration = Date.now() - startTime
      
      console.log('🎉 Migration completed successfully!')
      console.log(`Duration: ${result.duration}ms`)
      console.log(`Records migrated: ${result.recordsMigrated.packages + result.recordsMigrated.statusUpdates + result.recordsMigrated.contactSubmissions}`)
      
      return result
      
    } catch (error) {
      this.progress.setError(error instanceof Error ? error.message : 'Unknown error')
      
      result.success = false
      result.duration = Date.now() - startTime
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      
      // Perform rollback if not in dry run mode
      if (!this.config.dryRun && !this.config.forceRollback) {
        console.log('\n⚠️  Migration failed, performing automatic rollback...')
        result.rollbackPerformed = true
        result.rollbackSuccess = await this.rollbackManager.performRollback(result.backupPath ?? null, pgClient)
      }
      
      return result
      
    } finally {
      // Clean up connections
      if (pgClient) {
        pgClient.release()
      }
      if (pool) {
        await pool.end()
      }
    }
  }
  
  private async validatePrerequisites(): Promise<void> {
    // Validate Neon configuration
    const configValidation = validateNeonConfig()
    if (!configValidation.valid) {
      throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`)
    }
    
    // Test PostgreSQL connection
    const pool = new Pool({
      connectionString: this.config.neonConnectionString,
      ssl: { rejectUnauthorized: false }
    })
    
    try {
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
    } catch (error) {
      throw new Error(`PostgreSQL connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      await pool.end()
    }
    
    // Check SQLite database exists
    const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
    try {
      await fs.access(dbPath)
    } catch {
      throw new Error(`SQLite database not found at: ${dbPath}`)
    }
    
    console.log('✓ Prerequisites validated')
  }
  
  private async performDryRun(pgClient: PoolClient, result: MigrationExecutionResult): Promise<MigrationExecutionResult> {
    console.log('\n🧪 Performing dry run validation...')
    
    try {
      // Test schema creation
      const schemaResult = await setupPostgresSchema(pgClient)
      if (!schemaResult.success) {
        throw new Error(schemaResult.error || 'Schema test failed')
      }
      
      // Test data export
      const exportResult = await exportSQLiteData()
      if (!exportResult.success) {
        throw new Error(exportResult.error || 'Data export test failed')
      }
      
      const totalRecords = exportResult.data.packages.length + 
                          exportResult.data.statusUpdates.length + 
                          exportResult.data.contactSubmissions.length
      
      console.log(`✓ Dry run completed successfully`)
      console.log(`  Ready to migrate ${totalRecords} records`)
      console.log(`  - Packages: ${exportResult.data.packages.length}`)
      console.log(`  - Status Updates: ${exportResult.data.statusUpdates.length}`)
      console.log(`  - Contact Submissions: ${exportResult.data.contactSubmissions.length}`)
      
      result.success = true
      result.duration = Date.now() - Date.now()
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Dry run failed')
      throw error
    }
    
    return result
  }
  
  private async verifyMigrationIntegrity(pgClient: PoolClient): Promise<void> {
    // Basic integrity checks
    const checks = [
      { name: 'packages', query: 'SELECT COUNT(*) as count FROM packages' },
      { name: 'status_updates', query: 'SELECT COUNT(*) as count FROM status_updates' },
      { name: 'contact_submissions', query: 'SELECT COUNT(*) as count FROM contact_submissions' }
    ]
    
    for (const check of checks) {
      const result = await pgClient.query(check.query)
      const count = parseInt(result.rows[0].count)
      
      if (this.config.verbose) {
        console.log(`✓ ${check.name}: ${count} records`)
      }
    }
    
    // Check foreign key integrity
    const orphanedResult = await pgClient.query(`
      SELECT COUNT(*) as count 
      FROM status_updates su 
      LEFT JOIN packages p ON su.package_id = p.id 
      WHERE p.id IS NULL
    `)
    
    const orphanedCount = parseInt(orphanedResult.rows[0].count)
    if (orphanedCount > 0) {
      throw new Error(`Data integrity check failed: ${orphanedCount} orphaned status update records found`)
    }
    
    console.log('✓ Data integrity verification passed')
  }
  
  async forceRollback(backupPath?: string): Promise<boolean> {
    console.log('🔄 Performing forced rollback...')
    
    let pgClient: PoolClient | null = null
    let pool: Pool | null = null
    
    try {
      // Connect to PostgreSQL for cleanup
      pool = new Pool({
        connectionString: this.config.neonConnectionString,
        ssl: { rejectUnauthorized: false }
      })
      
      pgClient = await pool.connect()
      
      return await this.rollbackManager.performRollback(backupPath ?? null, pgClient)
      
    } catch (error) {
      console.error('Forced rollback failed:', error instanceof Error ? error.message : 'Unknown error')
      return false
    } finally {
      if (pgClient) {
        pgClient.release()
      }
      if (pool) {
        await pool.end()
      }
    }
  }
  
  async listBackups(): Promise<string[]> {
    return await this.backupManager.listBackups()
  }
}

// Command-line interface
const parseArgs = (): MigrationExecutorConfig => {
  const args = process.argv.slice(2)
  const config: MigrationExecutorConfig = {
    neonConnectionString: process.env.NEON_DATABASE_URL || '',
    dryRun: false,
    skipBackup: false,
    verbose: false,
    forceRollback: false
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
      case '--verbose':
        config.verbose = true
        break
      case '--force-rollback':
        config.forceRollback = true
        break
      case '--connection-string':
        config.neonConnectionString = args[i + 1]
        i++
        break
      case '--backup-path':
        config.backupPath = args[i + 1]
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
SwiftShip Enhanced Migration Executor

Usage: npm run migrate:execute [options]

Options:
  --connection-string <url>  Neon database connection string
  --dry-run                  Validate migration without executing
  --skip-backup             Skip SQLite backup creation
  --verbose                 Enable detailed logging
  --force-rollback          Perform rollback operation
  --backup-path <path>      Specific backup file for rollback
  --help                    Show this help message

Examples:
  npm run migrate:execute
  npm run migrate:execute --dry-run --verbose
  npm run migrate:execute --force-rollback --backup-path ./backups/backup.db
  `)
}

// Main execution function
const main = async (): Promise<void> => {
  try {
    const config = parseArgs()
    const executor = new MigrationExecutor(config)
    
    if (config.forceRollback) {
      const success = await executor.forceRollback(config.backupPath)
      process.exit(success ? 0 : 1)
    }
    
    const result = await executor.execute()
    
    if (result.success) {
      console.log('\n✅ Migration execution completed successfully')
      if (result.backupPath) {
        console.log(`Backup available at: ${result.backupPath}`)
      }
    } else {
      console.error('\n❌ Migration execution failed')
      console.error('Errors:', result.errors.join(', '))
      
      if (result.rollbackPerformed) {
        console.log(`Rollback ${result.rollbackSuccess ? 'succeeded' : 'failed'}`)
      }
    }
    
    process.exit(result.success ? 0 : 1)
    
  } catch (error) {
    console.error('Migration executor failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\nMigration execution cancelled by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\nMigration execution terminated')
  process.exit(0)
})

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
}

export { MigrationExecutor, type MigrationExecutorConfig, type MigrationExecutionResult }