import type { NextApiRequest, NextApiResponse } from 'next'
import { getPackageByTrackingNumber, getStatusUpdatesByPackageId, initDatabase, PackageData, StatusUpdate } from '@/lib/db'

type TrackingResponse = {
  success: boolean
  message: string
  package?: PackageData & { statusHistory?: StatusUpdate[] }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TrackingResponse>
) {
  // Initialize database on first request
  try {
    await initDatabase()
  } catch (error) {
    console.error('Database initialization failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: 'Internal server error'
    })
  }

  if (req.method === 'GET') {
    // Handle GET request with query parameter
    const { trackingNumber } = req.query
    
    if (!trackingNumber || typeof trackingNumber !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required',
        error: 'Missing tracking number'
      })
    }

    try {
      const packageData = await getPackageByTrackingNumber(trackingNumber)
      
      if (!packageData) {
        return res.status(404).json({
          success: false,
          message: 'Package not found',
          error: 'Invalid tracking number'
        })
      }

      // Get status history for the package
      const statusHistory = await getStatusUpdatesByPackageId(packageData.id)

      return res.status(200).json({
        success: true,
        message: 'Package found',
        package: {
          ...packageData,
          statusHistory
        }
      })
    } catch (error) {
      console.error('Error tracking package:', error)
      return res.status(500).json({
        success: false,
        message: 'Failed to track package',
        error: 'Internal server error'
      })
    }
  }

  if (req.method === 'POST') {
    // Handle POST request with body
    const { trackingNumber } = req.body
    
    if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid tracking number is required',
        error: 'Invalid input'
      })
    }

    try {
      const packageData = await getPackageByTrackingNumber(trackingNumber.trim())
      
      if (!packageData) {
        return res.status(404).json({
          success: false,
          message: 'Package not found. Please check your tracking number and try again.',
          error: 'Package not found'
        })
      }

      // Get status history for the package
      const statusHistory = await getStatusUpdatesByPackageId(packageData.id)

      return res.status(200).json({
        success: true,
        message: 'Package tracking information retrieved successfully',
        package: {
          ...packageData,
          statusHistory
        }
      })
    } catch (error) {
      console.error('Error tracking package:', error)
      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve package information at this time',
        error: 'Internal server error'
      })
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
    error: 'Invalid request method'
  })
}