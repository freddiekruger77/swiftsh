# SwiftShip Deployment Guide

This guide covers deploying SwiftShip to Vercel and other platforms.

## Prerequisites

- Node.js 18+ and npm 8+
- Vercel CLI (optional): `npm i -g vercel`
- Git repository

## Environment Variables

Create these environment variables in your deployment platform:

### Required Variables

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-super-secret-jwt-secret-here

# Database Configuration
DATABASE_PATH=/tmp/swiftship.db

# Admin Credentials
ADMIN_EMAIL=admin@swiftship.com
ADMIN_PASSWORD=your-secure-admin-password
```

### Generating Secrets

```bash
# Generate a secure NextAuth secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Vercel Deployment

### Option 1: Deploy via Vercel Dashboard

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your Git repository

2. **Configure Environment Variables**
   - In project settings, add all required environment variables
   - Use the values from the `.env.local.example` file as reference

3. **Deploy**
   - Vercel will automatically build and deploy
   - Your app will be available at `https://your-project.vercel.app`

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy
```

### Option 3: Deploy via Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Connect the repository to Vercel
3. Set environment variables in Vercel dashboard
4. Every push to main branch will auto-deploy

## Database Configuration

### SQLite on Vercel

Vercel's serverless functions use `/tmp` directory for temporary files:

```bash
DATABASE_PATH=/tmp/swiftship.db
```

**Important Notes:**
- Database is recreated on each cold start
- For production, consider using a persistent database service
- Current setup is suitable for demos and development

### Production Database Options

For production deployments, consider these alternatives:

1. **PlanetScale** (MySQL-compatible)
2. **Supabase** (PostgreSQL)
3. **Railway** (PostgreSQL/MySQL)
4. **Neon** (PostgreSQL)

## Build Configuration

The project includes optimized build settings:

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "deploy": "vercel --prod"
  }
}
```

## Performance Optimizations

### Next.js Configuration

```javascript
// next.config.js
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['sqlite3']
  }
}
```

### Vercel Configuration

```json
{
  "functions": {
    "pages/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

## Security Headers

The deployment includes security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Monitoring and Logging

### Vercel Analytics

Enable Vercel Analytics in your dashboard for:
- Page views and performance metrics
- Core Web Vitals monitoring
- Real user monitoring

### Error Tracking

For production error tracking, integrate with:
- **Sentry**: `npm install @sentry/nextjs`
- **LogRocket**: `npm install logrocket`
- **Bugsnag**: `npm install @bugsnag/js`

## Custom Domain

1. **Add Domain in Vercel**
   - Go to Project Settings → Domains
   - Add your custom domain

2. **Update Environment Variables**
   ```bash
   NEXTAUTH_URL=https://your-custom-domain.com
   ```

3. **DNS Configuration**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or use Vercel nameservers

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Admin credentials set
- [ ] NextAuth secret generated
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Error tracking configured (optional)
- [ ] Analytics enabled (optional)

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check `DATABASE_PATH` environment variable
   - Ensure SQLite3 is in dependencies

2. **Authentication Issues**
   - Verify `NEXTAUTH_URL` matches your domain
   - Check `NEXTAUTH_SECRET` is set
   - Ensure admin credentials are correct

3. **Build Failures**
   - Check Node.js version (18+ required)
   - Run `npm run type-check` locally
   - Review build logs in Vercel dashboard

4. **API Route Timeouts**
   - Database operations should complete within 30 seconds
   - Consider optimizing queries for large datasets

### Getting Help

- Check Vercel deployment logs
- Review Next.js documentation
- Check the project's GitHub issues
- Contact support with error ID from error boundary

## Alternative Deployment Platforms

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=.next
```

### Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway deploy
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Post-Deployment

1. **Test Core Functionality**
   - Package tracking
   - Contact form submission
   - Admin login and package management

2. **Performance Testing**
   - Run Lighthouse audit
   - Test on various devices and networks
   - Monitor Core Web Vitals

3. **Security Testing**
   - Test authentication flows
   - Verify HTTPS is enforced
   - Check security headers

4. **Monitoring Setup**
   - Configure uptime monitoring
   - Set up error alerts
   - Monitor database performance