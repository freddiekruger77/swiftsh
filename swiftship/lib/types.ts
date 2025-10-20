// Shared types for client and server

export enum PackageStatus {
  CREATED = 'created',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  EXCEPTION = 'exception'
}

export interface PackageData {
  id: string
  trackingNumber: string
  status: string
  currentLocation: string
  destination: string
  estimatedDelivery?: Date
  lastUpdated: Date
  customerName?: string
  customerEmail?: string
}

export interface StatusUpdate {
  id: string
  packageId: string
  status: string
  location: string
  timestamp: Date
  notes?: string
}

export interface ContactSubmission {
  id: string
  name: string
  email: string
  message: string
  submittedAt: Date
  resolved: boolean
}