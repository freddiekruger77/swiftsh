import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  getAllPackages, 
  getAllContactSubmissions,
  markContactSubmissionResolved,
  initDatabase,
  PackageData,
  ContactSubmission 
} from '@/lib/postgresDb'

type AdminPackagesResponse = {
  success: boolean
  message: string
  packages?: PackageData[]
  contacts?: ContactSubmission[]
  error?: string
}

import { requireAuth, AuthenticatedRequest } from '@/lib/auth'

async function adminPackagesHandler(
  req: AuthenticatedRequest,
  res: NextApiResponse<AdminPackagesResponse>
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
    const { type } = req.query

    try {
      if (type === 'contacts') {
        // Get all contact submissions
        const contacts = await getAllContactSubmissions()
        
        return res.status(200).json({
          success: true,
          message: 'Contact submissions retrieved successfully',
          contacts
        })
      } else {
        // Get all packages (default)
        const packages = await getAllPackages()
        
        return res.status(200).json({
          success: true,
          message: 'Packages retrieved successfully',
          packages
        })
      }
    } catch (error) {
      console.error('Error getting admin data:', error)
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve data',
        error: 'Internal server error'
      })
    }
  }

  if (req.method === 'POST') {
    const { action, contactId } = req.body

    if (action === 'resolve-contact') {
      if (!contactId) {
        return res.status(400).json({
          success: false,
          message: 'Contact ID is required',
          error: 'Missing contact ID'
        })
      }

      try {
        const resolved = await markContactSubmissionResolved(contactId)
        
        if (!resolved) {
          return res.status(404).json({
            success: false,
            message: 'Contact submission not found',
            error: 'Invalid contact ID'
          })
        }

        return res.status(200).json({
          success: true,
          message: 'Contact submission marked as resolved'
        })
      } catch (error) {
        console.error('Error resolving contact:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to resolve contact submission',
          error: 'Internal server error'
        })
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid action',
      error: 'Unknown action'
    })
  }

  // Method not allowed
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
    error: 'Invalid request method'
  })
}

// Export the handler wrapped with authentication
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminPackagesResponse>
) {
  return requireAuth(req, res, adminPackagesHandler)
}