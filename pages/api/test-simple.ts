import type { NextApiRequest, NextApiResponse } from 'next'

type TestResponse = {
  success: boolean
  message: string
  timestamp: string
  environment: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResponse>
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const response: TestResponse = {
      success: true,
      message: 'Simple test function is working!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    }

    return res.status(200).json(response)
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Test function failed',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    })
  }
}