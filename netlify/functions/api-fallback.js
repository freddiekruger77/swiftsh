// Catch-all function for API routes
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
        '/.netlify/functions/health-postgres',
        '/.netlify/functions/health-detailed-postgres',
        '/.netlify/functions/diagnostics-postgres',
        '/.netlify/functions/track',
        '/.netlify/functions/contact',
        '/.netlify/functions/admin-packages',
        '/.netlify/functions/admin-init-db'
      ]
    })
  }
}
