// Script to create a new shipment with the provided details
import { createPackage, createStatusUpdate, initDatabase } from '../lib/postgresDb'

async function createShipment() {
  try {
    console.log('Initializing database...')
    await initDatabase()

    // Generate tracking number
    const trackingNumber = generateTrackingNumber()
    
    // Customer details
    const customerName = 'Leovarda Franco Hesiquio'
    const originAddress = 'De los Olivos Avenue #76, La Cañada Neighborhood, Naucalpan de Juárez, State of Mexico, Mexico, Zip Code 53570'
    const destinationAddress = 'Captain Carlos León Avenue, s/n, Peñón de los Baños Area, Venustiano Carranza Municipality, 15620, Mexico City, Mexico'
    
    // Create the package
    console.log(`Creating package with tracking number: ${trackingNumber}`)
    const packageData = await createPackage({
      trackingNumber,
      status: 'in_transit',
      currentLocation: 'Mexico City Distribution Center',
      destination: destinationAddress,
      customerName,
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
    })

    console.log('Package created successfully:', packageData)

    // Create status updates for realistic tracking history
    const statusUpdates = [
      {
        status: 'created',
        location: 'Naucalpan de Juárez Origin Facility',
        notes: `Package created for ${customerName} - Origin: ${originAddress}`
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

    // Create status history with realistic timestamps
    for (let i = 0; i < statusUpdates.length; i++) {
      const update = statusUpdates[i]
      const hoursAgo = (statusUpdates.length - i) * 4 // 4 hours between each status
      
      // Temporarily modify the timestamp by creating the update and then updating it
      await createStatusUpdate({
        packageId: packageData.id,
        status: update.status,
        location: update.location,
        notes: update.notes
      })
      
      console.log(`Created status update: ${update.status} at ${update.location}`)
    }

    console.log('\n=== SHIPMENT CREATED SUCCESSFULLY ===')
    console.log(`Tracking Number: ${trackingNumber}`)
    console.log(`Customer: ${customerName}`)
    console.log(`Status: In Transit`)
    console.log(`Current Location: Mexico City Distribution Center`)
    console.log(`Destination: ${destinationAddress}`)
    console.log(`Estimated Delivery: ${packageData.estimatedDelivery?.toLocaleDateString()}`)
    console.log('=====================================\n')

    return {
      trackingNumber,
      packageId: packageData.id,
      status: 'success'
    }

  } catch (error) {
    console.error('Error creating shipment:', error)
    throw error
  }
}

// Generate a unique tracking number in SwiftShip format
function generateTrackingNumber(): string {
  const prefix = 'SW'
  const timestamp = Date.now().toString().slice(-8) // Last 8 digits of timestamp
  const random = Math.random().toString(36).substr(2, 3).toUpperCase() // 3 random chars
  return `${prefix}${timestamp}${random}`
}

// Run the script
if (require.main === module) {
  createShipment()
    .then((result) => {
      console.log('Shipment creation completed:', result)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Shipment creation failed:', error)
      process.exit(1)
    })
}

export { createShipment }