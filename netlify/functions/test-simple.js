// Netlify function wrapper for test-simple.ts
// This function adapts Next.js API routes to work with Netlify Functions

exports.handler = async (event, context) => {
  // Set up environment for serverless
  process.env.NETLIFY = 'true'
  
  try {
    // Dynamic import of the Next.js API handler
    const { default: handler } = await import('../../pages/api/test-simple.js')
    
    // Parse request body
    let body = {}
    if (event.body) {
      try {
        body = JSON.parse(event.body)
      } catch (e) {
        body = event.body
      }
    }

    // Convert Netlify event to Next.js API request format
    const req = {
      method: event.httpMethod,
      headers: event.headers || {},
      body: body,
      query: event.queryStringParameters || {},
      url: event.path,
      cookies: parseCookies(event.headers.cookie || ''),
      // Add Netlify-specific properties
      netlify: {
        event,
        context
      }
    }

    // Create response object that captures Next.js response
    let statusCode = 200
    let responseHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
    let responseBody = ''

    const res = {
      status: (code) => {
        statusCode = code
        return res
      },
      setHeader: (key, value) => {
        responseHeaders[key] = value
        return res
      },
      json: (data) => {
        responseHeaders['Content-Type'] = 'application/json'
        responseBody = JSON.stringify(data)
        return res
      },
      send: (data) => {
        responseBody = typeof data === 'string' ? data : JSON.stringify(data)
        return res
      },
      end: (data) => {
        if (data) {
          responseBody = typeof data === 'string' ? data : JSON.stringify(data)
        }
        return res
      },
      redirect: (url) => {
        statusCode = 302
        responseHeaders['Location'] = url
        return res
      }
    }

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: ''
      }
    }

    // Call the Next.js API handler
    await handler(req, res)
    
    return {
      statusCode,
      headers: responseHeaders,
      body: responseBody
    }
    
  } catch (error) {
    console.error('Netlify function error:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }
}

// Helper function to parse cookies
function parseCookies(cookieString) {
  const cookies = {}
  if (cookieString) {
    cookieString.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=')
      if (name && value) {
        cookies[name] = decodeURIComponent(value)
      }
    })
  }
  return cookies
}
