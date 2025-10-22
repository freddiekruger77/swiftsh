# Deployment Checklist for Neon DB Migration

This checklist ensures a smooth deployment of the SwiftShip application with Neon PostgreSQL database.

## Pre-Deployment Setup

### 1. Neon Database Setup
- [ ] Create Neon account at [neon.tech](https://neon.tech)
- [ ] Create new database project
- [ ] Note down connection string
- [ ] Choose appropriate region (closest to users)
- [ ] Configure connection limits based on plan

### 2. Environment Variables Setup
- [ ] Copy `.env.netlify.neon.example` to reference
- [ ] Set all required environment variables in Netlify dashboard
- [ ] Generate secure `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- [ ] Set production URL in `NEXTAUTH_URL`
- [ ] Configure strong admin credentials
- [ ] Set Neon connection string in `NEON_DATABASE_URL`

### 3. Code Preparation
- [ ] Ensure all PostgreSQL dependencies are in `package.json`
- [ ] Update `next.config.js` for PostgreSQL externals
- [ ] Verify build scripts include PostgreSQL endpoints
- [ ] Test migration scripts locally

## Environment Variables Checklist

### Required Variables
- [ ] `NEXTAUTH_URL` = `https://your-site.netlify.app`
- [ ] `NEXTAUTH_SECRET` = `[32+ character secret]`
- [ ] `ADMIN_EMAIL` = `admin@yourcompany.com`
- [ ] `ADMIN_PASSWORD` = `[secure password 8+ chars]`
- [ ] `NEON_DATABASE_URL` = `postgresql://user:pass@host/db?sslmode=require`
- [ ] `NEON_MAX_CONNECTIONS` = `20` (adjust for your plan)
- [ ] `NEON_IDLE_TIMEOUT` = `30000`
- [ ] `NEON_CONNECTION_TIMEOUT` = `10000`

### Optional Variables
- [ ] `NODE_ENV` = `production`
- [ ] `SEED_DATABASE` = `false`
- [ ] `ENABLE_QUERY_LOGGING` = `false`
- [ ] `ENABLE_PERFORMANCE_MONITORING` = `true`
- [ ] `APP_VERSION` = `1.0.0`
- [ ] `NEON_REGION` = `us-east-1` (or your preferred region)

## Deployment Steps

### 1. Initial Deployment
- [ ] Push code to repository
- [ ] Connect repository to Netlify
- [ ] Set environment variables in Netlify dashboard
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Publish directory: `out`
  - Node version: `18`

### 2. Database Migration
- [ ] Run migration locally first (dry-run): `npm run migrate:postgres:dry-run`
- [ ] Create backup of existing SQLite data (if applicable)
- [ ] Run actual migration: `npm run migrate:postgres`
- [ ] Verify migration success

### 3. Post-Deployment Verification
- [ ] Check deployment logs for errors
- [ ] Test health endpoint: `https://your-site.netlify.app/api/health-postgres`
- [ ] Run diagnostics: `https://your-site.netlify.app/api/diagnostics-postgres`
- [ ] Test application functionality
- [ ] Verify admin panel access
- [ ] Test package tracking functionality

## Health Check Endpoints

Test these endpoints after deployment:

| Endpoint | Purpose | Expected Status |
|----------|---------|-----------------|
| `/api/health-postgres` | Basic health check | 200 OK |
| `/api/health-detailed-postgres` | Detailed health info | 200 OK |
| `/api/diagnostics-postgres` | Comprehensive diagnostics | 200 OK |
| `/api/track` | Package tracking | 200 OK |
| `/api/contact` | Contact form | 200 OK |
| `/admin` | Admin panel | 200 OK (with auth) |

## Performance Optimization

### Connection Pool Settings by Neon Plan

| Plan | Max Connections | Recommended Settings |
|------|----------------|---------------------|
| Free | 10 | `NEON_MAX_CONNECTIONS=10` |
| Pro | 20-50 | `NEON_MAX_CONNECTIONS=20` |
| Scale | 50-100 | `NEON_MAX_CONNECTIONS=50` |

### Regional Optimization
- [ ] Set `NEON_REGION` to match your user base
- [ ] Consider `NETLIFY_REGION` for function deployment
- [ ] Monitor latency in diagnostics endpoint

## Security Checklist

### Production Security
- [ ] Strong admin password (not default)
- [ ] Secure NextAuth secret (32+ chars)
- [ ] SSL enabled in connection string (`sslmode=require`)
- [ ] Database seeding disabled (`SEED_DATABASE=false`)
- [ ] Query logging disabled in production
- [ ] HTTPS enforced for all endpoints

### Access Control
- [ ] Admin panel requires authentication
- [ ] API endpoints have proper CORS headers
- [ ] Sensitive data not logged
- [ ] Environment variables not exposed to client

## Monitoring and Maintenance

### Health Monitoring
- [ ] Set up monitoring for health endpoints
- [ ] Configure alerts for database connection failures
- [ ] Monitor connection pool utilization
- [ ] Track query performance metrics

### Regular Maintenance
- [ ] Monitor Neon dashboard for usage
- [ ] Review slow query logs
- [ ] Update dependencies regularly
- [ ] Backup database regularly (Neon handles this automatically)

## Troubleshooting

### Common Issues and Solutions

#### Connection Timeout
**Symptoms:** `Connection timeout` errors
**Solutions:**
- Increase `NEON_CONNECTION_TIMEOUT`
- Check network connectivity
- Verify Neon database is running

#### Too Many Connections
**Symptoms:** `too many connections` errors
**Solutions:**
- Reduce `NEON_MAX_CONNECTIONS`
- Upgrade Neon plan
- Optimize connection usage

#### SSL Connection Errors
**Symptoms:** SSL-related connection errors
**Solutions:**
- Ensure `?sslmode=require` in connection string
- Verify Neon SSL configuration
- Check certificate validity

#### Build Failures
**Symptoms:** Build fails with PostgreSQL errors
**Solutions:**
- Verify `pg` dependency in package.json
- Check webpack externals configuration
- Ensure proper TypeScript types

### Debug Commands

```bash
# Local testing
npm run dev
npm run validate:config
npm run health:postgres
npm run diagnostics:postgres

# Migration testing
npm run migrate:postgres:dry-run

# Production testing
curl https://your-site.netlify.app/api/health-postgres
curl https://your-site.netlify.app/api/diagnostics-postgres
```

## Rollback Plan

If deployment fails:

1. **Immediate Rollback:**
   - Revert to previous Netlify deployment
   - Switch back to SQLite if needed
   - Restore environment variables

2. **Database Rollback:**
   - Restore from backup (if migration was run)
   - Verify data integrity
   - Test application functionality

3. **Investigation:**
   - Check Netlify function logs
   - Review Neon database logs
   - Analyze error messages
   - Fix issues and redeploy

## Success Criteria

Deployment is successful when:
- [ ] All health checks return 200 OK
- [ ] Diagnostics show all systems healthy
- [ ] Application loads without errors
- [ ] Package tracking works
- [ ] Admin panel is accessible
- [ ] Database operations complete successfully
- [ ] Performance metrics are within acceptable ranges

## Post-Deployment Tasks

- [ ] Update documentation with new endpoints
- [ ] Notify team of successful deployment
- [ ] Monitor application for 24 hours
- [ ] Schedule regular health checks
- [ ] Plan for future optimizations

---

**Note:** Keep this checklist updated as the application evolves. Each deployment should follow this checklist to ensure consistency and reliability.