// Test setup file for Jest
// This file runs before each test suite

// Set test environment variables
;(process.env as any).NODE_ENV = 'test'
process.env.NEON_DATABASE_URL = process.env.TEST_NEON_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'
process.env.NEON_MAX_CONNECTIONS = '5'
process.env.NEON_IDLE_TIMEOUT = '10000'
process.env.NEON_CONNECTION_TIMEOUT = '5000'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.ADMIN_EMAIL = 'test@example.com'
process.env.ADMIN_PASSWORD = 'testpassword123'

// Increase timeout for database operations
jest.setTimeout(30000)

// Global test cleanup
afterAll(async () => {
  // Close any open database connections
  try {
    const { closePool } = await import('../lib/neonDb')
    await closePool()
  } catch (error) {
    console.warn('Error closing database pool in test cleanup:', error)
  }
})