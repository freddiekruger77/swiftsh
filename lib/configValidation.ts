// Configuration validation utilities for Neon DB migration

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Validate all required environment variables for Neon DB
export const validateNeonEnvironment = (): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Required environment variables
  const requiredVars = [
    'NEON_DATABASE_URL',
    'NEXTAUTH_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD'
  ]
  
  // Check required variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`)
    }
  })
  
  // Validate NEON_DATABASE_URL format
  if (process.env.NEON_DATABASE_URL) {
    if (!process.env.NEON_DATABASE_URL.startsWith('postgresql://')) {
      errors.push('NEON_DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://')
    }
    
    if (!process.env.NEON_DATABASE_URL.includes('sslmode=require')) {
      warnings.push('NEON_DATABASE_URL should include sslmode=require for secure connections')
    }
    
    if (!process.env.NEON_DATABASE_URL.includes('neon.tech')) {
      warnings.push('NEON_DATABASE_URL does not appear to be a Neon database URL')
    }
  }
  
  // Validate numeric configuration values
  const numericVars = [
    { name: 'NEON_MAX_CONNECTIONS', defaultValue: 10, min: 1, max: 100 },
    { name: 'NEON_IDLE_TIMEOUT', defaultValue: 30000, min: 1000, max: 300000 },
    { name: 'NEON_CONNECTION_TIMEOUT', defaultValue: 10000, min: 1000, max: 60000 }
  ]
  
  numericVars.forEach(({ name, defaultValue, min, max }) => {
    const value = process.env[name]
    if (value) {
      const numValue = parseInt(value)
      if (isNaN(numValue)) {
        errors.push(`${name} must be a valid number`)
      } else if (numValue < min || numValue > max) {
        errors.push(`${name} must be between ${min} and ${max}`)
      }
    } else {
      warnings.push(`${name} not set, using default value: ${defaultValue}`)
    }
  })
  
  // Validate NEXTAUTH_SECRET strength
  if (process.env.NEXTAUTH_SECRET) {
    if (process.env.NEXTAUTH_SECRET.length < 32) {
      warnings.push('NEXTAUTH_SECRET should be at least 32 characters long for security')
    }
    
    if (process.env.NEXTAUTH_SECRET === 'your-super-secret-jwt-secret-change-this-in-production') {
      errors.push('NEXTAUTH_SECRET must be changed from the default example value')
    }
  }
  
  // Validate admin credentials
  if (process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 8) {
      warnings.push('ADMIN_PASSWORD should be at least 8 characters long')
    }
    
    if (process.env.ADMIN_PASSWORD === 'admin123' || process.env.ADMIN_PASSWORD === 'your-secure-admin-password') {
      errors.push('ADMIN_PASSWORD must be changed from the default example value')
    }
  }
  
  // Validate email format
  if (process.env.ADMIN_EMAIL) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(process.env.ADMIN_EMAIL)) {
      errors.push('ADMIN_EMAIL must be a valid email address')
    }
  }
  
  // Environment-specific validations
  if (process.env.NODE_ENV === 'production') {
    if (process.env.SEED_DATABASE === 'true') {
      warnings.push('SEED_DATABASE is enabled in production - this may overwrite existing data')
    }
    
    if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes('localhost')) {
      errors.push('NEXTAUTH_URL must be set to your production domain in production environment')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// Validate configuration and provide helpful error messages
export const validateConfigurationOnStartup = (): void => {
  console.log('🔍 Validating Neon DB configuration...')
  
  const result = validateNeonEnvironment()
  
  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:')
    result.warnings.forEach(warning => console.warn(`   - ${warning}`))
  }
  
  // Log errors and exit if invalid
  if (!result.valid) {
    console.error('❌ Configuration validation failed:')
    result.errors.forEach(error => console.error(`   - ${error}`))
    console.error('\n📖 Please check your environment variables and refer to .env.netlify.neon.example for guidance')
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid configuration - cannot start application')
    } else {
      console.warn('⚠️  Development mode: continuing with invalid configuration (some features may not work)')
    }
  } else {
    console.log('✅ Configuration validation passed')
  }
}

// Get configuration summary for health checks
export const getConfigurationSummary = () => {
  return {
    neonConfigured: !!process.env.NEON_DATABASE_URL,
    maxConnections: parseInt(process.env.NEON_MAX_CONNECTIONS || '10'),
    idleTimeout: parseInt(process.env.NEON_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.NEON_CONNECTION_TIMEOUT || '10000'),
    environment: process.env.NODE_ENV || 'development',
    authConfigured: !!process.env.NEXTAUTH_SECRET,
    adminConfigured: !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
  }
}

// Check if we're in a serverless environment
export const isServerlessEnvironment = (): boolean => {
  return !!(
    process.env.NETLIFY || 
    process.env.AWS_LAMBDA_FUNCTION_NAME || 
    process.env.VERCEL ||
    process.env.NODE_ENV === 'production'
  )
}

// Get environment-specific recommendations
export const getEnvironmentRecommendations = (): string[] => {
  const recommendations: string[] = []
  
  if (isServerlessEnvironment()) {
    recommendations.push('Consider using connection pooling for better performance in serverless environments')
    recommendations.push('Set NEON_MAX_CONNECTIONS based on your Neon DB plan limits')
    recommendations.push('Use shorter idle timeouts to prevent connection exhaustion')
  }
  
  if (process.env.NODE_ENV === 'production') {
    recommendations.push('Ensure NEXTAUTH_SECRET is a cryptographically secure random string')
    recommendations.push('Use strong admin credentials and consider implementing 2FA')
    recommendations.push('Monitor connection pool usage and adjust limits as needed')
    recommendations.push('Set up database monitoring and alerting')
  }
  
  return recommendations
}