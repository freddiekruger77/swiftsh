# Migration Tools Documentation

This document provides comprehensive documentation for the SwiftShip SQLite to PostgreSQL migration tools.

## Overview

The migration system consists of three main components:

1. **Migration Executor** - Handles the actual data migration with backup and rollback capabilities
2. **Post-Migration Verifier** - Validates the migration results and tests system functionality
3. **Migration Orchestrator** - Combines execution and verification into a single workflow

## Quick Start

### Full Migration (Recommended)

```bash
# Run complete migration with verification
npm run migrate:full

# Dry run to test the process
npm run migrate:full:dry-run
```

### Individual Components

```bash
# Execute migration only
npm run migrate:execute

# Verify existing migration
npm run verify:migration

# Rollback migration
npm run migrate:rollback
```

## Tools Overview

### 1. Migration Executor (`scripts/migration-executor.ts`)

The Migration Executor handles the complete migration process with enhanced features:

#### Features
- **Automatic Backup**: Creates SQLite database backup before migration
- **Progress Reporting**: Real-time progress updates during migration
- **Error Handling**: Comprehensive error handling with detailed messages
- **Rollback Functionality**: Automatic rollback on failure
- **Dry Run Mode**: Test migration without actual data transfer

#### Usage

```bash
# Basic migration
npm run migrate:execute

# Dry run
npm run migrate:execute:dry-run

# Skip backup (not recommended)
npx ts-node scripts/migration-executor.ts --skip-backup

# Force rollback
npm run migrate:rollback

# Custom connection string
npx ts-node scripts/migration-executor.ts --connection-string "postgresql://..."
```

#### Command Line Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Validate migration without executing |
| `--skip-backup` | Skip SQLite backup creation |
| `--verbose` | Enable detailed logging |
| `--force-rollback` | Perform rollback operation |
| `--connection-string <url>` | Custom Neon database connection string |
| `--backup-path <path>` | Specific backup file for rollback |

### 2. Post-Migration Verifier (`scripts/post-migration-verification.ts`)

The Post-Migration Verifier ensures the migration was successful and the system is functioning correctly:

#### Features
- **Data Integrity Checks**: Compares SQLite and PostgreSQL data
- **API Endpoint Testing**: Validates all API routes work with new database
- **Concurrent Access Testing**: Tests connection pooling and concurrent queries
- **Performance Validation**: Benchmarks query performance and connection times
- **Detailed Reporting**: Generates comprehensive verification reports

#### Usage

```bash
# Basic verification
npm run verify:migration

# Verbose verification
npm run verify:migration:verbose

# Skip API tests
npx ts-node scripts/post-migration-verification.ts --skip-api-tests

# Skip performance tests
npx ts-node scripts/post-migration-verification.ts --skip-performance-tests

# Custom concurrent connections
npx ts-node scripts/post-migration-verification.ts --concurrent-connections 10
```

#### Command Line Options

| Option | Description |
|--------|-------------|
| `--verbose` | Enable detailed logging |
| `--skip-api-tests` | Skip API endpoint testing |
| `--skip-performance-tests` | Skip performance benchmarks |
| `--connection-string <url>` | Custom Neon database connection string |
| `--concurrent-connections <n>` | Number of concurrent connections to test |

#### Verification Tests

1. **Data Integrity**
   - Record count comparison between SQLite and PostgreSQL
   - Foreign key integrity validation
   - Sample data verification

2. **API Endpoints**
   - Health check endpoints
   - Package tracking functionality
   - Admin package creation

3. **Concurrent Access**
   - Connection pool stress testing
   - Concurrent query execution
   - Connection time benchmarks

4. **Performance**
   - Query response time benchmarks
   - Connection pool status monitoring
   - Memory usage analysis

### 3. Migration Orchestrator (`scripts/migration-orchestrator.ts`)

The Migration Orchestrator provides a complete end-to-end migration workflow:

#### Features
- **Complete Workflow**: Combines execution and verification
- **Automatic Rollback**: Rolls back on verification failure
- **Comprehensive Reporting**: Generates detailed reports in JSON and Markdown
- **Flexible Configuration**: Customizable verification settings

#### Usage

```bash
# Full migration with verification
npm run migrate:full

# Dry run
npm run migrate:full:dry-run

# Skip verification
npx ts-node scripts/migration-orchestrator.ts --skip-verification

# Disable auto-rollback
npx ts-node scripts/migration-orchestrator.ts --no-auto-rollback
```

#### Command Line Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Validate migration without executing |
| `--skip-backup` | Skip SQLite backup creation |
| `--skip-verification` | Skip post-migration verification |
| `--verbose` | Enable detailed logging |
| `--no-auto-rollback` | Disable automatic rollback on failure |
| `--skip-api-tests` | Skip API endpoint testing in verification |
| `--skip-performance-tests` | Skip performance benchmarks |
| `--concurrent-connections <n>` | Number of concurrent connections to test |

## Environment Variables

Ensure these environment variables are set before running migration:

```bash
# Required
NEON_DATABASE_URL=postgresql://username:password@host:port/database

# Optional
DATABASE_PATH=./data/swiftship.db  # SQLite database path
NEON_MAX_CONNECTIONS=10           # Connection pool size
NEON_IDLE_TIMEOUT=30000          # Connection idle timeout (ms)
NEON_CONNECTION_TIMEOUT=10000    # Connection timeout (ms)
```

