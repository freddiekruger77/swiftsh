const fs = require('fs')
const path = require('path')

console.log('Building Netlify functions...')

// Create netlify functions directory if it doesn't exist
const functionsDir = path.join(__dirname, '..', 'netlify', 'functions')
if (!fs.existsSync(functionsDir)) {
  fs.mkdirSync(functionsDir, { recursive: true })
}

// API routes to convert to Netlify functions
const routes = [
  { path: 'health.ts', name: 'health' },
  { path: 'health-detailed.ts', name: 'health-detailed' },
  { path: 'diagnostics.ts', name: 'diagnostics' },
  { path: 'test-deployment.ts', name: 'test-deployment' },
  { path: 'track.ts', name: 'track' },
  { path: 'contact.ts', name: 'contact' },
  { path: 'admin/packages.ts', name: 'admin-packages' },
  { path: 'admin/init-db.ts', name: 'admin-init-db' },
  { path: 'admin/update.ts', name: 'admin-update' },
  { path: 'admin/create-package.ts', name: 'admin-create-package' }
]

// Create a universal Netlify function wrapper
function createNetlifyFunction(apiPath, functionName) {
  return `// Netlify function wrapper for ${apiPath}
// This function adapts Next.js API routes to work with Netlify Functions

exports.handler = async (event, context) => {
  // Set up environment for serverless
  process.env.NETLIFY = 'true'
  
  try {
    // Dynamic import of the Next.js API handler
    const { default: handler } = await import('../../pages/api/${apiPath.replace('.ts', '.js')}')
    
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
`
}

// Create Netlify functions for all routes
routes.forEach(route => {
  const functionContent = createNetlifyFunction(route.path, route.name)
  const functionPath = path.join(functionsDir, `${route.name}.js`)
  
  fs.writeFileSync(functionPath, functionContent)
  console.log(`✓ Created Netlify function: ${route.name}.js`)
})

// Create a catch-all API function for any missed routes
const catchAllFunction = `// Catch-all function for API routes
exports.handler = async (event, context) => {
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: false,
      message: 'API endpoint not found',
      path: event.path,
      availableEndpoints: [
        '/.netlify/functions/health',
        '/.netlify/functions/health-detailed',
        '/.netlify/functions/diagnostics',
        '/.netlify/functions/track',
        '/.netlify/functions/contact',
        '/.netlify/functions/admin-packages',
        '/.netlify/functions/admin-init-db'
      ]
    })
  }
}
`

fs.writeFileSync(path.join(functionsDir, 'api-fallback.js'), catchAllFunction)
console.log('✓ Created catch-all function: api-fallback.js')

console.log(`\n🎉 Netlify functions build completed!`)
console.log(`📁 Functions created in: netlify/functions/`)
console.log(`🔗 Functions will be available at: /.netlify/functions/[function-name]`)
console.log(`\nExample URLs:`)
console.log(`  - /.netlify/functions/health`)
console.log(`  - /.netlify/functions/track`)
console.log(`  - /.netlify/functions/admin-packages`)