# Environment Configuration Guide

This guide covers the complete environment setup for the SwiftShip application with Neon DB integration.

## Table of Contents

- [Quick Start](#quick-start)
- [Required Environment Variables](#required-environment-variables)
- [Neon Database Configuration](#neon-database-configuration)
- [Connection Pool Settings](#connection-pool-settings)
- [Security Configuration](#security-configuration)
- [Performance Optimization](#performance-optimization)
- [Deployment-Specific Settings](#deployment-specific-settings)
- [Validation and Testing](#validation-and-testing)
- [Troubleshooting](#troubleshooting)

## Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.netlify.neon.example .env.local
   ```

2. **Set up Neon Database:**
   - Create account at [neon.tech](https://neon.tech)
   - Create a new database
   - Copy the connection string

3. **Configure required variables:**
   ```bash
   # Replace with your actual values
   NEON_DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   NEXTAUTH_URL=https://your-site.netlify.app
   ```

4. **Deploy to Netlify:**
   - Add all environment variables to Netlify dashboard
   - Deploy your application
   - Test with `/api/health-postgres`

## Required Environment Variables

### Authentication & Security

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXTAUTH_URL` | ✅ | Application URL for NextAuth callbacks | `https://myapp.netlify.app` |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret (min 32 chars) | `your-32-char-secret` |
| `ADMIN_EMAIL` | ✅ | Admin user email address | `admin@company.com` |
| `ADMIN_PASSWORD` | ✅ | Admin user password (min 8 chars) | `SecurePassword123` |

### Database Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEON_DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `NEON_MAX_CONNECTIONS` | ✅ | Maximum connection pool size | `20` |
| `NEON_IDLE_TIMEOUT` | ✅ | Idle connection timeout (ms) | `30000` |
| `NEON_CONNECTION_TIMEOUT` | ✅ | Connection attempt timeout (ms) | `10000` |

## Neon Database Configuration

### Getting Your Connection String

1. **Login to Neon Console:**
   - Go to [console.neon.tech](https://console.neon.tech)
   - Select your project

2. **Copy Connection String:**
   - Navigate to "Connection Details"
   - Copy the "Connection string" 
   - Ensure it includes `?sslmode=require`

3. **Connection String Format:**
   ```
   postgresql://[username]:[password]@[endpoint]/[database]?sslmode=require
   ```

### Database Regions

Choose the region closest to your users:

| Region | Endpoint Pattern | Best For |
|--------|------------------|----------|
| US East (N. Virginia) | `us-east-1.aws.neon.tech` | US East Coast |
| US West (Oregon) | `us-west-2.aws.neon.tech` | US West Coast |
| Europe (Frankfurt) | `eu-central-1.aws.neon.tech` | Europe |
| Asia Pacific (Singapore) | `ap-southeast-1.aws.neon.tech` | Asia Pacific |

## Connection Pool Settings

### Recommended Settings by Neon Plan

| Plan | Max Connections | Idle Timeout | Connection Timeout |
|------|----------------|--------------|-------------------|
| Free | `10` | `30000` | `10000` |
| Pro | `20-50` | `30000` | `10000` |
| Scale | `50-100` | `60000` | `15000` |

### Environment Variables

```bash
# Free tier (recommended)
NEON_MAX_CONNECTIONS=10
NEON_IDLE_TIMEOUT=30000
NEON_CONNECTION_TIMEOUT=10000

# Pro tier (recommended)
NEON_MAX_CONNECTIONS=20
NEON_IDLE_TIMEOUT=30000
NEON_CONNECTION_TIMEOUT=10000

# Scale tier (recommended)
NEON_MAX_CONNECTIONS=50
NEON_IDLE_TIMEOUT=60000
NEON_CONNECTION_TIMEOUT=15000
```

### Serverless Considerations

For Netlify Functions:
- Keep `NEON_MAX_CONNECTIONS` low (10-20)
- Use shorter `NEON_IDLE_TIMEOUT` (30000ms)
- Enable connection pooling in Neon console

## Security Configuration

### Production Security Checklist

- [ ] Generate secure `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- [ ] Use strong admin password (min 8 chars, mixed case, numbers)
- [ ] Set production URL in `NEXTAUTH_URL`
- [ ] Ensure SSL is enabled (`sslmode=require` in connection string)
- [ ] Disable database seeding: `SEED_DATABASE=false`
- [ ] Disable query logging: `ENABLE_QUERY_LOGGING=false`

### Development Security

```bash
# Development-friendly settings
SEED_DATABASE=true
ENABLE_QUERY_LOGGING=true
NEXTAUTH_URL=http://localhost:3000
```

## Performance Optimization

### Optional Performance Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PERFORMANCE_MONITORING` | `true` | Enable performance metrics |
| `SLOW_QUERY_THRESHOLD` | `1000` | Slow query threshold (ms) |
| `NEON_REGION` | - | Neon region for latency optimization |

### Performance Settings

```bash
# Enable monitoring
ENABLE_PERFORMANCE_MONITORING=true
SLOW_QUERY_THRESHOLD=1000

# Regional optimization
NEON_REGION=us-east-1

# Cache optimization (if using Redis)
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

## Deployment-Specific Settings

### Netlify Configuration

```bash
# Netlify-specific variables
NETLIFY_REGION=us-east-1
NETLIFY_FUNCTION_TIMEOUT=30
BUILD_COMMAND=npm run build
PUBLISH_DIRECTORY=.next

# Build optimization
NODE_ENV=production
APP_VERSION=1.0.0
```

### Vercel Configuration

```bash
# Vercel-specific variables
VERCEL_REGION=iad1
VERCEL_TIMEOUT=30

# Build settings
NODE_ENV=production
```

## Migration Configuration

### Migration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_MIGRATE_ON_STARTUP` | `false` | Run migrations on app start |
| `BACKUP_BEFORE_MIGRATION` | `true` | Create backup before migration |

### Migration Settings

```bash
# Automatic migration (use with caution in production)
AUTO_MIGRATE_ON_STARTUP=false
BACKUP_BEFORE_MIGRATION=true

# Migration scripts
npm run migrate:postgres          # Run migration
npm run migrate:postgres:dry-run  # Test migration
```

## Validation and Testing

### Configuration Validation

The application validates configuration on startup. Check validation results:

```bash
# Local development
npm run dev

# Check health endpoints
curl http://localhost:3000/api/health-postgres
curl http://localhost:3000/api/diagnostics-postgres
```

### Production Testing

After deployment, verify configuration:

1. **Health Check:**
   ```bash
   curl https://your-site.netlify.app/api/health-postgres
   ```

2. **Detailed Diagnostics:**
   ```bash
   curl https://your-site.netlify.app/api/diagnostics-postgres
   ```

3. **Database Connection:**
   ```bash
   curl https://your-site.netlify.app/api/test-simple
   ```

## Troubleshooting

### Common Issues

#### Connection Timeout
```
Error: Connection timeout
```
**Solution:** Increase `NEON_CONNECTION_TIMEOUT` or check network connectivity.

#### Too Many Connections
```
Error: too many connections
```
**Solution:** Reduce `NEON_MAX_CONNECTIONS` or upgrade Neon plan.

#### SSL Connection Error
```
Error: SSL connection required
```
**Solution:** Ensure connection string includes `?sslmode=require`.

#### Invalid Connection String
```
Error: Invalid connection string
```
**Solution:** Verify format: `postgresql://user:pass@host/db?sslmode=require`

### Debug Mode

Enable debug logging:

```bash
# Enable detailed logging
ENABLE_QUERY_LOGGING=true
DEBUG=neon:*
LOG_LEVEL=debug
```

### Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/health-postgres` | Basic health check |
| `/api/health-detailed-postgres` | Detailed health information |
| `/api/diagnostics-postgres` | Comprehensive diagnostics |

### Support Resources

- [Neon Documentation](https://neon.tech/docs)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)

### Getting Help

If you encounter issues:

1. Check the diagnostics endpoint
2. Review Netlify function logs
3. Verify all environment variables are set
4. Test connection string with a PostgreSQL client
5. Check Neon dashboard for connection limits

## Environment Variable Checklist

Use this checklist to ensure all variables are configured:

### Required Variables
- [ ] `NEXTAUTH_URL` - Set to your domain
- [ ] `NEXTAUTH_SECRET` - Generated with `openssl rand -base64 32`
- [ ] `ADMIN_EMAIL` - Valid email address
- [ ] `ADMIN_PASSWORD` - Strong password (8+ chars)
- [ ] `NEON_DATABASE_URL` - Valid PostgreSQL connection string
- [ ] `NEON_MAX_CONNECTIONS` - Appropriate for your Neon plan
- [ ] `NEON_IDLE_TIMEOUT` - Set to 30000 for serverless
- [ ] `NEON_CONNECTION_TIMEOUT` - Set to 10000 for most cases

### Optional Variables
- [ ] `NODE_ENV` - Set to "production" for production
- [ ] `SEED_DATABASE` - Set to "false" for production
- [ ] `ENABLE_QUERY_LOGGING` - Set to "false" for production
- [ ] `APP_VERSION` - Your application version
- [ ] `NEON_REGION` - Your preferred Neon region

### Deployment Variables
- [ ] `NETLIFY_REGION` - For Netlify deployments
- [ ] `BUILD_COMMAND` - Build command for deployment
- [ ] `PUBLISH_DIRECTORY` - Output directory (.next)

---

**Next Steps:** After configuring your environment, proceed to run the database migration using the migration scripts.