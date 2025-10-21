# Netlify Deployment Checklist

## Pre-Deployment Setup

### ✅ Repository Setup
- [ ] Code is committed to Git repository (GitHub, GitLab, Bitbucket)
- [ ] Repository is accessible to Netlify
- [ ] Main branch is ready for deployment

### ✅ Environment Configuration
- [ ] `.env.netlify.example` reviewed and understood
- [ ] Environment variables prepared for Netlify dashboard
- [ ] `NEXTAUTH_SECRET` generated (32+ characters)
- [ ] Admin credentials decided (strong password)

### ✅ Build Configuration
- [ ] `netlify.toml` configuration file present
- [ ] `package.json` scripts updated for Netlify
- [ ] `next.config.js` configured for Netlify export
- [ ] Dependencies include Netlify CLI and plugins

## Netlify Dashboard Setup

### ✅ Site Creation
- [ ] New site created from Git repository
- [ ] Correct branch selected for deployment
- [ ] Build settings configured:
  - Build command: `npm run build:netlify`
  - Publish directory: `out`
  - Functions directory: `netlify/functions`

### ✅ Environment Variables
Set these in Site Settings > Environment Variables:

**Required Variables:**
- [ ] `NEXTAUTH_URL` = `https://your-site-name.netlify.app`
- [ ] `NEXTAUTH_SECRET` = `your-32-character-secret`
- [ ] `DATABASE_PATH` = `/tmp/swiftship.db`
- [ ] `ADMIN_EMAIL` = `admin@swiftship.com`
- [ ] `ADMIN_PASSWORD` = `your-secure-password`

**Build Variables:**
- [ ] `NETLIFY` = `true`
- [ ] `NODE_VERSION` = `18`
- [ ] `NODE_ENV` = `production`

**Optional Variables:**
- [ ] `SEED_DATABASE` = `true` (for demo data)

### ✅ Build & Deploy Settings
- [ ] Node.js version set to 18 or higher
- [ ] Build timeout increased if needed (default: 15 minutes)
- [ ] Function timeout configured (10s free, 26s pro)

## First Deployment

### ✅ Deploy Process
- [ ] Trigger first deployment
- [ ] Monitor build logs for errors
- [ ] Verify build completes successfully
- [ ] Check deploy preview before going live

### ✅ Function Verification
Test these endpoints after deployment:

**Health Checks:**
- [ ] `/.netlify/functions/health` returns 200
- [ ] `/.netlify/functions/health-detailed` returns detailed status
- [ ] `/.netlify/functions/diagnostics` shows system info

**Core Functions:**
- [ ] `/.netlify/functions/track` accepts POST requests
- [ ] `/.netlify/functions/contact` accepts form submissions
- [ ] `/.netlify/functions/hello` returns test message

**Admin Functions:**
- [ ] `/.netlify/functions/admin-init-db` initializes database
- [ ] `/.netlify/functions/admin-packages` requires authentication
- [ ] Admin login works at `/admin`

### ✅ Frontend Verification
- [ ] Homepage loads correctly
- [ ] Navigation works between pages
- [ ] Tracking form submits successfully
- [ ] Contact form submits successfully
- [ ] Admin panel accessible and functional

## Post-Deployment Configuration

### ✅ Domain Setup (Optional)
- [ ] Custom domain added in Netlify dashboard
- [ ] DNS configured correctly
- [ ] SSL certificate provisioned
- [ ] `NEXTAUTH_URL` updated to custom domain
- [ ] Site redeployed with new URL

### ✅ Performance Optimization
- [ ] Function cold start times acceptable
- [ ] Database initialization working
- [ ] Static assets loading quickly
- [ ] Mobile responsiveness verified

### ✅ Security Verification
- [ ] HTTPS enabled and working
- [ ] Security headers configured
- [ ] Admin credentials secure
- [ ] Environment variables not exposed
- [ ] CORS working for API calls

## Monitoring Setup

### ✅ Health Monitoring
- [ ] Bookmark health check URLs for monitoring
- [ ] Set up external monitoring (optional)
- [ ] Configure Netlify notifications
- [ ] Test error handling and logging

### ✅ Analytics (Optional)
- [ ] Netlify Analytics enabled
- [ ] Google Analytics configured
- [ ] Performance monitoring set up

## Testing Checklist

### ✅ Functional Testing
- [ ] Create test package tracking number
- [ ] Test package tracking flow
- [ ] Submit test contact form
- [ ] Login to admin panel
- [ ] Create new package via admin
- [ ] Test all navigation links

### ✅ API Testing
Test with curl or Postman:

```bash
# Health check
curl https://your-site.netlify.app/.netlify/functions/health

# Track package
curl -X POST https://your-site.netlify.app/.netlify/functions/track \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"SW240567MXC"}'

# Contact form
curl -X POST https://your-site.netlify.app/.netlify/functions/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"Test message"}'
```

### ✅ Error Testing
- [ ] Test invalid tracking numbers
- [ ] Test malformed API requests
- [ ] Test admin access without authentication
- [ ] Verify error messages are user-friendly

## Troubleshooting

### ✅ Common Issues Resolved
- [ ] Build failures debugged and fixed
- [ ] Function timeout issues addressed
- [ ] Database connection issues resolved
- [ ] Environment variable issues fixed
- [ ] CORS issues resolved

### ✅ Performance Issues
- [ ] Cold start times optimized
- [ ] Database queries optimized
- [ ] Static asset delivery optimized
- [ ] Function memory usage acceptable

## Documentation

### ✅ Documentation Updated
- [ ] README updated with Netlify deployment info
- [ ] API documentation reflects Netlify URLs
- [ ] Environment variable documentation current
- [ ] Troubleshooting guide available

### ✅ Team Knowledge
- [ ] Team knows how to access Netlify dashboard
- [ ] Deployment process documented
- [ ] Rollback procedure understood
- [ ] Monitoring and alerting configured

## Final Verification

### ✅ Production Readiness
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Security measures in place
- [ ] Monitoring configured
- [ ] Documentation complete

### ✅ Go-Live Checklist
- [ ] DNS propagated (if using custom domain)
- [ ] SSL certificate active
- [ ] All stakeholders notified
- [ ] Support procedures in place
- [ ] Backup/rollback plan ready

## Success Criteria

✅ **Deployment Successful When:**
- [ ] Site loads at Netlify URL
- [ ] All pages render correctly
- [ ] API functions respond properly
- [ ] Database operations work
- [ ] Admin panel functional
- [ ] No console errors
- [ ] Performance meets requirements

---

**Deployment Date:** ___________
**Deployed By:** ___________
**Site URL:** ___________
**Status:** ⭕ In Progress | ✅ Complete | ❌ Issues

**Notes:**
_Add any deployment-specific notes or issues encountered_