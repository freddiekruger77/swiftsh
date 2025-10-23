import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  createPackage, 
  updatePackage, 
  createStatusUpdate, 
  getPackageByTrackingNumber,
  initDatabase,
  PackageStatus,
  PackageData 
} from '@/lib/postgresDb'

type AdminResponse = {
  success: boolean
  message: string
  package?: PackageData
  error?: string
}

import { requireAuth, AuthenticatedRequest } from '@/lib/auth'

async function adminUpdateHandler(
  req: AuthenticatedRequest,
  res: NextApiResponse<AdminResponse>
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

  if (req.method === 'POST') {
    const { action, trackingNumber, status, location, destination, notes, customerName, customerEmail, estimatedDelivery } = req.body
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required',
        error: 'Missing action parameter'
      })
    }

    try {
      if (action === 'create') {
        // Create new package
        if (!trackingNumber || !status || !location || !destination) {
          return res.status(400).json({
            success: false,
            message: 'Tracking number, status, current location, and destination are required',
            error: 'Missing required fields'
          })
        }

        const packageData = await createPackage({
          trackingNumber,
          status,
          currentLocation: location,
          destination,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined
        })

        // Create initial status update
        await createStatusUpdate({
          packageId: packageData.id,
          status,
          location,
          notes: notes || `Package created with status: ${status}`
        })

        return res.status(201).json({
          success: true,
          message: 'Package created successfully',
          package: packageData
        })
      }

      if (action === 'update') {
        // Update existing package
        if (!trackingNumber) {
          return res.status(400).json({
            success: false,
            message: 'Tracking number is required',
            error: 'Missing tracking number'
          })
        }

        const existingPackage = await getPackageByTrackingNumber(trackingNumber)
        if (!existingPackage) {
          return res.status(404).json({
            success: false,
            message: 'Package not found',
            error: 'Invalid tracking number'
          })
        }

        // Prepare update data
        const updates: Partial<PackageData> = {}
        if (status) updates.status = status
        if (location) updates.currentLocation = location
        if (destination) updates.destination = destination
        if (customerName !== undefined) updates.customerName = customerName
        if (customerEmail !== undefined) updates.customerEmail = customerEmail
        if (estimatedDelivery) updates.estimatedDelivery = new Date(estimatedDelivery)

        const updatedPackage = await updatePackage(existingPackage.id, updates)

        // Create status update if status or location changed
        if (status || location) {
          await createStatusUpdate({
            packageId: existingPackage.id,
            status: status || existingPackage.status,
            location: location || existingPackage.currentLocation,
            notes: notes || `Package updated: ${status ? `Status changed to ${status}` : ''}${location ? ` Location: ${location}` : ''}`
          })
        }

        return res.status(200).json({
          success: true,
          message: 'Package updated successfully',
          package: updatedPackage!
        })
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "create" or "update"',
        error: 'Invalid action'
      })

    } catch (error) {
      console.error('Error in admin update:', error)
      return res.status(500).json({
        success: false,
        message: 'Failed to process admin request',
        error: 'Internal server error'
      })
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['POST'])
  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
    error: 'Invalid request method'
  })
}

// Export the handler wrapped with authentication
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminResponse>
) {
  return requireAuth(req, res, adminUpdateHandler)
}