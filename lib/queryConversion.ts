// SQL query conversion utilities for SQLite to PostgreSQL migration
// Documents and handles differences between SQLite and PostgreSQL syntax

// Query conversion mappings and utilities
export const QUERY_CONVERSIONS = {
  // Data type conversions
  dataTypes: {
    'TEXT': 'TEXT',
    'INTEGER': 'INTEGER',
    'REAL': 'DECIMAL',
    'BLOB': 'BYTEA',
    'BOOLEAN': 'BOOLEAN',
    'DATETIME': 'TIMESTAMP WITH TIME ZONE',
    'VARCHAR(255)': 'VARCHAR(255)'
  },

  // Function conversions
  functions: {
    'datetime()': 'NOW()',
    'strftime()': 'TO_CHAR()',
    'substr()': 'SUBSTRING()',
    'length()': 'LENGTH()',
    'upper()': 'UPPER()',
    'lower()': 'LOWER()',
    'trim()': 'TRIM()',
    'replace()': 'REPLACE()',
    'coalesce()': 'COALESCE()',
    'ifnull()': 'COALESCE()',
    'random()': 'RANDOM()',
    'abs()': 'ABS()',
    'round()': 'ROUND()'
  },

  // Operator conversions
  operators: {
    '||': '||', // String concatenation (same in both)
    'LIKE': 'ILIKE', // Case-insensitive LIKE in PostgreSQL
    'GLOB': '~*', // Pattern matching
    'REGEXP': '~', // Regular expression matching
  },

  // Constraint conversions
  constraints: {
    'AUTOINCREMENT': 'SERIAL',
    'PRIMARY KEY': 'PRIMARY KEY',
    'UNIQUE': 'UNIQUE',
    'NOT NULL': 'NOT NULL',
    'DEFAULT': 'DEFAULT',
    'CHECK': 'CHECK',
    'FOREIGN KEY': 'FOREIGN KEY'
  }
}

// Common SQLite to PostgreSQL query patterns
export const QUERY_PATTERNS = {
  // Date/time handling
  sqliteDateTime: {
    pattern: /datetime\('now'\)/gi,
    replacement: 'NOW()'
  },
  
  sqliteDateFormat: {
    pattern: /strftime\('([^']+)',\s*([^)]+)\)/gi,
    replacement: "TO_CHAR($2, '$1')"
  },

  // Boolean handling
  sqliteBoolean: {
    pattern: /\b(true|false)\b/gi,
    replacement: (match: string) => match.toLowerCase() === 'true' ? 'TRUE' : 'FALSE'
  },

  // LIMIT/OFFSET syntax (same in both, but documenting)
  limitOffset: {
    pattern: /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/gi,
    replacement: 'LIMIT $1 OFFSET $2'
  },

  // Parameter placeholders
  sqliteParams: {
    pattern: /\?/g,
    replacement: (match: string, offset: number, string: string) => {
      // Count how many ? appear before this one
      const beforeThis = string.substring(0, offset)
      const paramNumber = (beforeThis.match(/\?/g) || []).length + 1
      return `$${paramNumber}`
    }
  }
}

// Convert SQLite query to PostgreSQL
export const convertSQLiteToPostgreSQL = (sqliteQuery: string): string => {
  let postgresQuery = sqliteQuery

  // Apply pattern conversions
  Object.values(QUERY_PATTERNS).forEach(pattern => {
    if ('replacement' in pattern && typeof pattern.replacement === 'string') {
      postgresQuery = postgresQuery.replace(pattern.pattern, pattern.replacement)
    } else if ('replacement' in pattern && typeof pattern.replacement === 'function') {
      postgresQuery = postgresQuery.replace(pattern.pattern, pattern.replacement)
    }
  })

  // Convert function names
  Object.entries(QUERY_CONVERSIONS.functions).forEach(([sqlite, postgres]) => {
    const pattern = new RegExp(`\\b${sqlite.replace('()', '\\(')}`, 'gi')
    postgresQuery = postgresQuery.replace(pattern, postgres.replace('()', '('))
  })

  return postgresQuery
}

