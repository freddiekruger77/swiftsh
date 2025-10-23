import type { NextApiRequest, NextApiResponse } from 'next'
import { createPackage, createStatusUpdate, initDatabase, getPackageByTrackingNumber } from '@/lib/postgresDb'

type FixResponse = {
  success: boolean
  message: string
  package?: any
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FixResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    })
  }

  try {
    console.log('Fixing tracking - initializing database and creating SW240567MXC package...')
    
    // Initialize database schema
    await initDatabase()
    
    const trackingNumber = 'SW240567MXC'
    
    // Check if package already exists
    const existingPackage = await getPackageByTrackingNumber(trackingNumber)
    if (existingPackage) {
      return res.status(200).json({
        success: true,
        message: 'Package already exists and is trackable',
        package: existingPackage
      })
    }

    // Create the specific package for Leovarda Franco Hesiquio
    const packageData = await createPackage({
      trackingNumber,
      status: 'in_transit',
      currentLocation: 'Mexico City Distribution Center',
      destination: 'Captain Carlos León Avenue, s/n, Peñón de los Baños Area, Venustiano Carranza Municipality, 15620, Mexico City, Mexico',
      customerName: 'Leovarda Franco Hesiquio',
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
    })

    // Create status history
    const statusUpdates = [
      {
        status: 'created',
        location: 'Naucalpan de Juárez Origin Facility',
        notes: 'Package created - Origin: De los Olivos Avenue #76, La Cañada Neighborhood, Naucalpan de Juárez, State of Mexico, Mexico, Zip Code 53570'
      },
      {
        status: 'picked_up',
        location: 'Naucalpan de Juárez Pickup Center',
        notes: 'Package picked up by carrier'
      },
      {
        status: 'in_transit',
        location: 'Mexico City Distribution Center',
        notes: 'Package in transit to destination - Mexico City'
      }
    ]

    // Create status updates
    for (const update of statusUpdates) {
      await createStatusUpdate({
        packageId: packageData.id,
        status: update.status,
        location: update.location,
        notes: update.notes
      })
    }

    console.log(`Package SW240567MXC created successfully for Leovarda Franco Hesiquio`)

    return res.status(201).json({
      success: true,
      message: 'Package SW240567MXC created successfully and is now trackable',
      package: packageData
    })

  } catch (error) {
    console.error('Error fixing tracking:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fix tracking',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}