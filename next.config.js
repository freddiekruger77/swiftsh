/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Netlify deployment configuration
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  
  experimental: {
    serverComponentsExternalPackages: ['sqlite3', 'pg']
  },
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve server-only modules on the client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        util: false,
        pg: false,
        'pg-native': false,
      }
    }
    
    // Externalize database modules for server-side
    if (isServer) {
      config.externals.push('sqlite3', 'pg', 'pg-native')
    }
    
    return config
  }
}

module.exports = nextConfig