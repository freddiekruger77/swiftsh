import type { NextApiRequest, NextApiResponse } from 'next'
import { createContactSubmission, initDatabase, validateContactSubmission } from '@/lib/db'

type ContactResponse = {
  success: boolean
  message: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContactResponse>
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
    const { name, email, message } = req.body
    
    // Basic input validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        error: 'Missing required fields'
      })
    }

    // Validate input data using database validation
    const submissionData = {
      name: name.toString().trim(),
      email: email.toString().trim(),
      message: message.toString().trim()
    }

    const validationErrors = validateContactSubmission(submissionData)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
        error: 'Validation failed'
      })
    }

    try {
      // Create contact submission in database
      const contactSubmission = await createContactSubmission(submissionData)
      
      console.log('Contact submission created:', {
        id: contactSubmission.id,
        name: contactSubmission.name,
        email: contactSubmission.email,
        submittedAt: contactSubmission.submittedAt
      })

      return res.status(201).json({
        success: true,
        message: 'Thank you for your message! We will get back to you soon.'
      })
    } catch (error) {
      console.error('Error creating contact submission:', error)
      return res.status(500).json({
        success: false,
        message: 'Unable to submit your message at this time. Please try again later.',
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