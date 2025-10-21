# Netlify Deployment Guide

This guide will help you deploy SwiftShip to Netlify with full functionality including serverless functions and database support.

## Prerequisites

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, etc.)
3. **Node.js 18+**: Required for building the application

## Deployment Steps

### 1. Connect Repository to Netlify

1. Log in to your Netlify dashboard
2. Click "New site from Git"
3. Choose your Git provider and repository
4. Select the branch to deploy (usually `main` or `master`)

### 2. Configure Build Settings

In Netlify dashboard, set these build settings:

- **Build command**: `npm run build`
- **Publish directory**: `out`
- **Functions directory**: `netlify/functions`

### 3. Set Environment Variables

Go to Site Settings > Environment Variables and add:

```bash
# Required Variables
NEXTAUTH_URL=https://your-site-name.netlify.app
NEXTAUTH_SECRET=your-super-secret-jwt-secret-32-chars-min
DATABASE_PATH=/tmp/swiftship.db
ADMIN_EMAIL=admin@swiftship.com
ADMIN_PASSWORD=your-secure-password

# Build Variables
NETLIFY=true
NODE_VERSION=18
NODE_ENV=production

# Optional
SEED_DATABASE=true
```

### 4. Deploy

1. Click "Deploy site" in Netlify dashboard
2. Wait for build to complete (usually 2-5 minutes)
3. Your site will be available at `https://your-site-name.netlify.app`

## Post-Deployment Configuration

### Custom Domain (Optional)

1. Go to Site Settings > Domain management
2. Add your custom domain
3. Configure DNS settings as instructed
4. Update `NEXTAUTH_URL` environment variable to your custom domain

### Database Initialization

The database will be automatically initialized on first API call. You can also trigger it manually:

```bash
curl -X POST https://your-site-name.netlify.app/.netlify/functions/admin-init-db
```

### Admin Access

1. Navigate to `https://your-site-name.netlify.app/admin`
2. Use the credentials set in `ADMIN_EMAIL` and `ADMIN_PASSWORD`

## API Endpoints

All API routes are automatically converted to Netlify functions:

- Health Check: `/.netlify/functions/health`
- Detailed Health: `/.netlify/functions/health-detailed`
- Diagnostics: `/.netlify/functions/diagnostics`
- Package Tracking: `/.netlify/functions/track`
- Contact Form: `/.netlify/functions/contact`
- Admin Functions: `/.netlify/functions/admin-*`

## Monitoring and Debugging

### Function Logs

1. Go to Netlify dashboard > Functions tab
2. Click on any function to view logs
3. Use for debugging API issues

### Build Logs

1. Go to Deploys tab in Netlify dashboard
2. Click on any deploy to view build logs
3. Check for build errors or warnings

### Health Checks

Monitor your deployment health:

- Basic: `https://your-site-name.netlify.app/.netlify/functions/health`
- Detailed: `https://your-site-name.netlify.app/.netlify/functions/health-detailed`
- Diagnostics: `https://your-site-name.netlify.app/.netlify/functions/diagnostics`

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (should be 18+)
   - Verify all dependencies are installed
   - Check build logs for specific errors

2. **Function Timeouts**
   - Netlify functions have a 10-second timeout on free tier
   - Optimize database queries
   - Consider upgrading to Pro plan for 26-second timeout

3. **Database Issues**
   - Database is ephemeral in serverless environment
   - Data resets on each cold start
   - Consider external database for production (PostgreSQL, MySQL)

4. **Environment Variables**
   - Ensure all required variables are set
   - Check variable names for typos
   - Redeploy after changing variables

### Performance Optimization

1. **Cold Starts**
   - Database initialization happens on first request
   - Subsequent requests are faster
   - Consider keeping functions warm with scheduled pings

2. **Database Performance**
   - SQLite is suitable for development/demo
   - For production, consider:
     - Supabase (PostgreSQL)
     - PlanetScale (MySQL)
     - MongoDB Atlas

## Migration from Vercel

If migrating from Vercel:

1. Update environment variables in Netlify
2. Change `NEXTAUTH_URL` to Netlify domain
3. Update any hardcoded Vercel-specific URLs
4. Test all functionality after deployment

## Support

For deployment issues:

1. Check Netlify documentation
2. Review function logs in dashboard
3. Use health check endpoints for diagnostics
4. Contact support if needed

## Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **Admin Credentials**: Use strong passwords in production
3. **HTTPS**: Netlify provides HTTPS by default
4. **CORS**: Configured automatically for API endpoints
5. **Headers**: Security headers are set in `netlify.toml`

## Scaling Considerations

- **Free Tier**: 100GB bandwidth, 300 build minutes/month
- **Pro Tier**: 1TB bandwidth, 1000 build minutes/month
- **Function Limits**: 125,000 function calls/month (free), 2M+ (pro)
- **Database**: Consider external database for high traffic

Your SwiftShip application is now ready for production on Netlify!