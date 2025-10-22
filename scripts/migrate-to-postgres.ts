#!/usr/bin/env node

// Command-line migration script for SQLite to PostgreSQL migration

import { Pool } from 'pg'
import { setupPostgresSchema } from '../lib/postgresSchema'
import { createAllIndexes } from '../lib/postgresIndexes'
import { performCompleteMigration } from '../lib/dataMigration'

// Migration configuration
interface MigrationConfig {
  neonConnectionString: string
  dryRun: boolean
  skipBackup: boolean
  verbose: boolean
}

// Parse command line arguments
const parseArgs = (): MigrationConfig => {
  const args = process.argv.slice(2)
  const config: MigrationConfig = {
    neonConnectionString: process.env.NEON_DATABASE_URL || '',
    dryRun: false,
    skipBackup: false,
    verbose: false
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
      case '--connection-string':
        config.neonConnectionString = args[i + 1]
        i++ // Skip next argument
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

// Print help information
const printHelp = (): void => {
  console.log(`
SwiftShip SQLite to PostgreSQL Migration Tool

Usage: npm run migrate:postgres [options]

Options:
  --connection-string <url>  Neon database connection string (or set NEON_DATABASE_URL)
  --dry-run                  Perform migration validation without actual data transfer
  --skip-backup             Skip SQLite backup creation
  --verbose                 Enable verbose logging
  --help                    Show this help message

Environment Variables:
  NEON_DATABASE_URL         Neon PostgreSQL connection string

Examples:
  npm run migrate:postgres
  npm run migrate:postgres --dry-run --verbose
  npm run migrate:postgres --connection-string "postgresql://user:pass@host/db"
  `)
}

// Validate migration prerequisites
const validatePrerequisites = async (config: MigrationConfig): Promise<void> => {
  console.log('Validating migration prerequisites...')
  
  // Check Neon connection string
  if (!config.neonConnectionString) {
    throw new Error('Neon database connection string is required. Set NEON_DATABASE_URL or use --connection-string')
  }
  
  // Validate connection string format
  if (!config.neonConnectionString.startsWith('postgresql://') && !config.neonConnectionString.startsWith('postgres://')) {
    throw new Error('Invalid PostgreSQL connection string format')
  }
  
  // Check if SQLite database exists
  const fs = await import('fs')
  const dbPath = process.env.DATABASE_PATH || './data/swiftship.db'
  
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database not found at: ${dbPath}`)
  }
  
  console.log('✓ Prerequisites validated')
}

// Test PostgreSQL connection
const testPostgresConnection = async (connectionString: string): Promise<void> => {
  console.log('Testing PostgreSQL connection...')
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    console.log('✓ PostgreSQL connection successful')
  } catch (error) {
    throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await pool.end()
  }
}

// Perform dry run migration
const performDryRun = async (config: MigrationConfig): Promise<void> => {
  console.log('\n=== DRY RUN MODE ===')
  console.log('This will validate the migration process without transferring data\n')
  
  const pool = new Pool({
    connectionString: config.neonConnectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    const client = await pool.connect()
    
    // Test schema creation
    console.log('Testing schema creation...')
    const schemaResult = await setupPostgresSchema(client)
    if (!schemaResult.success) {
      throw new Error(schemaResult.error || 'Schema creation test failed')
    }
    console.log(`✓ Schema test passed: ${schemaResult.tablesCreated} tables, ${schemaResult.indexesCreated} indexes`)
    
    // Test data export
    console.log('Testing data export...')
    const { exportSQLiteData } = await import('../lib/dataMigration')
    const exportResult = await exportSQLiteData()
    if (!exportResult.success) {
      throw new Error(exportResult.error || 'Data export test failed')
    }
    
    const totalRecords = exportResult.data.packages.length + 
                        exportResult.data.statusUpdates.length + 
                        exportResult.data.contactSubmissions.length
    
    console.log(`✓ Data export test passed: ${totalRecords} records ready for migration`)
    console.log(`  - Packages: ${exportResult.data.packages.length}`)
    console.log(`  - Status Updates: ${exportResult.data.statusUpdates.length}`)
    console.log(`  - Contact Submissions: ${exportResult.data.contactSubmissions.length}`)
    
    client.release()
    console.log('\n✓ Dry run completed successfully - migration is ready to proceed')
    
  } catch (error) {
    console.error('\n✗ Dry run failed:', error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    await pool.end()
  }
}

// Perform actual migration
const performActualMigration = async (config: MigrationConfig): Promise<void> => {
  console.log('\n=== STARTING MIGRATION ===')
  console.log('This will migrate data from SQLite to PostgreSQL\n')
  
  const pool = new Pool({
    connectionString: config.neonConnectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    const client = await pool.connect()
    
    // Step 1: Setup schema
    console.log('Step 1: Setting up PostgreSQL schema...')
    const schemaResult = await setupPostgresSchema(client)
    if (!schemaResult.success) {
      throw new Error(schemaResult.error || 'Schema setup failed')
    }
    console.log(`✓ Schema setup completed: ${schemaResult.tablesCreated} tables, ${schemaResult.indexesCreated} indexes`)
    
    // Step 2: Create additional indexes
    console.log('Step 2: Creating performance indexes...')
    const indexResult = await createAllIndexes(client)
    console.log(`✓ Index creation completed: ${indexResult.created.length} created, ${indexResult.failed.length} failed`)
    
    if (indexResult.failed.length > 0 && config.verbose) {
      console.warn('Failed indexes:', indexResult.failed.map(f => f.name).join(', '))
    }
    
    // Step 3: Migrate data
    console.log('Step 3: Migrating data...')
    const migrationResult = await performCompleteMigration(client)
    
    if (!migrationResult.success) {
      throw new Error(`Migration failed: ${migrationResult.errors.join(', ')}`)
    }
    
    const totalRecords = migrationResult.recordsCopied.packages + 
                        migrationResult.recordsCopied.statusUpdates + 
                        migrationResult.recordsCopied.contactSubmissions
    
    console.log(`✓ Data migration completed in ${migrationResult.duration}ms`)
    console.log(`  Total records migrated: ${totalRecords}`)
    console.log(`  - Packages: ${migrationResult.recordsCopied.packages}`)
    console.log(`  - Status Updates: ${migrationResult.recordsCopied.statusUpdates}`)
    console.log(`  - Contact Submissions: ${migrationResult.recordsCopied.contactSubmissions}`)
    
    if (migrationResult.backupPath) {
      console.log(`  SQLite backup: ${migrationResult.backupPath}`)
    }
    
    if (migrationResult.errors.length > 0) {
      console.warn('Migration completed with warnings:')
      migrationResult.errors.forEach(error => console.warn(`  - ${error}`))
    }
    
    client.release()
    console.log('\n🎉 Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Update your application environment variables to use PostgreSQL')
    console.log('2. Test your application with the new database')
    console.log('3. Monitor performance and optimize queries as needed')
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error instanceof Error ? error.message : 'Unknown error')
    console.log('\nTroubleshooting:')
    console.log('1. Check your Neon database connection string')
    console.log('2. Ensure your SQLite database is accessible')
    console.log('3. Verify you have sufficient permissions')
    console.log('4. Run with --dry-run to test the migration process')
    throw error
  } finally {
    await pool.end()
  }
}

// Main migration function
const main = async (): Promise<void> => {
  try {
    console.log('SwiftShip SQLite to PostgreSQL Migration Tool')
    console.log('=' .repeat(50))
    
    const config = parseArgs()
    
    if (config.verbose) {
      console.log('Configuration:')
      console.log(`  Connection String: ${config.neonConnectionString.replace(/:[^:@]*@/, ':***@')}`)
      console.log(`  Dry Run: ${config.dryRun}`)
      console.log(`  Skip Backup: ${config.skipBackup}`)
      console.log(`  Verbose: ${config.verbose}`)
      console.log('')
    }
    
    // Validate prerequisites
    await validatePrerequisites(config)
    
    // Test PostgreSQL connection
    await testPostgresConnection(config.neonConnectionString)
    
    if (config.dryRun) {
      await performDryRun(config)
    } else {
      // Confirm before proceeding with actual migration
      if (process.env.NODE_ENV !== 'development') {
        console.log('\n⚠️  WARNING: This will migrate your production data!')
        console.log('Make sure you have a backup of your SQLite database.')
        console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...\n')
        
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
      
      await performActualMigration(config)
    }
    
  } catch (error) {
    console.error('\nMigration failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\nMigration cancelled by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\nMigration terminated')
  process.exit(0)
})

// Run migration if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
}

export { main as runMigration }