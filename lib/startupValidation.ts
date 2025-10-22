// Application startup configuration validation for Neon DB migration
// Validates all required environment variables and configuration on startup

import { validateNeonConfig, validateNeonEnvironment } from './configValidation'

// Startup validation result interface
export interface StartupValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  recommendations: string[]
  configuration: {
    environment: string
    database: 'neon' | 'sqlite' | 'unknown'
    deployment: 'netlify' | 'vercel' | 'local' | 'unknown'
    ssl: boolean
    pooling: boolean
  }
}

// Critical environment variables that must be present
const CRITICAL_ENV_VARS = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD'
]

// Neon-specific environment variables
const NEON_ENV_VARS = [
  'NEON_DATABASE_URL',
  'NEON_MAX_CONNECTIONS',
  'NEON_IDLE_TIMEOUT',
  'NEON_CONNECTION_TIMEOUT'
]

// Optional environment variables with defaults
const OPTIONAL_ENV_VARS = {
  'NODE_ENV': 'development',
  'SEED_DATABASE': 'false',
  'ENABLE_QUERY_LOGGING': 'false',
  'AUTO_MIGRATE_ON_STARTUP': 'false',
  'BACKUP_BEFORE_MIGRATION': 'true',
  'ENABLE_PERFORMANCE_MONITORING': 'true',
  'SLOW_QUERY_THRESHOLD': '1000',
  'APP_VERSION': '1.0.0'
}

