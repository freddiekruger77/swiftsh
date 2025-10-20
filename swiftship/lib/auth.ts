import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

// Middleware to check if user is authenticated admin
export async function requireAuth(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
) {
  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'Unauthorized'
      })
    }

    // Check if user has admin role
    const userRole = (session.user as any).role
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        error: 'Forbidden'
      })
    }

    // Add user info to request
    req.user = {
      id: (session.user as any).id || session.user.email || '',
      email: session.user.email || '',
      name: session.user.name || '',
      role: userRole
    }

    // Call the actual handler
    return await handler(req, res)
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: 'Internal server error'
    })
  }
}

// Helper function to check authentication in API routes
export async function isAuthenticated(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  try {
    const session = await getServerSession(req, res, authOptions)
    return !!(session && session.user && (session.user as any).role === 'admin')
  } catch (error) {
    console.error('Authentication check error:', error)
    return false
  }
}

// Helper function to get current user session
export async function getCurrentUser(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (session && session.user) {
      return {
        id: (session.user as any).id || session.user.email || '',
        email: session.user.email || '',
        name: session.user.name || '',
        role: (session.user as any).role || ''
      }
    }
    return null
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}