#!/usr/bin/env node

/**
 * Generate secure secrets for SwiftShip deployment
 * Run with: node scripts/generate-secrets.js
 */

const crypto = require('crypto')

console.log('🔐 SwiftShip Secret Generator')
console.log('================================\n')

// Generate NextAuth secret
const nextAuthSecret = crypto.randomBytes(32).toString('base64')
console.log('NEXTAUTH_SECRET (copy this to your environment variables):')
console.log(nextAuthSecret)
console.log('')

// Generate admin password
const adminPassword = crypto.randomBytes(16).toString('hex')
console.log('Suggested ADMIN_PASSWORD (change if desired):')
console.log(adminPassword)
console.log('')

// Show environment variable template
console.log('📋 Environment Variables Template:')
console.log('==================================')
console.log(`NEXTAUTH_URL=https://your-domain.vercel.app`)
console.log(`NEXTAUTH_SECRET=${nextAuthSecret}`)
console.log(`DATABASE_PATH=/tmp/swiftship.db`)
console.log(`ADMIN_EMAIL=admin@swiftship.com`)
console.log(`ADMIN_PASSWORD=${adminPassword}`)
console.log(`SEED_DATABASE=false`)
console.log('')

console.log('💡 Tips:')
console.log('- Copy these values to your deployment platform (Vercel, Netlify, etc.)')
console.log('- Change ADMIN_EMAIL to your preferred admin email')
console.log('- Keep NEXTAUTH_SECRET secure and never commit it to version control')
console.log('- Use SEED_DATABASE=true for demo/development environments')
console.log('')

console.log('🚀 Ready to deploy!')