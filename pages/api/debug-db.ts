import type { NextApiRequest, NextApiResponse } from 'next'
import { getAllPackages, getDatabase } from '@/lib/db'

type DebugResponse = {
  success: boolean
  database: {
    connected: boolean
    path: string
    packages: any[]
    packageCount: number
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DebugResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      success: false,
      database: {
        connected: false,
        path: '',
        packages: [],
        packageCount: 0
      },
      error: 'Method not allowed'
    })
  }

  try {
    // Test database connection
    const db = await getDatabase()
    const dbPath = process.env.DATABASE_PATH || '/tmp/swiftship.db'
    
    // Get all packages
    const packages = await getAllPackages()
    
    return res.status(200).json({
      success: true,
      database: {
        connected: true,
        path: dbPath,
        packages: packages,
        packageCount: packages.length
      }
    })
    
  } catch (error) {
    console.error('Database debug error:', error)
    return res.status(500).json({
      success: false,
      database: {
        connected: false,
        path: process.env.DATABASE_PATH || '/tmp/swiftship.db',
        packages: [],
        packageCount: 0
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}