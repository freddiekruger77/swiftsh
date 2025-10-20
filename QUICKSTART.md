# 🚀 SwiftShip Quick Start Guide

Get SwiftShip running in 5 minutes!

## Prerequisites

- Node.js 18+ and npm 8+
- Git

## 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-username/swiftship.git
cd swiftship

# Install dependencies and generate secrets
npm run setup
```

## 2. Configure Environment

```bash
# Copy environment template
cp .env.local.example .env.local

# Edit .env.local with your preferred settings
# The setup script above generated secure secrets for you
```

## 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 4. Test the Application

### Customer Features
- **Track Package**: Try tracking number `SW123456789`
- **Contact Form**: Submit a test message
- **Responsive Design**: Test on mobile/tablet

### Admin Features
- **Login**: Go to `/admin/login`
  - Email: `admin@swiftship.com`
  - Password: `admin123`
- **Dashboard**: View package statistics
- **Manage Packages**: Create and update packages
- **Handle Contacts**: Review customer messages

## 5. Deploy to Production

### Option A: Deploy to Vercel (Recommended)

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial SwiftShip setup"
git push origin main
```

2. **Deploy to Vercel**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Add environment variables (use the secrets from step 1)
- Deploy!

### Option B: Generate Production Secrets

```bash
npm run generate-secrets
```

Copy the generated values to your deployment platform.

## 🎯 What's Included

- ✅ **Package Tracking System** - Real-time tracking with status history
- ✅ **Admin Panel** - Complete package management interface
- ✅ **Authentication** - Secure admin login with NextAuth.js
- ✅ **Responsive Design** - Works on all devices
- ✅ **Error Handling** - Comprehensive error boundaries and validation
- ✅ **Database** - SQLite with sample data
- ✅ **API Endpoints** - RESTful APIs for all operations
- ✅ **Production Ready** - Optimized build and deployment config

## 📱 Demo Data

The application includes sample tracking numbers for testing:

| Tracking Number | Status | Description |
|----------------|--------|-------------|
| `SW123456789` | In Transit | Package moving to destination |
| `SW987654321` | Delivered | Successfully delivered |
| `SW456789123` | Out for Delivery | On delivery truck |
| `SW789123456` | Picked Up | Recently collected |
| `SW321654987` | Exception | Delivery issue |

## 🔧 Customization

### Change Admin Credentials
Edit `.env.local`:
```bash
ADMIN_EMAIL=your-email@company.com
ADMIN_PASSWORD=your-secure-password
```

### Disable Sample Data
Edit `.env.local`:
```bash
SEED_DATABASE=false
```

### Custom Styling
- Edit `styles/globals.css` for global styles
- Modify components in `components/` directory
- Update colors and branding as needed

## 📚 Next Steps

1. **Customize Branding**: Update colors, logos, and text
2. **Add Features**: Extend with email notifications, SMS, etc.
3. **Scale Database**: Migrate to PostgreSQL for production
4. **Add Analytics**: Integrate with Google Analytics or similar
5. **Monitor Errors**: Set up Sentry or error tracking

## 🆘 Need Help?

- **Documentation**: Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide
- **Health Check**: Visit `/api/health` to check system status
- **Issues**: Report bugs on GitHub Issues
- **Build Problems**: Run `npm run type-check` to check for TypeScript errors

## 🎉 You're Ready!

SwiftShip is now running and ready for customization. The application includes:

- Professional UI with smooth animations
- Complete package tracking workflow
- Admin management system
- Mobile-responsive design
- Production-ready deployment configuration

Happy shipping! 📦✨