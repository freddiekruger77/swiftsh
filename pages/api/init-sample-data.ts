import type { NextApiRequest, NextApiResponse } from 'next'
import { initDatabase } from '@/lib/db'
import { initializeProductionDatabase } from '@/lib/dbInit'

type InitResponse = {
  success: boolean
  message: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InitResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    })
  }

  try {
    console.log('Initializing database and sample data...')
    
    // Initialize database schema
    await initDatabase()
    
    // Initialize with sample data (including SW240567MXC)
    await initializeProductionDatabase()
    
    return res.status(200).json({
      success: true,
      message: 'Database and sample data initialized successfully'
    })
    
  } catch (error) {
    console.error('Database initialization error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize database',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}