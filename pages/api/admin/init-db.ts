import type { NextApiRequest, NextApiResponse } from 'next'
import { initializeProductionDatabase, checkDatabaseHealth } from '@/lib/dbInit'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth'

type InitDbResponse = {
  success: boolean
  message: string
  error?: string
}

async function initDbHandler(
  req: AuthenticatedRequest,
  res: NextApiResponse<InitDbResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      error: 'Only POST requests are allowed'
    })
  }

  try {
    // Check if database is already healthy
    const isHealthy = await checkDatabaseHealth()
    
    if (isHealthy) {
      return res.status(200).json({
        success: true,
        message: 'Database is already initialized and healthy'
      })
    }

    // Initialize database
    await initializeProductionDatabase()

    // Verify initialization was successful
    const isNowHealthy = await checkDatabaseHealth()
    
    if (isNowHealthy) {
      return res.status(200).json({
        success: true,
        message: 'Database initialized successfully'
      })
    } else {
      return res.status(500).json({
        success: false,
        message: 'Database initialization completed but health check failed',
        error: 'Database may not be fully functional'
      })
    }
  } catch (error) {
    console.error('Database initialization error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize database',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Export the handler wrapped with authentication
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InitDbResponse>
) {
  return requireAuth(req, res, initDbHandler)
}