## Migration Process

### Phase 1: Pre-Migration

1. **Environment Validation**
   - Check required environment variables
   - Validate Neon database connection
   - Verify SQLite database exists

2. **Backup Creation**
   - Create timestamped SQLite backup
   - Verify backup integrity

### Phase 2: Migration Execution

1. **Schema Setup**
   - Create PostgreSQL tables
   - Set up indexes for performance
   - Configure foreign key constraints

2. **Data Migration**
   - Export data from SQLite
   - Transform data for PostgreSQL compatibility
   - Bulk import with transaction safety

3. **Integrity Verification**
   - Compare record counts
   - Validate foreign key relationships
   - Verify sample data accuracy

### Phase 3: Post-Migration Verification

1. **Data Integrity Tests**
   - Comprehensive data comparison
   - Foreign key integrity checks
   - Sample data verification

2. **Functional Tests**
   - API endpoint validation
   - Database operation tests
   - Error handling verification

3. **Performance Tests**
   - Query response time benchmarks
   - Connection pool efficiency
   - Concurrent access validation

## Error Handling and Rollback

### Automatic Rollback Triggers

- Migration execution failures
- Data integrity verification failures
- Critical API endpoint failures
- Performance threshold violations

### Rollback Process

1. **PostgreSQL Cleanup**
   - Drop migrated tables
   - Clean up indexes and constraints

2. **SQLite Restoration**
   - Restore from backup
   - Verify restoration success

3. **Validation**
   - Test restored database
   - Confirm application functionality

### Manual Rollback

```bash
# Rollback using specific backup
npm run migrate:rollback --backup-path ./backups/backup-file.db

# Force rollback (cleanup PostgreSQL only)
npx ts-node scripts/migration-executor.ts --force-rollback
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   ```bash
   # Test connection
   npx ts-node -e "import('./lib/neonDb').then(m => m.validateConnection().then(console.log))"
   ```

2. **Environment Variable Issues**
   ```bash
   # Validate configuration
   npm run validate:config
   ```

3. **Permission Issues**
   - Ensure Neon database user has CREATE, INSERT, UPDATE, DELETE permissions
   - Check file system permissions for backup directory

4. **Performance Issues**
   - Increase connection pool size: `NEON_MAX_CONNECTIONS=20`
   - Adjust timeout values: `NEON_CONNECTION_TIMEOUT=15000`

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
# Verbose migration
npm run migrate:full -- --verbose

# Debug specific component
npx ts-node scripts/migration-executor.ts --verbose --dry-run
```

## Reports and Logs

### Generated Files

- `migration-report-{timestamp}.json` - Detailed JSON report
- `migration-summary-{timestamp}.md` - Human-readable summary
- `verification-report-{timestamp}.json` - Verification details
- `./backups/swiftship-pre-migration-{timestamp}.db` - Database backup

### Report Contents

1. **Configuration Summary**
   - Migration settings
   - Environment configuration
   - Performance thresholds

2. **Execution Results**
   - Migration duration
   - Records migrated
   - Error details

3. **Verification Results**
   - Data integrity status
   - API test results
   - Performance benchmarks

4. **Recommendations**
   - Next steps
   - Optimization suggestions
   - Monitoring recommendations

## Best Practices

### Before Migration

1. **Test in Development**
   ```bash
   # Always test with dry run first
   npm run migrate:full:dry-run
   ```

2. **Backup Verification**
   - Verify backup creation is working
   - Test backup restoration process

3. **Environment Preparation**
   - Ensure Neon database is properly configured
   - Verify network connectivity
   - Check available disk space

### During Migration

1. **Monitor Progress**
   - Use verbose mode for detailed logging
   - Monitor system resources
   - Watch for error messages

2. **Avoid Interruption**
   - Don't cancel migration mid-process
   - Ensure stable network connection
   - Monitor system resources

### After Migration

1. **Verify Results**
   - Review verification report
   - Test application functionality
   - Monitor performance metrics

2. **Update Configuration**
   - Update environment variables
   - Deploy application changes
   - Update documentation

3. **Cleanup**
   - Archive SQLite backups
   - Remove temporary files
   - Update monitoring systems

## Performance Tuning

### Connection Pool Optimization

```bash
# For high-traffic applications
NEON_MAX_CONNECTIONS=20
NEON_IDLE_TIMEOUT=60000
NEON_CONNECTION_TIMEOUT=15000
```

### Query Optimization

The migration creates optimized indexes:

- `idx_packages_tracking_number` - Fast tracking number lookups
- `idx_status_updates_package_id` - Efficient status history queries
- `idx_status_updates_timestamp` - Time-based sorting
- `idx_contact_submissions_submitted_at` - Admin dashboard queries

### Monitoring

Set up monitoring for:

- Connection pool utilization
- Query response times
- Error rates
- Memory usage

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review generated reports for error details
3. Run with `--verbose` flag for detailed logging
4. Ensure all environment variables are correctly set

## Migration Checklist

- [ ] Environment variables configured
- [ ] Neon database accessible
- [ ] SQLite database backed up
- [ ] Dry run completed successfully
- [ ] Migration executed successfully
- [ ] Verification passed
- [ ] Application tested with new database
- [ ] Performance monitoring in place
- [ ] Documentation updated