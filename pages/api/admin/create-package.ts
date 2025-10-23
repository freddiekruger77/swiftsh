import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  createPackage, 
  createStatusUpdate,
  initDatabase,
  PackageData,
  generateId,
  formatTrackingNumber
} from '@/lib/postgresDb'

type CreatePackageRequest = {
  customerName: string
  customerEmail?: string
  currentLocation: string
  destination: string
  status?: string
  estimatedDelivery?: string
  notes?: string
}

type CreatePackageResponse = {
  success: boolean
  message: string
  package?: PackageData
  trackingNumber?: string
  error?: string
}

import { requireAuth, AuthenticatedRequest } from '@/lib/auth'

async function createPackageHandler(
  req: AuthenticatedRequest,
  res: NextApiResponse<CreatePackageResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      error: 'Only POST method is allowed'
    })
  }

  // Initialize database
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

  const {
    customerName,
    customerEmail,
    currentLocation,
    destination,
    status = 'in_transit',
    estimatedDelivery,
    notes
  }: CreatePackageRequest = req.body

  // Validate required fields
  if (!customerName || !currentLocation || !destination) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      error: 'customerName, currentLocation, and destination are required'
    })
  }

  try {
    // Generate a unique tracking number
    const trackingNumber = generateTrackingNumber()
    
    // Parse estimated delivery if provided
    let estimatedDeliveryDate: Date | undefined
    if (estimatedDelivery) {
      estimatedDeliveryDate = new Date(estimatedDelivery)
      if (isNaN(estimatedDeliveryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid estimated delivery date',
          error: 'estimatedDelivery must be a valid date'
        })
      }
    }

    // Create the package
    const packageData = await createPackage({
      trackingNumber,
      status,
      currentLocation,
      destination,
      customerName,
      customerEmail,
      estimatedDelivery: estimatedDeliveryDate
    })

    // Create initial status update
    await createStatusUpdate({
      packageId: packageData.id,
      status,
      location: currentLocation,
      notes: notes || `Package created for ${customerName}`
    })

    console.log(`Package created successfully: ${trackingNumber} for ${customerName}`)

    return res.status(201).json({
      success: true,
      message: 'Package created successfully',
      package: packageData,
      trackingNumber: packageData.trackingNumber
    })

  } catch (error) {
    console.error('Error creating package:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create package',
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

// Generate a unique tracking number in SwiftShip format
function generateTrackingNumber(): string {
  const prefix = 'SW'
  const timestamp = Date.now().toString().slice(-8) // Last 8 digits of timestamp
  const random = Math.random().toString(36).substr(2, 3).toUpperCase() // 3 random chars
  return `${prefix}${timestamp}${random}`
}

// Export the handler wrapped with authentication
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatePackageResponse>
) {
  return requireAuth(req, res, createPackageHandler)
}