// Perform comprehensive startup validation
export const performStartupValidation = async (): Promise<StartupValidationResult> => {
  const result: StartupValidationResult = {
    success: false,
    errors: [],
    warnings: [],
    recommendations: [],
    configuration: {
      environment: process.env.NODE_ENV || 'development',
      database: 'unknown',
      deployment: 'unknown',
      ssl: false,
      pooling: false
    }
  }

  console.log('🔍 Starting application configuration validation...')

  try {
    // 1. Validate critical environment variables
    validateCriticalEnvironmentVariables(result)

    // 2. Detect database type and validate accordingly
    detectAndValidateDatabase(result)

    // 3. Detect deployment environment
    detectDeploymentEnvironment(result)

    // 4. Validate security configuration
    validateSecurityConfiguration(result)

    // 5. Validate performance configuration
    validatePerformanceConfiguration(result)

    // 6. Generate recommendations
    generateRecommendations(result)

    // 7. Determine overall success
    result.success = result.errors.length === 0

    // Log validation results
    logValidationResults(result)

    return result

  } catch (error) {
    result.errors.push(`Startup validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result.success = false
    console.error('❌ Startup validation failed:', error)
    return result
  }
}

// Validate critical environment variables
const validateCriticalEnvironmentVariables = (result: StartupValidationResult): void => {
  console.log('📋 Validating critical environment variables...')

  CRITICAL_ENV_VARS.forEach(varName => {
    const value = process.env[varName]
    
    if (!value) {
      result.errors.push(`Missing required environment variable: ${varName}`)
    } else {
      // Validate specific formats
      switch (varName) {
        case 'NEXTAUTH_URL':
          if (!value.startsWith('http://') && !value.startsWith('https://')) {
            result.errors.push('NEXTAUTH_URL must be a valid URL starting with http:// or https://')
          }
          break
          
        case 'NEXTAUTH_SECRET':
          if (value.length < 32) {
            result.errors.push('NEXTAUTH_SECRET must be at least 32 characters long')
          }
          break
          
        case 'ADMIN_EMAIL':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            result.errors.push('ADMIN_EMAIL must be a valid email address')
          }
          break
          
        case 'ADMIN_PASSWORD':
          if (value.length < 8) {
            result.errors.push('ADMIN_PASSWORD must be at least 8 characters long')
          }
          break
      }
    }
  })
}

// Detect and validate database configuration
const detectAndValidateDatabase = (result: StartupValidationResult): void => {
  console.log('🗄️ Detecting and validating database configuration...')

  const neonUrl = process.env.NEON_DATABASE_URL
  const sqlitePath = process.env.DATABASE_PATH

  if (neonUrl) {
    result.configuration.database = 'neon'
    result.configuration.ssl = neonUrl.includes('sslmode=require') || neonUrl.includes('ssl=true')
    result.configuration.pooling = true

    // Validate Neon configuration
    const neonValidation = validateNeonConfig()
    const envValidation = validateNeonEnvironment()

    result.errors.push(...neonValidation.errors)
    result.errors.push(...envValidation.errors)
    result.warnings.push(...envValidation.warnings)

    // Validate Neon-specific environment variables
    NEON_ENV_VARS.forEach(varName => {
      const value = process.env[varName]
      
      if (!value) {
        result.errors.push(`Missing required Neon environment variable: ${varName}`)
      } else if (varName.includes('CONNECTIONS') || varName.includes('TIMEOUT')) {
        const numValue = parseInt(value)
        if (isNaN(numValue) || numValue <= 0) {
          result.errors.push(`${varName} must be a positive integer`)
        }
      }
    })

    // Validate connection string format
    if (!neonUrl.startsWith('postgresql://')) {
      result.errors.push('NEON_DATABASE_URL must be a valid PostgreSQL connection string')
    }

  } else if (sqlitePath) {
    result.configuration.database = 'sqlite'
    result.configuration.ssl = false
    result.configuration.pooling = false
    result.warnings.push('Using SQLite database - consider migrating to Neon for production')
  } else {
    result.errors.push('No database configuration found - set either NEON_DATABASE_URL or DATABASE_PATH')
  }
}

// Detect deployment environment
const detectDeploymentEnvironment = (result: StartupValidationResult): void => {
  console.log('🚀 Detecting deployment environment...')

  if (process.env.NETLIFY) {
    result.configuration.deployment = 'netlify'
    
    // Netlify-specific validations
    if (!process.env.NETLIFY_REGION) {
      result.warnings.push('NETLIFY_REGION not set - may affect performance')
    }
    
  } else if (process.env.VERCEL) {
    result.configuration.deployment = 'vercel'
    
  } else if (process.env.NODE_ENV === 'development') {
    result.configuration.deployment = 'local'
    
  } else {
    result.configuration.deployment = 'unknown'
    result.warnings.push('Unknown deployment environment detected')
  }
}

// Validate security configuration
const validateSecurityConfiguration = (result: StartupValidationResult): void => {
  console.log('🔒 Validating security configuration...')

  // Check for production security settings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ADMIN_PASSWORD === 'admin' || process.env.ADMIN_PASSWORD === 'password') {
      result.errors.push('Default admin password detected in production - change immediately')
    }
    
    if (process.env.NEXTAUTH_SECRET === 'your-super-secret-jwt-secret-change-this-in-production') {
      result.errors.push('Default NextAuth secret detected in production - change immediately')
    }
    
    if (process.env.NEXTAUTH_URL?.includes('localhost')) {
      result.errors.push('Localhost URL detected in production environment')
    }
    
    if (result.configuration.database === 'neon' && !result.configuration.ssl) {
      result.errors.push('SSL not enabled for production Neon database connection')
    }
  }

  // Check for development security warnings
  if (process.env.NODE_ENV === 'development') {
    if (process.env.ENABLE_QUERY_LOGGING !== 'true') {
      result.recommendations.push('Enable query logging in development: ENABLE_QUERY_LOGGING=true')
    }
  }
}

// Validate performance configuration
const validatePerformanceConfiguration = (result: StartupValidationResult): void => {
  console.log('⚡ Validating performance configuration...')

  if (result.configuration.database === 'neon') {
    const maxConnections = parseInt(process.env.NEON_MAX_CONNECTIONS || '10')
    const idleTimeout = parseInt(process.env.NEON_IDLE_TIMEOUT || '30000')
    const connectionTimeout = parseInt(process.env.NEON_CONNECTION_TIMEOUT || '10000')

    // Connection pool recommendations
    if (maxConnections > 50 && result.configuration.deployment === 'netlify') {
      result.warnings.push('High connection limit for serverless environment - consider reducing NEON_MAX_CONNECTIONS')
    }
    
    if (maxConnections < 5) {
      result.warnings.push('Very low connection limit - may cause performance issues under load')
    }
    
    if (idleTimeout < 10000) {
      result.warnings.push('Very short idle timeout - may cause frequent reconnections')
    }
    
    if (connectionTimeout > 30000) {
      result.warnings.push('Very long connection timeout - may cause slow error responses')
    }
  }

  // Performance monitoring recommendations
  if (process.env.ENABLE_PERFORMANCE_MONITORING !== 'true' && process.env.NODE_ENV === 'production') {
    result.recommendations.push('Enable performance monitoring in production: ENABLE_PERFORMANCE_MONITORING=true')
  }
}

// Generate configuration recommendations
const generateRecommendations = (result: StartupValidationResult): void => {
  console.log('💡 Generating configuration recommendations...')

  // Environment-specific recommendations
  if (result.configuration.environment === 'production') {
    if (process.env.SEED_DATABASE === 'true') {
      result.warnings.push('Database seeding enabled in production - consider disabling')
    }
    
    if (process.env.ENABLE_QUERY_LOGGING === 'true') {
      result.recommendations.push('Disable query logging in production for better performance')
    }
  }

  // Database-specific recommendations
  if (result.configuration.database === 'neon') {
    if (!process.env.NEON_REGION) {
      result.recommendations.push('Set NEON_REGION to optimize latency for your users')
    }
    
    if (process.env.AUTO_MIGRATE_ON_STARTUP !== 'true') {
      result.recommendations.push('Consider enabling AUTO_MIGRATE_ON_STARTUP for automatic schema updates')
    }
  }

  // Deployment-specific recommendations
  if (result.configuration.deployment === 'netlify') {
    if (!process.env.NETLIFY_FUNCTION_TIMEOUT) {
      result.recommendations.push('Set NETLIFY_FUNCTION_TIMEOUT for long-running operations')
    }
  }

  // Security recommendations
  if (!process.env.APP_VERSION) {
    result.recommendations.push('Set APP_VERSION for better health check reporting')
  }
}

// Log validation results
const logValidationResults = (result: StartupValidationResult): void => {
  console.log('\n📊 Configuration Validation Results:')
  console.log('=====================================')
  
  console.log(`Environment: ${result.configuration.environment}`)
  console.log(`Database: ${result.configuration.database}`)
  console.log(`Deployment: ${result.configuration.deployment}`)
  console.log(`SSL Enabled: ${result.configuration.ssl}`)
  console.log(`Connection Pooling: ${result.configuration.pooling}`)
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach(error => console.log(`  - ${error}`))
  }
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    result.warnings.forEach(warning => console.log(`  - ${warning}`))
  }
  
  if (result.recommendations.length > 0) {
    console.log('\n💡 Recommendations:')
    result.recommendations.forEach(rec => console.log(`  - ${rec}`))
  }
  
  if (result.success) {
    console.log('\n✅ Configuration validation passed!')
  } else {
    console.log('\n❌ Configuration validation failed!')
    console.log('Please fix the errors above before starting the application.')
  }
  
  console.log('=====================================\n')
}

// Validate configuration and exit if critical errors
export const validateConfigurationOrExit = async (): Promise<void> => {
  const result = await performStartupValidation()
  
  if (!result.success) {
    console.error('💥 Critical configuration errors detected. Application cannot start.')
    console.error('Please fix the configuration errors and try again.')
    process.exit(1)
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Configuration warnings detected. Application will start but may not perform optimally.')
  }
}

// Get current configuration summary
export const getConfigurationSummary = (): any => {
  return {
    environment: process.env.NODE_ENV || 'development',
    database: process.env.NEON_DATABASE_URL ? 'neon' : (process.env.DATABASE_PATH ? 'sqlite' : 'none'),
    deployment: process.env.NETLIFY ? 'netlify' : (process.env.VERCEL ? 'vercel' : 'local'),
    ssl: !!(process.env.NEON_DATABASE_URL?.includes('sslmode=require')),
    pooling: !!process.env.NEON_DATABASE_URL,
    version: process.env.APP_VERSION || 'unknown',
    region: process.env.NEON_REGION || process.env.NETLIFY_REGION || 'unknown'
  }
}