// Validate PostgreSQL query syntax
export const validatePostgreSQLQuery = (query: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Check for common SQLite-specific syntax that won't work in PostgreSQL
  const sqliteSpecific = [
    { pattern: /AUTOINCREMENT/i, message: 'Use SERIAL instead of AUTOINCREMENT' },
    { pattern: /PRAGMA\s+/i, message: 'PRAGMA statements are SQLite-specific' },
    { pattern: /sqlite_master/i, message: 'Use information_schema instead of sqlite_master' },
    { pattern: /GLOB\s+/i, message: 'Use ~ or ~* instead of GLOB' },
    { pattern: /\?\s*(?!\d)/g, message: 'Use $1, $2, etc. instead of ? for parameters' },
    { pattern: /ifnull\s*\(/i, message: 'Use COALESCE() instead of IFNULL()' }
  ]

  sqliteSpecific.forEach(({ pattern, message }) => {
    if (pattern.test(query)) {
      errors.push(message)
    }
  })

  // Check for PostgreSQL-specific requirements
  const postgresRequirements = [
    {
      pattern: /INSERT\s+INTO\s+\w+.*VALUES.*RETURNING/i,
      required: false,
      message: 'Consider using RETURNING clause for INSERT statements'
    },
    {
      pattern: /UPDATE\s+\w+.*SET.*RETURNING/i,
      required: false,
      message: 'Consider using RETURNING clause for UPDATE statements'
    }
  ]

  return {
    valid: errors.length === 0,
    errors
  }
}

// PostgreSQL-specific query builders
export const PostgreSQLQueries = {
  // Get table information
  getTableInfo: (tableName: string) => `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `,

  // Get index information
  getIndexInfo: (tableName: string) => `
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = $1 AND schemaname = 'public'
  `,

  // Get foreign key constraints
  getForeignKeys: (tableName: string) => `
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `,

  // Get table size and statistics
  getTableStats: (tableName: string) => `
    SELECT 
      schemaname,
      tablename,
      attname,
      n_distinct,
      correlation
    FROM pg_stats
    WHERE tablename = $1 AND schemaname = 'public'
  `,

  // Analyze query performance
  explainQuery: (query: string) => `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,

  // Get connection information
  getConnectionInfo: () => `
    SELECT 
      pid,
      usename,
      application_name,
      client_addr,
      state,
      query_start,
      state_change
    FROM pg_stat_activity
    WHERE state = 'active'
  `,

  // Get database size
  getDatabaseSize: () => `
    SELECT 
      pg_size_pretty(pg_database_size(current_database())) as size,
      pg_database_size(current_database()) as size_bytes
  `,

  // Get table sizes
  getTableSizes: () => `
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
      pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `
}

// Query optimization suggestions for PostgreSQL
export const getQueryOptimizationSuggestions = (query: string): string[] => {
  const suggestions: string[] = []

  // Check for missing indexes
  if (/WHERE\s+\w+\s*=/.test(query) && !/INDEX/i.test(query)) {
    suggestions.push('Consider adding an index on frequently queried columns')
  }

  // Check for SELECT *
  if (/SELECT\s+\*/i.test(query)) {
    suggestions.push('Avoid SELECT * - specify only needed columns for better performance')
  }

  // Check for ORDER BY without LIMIT
  if (/ORDER\s+BY/i.test(query) && !/LIMIT/i.test(query)) {
    suggestions.push('Consider adding LIMIT when using ORDER BY to improve performance')
  }

  // Check for subqueries that could be JOINs
  if (/SELECT.*\(\s*SELECT/i.test(query)) {
    suggestions.push('Consider converting subqueries to JOINs for better performance')
  }

  // Check for LIKE with leading wildcard
  if (/LIKE\s+['"]%/i.test(query)) {
    suggestions.push('LIKE patterns starting with % cannot use indexes efficiently')
  }

  // Check for functions in WHERE clause
  if (/WHERE\s+\w+\s*\(/i.test(query)) {
    suggestions.push('Functions in WHERE clauses prevent index usage - consider functional indexes')
  }

  return suggestions
}

// Common PostgreSQL query templates for SwiftShip
export const SwiftShipQueries = {
  // Package queries
  findPackageByTrackingNumber: `
    SELECT * FROM packages 
    WHERE tracking_number = $1
  `,

  findPackagesByStatus: `
    SELECT * FROM packages 
    WHERE status = $1 
    ORDER BY last_updated DESC
  `,

  findRecentPackages: `
    SELECT * FROM packages 
    ORDER BY last_updated DESC 
    LIMIT $1
  `,

  updatePackageStatus: `
    UPDATE packages 
    SET status = $2, current_location = $3, last_updated = NOW()
    WHERE id = $1
    RETURNING *
  `,

  // Status update queries
  getPackageStatusHistory: `
    SELECT * FROM status_updates 
    WHERE package_id = $1 
    ORDER BY timestamp DESC
  `,

  addStatusUpdate: `
    INSERT INTO status_updates (id, package_id, status, location, timestamp, notes)
    VALUES ($1, $2, $3, $4, NOW(), $5)
    RETURNING *
  `,

  // Contact submission queries
  getUnresolvedContacts: `
    SELECT * FROM contact_submissions 
    WHERE resolved = false 
    ORDER BY submitted_at DESC
  `,

  markContactResolved: `
    UPDATE contact_submissions 
    SET resolved = true 
    WHERE id = $1
    RETURNING *
  `,

  // Analytics queries
  getPackageStatsByStatus: `
    SELECT 
      status,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (last_updated - created_at))/3600) as avg_hours
    FROM packages 
    GROUP BY status
  `,

  getDeliveryPerformance: `
    SELECT 
      DATE_TRUNC('day', last_updated) as date,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) as total
    FROM packages 
    WHERE last_updated >= NOW() - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', last_updated)
    ORDER BY date DESC
  `
}

// Export utility functions
export const queryUtils = {
  convertSQLiteToPostgreSQL,
  validatePostgreSQLQuery,
  getQueryOptimizationSuggestions
}