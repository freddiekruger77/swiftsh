# SwiftShip Netlify Deployment Guide

SwiftShip is optimized for **Netlify** deployment with serverless functions and static site generation.

## 🚀 Quick Deployment

### Prerequisites
- Netlify account ([netlify.com](https://netlify.com))
- Git repository (GitHub, GitLab, Bitbucket)
- Node.js 18+ for local development

### Deploy to Netlify

1. **Connect Repository**
   ```bash
   # Fork or clone the repository
   git clone https://github.com/your-username/swiftship.git
   cd swiftship
   ```

2. **Netlify Dashboard Setup**
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click "New site from Git"
   - Connect your Git provider and select the repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `out`
     - **Functions directory**: `netlify/functions`

3. **Environment Variables**
   Set these in Site Settings > Environment Variables:
   ```bash
   NEXTAUTH_URL=https://your-site-name.netlify.app
   NEXTAUTH_SECRET=your-32-character-secret
   DATABASE_PATH=/tmp/swiftship.db
   ADMIN_EMAIL=admin@swiftship.com
   ADMIN_PASSWORD=your-secure-password
   NODE_ENV=production
   NETLIFY=true
   ```

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Your site will be live at `https://your-site-name.netlify.app`

## 🔧 Build Configuration

### Build Process
```bash
npm run build  # Builds static site + generates Netlify functions
```

### Generated Structure
```
out/                    # Static site files
netlify/functions/      # Serverless functions
├── health.js
├── track.js
├── contact.js
├── admin-packages.js
└── ... (12 total functions)
```

## 🔗 API Endpoints

All API routes are converted to Netlify functions:

- **Health Check**: `/.netlify/functions/health`
- **Package Tracking**: `/.netlify/functions/track`
- **Contact Form**: `/.netlify/functions/contact`
- **Admin Functions**: `/.netlify/functions/admin-*`

## 📋 Environment Variables

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_URL` | Site URL for authentication | `https://your-site.netlify.app` |
| `NEXTAUTH_SECRET` | JWT secret (32+ chars) | `your-super-secret-key-here` |
| `DATABASE_PATH` | SQLite database path | `/tmp/swiftship.db` |
| `ADMIN_EMAIL` | Admin login email | `admin@swiftship.com` |
| `ADMIN_PASSWORD` | Admin login password | `your-secure-password` |

### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `SEED_DATABASE` | Add sample data | `true` |
| `NODE_ENV` | Environment | `production` |

## 🗄️ Database

### SQLite Configuration
- **Development**: Local file storage
- **Production**: Ephemeral `/tmp` storage (resets on cold starts)
- **Initialization**: Automatic on first API call

### Production Considerations
For production use, consider external database:
- **PostgreSQL**: [Supabase](https://supabase.com), [Neon](https://neon.tech)
- **MySQL**: [PlanetScale](https://planetscale.com)
- **MongoDB**: [MongoDB Atlas](https://mongodb.com/atlas)

## 🔍 Monitoring

### Health Checks
- **Basic**: `/.netlify/functions/health`
- **Detailed**: `/.netlify/functions/health-detailed`
- **Diagnostics**: `/.netlify/functions/diagnostics`

### Function Logs
- Available in Netlify dashboard > Functions tab
- Real-time monitoring and debugging

## 🎯 Features

### ✅ Included Features
- Package tracking system
- Admin panel with authentication
- Contact form
- Responsive design
- Health monitoring
- Comprehensive diagnostics

### 📦 Sample Data
Includes sample shipment:
- **Tracking Number**: SW240567MXC
- **Customer**: Leovarda Franco Hesiquio
- **Status**: In Transit (Mexico City)

## 🔒 Security

### Built-in Security
- HTTPS by default
- Security headers configured
- CORS properly set up
- Environment variables protected

### Admin Access
- Navigate to `/admin`
- Use configured admin credentials
- Session-based authentication

## 🚀 Performance

### Optimization Features
- Static site generation
- Serverless functions
- Optimized images
- Efficient caching

### Limits (Free Tier)
- **Bandwidth**: 100GB/month
- **Functions**: 125,000 calls/month
- **Build minutes**: 300/month

## 🛠️ Development

### Local Development
```bash
npm install
npm run dev
# Site available at http://localhost:3000
```

### Testing Build
```bash
npm run build
# Check out/ directory for static files
# Check netlify/functions/ for serverless functions
```

## 📚 Documentation

### Available Guides
- `NETLIFY_DEPLOYMENT.md` - Detailed deployment steps
- `NETLIFY_CHECKLIST.md` - Deployment checklist
- `NETLIFY_RESTRUCTURE_SUMMARY.md` - Technical details

### API Documentation
All endpoints documented with examples and error handling.

## 🆘 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (18+)
   - Verify environment variables
   - Review build logs

2. **Function Errors**
   - Check function logs in dashboard
   - Verify database initialization
   - Test endpoints individually

3. **Database Issues**
   - Database resets on cold starts (expected)
   - Check `/tmp` directory permissions
   - Verify environment variables

### Getting Help
- Check Netlify documentation
- Review function logs
- Use diagnostic endpoints
- Contact support if needed

## ✅ Success Checklist

- [ ] Repository connected to Netlify
- [ ] Build settings configured
- [ ] Environment variables set
- [ ] First deployment successful
- [ ] Health checks passing
- [ ] Admin panel accessible
- [ ] Package tracking working
- [ ] Contact form functional

## 🎉 You're Ready!

Your SwiftShip application is now deployed on Netlify with full functionality including package tracking, admin management, and comprehensive monitoring.

**Live Site**: `https://your-site-name.netlify.app`
**Admin Panel**: `https://your-site-name.netlify.app/admin`
**Health Check**: `https://your-site-name.netlify.app/.netlify/functions/health`